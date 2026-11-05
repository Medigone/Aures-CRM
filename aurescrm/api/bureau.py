# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""API du poste de bureau (/bureau) : file de travail et traitement des tickets.

Couche mince : les règles métier restent dans les modules des DocTypes. Les listes passent par
`frappe.get_list` pour conserver les permissions ; un document est toujours contrôlé par `check_permission`,
et chaque écriture passe par `doc.save()` ou le workflow pour garder validations, hooks et historique.

Chaque action renvoie le ticket à jour. Elle reçoit la date `modified` affichée à l'écran : si le ticket a
changé entre-temps, l'action est refusée plutôt que d'écraser le travail d'un autre sans le dire.
"""

import json
import unicodedata

import frappe
from frappe import _
from frappe.model.workflow import apply_workflow, get_transitions
from frappe.utils import cint, cstr, escape_html, get_fullname, getdate, strip_html, today

from aurescrm.api import activity
from aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial import (
	CHECKLIST_TERMINE_FIELDS,
	default_niveau_urgence_pour_creation,
	get_cycle_documents,
	process_urgence_decision,
	save_ticket_rapprochement_decision,
	update_assigne_a,
)

TICKET = "Ticket Commercial"
BUREAU_ROLES = {"Administrateur Ventes", "System Manager"}
ROLE_BACK_OFFICE = "Administrateur Ventes"

STATUS_BLOCKED = "Blocage Créance"
STATUS_PAUSED = "Pending"
CLOSED_STATUSES = ("Terminé", "Annulé")
DECIDED = (
	"Devis retenu pour commande",
	"Nouvelle demande de faisabilité",
	"Aucun candidat pertinent",
)
WANTS_NEW_DEMANDE = "Nouvelle demande de faisabilité"
NO_CANDIDATE = "Aucun candidat pertinent"
CREANCE_OK = ("OK", "Déblocage autorisé")
URGENCE_RANK = {"U0": 0, "U1": 1, "U2": 2, "U3": 3}
# Le blocage passe par la carte Créance, qui exige un motif : pas de bouton de workflow pour lui.
HIDDEN_ACTIONS = {"Bloquer Créance"}

# Tailles de page : la file trie ici, sur toute la vue, puis ne calcule les étapes que de la page demandée.
DEFAULT_PAGE_LENGTH = 20
MAX_PAGE_LENGTH = 500

# Création d'un ticket.
CLIENT_COMMERCIAL_FIELD = "custom_commercial_attribué"
CLIENT_SEARCH_LIMIT = 8
COMMERCIAL_ROLES = ("Commercial Itinérant", "Commercial Sédentaire")

# Actions groupées : seulement ce qui ne demande ni saisie ni contrôle ticket par ticket, et reste réversible.
BULK_LIMIT = 100
BULK_ACTIONS = {"Démarrer", "Pause"}
BULK_SAVEPOINT = "bureau_bulk_item"

QUEUE_FIELDS = [
	"name",
	"customer",
	"customer_name",
	"request_type",
	"status",
	"echeance",
	"creation",
	"niveau_urgence",
	"niveau_urgence_demande",
	"statut_demande_urgence",
	"assigne_a",
	"assigne_a_nom",
	"modified",
	"commercial",
	"nom_commercial",
	"statut_creance",
	"_user_tags",
	"creation_date",
	"decision_rapprochement",
	"devis_rapproche",
	"demande_faisabilite_rapprochee",
	*sorted({fieldname for fields in CHECKLIST_TERMINE_FIELDS.values() for fieldname in fields}),
]

# Champs lus pour trier toute la vue : peu de colonnes, car elle peut compter des milliers de lignes.
QUEUE_ORDER_FIELDS = [
	"name",
	"customer",
	"customer_name",
	"request_type",
	"status",
	"echeance",
	"creation",
	"modified",
	"niveau_urgence",
	"niveau_urgence_demande",
	"statut_demande_urgence",
	"assigne_a_nom",
	"commercial",
	"nom_commercial",
	"statut_creance",
]

# Filtre de la file → (champ du ticket, nature de la valeur).
FILTER_FIELDS = {
	"client": ("customer_name", "text"),
	"commercial": ("nom_commercial", "text"),
	"type": ("request_type", "choice"),
	"status": ("status", "choice"),
	"urgence": ("niveau_urgence", "choice"),
	"creance": ("statut_creance", "choice"),
	"assigne": ("assigne_a", "user"),
	"echeance": ("echeance", "date"),
	"tag": ("_user_tags", "text"),
}
FILTER_OPERATORS = {
	"text": {"contient", "exclut"},
	"choice": {"est", "nest"},
	"user": {"est", "nest"},
	"date": {"avant", "apres", "vide"},
}
NOBODY = "__nobody__"


def can_access_bureau(user=None):
	user = user or frappe.session.user
	if user == "Guest":
		return False
	roles = set(frappe.get_roles(user))
	return "Administrator" in roles or bool(roles & BUREAU_ROLES)


def require_bureau():
	if not can_access_bureau():
		frappe.throw(_("Le poste de bureau est réservé au back office."), frappe.PermissionError)
	return frappe.session.user


def _is_open(status):
	return cstr(status) not in CLOSED_STATUSES


def view_filters(view, user):
	"""Filtres d'une vue de la file."""
	opened = ["status", "not in", list(CLOSED_STATUSES)]
	views = {
		"todo": [opened],
		"mine": [opened, ["assigne_a", "=", user]],
		"urgent": [opened, ["statut_demande_urgence", "=", "En attente"]],
		"creance": [["status", "=", STATUS_BLOCKED]],
		"closed": [["status", "in", list(CLOSED_STATUSES)]],
	}
	if view not in views:
		frappe.throw(_("Vue inconnue."))
	return views[view]


