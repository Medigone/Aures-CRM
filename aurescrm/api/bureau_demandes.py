# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Demandes de faisabilité du poste de bureau (/bureau/demandes) : liste, fiche, création et cycle.

Même contrat que `bureau_clients.py` et `bureau_articles.py` : les listes passent par `frappe.get_list`, chaque écriture
passe par `doc.insert()` ou `doc.save()`, et une action reçoit la date `modified` affichée à l'écran.

Les méthodes de `demande_faisabilite.py` restent la seule source des règles métier. Certaines n'ont pas de contrôle
de droits ou de statut (le Desk ne les vérifie que dans le navigateur) : les actions d'ici les posent avant de les appeler.
"""

import frappe
from frappe import _
from frappe.utils import add_days, cint, cstr, flt, getdate, today

from aurescrm.api import activity
from aurescrm.api.bureau import (
	BELL_FIELD,
	CLOSED_STATUSES,
	TICKET,
	_parse,
	condition_filters,
	doctype_filter_fields,
	has_child_filter,
	page_bounds,
	require_bureau,
	row_bell,
	row_tags,
	ticket_demande_state,
)
from aurescrm.api.bureau_articles import ITEM, PROCEDE_FIELD, _customers, format_label, last_bats, support_label
from aurescrm.aures_crm.doctype.demande_faisabilite.demande_faisabilite import (
	FAISABILITE_PROCEDES,
	_user_can_create_devis_from_demande,
	cancel_etudes_faisabilite,
	create_quotation_with_calculs,
	duplicate_demande_for_reprint,
	generate_etude_faisabilite,
)

DEMANDE = "Demande Faisabilite"
LIGNES = "Articles Demande Faisabilite"
ETUDES = ("Etude Faisabilite", "Etude Faisabilite Flexo")

BROUILLON = "Brouillon"
FERMEE = "Fermée"
RETIRAGE = "Retirage"
ESSAI_BLANC = "Essai Blanc"
TYPES = ("Premier Tirage", RETIRAGE, ESSAI_BLANC)

# Mêmes conditions que les boutons de `demande_faisabilite.js`.
CANCELLABLE = ("Confirmée", "En Cours", "Partiellement Finalisée", "Finalisée")
DEVIS_ALLOWED = ("Finalisée", "Devis Établis", "Partiellement Finalisée")
CLOSABLE = ("Finalisée", "Devis Établis")
REPRINTABLE = ("Commandé",)
BLOCKS_CANCEL = ("Réalisable", "Non Réalisable")

DEFAULT_DELAY_DAYS = 7

LIST_FIELDS = [
	"name",
	"modified",
	"status",
	"type",
	"client",
	"ticket_commercial",
	"niveau_urgence",
	"commercial",
	"date_livraison",
	"date_creation",
	"n_bon_commande",
	"cree_par",
	"_user_tags",
	BELL_FIELD,
]

VIEW_STATUSES = {
	"confirm": (BROUILLON,),
	"etude": ("Confirmée", "En Cours", "Partiellement Finalisée"),
	"chiffrer": ("Finalisée",),
	"devis": ("Devis Établis",),
	"commande": ("Commandé",),
	"closes": (FERMEE, "Annulée"),
}
VIEWS = ("all", *VIEW_STATUSES)
SORT_KEYS = {"name", "client_label", "articles", "type", "status", "procede", "urgence", "livraison", "commercial", "ticket", "bon_commande", "creation", "cree_par"}


def _in_view(view, row):
	return view == "all" or row["status"] in VIEW_STATUSES[view]


def _lines_by_demande(names):
	"""Lignes d'articles par demande : les demandes sont déjà lisibles, c'est leur contenu."""
	if not names:
		return {}
	rows = frappe.get_all(
		LIGNES,
		filters={"parent": ["in", names], "parenttype": DEMANDE},
		fields=["parent", "article", "designation_article", "quantite", "procede_article"],
		order_by="idx asc",
	)
	lines = {}
	for row in rows:
		lines.setdefault(row.parent, []).append(row)
	return lines


def _day(value):
	return str(value) if value else None


def _list_row(demande, customers, lines):
	rows = lines.get(demande.name) or []
	first = rows[0] if rows else None
	procedes = sorted({row.procede_article for row in rows if row.procede_article})
	return {
		"name": demande.name,
		"modified": str(demande.modified),
		"tags": row_tags(demande),
		"cloche": row_bell(demande),
		"status": demande.status,
		"type": demande.type,
		"client": demande.client,
		"client_label": (customers.get(demande.client) or {}).get("customer_name") or demande.client,
		"articles": (first.designation_article or first.article) if first else None,
		"articles_count": len(rows),
		"procede": ", ".join(procedes) or None,
		"urgence": demande.niveau_urgence or "U0",
		"livraison": _day(demande.date_livraison),
		"commercial": demande.commercial,
		"ticket": demande.ticket_commercial,
		"bon_commande": demande.n_bon_commande,
		"creation": _day(demande.date_creation),
		"cree_par": demande.cree_par,
		# Recherche seulement : retirée avant l'envoi.
		"_search": " ".join(
			cstr(value)
			for value in (
				demande.name,
				demande.client,
				(customers.get(demande.client) or {}).get("customer_name"),
				demande.ticket_commercial,
				demande.n_bon_commande,
				demande.commercial,
				*[f"{row.article} {row.designation_article}" for row in rows],
			)
		).casefold(),
	}


def order_demandes(rows, sort=None, direction=None):
	"""Les plus récentes d'abord, ou par la colonne demandée. Une ligne sans valeur reste à la fin, dans les deux sens."""
	ordered = sorted(rows, key=lambda row: (cstr(row["creation"]), row["name"]), reverse=True)
	if sort not in SORT_KEYS:
		return ordered
	filled = [row for row in ordered if row.get(sort) not in (None, "")]
	empty = [row for row in ordered if row.get(sort) in (None, "")]
	return sorted(filled, key=lambda row: cstr(row[sort]).casefold(), reverse=cstr(direction) == "desc") + empty


