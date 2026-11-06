# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Accueil du poste de bureau (/bureau) : ce que le back office doit transformer, faire avancer et mettre à jour.

Lecture seule : les actions de la page passent par les méthodes de `bureau.py` et `bureau_demandes.py`. Chaque bloc
passe par `frappe.get_list` et disparaît pour un rôle qui ne lit pas le document, plutôt que de faire tomber la page.
"""

import json
from urllib.parse import urlencode

import frappe
from frappe import _
from frappe.model.workflow import get_transitions
from frappe.utils import add_months, cint, cstr, date_diff, get_first_day, getdate, today

from aurescrm.api.bureau import (
	CLOSED_STATUSES,
	DEMANDE_TICKET_TYPES,
	STATUS_BLOCKED,
	STATUS_PAUSED,
	TICKET,
	URGENCE_RANK,
	require_bureau,
	ticket_demande_state,
)

DEMANDE = "Demande Faisabilite"
ETUDES = ("Etude Faisabilite", "Etude Faisabilite Flexo")
DEVIS = "Quotation"
COMMANDE = "Sales Order"
CUSTOMER = "Customer"
ITEM = "Item"
MAQUETTE = "Maquette"
RECLAMATION = "Reclamations Clients"

# Sans mouvement depuis ce nombre de jours : le document mérite un regard.
STALE_DAYS = 7
# Lignes montrées par groupe : l'action de chaque ligne demande de charger le ticket.
MAX_GROUP_ROWS = 10
TREND_MONTHS = 12

STATUS_NEW = "Nouveau"
STATUS_RUNNING = "En Cours"
URGENCE_PENDING = "En attente"
TYPE_UPDATE = "Mise à jour données"
TYPE_CLIENT = "Client"
MAQUETTE_ACTIVE = "Version Activée"
TO_DELIVER = ("To Deliver", "To Deliver and Bill")

STAGES = (
	{
		"key": "tickets",
		"label": "Tickets",
		"doctypes": (TICKET,),
		"statuses": (STATUS_NEW, STATUS_RUNNING, STATUS_PAUSED, STATUS_BLOCKED),
		"to": "Tickets",
	},
	{
		"key": "demandes",
		"label": "Demandes",
		"doctypes": (DEMANDE,),
		"statuses": ("Brouillon", "Confirmée", STATUS_RUNNING, "Partiellement Finalisée", "Finalisée", "Devis Établis"),
		"to": "Demandes",
	},
	{
		"key": "etudes",
		"label": "Études",
		"doctypes": ETUDES,
		"statuses": (STATUS_NEW, "En étude"),
		"href": "/app/etude-faisabilite",
		"third_party": True,
	},
	{
		"key": "devis",
		"label": "Devis",
		"doctypes": (DEVIS,),
		"statuses": ("Draft", "Open", "Partially Ordered"),
		"href": "/app/quotation",
	},
	{
		"key": "commandes",
		"label": "Commandes",
		"doctypes": (COMMANDE,),
		"statuses": ("Draft", "On Hold", "To Deliver", "To Deliver and Bill", "To Bill"),
		"href": "/app/sales-order",
	},
)

# Fiches clients : un manque, le ou les champs vides qui le font, et de quoi retrouver les fiches dans la liste.
CLIENT_GAPS = (
	("phone", "Sans téléphone principal", ("custom_nº_téléphone_principal",)),
	("legal", "Sans NIF, RC, NIS ni AI", ("custom_nº_nif", "custom_nº_rc", "custom_nº_nis", "custom_nº_ai")),
	("contact", "Sans contact principal", ("customer_primary_contact",)),
	("email", "Sans e-mail principal", ("custom_email_principal_client",)),
	("gps", "Sans position GPS", ("custom_gps",)),
)


def _is_empty(value):
	return not cstr(value).strip()


def _can_read(doctype):
	return bool(frappe.has_permission(doctype, "read"))


def is_stale(modified, current_day):
	return date_diff(current_day, getdate(modified)) > STALE_DAYS


def summarize_stage(rows, statuses, current_day):
	"""Les parts d'une étape, dans l'ordre du cycle, sans les statuts vides, et ce qui n'a plus bougé."""
	counts = {status: 0 for status in statuses}
	stale = 0
	for row in rows:
		if row.get("status") in counts:
			counts[row.get("status")] += 1
			stale += is_stale(row.get("modified"), current_day)
	return {
		"parts": [{"status": status, "count": count} for status, count in counts.items() if count],
		"total": sum(counts.values()),
		"stale": stale,
	}