def condition_filters(conditions, fields=None):
	"""Traduit les filtres choisis dans une liste. Un filtre sans valeur est ignoré, sauf « sans échéance »."""
	filters = []
	for condition in conditions or []:
		field = (fields or FILTER_FIELDS).get(cstr(condition.get("field")))
		if not field:
			frappe.throw(_("Filtre inconnu."))
		fieldname, kind = field
		op = cstr(condition.get("op"))
		if op not in FILTER_OPERATORS[kind]:
			frappe.throw(_("Condition de filtre invalide."))
		if op == "vide":
			filters.append([fieldname, "is", "not set"])
			continue
		value = cstr(condition.get("value")).strip()
		if not value:
			continue
		if kind == "user" and value == NOBODY:
			filters.append([fieldname, "is", "not set" if op == "est" else "set"])
		elif op == "contient":
			filters.append([fieldname, "like", f"%{value}%"])
		elif op == "exclut":
			filters.append([fieldname, "not like", f"%{value}%"])
		elif op == "est":
			filters.append([fieldname, "=", value])
		elif op == "nest":
			filters.append([fieldname, "!=", value])
		elif op == "avant":
			filters.append([fieldname, "<", str(getdate(value))])
		elif op == "apres":
			filters.append([fieldname, ">", str(getdate(value))])
	return filters


def queue_level(ticket):
	"""Niveau de tri : une demande d'urgence en attente compte déjà."""
	level = URGENCE_RANK.get(cstr(ticket.get("niveau_urgence")), 0)
	if ticket.get("statut_demande_urgence") == "En attente":
		level = max(level, URGENCE_RANK.get(cstr(ticket.get("niveau_urgence_demande")), 0))
	return level


def queue_sort_key(ticket):
	return (-queue_level(ticket), cstr(ticket.get("echeance")) or "9999-12-31", cstr(ticket.get("creation")))


def _sort_text(value):
	"""Texte comparable : sans accents ni casse, pour que « Étui » se range avec les E."""
	decomposed = unicodedata.normalize("NFD", cstr(value))
	return "".join(char for char in decomposed if not unicodedata.combining(char)).casefold()


# Colonne triable → valeur de tri. L'étape n'y figure pas : elle se calcule ligne par ligne (`compute_steps`).
QUEUE_SORTS = {
	"client": lambda row: row.customer_name or row.customer,
	"type": lambda row: row.request_type,
	"status": lambda row: row.status,
	"urgence": queue_level,
	"echeance": lambda row: str(row.echeance) if row.echeance else None,
	"name": lambda row: row.name,
	"creance": lambda row: row.statut_creance,
	"commercial": lambda row: row.nom_commercial or row.commercial,
	"assigne": lambda row: row.assigne_a_nom,
}


def order_queue(rows, view, sort=None, direction=None):
	"""Ordre de la vue : la colonne choisie (lignes sans valeur à la fin), sinon urgence puis échéance."""
	if sort:
		value_of = QUEUE_SORTS.get(sort)
		if not value_of:
			frappe.throw(_("Tri inconnu : {0}").format(sort))
		filled, empty = [], []
		for row in rows:
			value = value_of(row)
			(empty if value in (None, "") else filled).append((_sort_text(value) if isinstance(value, str) else value, row))
		filled.sort(key=lambda pair: pair[0], reverse=direction == "desc")
		return [row for _value, row in filled] + [row for _value, row in empty]
	if view == "closed":
		return sorted(rows, key=lambda row: cstr(row.modified), reverse=True)
	return sorted(rows, key=queue_sort_key)


def page_bounds(total, start, page_length):
	"""Début et taille valides : une page devenue vide ramène à la dernière page qui existe."""
	length = min(max(cint(page_length) or DEFAULT_PAGE_LENGTH, 1), MAX_PAGE_LENGTH)
	first = max(cint(start), 0)
	if first >= total:
		first = max(total - 1, 0) // length * length
	return first, length