@frappe.whitelist()
def get_demandes(view="all", conditions=None, search=None, start=0, page_length=None, sort=None, direction=None):
	"""Une page de la liste, le total, l'ordre de toute la vue, et les compteurs de toutes les vues pour les mêmes filtres."""
	require_bureau()
	if view not in VIEWS:
		frappe.throw(_("Vue inconnue."))
	conditions = condition_filters(_parse(conditions), DEMANDE)
	demandes = frappe.get_list(DEMANDE, filters=conditions, distinct=has_child_filter(conditions, DEMANDE), fields=LIST_FIELDS, limit_page_length=0)
	customers = _customers(demande.client for demande in demandes)
	lines = _lines_by_demande([demande.name for demande in demandes])
	rows = [_list_row(demande, customers, lines) for demande in demandes]
	# Le client et les articles ne sont pas des champs de la demande : la recherche se fait sur les lignes construites.
	words = cstr(search).casefold().split()
	if words:
		rows = [row for row in rows if all(word in row["_search"] for word in words)]
	for row in rows:
		del row["_search"]
	ordered = order_demandes([row for row in rows if _in_view(view, row)], sort, direction)
	first, length = page_bounds(len(ordered), start, page_length)
	return {
		"demandes": ordered[first : first + length],
		"counts": {name: sum(1 for row in rows if _in_view(name, row)) for name in VIEWS},
		"total": len(ordered),
		"start": first,
		"page_length": length,
		# Toute la vue, pour aller à la demande voisine depuis la fiche, au-delà de la page affichée.
		"names": [row["name"] for row in ordered],
	}


def _can_create():
	return bool(frappe.has_permission(DEMANDE, "create"))


@frappe.whitelist()
def get_demande_options():
	"""Valeurs proposées dans les filtres et dans la fenêtre."""
	require_bureau()
	return {"types": list(TYPES), "can_create": _can_create(), "filter_fields": doctype_filter_fields(DEMANDE)}


def _etudes(name):
	"""Mêmes études que le bloc « Liens » du Desk, Offset et Flexo : les études d'une demande lisible."""
	rows = []
	for doctype in ETUDES:
		found = frappe.get_all(doctype, filters={"demande_faisabilite": name}, fields=["name", "status", "article", "article_parent", "item_name", "quantite"], order_by="name asc")
		rows.extend({**row, "doctype": doctype, "designation": row.item_name or row.article} for row in found)
	return rows


