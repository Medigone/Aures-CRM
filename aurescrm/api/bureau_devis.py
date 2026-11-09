# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Devis du poste de bureau (/bureau/devis) : liste, aperçu, fiche et cycle.

Un devis se crée depuis une demande de faisabilité (`bureau_demandes.create_devis`). Ici on saisit ses prix (saisie
libre, sans Calcul Devis), on le valide, on crée sa commande ou on le déclare perdu. Le Desk reste possible en parallèle.

Les prix des lignes sont au niveau de permission 1 du Devis : ils ne sortent qu'à qui le lit.
"""

from contextlib import contextmanager

import frappe
from frappe import _
from frappe.utils import add_days, cint, cstr, flt, get_fullname, getdate, now_datetime, today

from aurescrm.api import activity
from aurescrm.api.bureau import BELL_FIELD, _parse, condition_filters, doctype_filter_fields, has_child_filter, page_bounds, require_bureau, row_bell, row_tags
from aurescrm.api.bureau_articles import _customers

DEVIS = "Quotation"
LIGNES = "Quotation Item"
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


def _line(item, prices):
	rate = flt(item.rate)
	return {
		"name": item.name,
		"article": item.item_code,
		"designation": item.item_name or item.item_code,
		"quantite": flt(item.qty),
		"unite": item.uom,
		"prix": rate if prices else None,
		"montant": flt(item.amount) if prices else None,
		"chiffree": rate > 0,
	}


def _commandes(doc):
	if not frappe.get_meta(COMMANDE).has_field("custom_devis"):
		return []
	readable = bool(frappe.has_permission(COMMANDE, "read"))
	rows = frappe.get_all(COMMANDE, filters={"custom_devis": doc.name, "docstatus": ["!=", 2]}, fields=["name", "status", "docstatus", "transaction_date", "grand_total"], order_by="transaction_date desc, creation desc")
	return [{"name": row.name, "status": "Draft" if row.docstatus == 0 else row.status, "date": _day(row.transaction_date), "total": flt(row.grand_total) if readable else None} for row in rows]


def blocked(doc):
	"""Ce qui empêche de valider : une ligne sans prix, une validité manquante ou passée."""
	reasons = []
	if not doc.items:
		reasons.append(_("Le devis n'a aucune ligne."))
	missing = sum(1 for item in doc.items if flt(item.rate) <= 0)
	if missing:
		reasons.append(_("{0} ligne(s) sans prix.").format(missing))
	if not doc.valid_till:
		reasons.append(_("La date de validité manque."))
	elif getdate(doc.valid_till) < getdate(today()):
		reasons.append(_("La date de validité est passée."))
	return reasons


def actions(doc):
	"""Ce que cette personne peut faire sur ce devis, maintenant. Le serveur reste seul juge à l'exécution."""
	found = []
	if doc.docstatus == 0:
		if doc.has_permission("write"):
			found.append("prix")
		if doc.has_permission("submit"):
			found.append("valider")
	elif doc.docstatus == 1:
		ordered = doc.get("custom_statut_commande") == "Entièrement commandé" or doc.status == "Ordered"
		if doc.status in OUVERTS + ("Partially Ordered",) and not ordered and frappe.has_permission(COMMANDE, "create"):
			found.append("commande")
		if doc.status in OUVERTS + ("Expired",) and doc.has_permission("write"):
			found.append("perdu")
		if doc.status not in COMMANDES and doc.status != "Cancelled" and doc.has_permission("cancel"):
			found.append("annuler")
	return found


def _lost(doc):
	if doc.status != "Lost":
		return None
	return {"raisons": [row.lost_reason for row in doc.get("lost_reasons") or []], "precisions": doc.get("order_lost_reason") or None}


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
	lines = [_line(item, prices) for item in doc.items]
	allowed = actions(doc)
	return {
		"name": doc.name,
		"modified": str(doc.modified),
		"creation": str(doc.creation),
		"tags": row_tags(doc),
		"can_write": bool(doc.has_permission("write")),
		"can_print": bool(doc.has_permission("print")),
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
		"actions": allowed,
		"blocked": blocked(doc) if "valider" in allowed else [],
		"raisons_perte": frappe.get_all("Quotation Lost Reason", pluck="name", order_by="name asc") if "perdu" in allowed else [],
		"perte": _lost(doc),
		"comments": activity.comment_summary(DEVIS, doc.name),
	}


@contextmanager
def _signed(doctype, name):
	"""Écrit en tant qu'Administrator, puis rend l'écriture à son auteur.

	ERPNext vérifie le droit de lire le compte client (`get_party_account`) à chaque enregistrement d'un devis ou d'une
	commande, ce que l'équipe devis et le back office n'ont pas. Un droit sur Account remplacerait tous ses droits
	standard : les droits de la personne sont donc contrôlés avant, et seule l'écriture passe par l'administrateur.
	"""
	user = frappe.session.user
	start = now_datetime()
	frappe.set_user("Administrator")
	try:
		yield user
	finally:
		frappe.set_user(user)
	if user == "Administrator":
		return
	frappe.db.set_value(doctype, name, "modified_by", user, update_modified=False)
	for version in frappe.get_all("Version", filters={"ref_doctype": doctype, "docname": name, "owner": "Administrator", "creation": [">=", start]}, pluck="name"):
		frappe.db.set_value("Version", version, {"owner": user, "modified_by": user}, update_modified=False)