def _search_filters(search):
	value = cstr(search).strip()
	if not value:
		return None
	pattern = f"%{value}%"
	return [["customer_name", "like", pattern], ["customer", "like", pattern], ["name", "like", pattern]]


def _parse(value):
	return json.loads(value) if isinstance(value, str) and value else value


def row_tags(row):
	"""Tags d'une ligne de liste : la colonne `_user_tags` les range sous la forme « ,tag1,tag2 »."""
	return [tag for tag in cstr(row.get("_user_tags")).split(",") if tag]


def _queue_row(ticket, user, current_day, cycle=None, commande=None):
	echeance = str(ticket.echeance) if ticket.get("echeance") else None
	return {
		"name": ticket.name,
		"modified": str(ticket.modified),
		"tags": row_tags(ticket),
		"client": ticket.customer_name or ticket.customer,
		"commercial": ticket.nom_commercial or ticket.commercial,
		"request_type": ticket.request_type,
		"status": ticket.status,
		"statut_creance": ticket.statut_creance,
		"step": _queue_step(compute_steps(ticket, cycle, commande)),
		"echeance": echeance,
		"is_late": bool(echeance and echeance < current_day and _is_open(ticket.status)),
		"niveau_urgence": ticket.niveau_urgence or "U0",
		"urgence_en_attente": ticket.statut_demande_urgence == "En attente" and _is_open(ticket.status),
		"niveau_urgence_demande": ticket.niveau_urgence_demande,
		"assigne_a": ticket.assigne_a,
		"assigne_a_nom": ticket.assigne_a_nom,
		"mine": ticket.assigne_a == user,
	}


def _queue_step(timeline):
	"""Résumé de la timeline pour une ligne de la file."""
	steps = timeline["steps"]
	current = timeline["current"]
	return {
		"label": steps[current if current is not None else -1]["label"],
		"current": current,
		"done": sum(1 for step in steps if step["state"] == "done"),
		"total": len(steps),
	}


def _queue_documents(tickets):
	"""Documents du cycle de chaque ligne, lus en une fois : la file peut compter 500 tickets.

	Renvoie, par ticket, ce dont `compute_steps` a besoin et qui donne le même résultat que `get_cycle_documents`.
	"""
	names = [ticket.name for ticket in tickets]
	if not names:
		return {}, {}
	cycles = {name: {"demandes": [], "dossiers": []} for name in names}

	dossiers = frappe.get_all(
		"Dossier Essai Blanc",
		filters={"ticket_commercial": ["in", names]},
		fields=["name", "status", "ticket_commercial"],
		order_by="modified desc",
	)
	for dossier in dossiers:
		cycles[dossier.ticket_commercial]["dossiers"].append(dossier)

	demandes = frappe.get_all(
		"Demande Faisabilite",
		filters={"ticket_commercial": ["in", names]},
		fields=["name", "status", "ticket_commercial"],
		order_by="modified desc",
	)
	orders_by_demande = {}
	if demandes:
		orders = frappe.get_all(
			"Sales Order",
			filters={"custom_demande_de_faisabilité": ["in", [demande.name for demande in demandes]], "docstatus": ["!=", 2]},
			fields=["name", "status", "docstatus", "custom_demande_de_faisabilité as demande"],
		)
		for order in orders:
			orders_by_demande.setdefault(order.demande, []).append({**order, "doctype": "Sales Order"})
	for demande in demandes:
		cycles[demande.ticket_commercial]["demandes"].append(
			{"name": demande.name, "status": demande.status, "sales_documents": orders_by_demande.get(demande.name, [])}
		)

	devis = {ticket.name: ticket.devis_rapproche for ticket in tickets if ticket.request_type == "Bon de commande" and ticket.devis_rapproche}
	orders_by_devis = {}
	if devis:
		orders = frappe.get_all(
			"Sales Order",
			filters={"custom_devis": ["in", list(set(devis.values()))], "docstatus": ["!=", 2]},
			fields=["name", "status", "docstatus", "custom_devis"],
			order_by="modified asc",
		)
		# Tri croissant : la commande la plus récente de chaque devis reste, comme dans `_commande_for_devis`.
		orders_by_devis = {order.custom_devis: order for order in orders}
	commandes = {name: orders_by_devis.get(quotation) for name, quotation in devis.items()}
	return cycles, commandes