def _sales_rows(doctype, link_field, name):
	"""Devis ou commandes de la demande. Les montants ne s'affichent qu'à qui peut lire ces pièces."""
	rows = frappe.get_all(doctype, filters={link_field: name, "docstatus": ["!=", 2]}, fields=["name", "status", "transaction_date", "grand_total"], order_by="transaction_date desc, creation desc")
	readable = bool(frappe.has_permission(doctype, "read"))
	return [{"name": row.name, "status": row.status, "date": _day(row.transaction_date), "total": flt(row.grand_total) if readable else None} for row in rows]


def _actions(doc):
	"""Ce que cette personne peut lancer sur cette demande, selon son statut et ses droits."""
	can_write = bool(doc.has_permission("write"))
	actions = []
	if can_write and doc.status == BROUILLON:
		actions.extend(["confirm", "edit"])
	if doc.status in DEVIS_ALLOWED and _user_can_create_devis_from_demande():
		actions.append("devis")
	if can_write and doc.status in CLOSABLE:
		actions.append("close")
	if doc.status in REPRINTABLE and _can_create():
		actions.append("retirage")
	if can_write and doc.status in CANCELLABLE:
		actions.append("cancel")
	return actions


def _ticket_summary(ticket):
	if not ticket or not frappe.has_permission(TICKET, "read", doc=ticket):
		return None
	row = frappe.db.get_value(TICKET, ticket, ["name", "request_type", "status"], as_dict=True)
	return row


def _payload(doc):
	customer = _customers([doc.client]).get(doc.client) or {}
	etudes = _etudes(doc.name)
	lines = [
		{
			"name": row.name,
			"article": row.article,
			"designation": row.designation_article or row.article,
			"quantite": cint(row.quantite),
			"est_creation": cint(row.est_creation),
			"procede": row.procede_article,
			"date_livraison": _day(row.date_livraison),
		}
		for row in doc.liste_articles
	]
	return {
		"name": doc.name,
		"modified": str(doc.modified),
		"tags": row_tags(doc.as_dict()),
		"can_write": bool(doc.has_permission("write")),
		"status": doc.status,
		"type": doc.type,
		"client": doc.client,
		"client_label": customer.get("customer_name") or doc.client,
		"wilaya": customer.get("custom_wilaya"),
		"commercial": doc.commercial,
		"ticket": doc.ticket_commercial,
		"ticket_info": _ticket_summary(doc.ticket_commercial),
		"urgence": doc.niveau_urgence or "U0",
		"livraison": _day(doc.date_livraison),
		"creation": _day(doc.date_creation),
		"cree_par": doc.cree_par,
		"bon_commande": doc.n_bon_commande,
		"demande_origin": doc.demande_origin,
		"procede": ", ".join(sorted({line["procede"] for line in lines if line["procede"]})) or None,
		"lines": lines,
		"etudes": etudes,
		"devis": _sales_rows("Quotation", "custom_demande_faisabilité", doc.name),
		"commandes": _sales_rows("Sales Order", "custom_demande_de_faisabilité", doc.name),
		"actions": _actions(doc),
		"cancel_blocking": [row for row in etudes if row["status"] in BLOCKS_CANCEL],
		"comments": activity.comment_summary(DEMANDE, doc.name),
	}


@frappe.whitelist()
def get_demande(name):
	require_bureau()
	doc = frappe.get_doc(DEMANDE, name)
	doc.check_permission("read")
	return _payload(doc)


def _last_quantities(names):
	"""Quantité de la dernière commande de chaque article, pour la reprendre en un clic."""
	if not names:
		return {}
	rows = frappe.db.sql(
		"""
		select soi.item_code, soi.qty
		from `tabSales Order Item` soi join `tabSales Order` so on so.name = soi.parent
		where soi.item_code in %(names)s and so.docstatus < 2
		order by so.transaction_date desc, so.creation desc
		""",
		{"names": names},
		as_dict=True,
	)
	last = {}
	for row in rows:
		last.setdefault(row.item_code, cint(row.qty))
	return last


