# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Devis du poste de bureau (/bureau/devis) : liste et aperçu, en lecture.

Un devis se crée depuis une demande de faisabilité (`bureau_demandes.create_devis`). Le chiffrage, la validation et
la commande restent sur le Desk tant que le cycle du devis n'est pas repris ici.

Les prix des lignes sont au niveau de permission 1 du Devis : ils ne sortent qu'à qui le lit. Les coûts des calculs
suivent `imposition/droits.py` : l'équipe devis seule.
"""

import frappe
from frappe import _
from frappe.utils import add_days, cint, cstr, flt, get_fullname, getdate, today

from aurescrm.api import activity
from aurescrm.api.bureau import BELL_FIELD, _parse, condition_filters, doctype_filter_fields, has_child_filter, page_bounds, require_bureau, row_bell, row_tags
from aurescrm.api.bureau_articles import _customers
from aurescrm.imposition.droits import voit_couts

DEVIS = "Quotation"
LIGNES = "Quotation Item"
CALCUL = "Calcul Devis"
DEMANDE = "Demande Faisabilite"
COMMANDE = "Sales Order"
DEMANDE_FIELD = "custom_demande_faisabilité"

FIELDS = [
	"name", "modified", "creation", "owner", "status", "docstatus", "party_name", "customer_name", "custom_id_client",
	"transaction_date", "valid_till", "custom_date_de_livraison", DEMANDE_FIELD, "custom_niveau_urgence", "custom_commercial",
	"custom_retirage", "custom_essai_blanc", "custom_statut_commande", "custom_pourcentage_commande", "net_total", "grand_total",
	"_user_tags", BELL_FIELD,
]  # fmt: skip

OUVERTS = ("Open", "Replied")
COMMANDES = ("Ordered", "Partially Ordered")
CLOS = ("Lost", "Expired", "Cancelled")
EXPIRE_SOUS = 7
VIEWS = ("all", "chiffrer", "valider", "valides", "expirent", "commandes", "clos")
SORT_KEYS = {"name", "client_label", "articles", "lignes", "chiffrage", "total", "total_ttc", "status", "commande", "date", "valable", "livraison", "urgence", "commercial", "demande", "ticket", "type", "creation", "modified", "cree_par"}
NUMERIC_SORT = {"lignes", "chiffrage", "total", "total_ttc", "commande"}


def _day(value):
	return str(value) if value else None


def _client(row):
	return row.get("custom_id_client") or row.get("party_name")


def _type(row):
	if row.get("custom_essai_blanc"):
		return "Essai Blanc"
	return "Retirage" if row.get("custom_retirage") else "Premier Tirage"


def in_view(view, row, current_day=None):
	"""Les brouillons se rangent selon leurs prix : une ligne sans prix reste à chiffrer."""
	if view == "all":
		return True
	status = row["status"]
	if view == "chiffrer":
		return status == "Draft" and row["chiffrees"] < row["lignes"]
	if view == "valider":
		return status == "Draft" and row["lignes"] > 0 and row["chiffrees"] == row["lignes"]
	if view == "valides":
		return status in OUVERTS + ("Partially Ordered",)
	if view == "expirent":
		day = getdate(current_day or today())
		return status in OUVERTS and bool(row["valable"]) and day <= getdate(row["valable"]) <= add_days(day, EXPIRE_SOUS)
	if view == "commandes":
		return status in COMMANDES
	return status in CLOS


def _lines_by_devis(names):
	"""Lignes des devis déjà lisibles : leurs articles, et si elles ont un prix."""
	if not names:
		return {}
	rows = frappe.get_all(LIGNES, filters={"parent": ["in", names], "parenttype": DEVIS}, fields=["parent", "item_code", "item_name", "rate"], order_by="idx asc")
	lines = {}
	for row in rows:
		lines.setdefault(row.parent, []).append(row)
	return lines


def _tickets(demandes):
	names = list({name for name in demandes if name})
	if not names:
		return {}
	return {row.name: row.ticket_commercial for row in frappe.get_all(DEMANDE, filters={"name": ["in", names]}, fields=["name", "ticket_commercial"])}


def _list_row(devis, customers, lines, tickets, owners):
	rows = lines.get(devis.name) or []
	first = rows[0] if rows else None
	client = _client(devis)
	client_label = devis.get("customer_name") or (customers.get(client) or {}).get("customer_name") or client
	demande = devis.get(DEMANDE_FIELD)
	ticket = tickets.get(demande)
	return {
		"name": devis.name,
		"modified": str(devis.modified),
		"creation": str(devis.creation),
		"tags": row_tags(devis),
		"cloche": row_bell(devis),
		"status": devis.status,
		"client": client,
		"client_label": client_label,
		"articles": (first.item_name or first.item_code) if first else None,
		"articles_count": len(rows),
		"lignes": len(rows),
		"chiffrees": sum(1 for row in rows if flt(row.rate) > 0),
		# Taux de lignes chiffrées : c'est lui que trie la colonne Chiffrage.
		"chiffrage": round(sum(1 for row in rows if flt(row.rate) > 0) / len(rows), 4) if rows else 0,
		"total": flt(devis.net_total),
		"total_ttc": flt(devis.grand_total),
		"statut_commande": devis.get("custom_statut_commande") or None,
		"commande": flt(devis.get("custom_pourcentage_commande")),
		"date": _day(devis.transaction_date),
		"valable": _day(devis.valid_till),
		"livraison": _day(devis.get("custom_date_de_livraison")),
		"urgence": devis.get("custom_niveau_urgence") or "U0",
		"commercial": devis.get("custom_commercial") or None,
		"demande": demande or None,
		"ticket": ticket or None,
		"type": _type(devis),
		"cree_par": owners.get(devis.owner) or devis.owner,
		# Recherche seulement : retirée avant l'envoi.
		"_search": " ".join(
			cstr(value) for value in (devis.name, client, client_label, demande, ticket, devis.get("custom_commercial"), *[f"{row.item_code} {row.item_name}" for row in rows])
		).casefold(),
	}


def order_devis(rows, sort=None, direction=None):
	"""Les plus récents d'abord, ou par la colonne demandée. Une ligne sans valeur reste à la fin, dans les deux sens."""
	ordered = sorted(rows, key=lambda row: (cstr(row.get("date")), row["creation"], row["name"]), reverse=True)
	if sort not in SORT_KEYS:
		return ordered
	filled = [row for row in ordered if row.get(sort) not in (None, "")]
	empty = [row for row in ordered if row.get(sort) in (None, "")]
	key = (lambda row: flt(row[sort])) if sort in NUMERIC_SORT else (lambda row: cstr(row[sort]).casefold())
	return sorted(filled, key=key, reverse=cstr(direction) == "desc") + empty