@frappe.whitelist()
def get_queue(view="todo", conditions=None, search=None, start=0, page_length=DEFAULT_PAGE_LENGTH, sort=None, direction=None):
	"""Une page de la file, le total et l'ordre de toute la vue, et les compteurs de toutes les vues pour les mêmes filtres."""
	user = require_bureau()
	base = condition_filters(_parse(conditions))
	or_filters = _search_filters(search)

	counts = {}
	for name in ("todo", "mine", "urgent", "creance", "closed"):
		rows = frappe.get_list(
			TICKET,
			filters=base + view_filters(name, user),
			or_filters=or_filters,
			fields=["count(name) as total"],
			limit_page_length=0,
		)
		counts[name] = rows[0].total if rows else 0

	ordered = order_queue(
		frappe.get_list(
			TICKET,
			filters=base + view_filters(view, user),
			or_filters=or_filters,
			fields=QUEUE_ORDER_FIELDS,
			limit_page_length=0,
		),
		view,
		sort,
		direction,
	)
	names = [row.name for row in ordered]
	first, length = page_bounds(len(names), start, page_length)
	page_names = names[first : first + length]

	# Les étapes coûtent cher : seules les lignes de la page les calculent.
	tickets = frappe.get_list(TICKET, filters=[["name", "in", page_names]], fields=QUEUE_FIELDS, limit_page_length=0) if page_names else []
	position = {name: index for index, name in enumerate(page_names)}
	tickets.sort(key=lambda ticket: position[ticket.name])

	current_day = today()
	cycles, commandes = _queue_documents(tickets)
	comments = activity.comment_counts(TICKET, page_names)
	return {
		"tickets": [
			{
				**_queue_row(ticket, user, current_day, cycles.get(ticket.name), commandes.get(ticket.name)),
				"comments": comments.get(ticket.name, 0),
			}
			for ticket in tickets
		],
		"counts": counts,
		"total": len(names),
		"start": first,
		"page_length": length,
		# Toute la vue, pour aller au ticket voisin depuis la fiche, au-delà de la page affichée.
		"names": names,
	}


def _select_options(fieldname):
	return [option for option in (frappe.get_meta(TICKET).get_field(fieldname).options or "").split("\n") if option]


@frappe.whitelist()
def get_references():
	"""Valeurs proposées dans les filtres de la file."""
	require_bureau()
	users = _back_office_users()
	return {
		"types": _select_options("request_type"),
		"statuses": _select_options("status"),
		"urgences": _select_options("niveau_urgence"),
		"creances": _select_options("statut_creance"),
		"assignees": [{"value": user.name, "label": user.full_name or user.name} for user in users],
		"nobody": NOBODY,
	}


def _format_day(value):
	return getdate(value).strftime("%d/%m/%Y") if value else ""


def _active_demandes(cycle):
	return [demande for demande in cycle.get("demandes") or [] if demande.get("status") != "Annulée"]


def _commande_from_cycle(cycle):
	"""Commande non annulée parmi les documents de vente du cycle."""
	for group in (cycle.get("demandes") or []) + (cycle.get("dossiers") or []):
		for document in group.get("sales_documents") or []:
			if document.get("doctype") == "Sales Order" and cint(document.get("docstatus")) != 2:
				return document
	return None


def _reference(document):
	return f"{document.get('name')} · {document.get('status')}" if document else ""