def _sub_procedes(names):
	"""Procédés des sous-articles de chaque article composé : ce sont eux qui comptent pour la demande."""
	if not names:
		return {}
	rows = frappe.get_all(ITEM, filters={"custom_article_parent": ["in", names]}, fields=["custom_article_parent", PROCEDE_FIELD])
	procedes = {name: set() for name in names}
	for row in rows:
		if row.get(PROCEDE_FIELD):
			procedes[row.custom_article_parent].add(row.get(PROCEDE_FIELD))
	return procedes


def _article_choice(item, subs, bats, quantities):
	composed = cint(item.custom_article_compose)
	procedes = sorted(subs.get(item.name) or ()) if composed else ([item.get(PROCEDE_FIELD)] if item.get(PROCEDE_FIELD) else [])
	reason = None
	if not procedes:
		reason = _("Composé sans sous-article") if composed else _("Procédé à renseigner sur l'article")
	elif any(procede not in FAISABILITE_PROCEDES for procede in procedes):
		reason = _("Ni Offset ni Flexo")
	return {
		"name": item.name,
		"designation": item.item_name or item.name,
		"reference": item.custom_code_client,
		"procedes": procedes,
		"support": support_label(item),
		"format": format_label(item),
		"bat": (bats.get(item.name) or {}).get("status"),
		"last_quantity": quantities.get(item.name) or 0,
		"compose": composed,
		"unavailable": reason,
	}


@frappe.whitelist()
def get_demande_articles(client):
	"""Articles qu'une demande peut porter pour ce client : même filtre que le Desk, sans les sous-articles."""
	require_bureau()
	if not cstr(client).strip():
		frappe.throw(_("Choisissez d'abord un client."))
	items = frappe.get_list(
		ITEM,
		filters=[["custom_client", "=", client], ["custom_sous_article", "=", 0], ["custom_article_parent", "is", "not set"], ["disabled", "=", 0]],
		fields=[
			"name",
			"item_name",
			"custom_code_client",
			PROCEDE_FIELD,
			"custom_article_compose",
			"custom_support",
			"custom_grammage",
			"custom_type_support",
			"custom_epaisseur",
			"custom_epaisseur_sb",
			"custom_découpe",
			"custom_laize",
			"custom_cotations_article",
			"custom_dimensions_h_x_l",
		],
		order_by="item_name asc",
		limit_page_length=0,
	)
	names = [item.name for item in items]
	subs = _sub_procedes([item.name for item in items if cint(item.custom_article_compose)])
	bats, quantities = last_bats(names), _last_quantities(names)
	return [_article_choice(item, subs, bats, quantities) for item in items]


@frappe.whitelist()
def get_ticket_demande_context(ticket):
	"""Ce que la fenêtre reprend du ticket, et si une demande peut en partir."""
	require_bureau()
	doc = frappe.get_doc(TICKET, ticket)
	doc.check_permission("read")
	state = ticket_demande_state(doc)
	return {
		"ticket": doc.name,
		"state": state["state"],
		"procede": state["procede"],
		"reason": state["reason"],
		"request_type": doc.request_type,
		"client": doc.customer,
		"client_label": doc.customer_name or doc.customer,
		"description": doc.description,
		"urgence": doc.niveau_urgence or "U0",
		# Comme le bouton du Desk : l'échéance du ticket, sinon dans sept jours.
		"livraison": _day(doc.echeance) or _day(add_days(today(), DEFAULT_DELAY_DAYS)),
		"from_echeance": bool(doc.echeance),
		"devis_rapproche": doc.devis_rapproche if doc.request_type == "Bon de commande" else None,
	}


def _check_ticket(ticket, client):
	"""Le Desk ne contrôle ces conditions que dans le navigateur : un appel direct passerait sans cela."""
	doc = frappe.get_doc(TICKET, ticket)
	doc.check_permission("read")
	state = ticket_demande_state(doc)
	if state["state"] != "ready":
		frappe.throw(state["reason"] or _("Ce ticket ne permet pas de créer une demande."))
	if client and client != doc.customer:
		frappe.throw(_("La demande doit porter sur le client du ticket."))
	return doc