def _require_read():
	require_bureau()
	if not frappe.has_permission(DEVIS, "read"):
		raise frappe.PermissionError


@frappe.whitelist()
def get_devis_list(view="all", conditions=None, search=None, start=0, page_length=None, sort=None, direction=None):
	"""Une page de la liste, le total, l'ordre de toute la vue, et les compteurs de toutes les vues pour les mêmes filtres."""
	_require_read()
	if view not in VIEWS:
		frappe.throw(_("Vue inconnue."))
	filters = condition_filters(_parse(conditions), DEVIS)
	found = frappe.get_list(DEVIS, filters=filters, distinct=has_child_filter(filters, DEVIS), fields=FIELDS, limit_page_length=0)
	customers = _customers(_client(row) for row in found)
	lines = _lines_by_devis([row.name for row in found])
	tickets = _tickets(row.get(DEMANDE_FIELD) for row in found)
	owners = {owner: get_fullname(owner) for owner in {row.owner for row in found}}
	rows = [_list_row(row, customers, lines, tickets, owners) for row in found]
	words = cstr(search).casefold().split()
	if words:
		rows = [row for row in rows if all(word in row["_search"] for word in words)]
	for row in rows:
		del row["_search"]
	current_day = today()
	ordered = order_devis([row for row in rows if in_view(view, row, current_day)], sort, direction)
	first, length = page_bounds(len(ordered), start, page_length)
	return {
		"devis": ordered[first : first + length],
		"counts": {name: sum(1 for row in rows if in_view(name, row, current_day)) for name in VIEWS},
		"total": len(ordered),
		"start": first,
		"page_length": length,
		# Toute la vue, pour passer au devis voisin depuis l'aperçu, au-delà de la page affichée.
		"names": [row["name"] for row in ordered],
	}