def compute_steps(ticket, cycle=None, commande=None):
	"""Étapes de la timeline, selon le type de ticket et l'état réel de ses documents.

	Source unique du calcul : la file, l'écran et les futurs rapports donnent ainsi la même réponse.
	La timeline guide sans imposer d'ordre : seules les règles du serveur bloquent une action.
	"""
	cycle = cycle or {}
	status = cstr(ticket.get("status"))
	request_type = cstr(ticket.get("request_type"))
	closed = status in CLOSED_STATUSES
	checks = CHECKLIST_TERMINE_FIELDS.get(request_type, ())
	checked = sum(1 for fieldname in checks if cint(ticket.get(fieldname)))

	received = {"key": "recu", "label": "Ticket reçu", "done": True, "detail": _format_day(ticket.get("creation_date"))}
	started = {
		"key": "charge",
		"label": "Pris en charge",
		"done": status != "Nouveau",
		"detail": cstr(ticket.get("assigne_a_nom")),
	}
	finish = {
		"key": "fin",
		"label": "Annulé" if status == "Annulé" else "Terminé",
		"done": closed,
		"detail": f"Liste de contrôle {checked}/{len(checks)}" if checks else "",
	}
	demandes = _active_demandes(cycle)

	if request_type == "Bon de commande":
		decision = cstr(ticket.get("decision_rapprochement"))
		devis = cstr(ticket.get("devis_rapproche"))
		order = commande or _commande_from_cycle(cycle)
		if decision == WANTS_NEW_DEMANDE:
			demande_name = cstr(ticket.get("demande_faisabilite_rapprochee"))
			demande = next((d for d in demandes if d.get("name") == demande_name), None) or (demandes[0] if demandes else None)
			document = {"key": "doc", "label": "Demande de faisabilité", "done": bool(demande), "detail": _reference(demande)}
		else:
			document = {
				"key": "doc",
				"label": "Commande" if devis else "Commande ou demande",
				"done": bool(order),
				"detail": _reference(order),
			}
		decision_detail = devis or {WANTS_NEW_DEMANDE: "Nouvelle demande", NO_CANDIDATE: "Aucun candidat"}.get(decision, "")
		steps = [
			received,
			started,
			{
				"key": "creance",
				"label": "Créance vérifiée",
				"done": cstr(ticket.get("statut_creance")) in CREANCE_OK,
				"blocked": status == STATUS_BLOCKED,
				"detail": cstr(ticket.get("statut_creance")) or "Non vérifiée",
			},
			{"key": "rappro", "label": "Rapprochement", "done": decision in DECIDED, "detail": decision_detail},
			document,
			finish,
		]
	elif request_type == "Demande de devis":
		steps = [
			received,
			started,
			{"key": "check", "label": "Articles vérifiés", "done": bool(cint(ticket.get("checklist_dd_articles")))},
			{
				"key": "doc",
				"label": "Demande de faisabilité",
				"done": bool(demandes),
				"detail": _reference(demandes[0]) if demandes else "",
			},
			{
				"key": "confirm",
				"label": "Demande confirmée",
				"done": any(d.get("status") != "Brouillon" for d in demandes),
			},
			finish,
		]
	elif request_type == "Essai Blanc":
		dossiers = cycle.get("dossiers") or []
		steps = [
			received,
			started,
			{"key": "check", "label": "Articles vérifiés", "done": bool(cint(ticket.get("checklist_eb_articles")))},
			{
				"key": "doc",
				"label": "Dossier essai à blanc",
				"done": bool(dossiers),
				"detail": _reference(dossiers[0]) if dossiers else "",
			},
			finish,
		]
	elif request_type == "Réclamation":
		steps = [
			received,
			started,
			{"key": "check", "label": "Photo", "done": bool(cint(ticket.get("checklist_rec_photo")))},
			{"key": "check", "label": "Quantités impactées", "done": bool(cint(ticket.get("checklist_rec_quantites")))},
			finish,
		]
	else:
		steps = [received, started, finish]

	current = None if closed else next((index for index, step in enumerate(steps) if not step["done"]), None)
	output = []
	for index, step in enumerate(steps):
		if step["done"]:
			state = "done"
		elif step.get("blocked"):
			state = "blocked"
		elif index == current:
			state = "paused" if status == STATUS_PAUSED else "current"
		else:
			state = "todo"
		detail = "En pause" if state == "paused" else cstr(step.get("detail"))
		output.append({"key": step["key"], "label": step["label"], "state": state, "detail": detail})
	return {"steps": output, "current": current}


def _ticket_documents(name, user, is_open=True):
	"""Fichiers joints au ticket. Le droit de lecture sur le ticket est contrôlé par l'appelant, comme sur le Desk."""
	files = frappe.get_all(
		"File",
		filters={"attached_to_doctype": TICKET, "attached_to_name": name, "is_folder": 0},
		fields=["name", "file_name", "file_url", "owner", "creation"],
		order_by="creation asc",
	)
	return [
		{
			"name": file.name,
			"file_name": file.file_name or file.file_url,
			"file_url": file.file_url,
			"owner_name": get_fullname(file.owner),
			"creation": str(file.creation),
			"can_remove": bool(is_open and file.owner == user),
		}
		for file in files
	]


def _commande_for_devis(devis):
	"""Commande issue du devis retenu : ce devis peut venir d'une demande non liée à ce ticket."""
	if not devis:
		return None
	rows = frappe.get_all(
		"Sales Order",
		filters={"custom_devis": devis, "docstatus": ["!=", 2]},
		fields=["name", "status", "docstatus"],
		order_by="modified desc",
		limit_page_length=1,
	)
	return rows[0] if rows else None


def _site_title(site):
	if not site:
		return None
	title_field = frappe.get_meta("Site Production").title_field
	return (frappe.db.get_value("Site Production", site, title_field) if title_field else None) or site


def _available_actions(doc):
	"""Actions du workflow que cet utilisateur peut lancer sur ce ticket, dans leur ordre de définition."""
	actions = []
	for transition in get_transitions(doc):
		if transition.action not in actions and transition.action not in HIDDEN_ACTIONS:
			actions.append(transition.action)
	return actions


