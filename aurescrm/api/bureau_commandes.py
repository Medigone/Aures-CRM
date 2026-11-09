# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Commandes du poste de bureau (/bureau/commandes) : liste et aperçu.

Une commande se crée depuis la fiche d'un devis validé (`bureau_devis.create_commande`). Sa validation crée le
dossier de fabrication. Les montants sont au niveau de permission 1 de la commande : ils ne sortent qu'à qui le lit.
"""

import frappe
from frappe import _
from frappe.utils import cstr, flt, get_fullname, getdate, today

from aurescrm.api import activity
from aurescrm.api.bureau import _parse, condition_filters, doctype_filter_fields, has_child_filter, page_bounds, require_bureau, row_bell, row_tags, BELL_FIELD
from aurescrm.api.bureau_articles import _customers

COMMANDE = "Sales Order"
LIGNES = "Sales Order Item"
DEMANDE = "Demande Faisabilite"
DOSSIER = "Dossier Fabrication"
DEMANDE_FIELD = "custom_demande_de_faisabilité"

FIELDS = [
	"name", "modified", "creation", "owner", "status", "docstatus", "customer", "customer_name", "transaction_date",
	"delivery_date", "custom_bon_de_commande_client", "custom_date_bon_de_commande", "custom_devis", DEMANDE_FIELD,
	"custom_niveau_urgence", "custom_commercial", "custom_retirage", "per_delivered", "per_billed", "net_total",
	"grand_total", "_user_tags", BELL_FIELD,
]  # fmt: skip

A_LIVRER = ("To Deliver and Bill", "To Deliver")
TERMINEES = ("Completed", "Closed")
VIEWS = ("all", "valider", "livrer", "retard", "facturer", "terminees", "annulees")
SORT_KEYS = {"name", "client_label", "articles", "bon_commande", "date_bon", "status", "livraison", "fabrication", "livre", "facture", "total", "total_ttc", "urgence", "commercial", "devis", "demande", "date", "creation", "modified", "cree_par"}
NUMERIC_SORT = {"livre", "facture", "total", "total_ttc"}


def _day(value):
	return str(value) if value else None


def reads_amounts():
	"""Totaux et prix sont au niveau 1 de la commande, comme sur le Desk."""
	return 1 in frappe.get_meta(COMMANDE).get_permlevel_access("read")


def in_view(view, row, current_day=None):
	if view == "all":
		return True
	status = row["status"]
	if view == "valider":
		return status == "Draft"
	if view == "livrer":
		return status in A_LIVRER
	if view == "retard":
		return status in A_LIVRER and bool(row["livraison"]) and getdate(row["livraison"]) < getdate(current_day or today())
	if view == "facturer":
		return status == "To Bill"
	if view == "terminees":
		return status in TERMINEES
	return status == "Cancelled"


def _lines_by_commande(names):
	if not names:
		return {}
	rows = frappe.get_all(
		LIGNES,
		filters={"parent": ["in", names], "parenttype": COMMANDE},
		fields=["name", "parent", "item_code", "item_name", "qty", "delivered_qty", "delivery_date", "rate", "amount", "uom"],
		order_by="idx asc",
	)
	lines = {}
	for row in rows:
		lines.setdefault(row.parent, []).append(row)
	return lines


def _dossiers(names):
	"""Dossier de fabrication de chaque commande : le plus récent s'il y en a plusieurs."""
	if not names:
		return {}
	found = {}
	for row in frappe.get_all(DOSSIER, filters={"sales_order": ["in", names]}, fields=["name", "sales_order", "status"], order_by="creation asc"):
		found[row.sales_order] = {"name": row.name, "status": row.status}
	return found


def _tickets(demandes):
	names = list({name for name in demandes if name})
	if not names:
		return {}
	return {row.name: row.ticket_commercial for row in frappe.get_all(DEMANDE, filters={"name": ["in", names]}, fields=["name", "ticket_commercial"])}


def prochaine_livraison(commande, lines):
	"""La date la plus proche des lignes qui restent à livrer ; la date de la commande à défaut."""
	dates = [line.delivery_date for line in lines if line.delivery_date and flt(line.delivered_qty) < flt(line.qty)]
	if dates:
		return _day(min(dates))
	return _day(commande.get("delivery_date"))