def _for_work(name, modified, action):
	"""Le devis à modifier : l'action doit être permise, et l'écran à jour."""
	require_bureau()
	doc = frappe.get_doc(DEVIS, name)
	doc.check_permission("read")
	if modified and cstr(modified) != str(doc.modified):
		frappe.throw(_("Ce devis vient d'être modifié par ailleurs. Il a été rechargé : vérifiez-le, puis recommencez."), frappe.TimestampMismatchError)
	if action not in actions(doc):
		frappe.throw(_("Cette action n'est pas possible sur ce devis."), frappe.PermissionError)
	return doc


@frappe.whitelist(methods=["POST"])
def update_devis(name, modified, prix=None, valable=None):
	"""Prix des lignes et validité d'un brouillon. `prix` : {ligne: prix unitaire HT}."""
	doc = _for_work(name, modified, "prix")
	prix = _parse(prix) or {}
	if prix and 1 not in frappe.get_meta(DEVIS).get_permlevel_access("write"):
		frappe.throw(_("Votre rôle ne peut pas modifier les prix des devis."), frappe.PermissionError)
	if not isinstance(prix, dict):
		frappe.throw(_("Prix illisibles."))
	rows = {row.name: row for row in doc.items}
	for row_name, value in prix.items():
		row = rows.get(row_name)
		if not row:
			frappe.throw(_("Cette ligne n'est plus dans le devis : rechargez-le."))
		rate = flt(value)
		if rate < 0:
			frappe.throw(_("Un prix ne peut pas être négatif."))
		row.rate = rate
	if valable is not None:
		if not valable:
			frappe.throw(_("La date de validité est obligatoire."))
		if getdate(valable) < getdate(doc.transaction_date):
			frappe.throw(_("La validité ne peut pas précéder la date du devis."))
		doc.valid_till = getdate(valable)
	with _signed(DEVIS, doc.name):
		doc.save(ignore_permissions=True)
	return get_devis(name)


@frappe.whitelist(methods=["POST"])
def validate_devis(name, modified):
	"""Soumet le devis : il ne se modifie plus. Le commercial est prévenu par les hooks du devis."""
	doc = _for_work(name, modified, "valider")
	reasons = blocked(doc)
	if reasons:
		frappe.throw(" ".join(reasons))
	with _signed(DEVIS, doc.name):
		doc.flags.ignore_permissions = True
		doc.submit()
	return get_devis(name)


@frappe.whitelist(methods=["POST"])
def create_commande(name, modified):
	"""Commande en brouillon, des articles restant à commander. Les règles (créance du ticket) sont celles du Desk."""
	from aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial import assert_can_create_sales_order_from_ticket
	from aurescrm.quotation import _get_ticket_commercial_from_quotation, make_sales_order_draft

	doc = _for_work(name, modified, "commande")
	# La règle de créance se lit avec les droits de la personne, avant l'écriture.
	assert_can_create_sales_order_from_ticket(_get_ticket_commercial_from_quotation(doc.name), doc.name)
	user = frappe.session.user
	frappe.set_user("Administrator")
	try:
		commande = make_sales_order_draft(doc.name)
	finally:
		frappe.set_user(user)
	frappe.db.set_value(COMMANDE, commande, {"owner": user, "modified_by": user}, update_modified=False)
	return {"commande": commande, "devis": get_devis(name)}


@frappe.whitelist(methods=["POST"])
def mark_lost(name, modified, raison, concurrent=None, precisions=None):
	"""Perdu, avec sa raison. Le concurrent est noté dans les précisions : la liste des concurrents du Desk n'est pas tenue."""
	doc = _for_work(name, modified, "perdu")
	raison = cstr(raison).strip()
	if not raison or not frappe.db.exists("Quotation Lost Reason", raison):
		frappe.throw(_("Choisissez une raison de perte."))
	detail = "\n".join(text for text in (cstr(precisions).strip(), cstr(concurrent).strip() and _("Concurrent retenu : {0}").format(cstr(concurrent).strip())) if text)
	with _signed(DEVIS, doc.name):
		doc.declare_enquiry_lost([{"lost_reason": raison}], [], detail or None)
	return get_devis(name)


@frappe.whitelist(methods=["POST"])
def cancel_devis(name, modified):
	doc = _for_work(name, modified, "annuler")
	with _signed(DEVIS, doc.name):
		doc.flags.ignore_permissions = True
		doc.cancel()
	return get_devis(name)


def _readable(name):
	require_bureau()
	frappe.get_doc(DEVIS, name).check_permission("read")
	return name


@frappe.whitelist()
def get_devis_activity(name):
	return activity.get_feed(DEVIS, _readable(name))


@frappe.whitelist(methods=["POST"])
def add_devis_comment(name, text, mentions=None):
	return activity.add_comment(DEVIS, _readable(name), text, mentions)


@frappe.whitelist(methods=["POST"])
def update_devis_comment(name, comment, text, mentions=None):
	return activity.update_comment(DEVIS, _readable(name), comment, text, mentions)


@frappe.whitelist(methods=["POST"])
def delete_devis_comment(name, comment):
	return activity.delete_comment(DEVIS, _readable(name), comment)