def _clean_lines(lines, client, date_livraison, essai_blanc):
	rows = _parse(lines) or []
	if not rows:
		frappe.throw(_("Ajoutez au moins un article."))
	articles = {row.get("article") for row in rows}
	owners = {item.name: item.custom_client for item in frappe.get_all(ITEM, filters={"name": ["in", list(articles)]}, fields=["name", "custom_client"])}
	seen = set()
	cleaned = []
	for row in rows:
		article = cstr(row.get("article"))
		quantite = cint(row.get("quantite"))
		if article not in owners:
			frappe.throw(_("L'article {0} n'existe pas.").format(article))
		if owners[article] != client:
			frappe.throw(_("L'article {0} n'appartient pas à ce client.").format(article))
		if quantite <= 0:
			frappe.throw(_("Saisissez une quantité pour l'article {0}.").format(article))
		if (article, quantite) in seen:
			frappe.throw(_("L'article {0} est déjà dans la demande avec cette quantité.").format(article))
		seen.add((article, quantite))
		cleaned.append({"article": article, "quantite": quantite, "est_creation": cint(row.get("est_creation")), "date_livraison": date_livraison, "essai_blanc": 1 if essai_blanc else 0})
	return cleaned


def _clean_values(values):
	values = _parse(values) or {}
	kind = cstr(values.get("type"))
	if kind not in TYPES:
		frappe.throw(_("Choisissez le type de la demande."))
	if not values.get("date_livraison"):
		frappe.throw(_("Renseignez la date de livraison souhaitée."))
	try:
		date_livraison = str(getdate(values["date_livraison"]))
	except Exception:
		frappe.throw(_("La date de livraison n'est pas valide."))
	bon_commande = cstr(values.get("n_bon_commande")).strip() or None
	if kind == RETIRAGE and not bon_commande:
		frappe.throw(_("Un retirage demande son numéro de bon de commande."))
	return {
		"type": kind,
		"date_livraison": date_livraison,
		"n_bon_commande": bon_commande if kind == RETIRAGE else None,
		"client": cstr(values.get("client")).strip(),
		"lines": values.get("lines"),
	}


def _set_lines(doc, values):
	doc.set("liste_articles", [])
	for line in _clean_lines(values["lines"], doc.client, values["date_livraison"], values["type"] == ESSAI_BLANC):
		doc.append("liste_articles", line)


@frappe.whitelist(methods=["POST"])
def create_demande(values=None, ticket=None):
	"""Crée une demande en brouillon. Elle part toujours d'un ticket, dont elle reprend le client et l'urgence."""
	require_bureau()
	frappe.has_permission(DEMANDE, "create", throw=True)
	if not cstr(ticket).strip():
		frappe.throw(_("Une demande de faisabilité se crée depuis un ticket."))
	values = _clean_values(values)
	source = _check_ticket(cstr(ticket), values["client"])
	doc = frappe.new_doc(DEMANDE)
	doc.ticket_commercial = source.name
	doc.niveau_urgence = source.niveau_urgence or "U0"
	doc.client = source.customer
	doc.update({"type": values["type"], "date_livraison": values["date_livraison"], "n_bon_commande": values["n_bon_commande"], "status": BROUILLON})
	_set_lines(doc, values)
	doc.insert()
	return {"name": doc.name}


def _demande_for_write(name, modified):
	"""Demande à modifier : mêmes droits que le Desk, et version identique à celle affichée à l'écran."""
	require_bureau()
	doc = frappe.get_doc(DEMANDE, name)
	doc.check_permission("write")
	_check_version(doc, modified)
	return doc


def _check_version(doc, modified):
	if modified and cstr(modified) != str(doc.modified):
		frappe.throw(
			_("Cette demande vient d'être modifiée par ailleurs. Elle a été rechargée : vérifiez-la, puis recommencez."),
			frappe.TimestampMismatchError,
		)


def _check_status(doc, allowed):
	if doc.status not in allowed:
		frappe.throw(_("Le statut « {0} » ne permet pas cette action.").format(doc.status))