def _stage(stage, current_day):
	doctypes = [doctype for doctype in stage["doctypes"] if _can_read(doctype)]
	if not doctypes:
		return None
	extra = []
	if stage["key"] == "devis":
		extra = ["valid_till"]
	elif stage["key"] == "commandes":
		extra = ["delivery_date"]
	rows = []
	for doctype in doctypes:
		rows += frappe.get_list(
			doctype,
			filters=[["status", "in", stage["statuses"]]],
			fields=["status", "modified", *extra],
			limit_page_length=0,
		)
	summary = summarize_stage(rows, stage["statuses"], current_day)
	late = 0
	if stage["key"] == "devis":
		late = sum(1 for row in rows if row.valid_till and getdate(row.valid_till) < getdate(current_day))
	elif stage["key"] == "commandes":
		late = sum(1 for row in rows if row.status in TO_DELIVER and row.delivery_date and getdate(row.delivery_date) < getdate(current_day))
	return {
		"key": stage["key"],
		"label": stage["label"],
		"to": stage.get("to"),
		"href": stage.get("href"),
		"third_party": bool(stage.get("third_party")),
		"late": late,
		**summary,
	}


def queue_group(ticket, has_demande):
	"""Le groupe d'un ticket ouvert dans la file de l'accueil, ou None s'il n'attend rien de particulier ici."""
	if ticket.get("request_type") == TYPE_UPDATE:
		return None
	if ticket.get("status") == STATUS_BLOCKED or ticket.get("statut_demande_urgence") == URGENCE_PENDING:
		return "decide"
	if ticket.get("status") in (STATUS_NEW, STATUS_PAUSED):
		return "take"
	if (
		ticket.get("status") == STATUS_RUNNING
		and ticket.get("request_type") in DEMANDE_TICKET_TYPES
		and not has_demande
		and not ticket.get("devis_rapproche")
	):
		return "transform"
	return None


def queue_order(ticket):
	"""Le plus urgent d'abord, puis l'échéance la plus proche, puis le plus ancien."""
	echeance = ticket.get("echeance")
	return (
		-URGENCE_RANK.get(ticket.get("niveau_urgence"), 0),
		echeance is None,
		str(echeance or ""),
		str(ticket.get("creation") or ""),
	)


def _row_action(ticket, group):
	"""Le bouton de la ligne : le serveur reste seul juge de ce qui est permis sur ce ticket."""
	doc = frappe.get_doc(TICKET, ticket.name)
	if group == "decide":
		label = _("Décider la créance") if ticket.status == STATUS_BLOCKED else _("Décider l'urgence")
		return {"kind": "open", "label": label}
	if group == "transform":
		state = ticket_demande_state(doc)
		if state["state"] == "ready":
			return {"kind": "demande", "label": _("Créer la demande")}
		return {"kind": "open", "label": _("Ouvrir"), "reason": state.get("reason")}
	if not ticket.assigne_a and doc.has_permission("write"):
		return {"kind": "assign", "label": _("Attribuer")}
	wanted = "Reprendre" if ticket.status == STATUS_PAUSED else "Démarrer"
	if any(transition.action == wanted for transition in get_transitions(doc)):
		return {"kind": "run", "label": _(wanted), "action": wanted}
	return {"kind": "open", "label": _("Ouvrir")}


def _queue_row(ticket, group, user, current_day):
	return {
		"name": ticket.name,
		"modified": str(ticket.modified),
		"request_type": ticket.request_type,
		"client": ticket.customer_name or ticket.customer,
		"commercial": ticket.nom_commercial,
		"status": ticket.status,
		"urgence": ticket.niveau_urgence,
		"assigne_a": ticket.assigne_a,
		"assigne_a_nom": ticket.assigne_a_nom,
		"mine": ticket.assigne_a == user,
		"echeance": str(ticket.echeance) if ticket.echeance else None,
		"is_late": bool(ticket.echeance and getdate(ticket.echeance) < getdate(current_day)),
		"idle_days": date_diff(current_day, getdate(ticket.modified)),
		"action": _row_action(ticket, group),
	}