def _list_row(commande, customers, lines, dossiers, tickets, owners, amounts):
	rows = lines.get(commande.name) or []
	first = rows[0] if rows else None
	client = commande.customer
	client_label = commande.get("customer_name") or (customers.get(client) or {}).get("customer_name") or client
	demande = commande.get(DEMANDE_FIELD)
	ticket = tickets.get(demande)
	dossier = dossiers.get(commande.name)
	status = "Draft" if commande.docstatus == 0 else commande.status
	return {
		"name": commande.name,
		"modified": str(commande.modified),
		"creation": str(commande.creation),
		"tags": row_tags(commande),
		"cloche": row_bell(commande),
		"status": status,
		"client": client,
		"client_label": client_label,
		"articles": (first.item_name or first.item_code) if first else None,
		"articles_count": len(rows),
		"bon_commande": commande.get("custom_bon_de_commande_client") or None,
		"date_bon": _day(commande.get("custom_date_bon_de_commande")),
		"livraison": prochaine_livraison(commande, rows),
		"fabrication": dossier["status"] if dossier else None,
		"dossier": dossier["name"] if dossier else None,
		"livre": flt(commande.per_delivered),
		"facture": flt(commande.per_billed),
		"total": flt(commande.net_total) if amounts else None,
		"total_ttc": flt(commande.grand_total) if amounts else None,
		"urgence": commande.get("custom_niveau_urgence") or "U0",
		"commercial": commande.get("custom_commercial") or None,
		"devis": commande.get("custom_devis") or None,
		"demande": demande or None,
		"ticket": ticket or None,
		"retirage": bool(commande.get("custom_retirage")),
		"date": _day(commande.transaction_date),
		"cree_par": owners.get(commande.owner) or commande.owner,
		# Recherche seulement : retirée avant l'envoi.
		"_search": " ".join(
			cstr(value)
			for value in (
				commande.name, client, client_label, commande.get("custom_bon_de_commande_client"), commande.get("custom_devis"), demande, ticket,
				dossier and dossier["name"], commande.get("custom_commercial"), *[f"{row.item_code} {row.item_name}" for row in rows],
			)
		).casefold(),
	}  # fmt: skip


def order_commandes(rows, sort=None, direction=None):
	"""Les plus récentes d'abord, ou par la colonne demandée. Une ligne sans valeur reste à la fin, dans les deux sens."""
	ordered = sorted(rows, key=lambda row: (cstr(row.get("date")), row["creation"], row["name"]), reverse=True)
	if sort not in SORT_KEYS:
		return ordered
	filled = [row for row in ordered if row.get(sort) not in (None, "")]
	empty = [row for row in ordered if row.get(sort) in (None, "")]
	key = (lambda row: flt(row[sort])) if sort in NUMERIC_SORT else (lambda row: cstr(row[sort]).casefold())
	return sorted(filled, key=key, reverse=cstr(direction) == "desc") + empty


def _require_read():
	require_bureau()
	if not frappe.has_permission(COMMANDE, "read"):
		raise frappe.PermissionError


@frappe.whitelist()
def get_commandes_list(view="all", conditions=None, search=None, start=0, page_length=None, sort=None, direction=None):
	"""Une page de la liste, le total, l'ordre de toute la vue, et les compteurs de toutes les vues pour les mêmes filtres."""
	_require_read()
	if view not in VIEWS:
		frappe.throw(_("Vue inconnue."))
	filters = condition_filters(_parse(conditions), COMMANDE)
	found = frappe.get_list(COMMANDE, filters=filters, distinct=has_child_filter(filters, COMMANDE), fields=FIELDS, limit_page_length=0)
	names = [row.name for row in found]
	customers = _customers(row.customer for row in found)
	lines = _lines_by_commande(names)
	dossiers = _dossiers(names)
	tickets = _tickets(row.get(DEMANDE_FIELD) for row in found)
	owners = {owner: get_fullname(owner) for owner in {row.owner for row in found}}
	amounts = reads_amounts()
	rows = [_list_row(row, customers, lines, dossiers, tickets, owners, amounts) for row in found]
	words = cstr(search).casefold().split()
	if words:
		rows = [row for row in rows if all(word in row["_search"] for word in words)]
	for row in rows:
		del row["_search"]
	current_day = today()
	ordered = order_commandes([row for row in rows if in_view(view, row, current_day)], sort if amounts or sort not in ("total", "total_ttc") else None, direction)
	first, length = page_bounds(len(ordered), start, page_length)
	return {
		"commandes": ordered[first : first + length],
		"counts": {name: sum(1 for row in rows if in_view(name, row, current_day)) for name in VIEWS},
		"total": len(ordered),
		"start": first,
		"page_length": length,
		# Toute la vue, pour passer à la commande voisine depuis l'aperçu, au-delà de la page affichée.
		"names": [row["name"] for row in ordered],
	}