@frappe.whitelist()
def get_ticket(name):
	"""Ticket complet pour l'écran de traitement : champs, étapes, actions, documents et cycle."""
	user = require_bureau()
	doc = frappe.get_doc(TICKET, name)
	doc.check_permission("read")

	cycle = get_cycle_documents(doc.name)
	commande = _commande_for_devis(doc.devis_rapproche) if doc.request_type == "Bon de commande" else None
	timeline = compute_steps(doc.as_dict(), cycle, commande)
	meta = frappe.get_meta(TICKET)
	echeance = str(doc.echeance) if doc.echeance else None
	can_write = bool(doc.has_permission("write"))

	return {
		"name": doc.name,
		"modified": str(doc.modified),
		"tags": row_tags(doc.as_dict()),
		"can_write": can_write,
		"actions": _available_actions(doc) if can_write else [],
		"request_type": doc.request_type,
		"status": doc.status,
		"customer": doc.customer,
		"client": doc.customer_name or doc.customer,
		"commercial": doc.nom_commercial or doc.commercial,
		"site": _site_title(doc.site),
		"priority": doc.priority,
		"echeance": echeance,
		"is_late": bool(echeance and echeance < today() and _is_open(doc.status)),
		"creation_date": str(doc.creation_date) if doc.creation_date else None,
		"assigne_a": doc.assigne_a,
		"assigne_a_nom": doc.assigne_a_nom,
		"mine": doc.assigne_a == user,
		"description": doc.description,
		"niveau_urgence": doc.niveau_urgence or "U0",
		"niveau_urgence_demande": doc.niveau_urgence_demande,
		"statut_demande_urgence": doc.statut_demande_urgence,
		"descr_urgence": doc.descr_urgence,
		"commentaire_validation_urgence": doc.commentaire_validation_urgence,
		"statut_creance": doc.statut_creance,
		"motif_blocage_creance": doc.motif_blocage_creance,
		"creance_verifiee_par": get_fullname(doc.creance_verifiee_par) if doc.creance_verifiee_par else None,
		"decision_rapprochement": doc.decision_rapprochement,
		"commentaire_rapprochement": doc.commentaire_rapprochement,
		"devis_rapproche": doc.devis_rapproche,
		"demande_faisabilite_rapprochee": doc.demande_faisabilite_rapprochee,
		"checklist": [
			{
				"fieldname": fieldname,
				"label": _(meta.get_label(fieldname)),
				"checked": bool(cint(doc.get(fieldname))),
			}
			for fieldname in CHECKLIST_TERMINE_FIELDS.get(cstr(doc.request_type), ())
		],
		"steps": timeline["steps"],
		"current_step": timeline["current"],
		"documents": _ticket_documents(doc.name, user, _is_open(doc.status)),
		"cycle": cycle,
		"commande": commande,
		"comments": activity.comment_summary(TICKET, doc.name),
	}


def _ticket_for_write(name, modified):
	"""Ticket à modifier : droit d'écriture, et version identique à celle affichée à l'écran."""
	require_bureau()
	doc = frappe.get_doc(TICKET, name)
	doc.check_permission("write")
	if modified and cstr(modified) != str(doc.modified):
		frappe.throw(
			_("Ce ticket vient d'être modifié par ailleurs. Il a été rechargé : vérifiez-le, puis recommencez."),
			frappe.TimestampMismatchError,
		)
	return doc


@frappe.whitelist(methods=["POST"])
def run_action(name, modified, action):
	"""Lance une action du workflow (Démarrer, Pause, Reprendre, Débloquer Créance, Terminer, Annuler)."""
	apply_workflow(_ticket_for_write(name, modified), cstr(action))
	return get_ticket(name)


@frappe.whitelist(methods=["POST"])
def set_creance(name, modified, statut, motif=None):
	"""Statut créance d'un bon de commande. `Bloquée` exige un motif et passe le ticket en Blocage Créance."""
	doc = _ticket_for_write(name, modified)
	if doc.request_type != "Bon de commande":
		frappe.throw(_("La créance ne concerne que les tickets de type Bon de commande."))
	doc.statut_creance = cstr(statut)
	if motif is not None:
		doc.motif_blocage_creance = cstr(motif).strip() or None
	doc.save()
	return get_ticket(name)


@frappe.whitelist(methods=["POST"])
def set_checklist(name, modified, fieldname, checked):
	"""Coche ou décoche un élément de la liste de contrôle du type de ticket."""
	doc = _ticket_for_write(name, modified)
	if fieldname not in CHECKLIST_TERMINE_FIELDS.get(cstr(doc.request_type), ()):
		frappe.throw(_("Cet élément n'appartient pas à la liste de contrôle de ce ticket."))
	doc.set(fieldname, 1 if cint(checked) else 0)
	doc.save()
	return get_ticket(name)


@frappe.whitelist(methods=["POST"])
def decide_urgence(name, modified, action, niveau=None, commentaire=None):
	"""Valide ou refuse la demande d'urgence, selon les règles de `process_urgence_decision`."""
	_ticket_for_write(name, modified)
	process_urgence_decision(name, action, niveau, commentaire)
	return get_ticket(name)


@frappe.whitelist(methods=["POST"])
def decide_rapprochement(name, modified, decision=None, devis=None, commentaire=None):
	"""Enregistre la décision de rapprochement, selon les règles de `save_ticket_rapprochement_decision`."""
	_ticket_for_write(name, modified)
	save_ticket_rapprochement_decision(name, decision or "", devis, None, commentaire)
	return get_ticket(name)


def _back_office_users():
	members = frappe.get_all("Has Role", filters={"role": ROLE_BACK_OFFICE, "parenttype": "User"}, pluck="parent")
	return frappe.get_all(
		"User",
		filters={"name": ["in", members or [""]], "enabled": 1},
		fields=["name", "full_name"],
		order_by="full_name asc",
	)