def _open_tickets():
	return frappe.get_list(
		TICKET,
		filters=[["status", "not in", list(CLOSED_STATUSES)]],
		fields=[
			"name",
			"modified",
			"creation",
			"status",
			"request_type",
			"customer",
			"customer_name",
			"nom_commercial",
			"niveau_urgence",
			"statut_demande_urgence",
			"assigne_a",
			"assigne_a_nom",
			"echeance",
			"devis_rapproche",
		],
		limit_page_length=0,
	)


def _tickets_with_demande(names):
	if not names or not _can_read(DEMANDE):
		return set()
	rows = frappe.get_list(
		DEMANDE,
		filters=[["ticket_commercial", "in", names], ["status", "!=", "Annulée"]],
		fields=["ticket_commercial"],
		limit_page_length=0,
	)
	return {row.ticket_commercial for row in rows}


def _queue(tickets, scope, user, current_day):
	with_demande = _tickets_with_demande([ticket.name for ticket in tickets])
	groups = {"decide": [], "take": [], "transform": []}
	for ticket in tickets:
		if scope == "mine" and ticket.assigne_a != user:
			continue
		group = queue_group(ticket, ticket.name in with_demande)
		if group:
			groups[group].append(ticket)
	result = []
	for key, rows in groups.items():
		rows.sort(key=queue_order)
		result.append(
			{
				"key": key,
				"total": len(rows),
				"rows": [_queue_row(row, key, user, current_day) for row in rows[:MAX_GROUP_ROWS]],
			}
		)
	return result


def _update_requests(tickets, current_day):
	"""Les tickets « Mise à jour données » : la demande de mise à jour écrite par un commercial."""
	rows = [ticket for ticket in tickets if ticket.request_type == TYPE_UPDATE]
	rows.sort(key=queue_order)
	return {
		"total": len(rows),
		"rows": [
			{
				"name": row.name,
				"client": row.customer_name or row.customer,
				"status": row.status,
				"idle_days": date_diff(current_day, getdate(row.modified)),
			}
			for row in rows[:MAX_GROUP_ROWS]
		],
	}


def _condition(doctype, field, op="is", value="not set"):
	return {"doctype": doctype, "field": field, "op": op, "value": value}


def count_client_gaps(rows):
	"""Pour chaque manque, le nombre de fiches où tous ses champs sont vides."""
	return [
		{
			"key": key,
			"label": label,
			"count": sum(1 for row in rows if all(_is_empty(row.get(field)) for field in fields)),
			"total": len(rows),
			"conditions": [_condition(CUSTOMER, field) for field in fields],
		}
		for key, label, fields in CLIENT_GAPS
	]


def _clients():
	if not _can_read(CUSTOMER):
		return None
	fields = sorted({field for _key, _label, names in CLIENT_GAPS for field in names})
	rows = frappe.get_list(CUSTOMER, filters=[["disabled", "=", 0]], fields=fields, limit_page_length=0)
	return {"total": len(rows), "rows": count_client_gaps(rows)}


def count_article_gaps(rows, activated):
	"""Les manques des articles. Le client et la maquette ne concernent qu'un article de type Client."""
	clients = [row for row in rows if row.get("custom_type_article") == TYPE_CLIENT]
	total, client_total = len(rows), len(clients)
	return [
		{
			"key": "image",
			"label": "Sans image",
			"count": sum(1 for row in rows if _is_empty(row.get("image"))),
			"total": total,
			"conditions": [_condition(ITEM, "image")],
		},
		{
			"key": "bat",
			"label": "Sans pièce BAT",
			"count": sum(1 for row in rows if _is_empty(row.get("custom_fiche_technique_article"))),
			"total": total,
			"conditions": [_condition(ITEM, "custom_fiche_technique_article")],
		},
		{
			"key": "maquette",
			"label": "Sans maquette activée",
			"count": sum(1 for row in clients if row.get("name") not in activated),
			"total": client_total,
			"view": "sans_maquette",
		},
		{
			"key": "client",
			"label": "Sans client",
			"count": sum(1 for row in clients if _is_empty(row.get("custom_client"))),
			"total": client_total,
			"conditions": [_condition(ITEM, "custom_type_article", "=", TYPE_CLIENT), _condition(ITEM, "custom_client")],
		},
	]