@frappe.whitelist()
def get_commandes_options():
	_require_read()
	return {"doctype": COMMANDE, "filter_fields": doctype_filter_fields(COMMANDE), "montants": reads_amounts()}


def _line(item, amounts):
	return {
		"name": item.name,
		"article": item.item_code,
		"designation": item.item_name or item.item_code,
		"quantite": flt(item.qty),
		"livree": flt(item.delivered_qty),
		"unite": item.uom,
		"livraison": _day(item.delivery_date),
		"prix": flt(item.rate) if amounts else None,
		"montant": flt(item.amount) if amounts else None,
	}


@frappe.whitelist()
def get_commande(name):
	require_bureau()
	doc = frappe.get_doc(COMMANDE, name)
	doc.check_permission("read")
	customers = _customers([doc.customer])
	demande = doc.get(DEMANDE_FIELD)
	ticket = frappe.db.get_value(DEMANDE, demande, "ticket_commercial") if demande else None
	dossier = _dossiers([doc.name]).get(doc.name)
	amounts = reads_amounts()
	return {
		"name": doc.name,
		"modified": str(doc.modified),
		"creation": str(doc.creation),
		"tags": row_tags(doc),
		"can_write": bool(doc.has_permission("write")),
		"status": "Draft" if doc.docstatus == 0 else doc.status,
		"docstatus": doc.docstatus,
		"client": doc.customer,
		"client_label": doc.customer_name or (customers.get(doc.customer) or {}).get("customer_name") or doc.customer,
		"commercial": doc.get("custom_commercial") or None,
		"urgence": doc.get("custom_niveau_urgence") or "U0",
		"retirage": bool(doc.get("custom_retirage")),
		"date": _day(doc.transaction_date),
		"livraison": prochaine_livraison(doc, doc.items),
		"bon_commande": doc.get("custom_bon_de_commande_client") or None,
		"date_bon": _day(doc.get("custom_date_bon_de_commande")),
		"devis": doc.get("custom_devis") or None,
		"demande": demande or None,
		"ticket": ticket or None,
		"dossier": dossier,
		"cree_par": get_fullname(doc.owner),
		"lignes": [_line(item, amounts) for item in doc.items],
		"livre": flt(doc.per_delivered),
		"facture": flt(doc.per_billed),
		"total": flt(doc.net_total) if amounts else None,
		"taxes": flt(doc.total_taxes_and_charges) if amounts else None,
		"total_ttc": flt(doc.grand_total) if amounts else None,
		"comments": activity.comment_summary(COMMANDE, doc.name),
	}


def _readable(name):
	require_bureau()
	frappe.get_doc(COMMANDE, name).check_permission("read")
	return name


@frappe.whitelist()
def get_commande_activity(name):
	return activity.get_feed(COMMANDE, _readable(name))


@frappe.whitelist(methods=["POST"])
def add_commande_comment(name, text, mentions=None):
	return activity.add_comment(COMMANDE, _readable(name), text, mentions)


@frappe.whitelist(methods=["POST"])
def update_commande_comment(name, comment, text, mentions=None):
	return activity.update_comment(COMMANDE, _readable(name), comment, text, mentions)


@frappe.whitelist(methods=["POST"])
def delete_commande_comment(name, comment):
	return activity.delete_comment(COMMANDE, _readable(name), comment)