def _check_assignable(user):
	if user != frappe.session.user and user not in {row.name for row in _back_office_users()}:
		frappe.throw(_("Ce ticket ne peut être attribué qu'à une personne du back office."))


def _assign(doc, user):
	"""Attribue le ticket. Renvoie le message d'échec, ou None."""
	result = update_assigne_a(doc.name, user)
	if result.get("status") != "success":
		return result.get("message") or _("Attribution impossible.")
	# `update_assigne_a` écrit sans déclencher `on_change` : les collègues doivent quand même le voir.
	from aurescrm.bureau_events import on_change  # bureau_events importe ce module

	on_change(doc)
	return None


@frappe.whitelist(methods=["POST"])
def set_assignee(name, user):
	"""Attribue le ticket à une personne du back office."""
	require_bureau()
	_check_assignable(user)
	doc = frappe.get_doc(TICKET, name)
	failure = _assign(doc, user)
	if failure:
		frappe.throw(failure)
	return get_ticket(name)


def _bulk_apply(items, apply, load=None):
	"""Applique une écriture à chaque document, séparément : un refus n'empêche pas de traiter les autres.

	`items` : [{name, modified}] tels qu'affichés dans la liste. `load(name, modified)` charge le document et contrôle
	droits et version (un ticket par défaut). `apply(doc)` renvoie la raison de ne pas le traiter, ou None. Chaque
	document est validé à part, pour qu'une requête interrompue garde ce qui est déjà fait.
	"""
	load = load or _ticket_for_write
	rows = _parse(items) or []
	if not rows:
		frappe.throw(_("Aucune ligne sélectionnée."))
	if len(rows) > BULK_LIMIT:
		frappe.throw(_("Sélectionnez au plus {0} lignes à la fois.").format(BULK_LIMIT))

	done, skipped = [], []
	for row in rows:
		name = cstr(row.get("name"))
		frappe.db.savepoint(BULK_SAVEPOINT)
		try:
			reason = apply(load(name, row.get("modified")))
		except (frappe.ValidationError, frappe.PermissionError) as error:
			frappe.db.rollback(save_point=BULK_SAVEPOINT)
			reason = strip_html(cstr(error)) or _("Action refusée.")
		except Exception:
			frappe.db.rollback(save_point=BULK_SAVEPOINT)
			frappe.log_error(title=f"Poste de bureau : action groupée sur {name}")
			reason = _("Erreur inattendue.")
		# Les messages d'un document ne doivent pas remonter comme une erreur de toute la requête.
		frappe.clear_messages()
		if reason:
			skipped.append({"name": name, "reason": reason})
		else:
			done.append(name)
		frappe.db.commit()
	return {"done": done, "skipped": skipped}


@frappe.whitelist(methods=["POST"])
def bulk_assign(items, user):
	"""Attribue plusieurs tickets ouverts à une personne du back office."""
	require_bureau()
	_check_assignable(user)

	def apply(doc):
		return _("Ticket clos.") if not _is_open(doc.status) else _assign(doc, user)

	return _bulk_apply(items, apply)


@frappe.whitelist(methods=["POST"])
def bulk_action(items, action):
	"""Lance une même action du workflow sur plusieurs tickets. Seuls ceux à qui elle s'applique sont traités."""
	require_bureau()
	action = cstr(action)
	if action not in BULK_ACTIONS:
		frappe.throw(_("Cette action ne se lance pas sur plusieurs tickets."))

	def apply(doc):
		if action not in _available_actions(doc):
			return _("Action non disponible pour ce ticket.")
		apply_workflow(doc, action)
		return None

	return _bulk_apply(items, apply)


@frappe.whitelist(methods=["POST"])
def remove_document(name, file):
	"""Retire un fichier que l'utilisateur a lui-même joint à ce ticket, tant que le ticket est ouvert."""
	user = require_bureau()
	doc = frappe.get_doc(TICKET, name)
	doc.check_permission("write")
	row = frappe.db.get_value(
		"File", file, ["attached_to_doctype", "attached_to_name", "owner"], as_dict=True
	)
	if not row or row.attached_to_doctype != TICKET or row.attached_to_name != doc.name:
		frappe.throw(_("Ce fichier n'est pas joint à ce ticket."))
	if row.owner != user:
		frappe.throw(_("Seule la personne qui a joint ce fichier peut le retirer."), frappe.PermissionError)
	if not _is_open(doc.status):
		frappe.throw(_("Les fichiers d'un ticket clos ne peuvent plus être retirés."))
	# Droits contrôlés ci-dessus : le rôle n'a pas forcément de droit direct sur le DocType File.
	frappe.delete_doc("File", file, ignore_permissions=True)
	return get_ticket(name)


def _commercial_users():
	members = frappe.get_all("Has Role", filters={"role": ["in", list(COMMERCIAL_ROLES)], "parenttype": "User"}, pluck="parent")
	return frappe.get_all(
		"User",
		filters={"name": ["in", members or [""]], "enabled": 1, "user_type": "System User"},
		fields=["name", "full_name"],
		order_by="full_name asc",
	)