def _articles():
	if not _can_read(ITEM):
		return None
	rows = frappe.get_list(
		ITEM,
		filters=[["disabled", "=", 0]],
		fields=["name", "custom_type_article", "custom_client", "image", "custom_fiche_technique_article"],
		limit_page_length=0,
	)
	activated = set()
	if _can_read(MAQUETTE):
		activated = set(frappe.get_list(MAQUETTE, filters=[["status", "=", MAQUETTE_ACTIVE]], pluck="article", limit_page_length=0))
	return {"total": len(rows), "rows": count_article_gaps(rows, activated)}


def _desk_href(route, **filters):
	"""Une liste du Desk déjà filtrée. Une valeur composée s'écrit en JSON, comme le Desk la lit dans l'adresse."""
	query = {key: value if isinstance(value, str) else json.dumps(value) for key, value in filters.items()}
	return f"/app/{route}?{urlencode(query)}"


def _count(doctype, filters):
	return len(frappe.get_list(doctype, filters=filters, pluck="name", limit_page_length=0))


def _documents(current_day):
	"""Les documents dont le statut ou la date ne disent plus la vérité. Ils s'ouvrent là où ils se traitent."""
	limit = frappe.utils.add_days(current_day, -STALE_DAYS)
	stale_draft = [["status", "=", "Brouillon"], ["modified", "<", limit]]
	rows = []
	if _can_read(COMMANDE):
		overdue = [["status", "in", list(TO_DELIVER)], ["delivery_date", "<", current_day]]
		rows.append(
			{
				"key": "commandes_retard",
				"label": "Commandes à livrer, date dépassée",
				"count": _count(COMMANDE, overdue),
				"href": _desk_href("sales-order", status=["in", list(TO_DELIVER)], delivery_date=["<", current_day]),
			}
		)
	if _can_read(RECLAMATION):
		rows.append(
			{
				"key": "reclamations",
				"label": "Réclamations en retard",
				"count": _count(RECLAMATION, [["status", "=", "En retard"]]),
				"href": _desk_href("reclamations-clients", status="En retard"),
			}
		)
	if _can_read(MAQUETTE):
		rows.append(
			{
				"key": "maquettes",
				"label": "Maquettes à référencer",
				"count": _count(MAQUETTE, [["status", "=", "A référencer"]]),
				"href": _desk_href("maquette", status="A référencer"),
			}
		)
	if _can_read(DEMANDE):
		rows.append(
			{
				"key": "demandes_brouillon",
				"label": "Demandes en brouillon depuis plus de 7 j",
				"count": _count(DEMANDE, stale_draft),
				"to": {"name": "Demandes"},
				"conditions": [_condition(DEMANDE, "status", "=", "Brouillon"), _condition(DEMANDE, "modified", "<", limit)],
			}
		)
	if _can_read(DEVIS):
		rows.append(
			{
				"key": "devis_brouillon",
				"label": "Devis en brouillon depuis plus de 7 j",
				"count": _count(DEVIS, [["status", "=", "Draft"], ["modified", "<", limit]]),
				"href": _desk_href("quotation", status="Draft", modified=["<", limit]),
			}
		)
		rows.append(
			{
				"key": "devis_perimes",
				"label": "Devis périmés encore ouverts",
				"count": _count(DEVIS, [["status", "=", "Open"], ["valid_till", "<", current_day]]),
				"href": _desk_href("quotation", status="Open", valid_till=["<", current_day]),
			}
		)
	if _can_read(COMMANDE):
		rows.append(
			{
				"key": "commandes_brouillon",
				"label": "Commandes en brouillon depuis plus de 7 j",
				"count": _count(COMMANDE, [["status", "=", "Draft"], ["modified", "<", limit]]),
				"href": _desk_href("sales-order", status="Draft", modified=["<", limit]),
			}
		)
	return rows