@frappe.whitelist(methods=["POST"])
def update_demande(name, modified, values=None):
	"""Modifie un brouillon. Une demande confirmée a déjà lancé ses études : elle ne se modifie plus."""
	doc = _demande_for_write(name, modified)
	_check_status(doc, (BROUILLON,))
	values = _clean_values(values)
	# Le client et la date ne s'écrivent qu'à la création (`set_only_once`) : les lignes reprennent la date en place.
	values["date_livraison"] = str(doc.date_livraison)
	doc.update({"type": values["type"], "n_bon_commande": values["n_bon_commande"]})
	_set_lines(doc, values)
	doc.save()
	return _payload(doc)


@frappe.whitelist(methods=["POST"])
def confirm_demande(name, modified):
	"""Lance les études : une par article, ou par sous-article d'un composé. Passe la demande en Confirmée."""
	doc = _demande_for_write(name, modified)
	_check_status(doc, (BROUILLON,))
	generate_etude_faisabilite(doc.name)
	return get_demande(doc.name)


@frappe.whitelist(methods=["POST"])
def cancel_demande(name, modified):
	"""Annule la demande et retire ses études. Refusé dès qu'une étude a abouti."""
	doc = _demande_for_write(name, modified)
	_check_status(doc, CANCELLABLE)
	result = cancel_etudes_faisabilite(doc.name)
	if result.get("status") == "blocked":
		frappe.throw(_("Annulation impossible : ces études ont abouti ({0}).").format(", ".join(result.get("blocked_etudes") or [])))
	return get_demande(doc.name)


@frappe.whitelist(methods=["POST"])
def close_demande(name, modified):
	doc = _demande_for_write(name, modified)
	_check_status(doc, CLOSABLE)
	doc.status = FERMEE
	doc.save()
	return _payload(doc)


@frappe.whitelist(methods=["POST"])
def create_devis(name, modified):
	"""Crée le devis et ses calculs. Réservé aux rôles Devis : Chargé Devis ne fait que lire la demande, sans l'écrire."""
	require_bureau()
	doc = frappe.get_doc(DEMANDE, name)
	doc.check_permission("read")
	_check_version(doc, modified)
	if not _user_can_create_devis_from_demande():
		frappe.throw(_("Seuls les rôles Chargé Devis et Responsable Devis peuvent créer un devis depuis une demande."), frappe.PermissionError)
	_check_status(doc, DEVIS_ALLOWED)
	result = create_quotation_with_calculs(doc.name)
	return {"quotation": result["quotation_name"], "demande": get_demande(doc.name)}


@frappe.whitelist(methods=["POST"])
def create_retirage(name, modified, date_livraison):
	"""Nouvelle demande en brouillon, copie de celle-ci. La méthode du Desk insère sans droits : ils se contrôlent ici."""
	require_bureau()
	frappe.has_permission(DEMANDE, "create", throw=True)
	doc = frappe.get_doc(DEMANDE, name)
	doc.check_permission("read")
	_check_version(doc, modified)
	_check_status(doc, REPRINTABLE)
	if not date_livraison:
		frappe.throw(_("Renseignez la nouvelle date de livraison souhaitée."))
	result = duplicate_demande_for_reprint(doc.name, str(getdate(date_livraison)))
	if result.get("error"):
		frappe.throw(result["error"])
	return {"name": result["new_docname"]}


def bulk_guard(doc, operation):
	"""Une action groupée ne touche qu'un brouillon : ensuite, les études s'appuient sur la demande. Les tags restent libres."""
	if doc.status != BROUILLON:
		return _("La demande n'est plus en brouillon.")
	return None


@frappe.whitelist()
def get_demande_activity(name):
	require_bureau()
	return activity.get_feed(DEMANDE, name)


@frappe.whitelist(methods=["POST"])
def add_demande_comment(name, text, mentions=None):
	require_bureau()
	return activity.add_comment(DEMANDE, name, text, mentions)


@frappe.whitelist(methods=["POST"])
def update_demande_comment(name, comment, text, mentions=None):
	require_bureau()
	return activity.update_comment(DEMANDE, name, comment, text, mentions)


@frappe.whitelist(methods=["POST"])
def delete_demande_comment(name, comment):
	require_bureau()
	return activity.delete_comment(DEMANDE, name, comment)