@frappe.whitelist()
def get_ticket_form_options():
	"""Listes de la fenêtre de création. L'urgence de chaque type reprend la règle appliquée à l'enregistrement."""
	require_bureau()
	return {
		"types": [{"value": value, "urgence": default_niveau_urgence_pour_creation(value)} for value in _select_options("request_type")],
		"channels": _select_options("channel"),
		"sites": [
			{"value": site.name, "label": site.title or site.name}
			for site in frappe.get_list("Site Production", fields=["name", "title"], order_by="title asc", limit_page_length=0)
		],
		"commercials": [{"value": user.name, "label": user.full_name or user.name} for user in _commercial_users()],
	}


@frappe.whitelist()
def search_clients(search=None):
	"""Clients proposés à la création, avec leur commercial et leurs tickets ouverts pour repérer un doublon."""
	require_bureau()
	value = cstr(search).strip()
	pattern = f"%{value}%"
	clients = frappe.get_list(
		"Customer",
		filters={"disabled": 0},
		or_filters=[["customer_name", "like", pattern], ["name", "like", pattern], ["custom_wilaya", "like", pattern]] if value else None,
		fields=["name", "customer_name", "custom_wilaya", CLIENT_COMMERCIAL_FIELD],
		order_by="customer_name asc",
		limit_page_length=CLIENT_SEARCH_LIMIT,
	)
	names = [client.name for client in clients]
	open_tickets = {}
	if names:
		rows = frappe.get_list(
			TICKET,
			filters={"customer": ["in", names], "status": ["not in", CLOSED_STATUSES]},
			fields=["customer", "count(name) as total"],
			group_by="customer",
			limit_page_length=0,
		)
		open_tickets = {row.customer: row.total for row in rows}
	return [
		{
			"name": client.name,
			"label": client.customer_name or client.name,
			"wilaya": client.custom_wilaya,
			"commercial": client.get(CLIENT_COMMERCIAL_FIELD),
			"commercial_name": get_fullname(client.get(CLIENT_COMMERCIAL_FIELD)) if client.get(CLIENT_COMMERCIAL_FIELD) else None,
			"open_tickets": open_tickets.get(client.name, 0),
		}
		for client in clients
	]


def _description_html(text):
	paragraphs = [escape_html(paragraph.strip()).replace("\n", "<br>") for paragraph in cstr(text).split("\n\n") if paragraph.strip()]
	return "".join(f"<p>{paragraph}</p>" for paragraph in paragraphs)


@frappe.whitelist(methods=["POST"])
def create_ticket(customer=None, request_type=None, site=None, description=None, commercial=None, channel=None, echeance=None):
	"""Crée un ticket. Le commercial est par défaut celui du client : le ticket apparaît ainsi dans son suivi."""
	require_bureau()
	for value, label in ((customer, _("Le client")), (request_type, _("Le type de demande")), (site, _("Le site de production"))):
		if not cstr(value).strip():
			frappe.throw(_("{0} est obligatoire.").format(label))
	if not cstr(description).strip():
		frappe.throw(_("Décrivez la demande."))
	assigned = frappe.db.get_value("Customer", customer, CLIENT_COMMERCIAL_FIELD)
	if commercial and commercial != assigned and commercial not in {user.name for user in _commercial_users()}:
		frappe.throw(_("Choisissez un commercial de la liste."))
	doc = frappe.get_doc(
		{
			"doctype": TICKET,
			"customer": customer,
			"request_type": request_type,
			"site": site,
			"priority": "Moyenne",
			# Sans cela, un rôle exempté de la règle d'urgence garderait la valeur par défaut du champ (U0).
			"niveau_urgence": default_niveau_urgence_pour_creation(request_type),
			"channel": channel or None,
			"echeance": echeance or None,
			"description": _description_html(description),
			"commercial": commercial or assigned or frappe.session.user,
		}
	)
	doc.insert()
	return {"name": doc.name}


@frappe.whitelist()
def get_activity(name):
	"""Commentaires et activité du ticket : les mêmes que sur le Desk."""
	require_bureau()
	return activity.get_feed(TICKET, name)


@frappe.whitelist()
def get_mention_candidates():
	require_bureau()
	return activity.mention_candidates()


@frappe.whitelist(methods=["POST"])
def add_comment(name, text, mentions=None):
	require_bureau()
	return activity.add_comment(TICKET, name, text, mentions)


@frappe.whitelist(methods=["POST"])
def update_comment(name, comment, text, mentions=None):
	require_bureau()
	return activity.update_comment(TICKET, name, comment, text, mentions)


@frappe.whitelist(methods=["POST"])
def delete_comment(name, comment):
	require_bureau()
	return activity.delete_comment(TICKET, name, comment)