@frappe.whitelist()
def get_devis_options():
	_require_read()
	return {"doctype": DEVIS, "filter_fields": doctype_filter_fields(DEVIS)}


def _reads_prices():
	"""Les prix des lignes sont au niveau 1 du Devis, comme sur le Desk."""
	return 1 in frappe.get_meta(DEVIS).get_permlevel_access("read")


def _calculs(doc):
	"""Le calcul de chaque ligne, pour l'équipe devis seule : coût unitaire, prix proposé et prix final."""
	if not voit_couts():
		return {}
	rows = frappe.get_all(CALCUL, filters={"devis": doc.name, "docstatus": ["!=", 2]}, fields=["name", "quotation_item_row", "article", "quantite", "cout_unitaire", "prix_unitaire_propose", "prix_propose_final"], order_by="creation asc")
	return {row.quotation_item_row or f"{row.article}|{flt(row.quantite)}": row for row in rows}


def _line(item, calculs, prices):
	calcul = calculs.get(item.name) or calculs.get(f"{item.item_code}|{flt(item.qty)}")
	cost = flt(calcul.cout_unitaire) if calcul else 0
	rate = flt(item.rate)
	line = {
		"name": item.name,
		"article": item.item_code,
		"designation": item.item_name or item.item_code,
		"quantite": flt(item.qty),
		"unite": item.uom,
		"prix": rate if prices else None,
		"montant": flt(item.amount) if prices else None,
		"chiffree": rate > 0,
	}
	if calculs:
		line["calcul"] = {
			"name": calcul.name,
			"cout_unitaire": cost or None,
			"prix_propose": flt(calcul.prix_unitaire_propose) or None,
			"prix_final": flt(calcul.prix_propose_final) or None,
			# Marge sur coût du prix du devis : sans coût, elle ne se calcule pas.
			"marge": round((rate / cost - 1) * 100, 1) if cost and rate else None,
		} if calcul else None
	return line


def _commandes(doc):
	if not frappe.get_meta(COMMANDE).has_field("custom_devis"):
		return []
	readable = bool(frappe.has_permission(COMMANDE, "read"))
	rows = frappe.get_all(COMMANDE, filters={"custom_devis": doc.name, "docstatus": ["!=", 2]}, fields=["name", "status", "docstatus", "transaction_date", "grand_total"], order_by="transaction_date desc, creation desc")
	return [{"name": row.name, "status": "Draft" if row.docstatus == 0 else row.status, "date": _day(row.transaction_date), "total": flt(row.grand_total) if readable else None} for row in rows]


@frappe.whitelist()
def get_devis(name):
	require_bureau()
	doc = frappe.get_doc(DEVIS, name)
	doc.check_permission("read")
	client = _client(doc)
	customers = _customers([client])
	demande = doc.get(DEMANDE_FIELD)
	ticket = frappe.db.get_value(DEMANDE, demande, "ticket_commercial") if demande else None
	prices = _reads_prices()
	calculs = _calculs(doc)
	lines = [_line(item, calculs, prices) for item in doc.items]
	return {
		"name": doc.name,
		"modified": str(doc.modified),
		"creation": str(doc.creation),
		"tags": row_tags(doc),
		"can_write": bool(doc.has_permission("write")),
		"couts": bool(calculs) or voit_couts(),
		"status": doc.status,
		"docstatus": cint(doc.docstatus),
		"type": _type(doc),
		"client": client,
		"client_label": doc.customer_name or (customers.get(client) or {}).get("customer_name") or client,
		"commercial": doc.get("custom_commercial") or None,
		"urgence": doc.get("custom_niveau_urgence") or "U0",
		"date": _day(doc.transaction_date),
		"valable": _day(doc.valid_till),
		"livraison": _day(doc.get("custom_date_de_livraison")) if prices else None,
		"demande": demande or None,
		"ticket": ticket or None,
		"cree_par": get_fullname(doc.owner),
		"lignes": lines,
		"chiffrees": sum(1 for line in lines if line["chiffree"]),
		"total": flt(doc.net_total),
		"taxes": flt(doc.total_taxes_and_charges),
		"total_ttc": flt(doc.grand_total),
		"statut_commande": doc.get("custom_statut_commande") or None,
		"commande": flt(doc.get("custom_pourcentage_commande")),
		"commandes": _commandes(doc),
		"comments": activity.comment_summary(DEVIS, doc.name),
	}