def closing_months(versions, closed):
	"""Le mois de clôture de chaque ticket clos, lu dans son historique : le ticket n'a pas de date de clôture.

	`versions` : (ticket, date, données JSON) du plus ancien au plus récent. `closed` : {ticket: date de modification},
	utilisée quand l'historique ne dit rien. Un ticket rouvert puis refermé compte à sa dernière clôture.
	"""
	dates = dict(closed)
	for ticket, created, data in versions:
		if ticket not in closed:
			continue
		try:
			changes = json.loads(data).get("changed") or []
		except (TypeError, ValueError):
			continue
		for change in changes:
			if change[0] == "status" and change[2] in CLOSED_STATUSES:
				dates[ticket] = created
	return [getdate(value).strftime("%Y-%m") for value in dates.values()]


def age_buckets(creations, current_day):
	"""La répartition des tickets ouverts selon leur ancienneté."""
	buckets = [
		{"label": "7 j", "max": 7, "count": 0},
		{"label": "8–30 j", "max": 30, "count": 0},
		{"label": "31–90 j", "max": 90, "count": 0},
		{"label": "91–180 j", "max": 180, "count": 0},
		{"label": "+ 180 j", "max": None, "count": 0},
	]
	for creation in creations:
		age = date_diff(current_day, getdate(creation))
		for bucket in buckets:
			if bucket["max"] is None or age <= bucket["max"]:
				bucket["count"] += 1
				break
	return [{"label": bucket["label"], "count": bucket["count"]} for bucket in buckets]


def month_keys(current_day, length=TREND_MONTHS):
	first = get_first_day(current_day)
	return [add_months(first, offset - length + 1).strftime("%Y-%m") for offset in range(length)]


def completeness(rows):
	"""La part des champs suivis qui sont remplis."""
	expected = sum(row["total"] for row in rows)
	filled = expected - sum(row["count"] for row in rows)
	return {"filled": filled, "expected": expected, "percent": round(filled * 100 / expected) if expected else 100}


def _trends(open_tickets, clients, articles, current_day):
	months = month_keys(current_day)
	start = f"{months[0]}-01"
	received = frappe.get_list(TICKET, filters=[["creation", ">=", start]], pluck="creation", limit_page_length=0)
	closed = {
		row.name: row.modified
		for row in frappe.get_list(TICKET, filters=[["status", "in", list(CLOSED_STATUSES)]], fields=["name", "modified"], limit_page_length=0)
	}
	# L'historique ne s'expose qu'à travers le ticket : seuls les tickets lisibles ci-dessus y sont lus.
	versions = frappe.get_all(
		"Version",
		filters={"ref_doctype": TICKET, "docname": ["in", list(closed)], "data": ["like", '%"status"%']},
		fields=["docname", "creation", "data"],
		order_by="creation asc",
		limit_page_length=0,
	) if closed else []
	closing = closing_months([(row.docname, row.creation, row.data) for row in versions], closed)
	received_months = [getdate(value).strftime("%Y-%m") for value in received]
	return {
		"months": [
			{"month": month, "received": received_months.count(month), "closed": closing.count(month)}
			for month in months
		],
		"ages": age_buckets([ticket.creation for ticket in open_tickets], current_day),
		"completeness": {
			"clients": completeness(clients["rows"]) if clients else None,
			"articles": completeness(articles["rows"]) if articles else None,
		},
	}


@frappe.whitelist()
def get_accueil(scope="team"):
	"""Toute la page en une réponse. `scope` ne touche que la file : « mine » garde les tickets attribués à la personne."""
	user = require_bureau()
	if scope not in ("team", "mine"):
		frappe.throw(_("Vue inconnue."))
	current_day = today()
	tickets = _open_tickets() if _can_read(TICKET) else []
	clients, articles = _clients(), _articles()
	return {
		"stale_days": STALE_DAYS,
		"stages": [row for row in (_stage(stage, current_day) for stage in STAGES) if row],
		"trends": _trends(tickets, clients, articles, current_day) if _can_read(TICKET) else None,
		"queue": _queue(tickets, scope, user, current_day),
		"updates": _update_requests(tickets, current_day),
		"clients": clients,
		"articles": articles,
		"documents": _documents(current_day),
		"max_rows": cint(MAX_GROUP_ROWS),
	}
