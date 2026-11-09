# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Commandes du poste de bureau (/bureau/commandes) : liste, aperçu, fiche et validation.

Une commande se crée depuis la fiche d'un devis validé (`bureau_devis.create_commande`). Sur sa fiche, on saisit le
bon de commande du client, on joint son scan, puis l'Administrateur Ventes la valide : les hooks de la commande créent
le dossier de fabrication, mettent le devis à jour et préviennent le commercial. Les prix restent ceux du devis, les
dates de livraison celles de la demande. Les montants sont au niveau de permission 1 : ils ne sortent qu'à qui le lit.
"""

import frappe
from frappe import _
from frappe.utils import cint, cstr, flt, get_fullname, getdate, today

from aurescrm.api import activity
from aurescrm.api.bureau import _parse, condition_filters, doctype_filter_fields, has_child_filter, page_bounds, require_bureau, row_bell, row_tags, BELL_FIELD
from aurescrm.api.bureau_articles import _customers
from aurescrm.api.bureau_clients import bind_file

COMMANDE = "Sales Order"
LIGNES = "Sales Order Item"
DEMANDE = "Demande Faisabilite"
DOSSIER = "Dossier Fabrication"
DEMANDE_FIELD = "custom_demande_de_faisabilité"
ETUDE = "Etude Technique"
SCAN_FIELD = "custom_bon_de_commande_scanne"
# Seul l'Administrateur Ventes valide sur le bureau, même si d'autres rôles ERPNext le peuvent sur le Desk.
VALIDEURS = frozenset({"Administrateur Ventes", "System Manager"})
ETUDES_COMMENCEES = ("En Cours", "Terminé")

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


def scan_pret():
	"""Le champ du scan n'existe qu'après la migration : sans lui, le dépôt ne se propose pas."""
	return frappe.get_meta(COMMANDE).has_field(SCAN_FIELD)


def blocked(doc):
	"""Ce qui empêche de valider un brouillon."""
	reasons = []
	if not doc.get("custom_bon_de_commande_client"):
		reasons.append(_("Le n° du bon de commande du client manque."))
	if not doc.get("custom_date_bon_de_commande"):
		reasons.append(_("La date du bon de commande manque."))
	if not doc.items:
		reasons.append(_("La commande n'a aucun article."))
	missing = sum(1 for item in doc.items if not item.delivery_date)
	if missing:
		reasons.append(_("{0} article(s) sans date de livraison.").format(missing))
	return reasons


def annulation_bloquee(doc):
	"""Pourquoi une commande validée ne s'annule plus : une étude technique commencée, ou une livraison faite."""
	etudes = frappe.get_all(ETUDE, filters={"commande": doc.name, "status": ["in", ETUDES_COMMENCEES], "docstatus": ["<", 2]}, pluck="name", limit=1)
	if etudes:
		return _("Une étude technique est déjà commencée ({0}).").format(etudes[0])
	livraisons = frappe.get_all("Delivery Note Item", filters={"against_sales_order": doc.name, "docstatus": 1}, pluck="parent", limit=1)
	if livraisons:
		return _("Un bon de livraison existe déjà ({0}).").format(livraisons[0])
	return None


def actions(doc):
	"""Ce que cette personne peut faire sur cette commande, maintenant. Le serveur reste seul juge à l'exécution."""
	found = []
	if doc.docstatus == 0 and doc.has_permission("write"):
		found.append("bon")
	if doc.docstatus < 2 and scan_pret() and doc.has_permission("write"):
		found.append("scan")
	user = frappe.session.user
	valideur = user == "Administrator" or bool(VALIDEURS & set(frappe.get_roles(user)))
	if doc.docstatus == 0 and valideur and doc.has_permission("submit"):
		found.append("valider")
	if doc.docstatus == 0 and doc.has_permission("delete"):
		found.append("supprimer")
	if doc.docstatus == 1 and doc.status not in TERMINEES and valideur and doc.has_permission("cancel"):
		found.append("annuler")
	return found


def _etudes(name):
	rows = frappe.get_all(ETUDE, filters={"commande": name, "docstatus": ["<", 2]}, fields=["status"])
	return {
		"total": len([row for row in rows if row.status != "Annulée"]),
		"en_cours": sum(1 for row in rows if row.status == "En Cours"),
		"terminees": sum(1 for row in rows if row.status == "Terminé"),
	}


def fabrication(doc):
	"""Avancement de chaque article : quantités du dossier de fabrication et études techniques, en lecture seule."""
	dossier = frappe.db.get_value(DOSSIER, {"sales_order": doc.name}, "name", order_by="creation desc")
	lignes = {}
	if dossier:
		for row in frappe.get_all(
			"Dossier Fabrication Ligne",
			filters={"parent": dossier, "parenttype": DOSSIER},
			fields=["article", "quantite_commandee", "quantite_programmee", "quantite_produite", "statut_article", "machine"],
		):
			lignes.setdefault(row.article, row)
	etudes = {}
	for row in frappe.get_all(
		ETUDE,
		filters={"commande": doc.name, "docstatus": ["<", 2]},
		fields=["name", "article", "status", "machine", "quantite", "date_planification_production"],
		order_by="date_planification_production asc, creation asc",
	):
		etudes.setdefault(row.article, []).append(
			{"name": row.name, "status": row.status, "machine": row.machine or None, "quantite": flt(row.quantite), "date": _day(row.date_planification_production)}
		)
	rows = []
	seen = set()
	for item in doc.items:
		if item.item_code in seen:
			continue
		seen.add(item.item_code)
		ligne = lignes.get(item.item_code) or {}
		article_etudes = etudes.get(item.item_code) or []
		machine = ligne.get("machine") or next((etude["machine"] for etude in article_etudes if etude["machine"]), None)
		rows.append(
			{
				"article": item.item_code,
				"designation": item.item_name or item.item_code,
				"commandee": flt(ligne.get("quantite_commandee")) or flt(item.qty),
				"programmee": flt(ligne.get("quantite_programmee")),
				"produite": flt(ligne.get("quantite_produite")),
				"statut": ligne.get("statut_article") or None,
				"machine": machine,
				"etudes": article_etudes,
			}
		)
	return rows


def _readable_doctype(doctype):
	return bool(frappe.has_permission(doctype, "read"))


def documents(doc, amounts):
	"""Bons de livraison et factures de la commande, brouillons compris, annulés exclus."""
	found = []
	for doctype, child, link, kind in (
		("Delivery Note", "Delivery Note Item", "against_sales_order", "livraison"),
		("Sales Invoice", "Sales Invoice Item", "sales_order", "facture"),
	):
		parents = list(set(frappe.get_all(child, filters={link: doc.name, "parenttype": doctype}, pluck="parent")))
		if not parents:
			continue
		readable = _readable_doctype(doctype)
		for row in frappe.get_all(
			doctype,
			filters={"name": ["in", parents], "docstatus": ["<", 2]},
			fields=["name", "docstatus", "status", "posting_date", "grand_total"],
			order_by="posting_date asc, creation asc",
		):
			found.append(
				{
					"type": kind,
					"doctype": doctype,
					"name": row.name,
					"status": "Draft" if row.docstatus == 0 else row.status,
					"date": _day(row.posting_date),
					"total": flt(row.grand_total) if amounts else None,
					"lisible": readable,
				}
			)
	return found


def _scan(doc):
	url = doc.get(SCAN_FIELD) if scan_pret() else None
	if not url:
		return None
	return {"url": url, "name": url.rsplit("/", 1)[-1]}


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
	allowed = actions(doc)
	return {
		"name": doc.name,
		"modified": str(doc.modified),
		"creation": str(doc.creation),
		"tags": row_tags(doc),
		"can_write": bool(doc.has_permission("write")),
		"status": "Draft" if doc.docstatus == 0 else doc.status,
		"docstatus": cint(doc.docstatus),
		"client": doc.customer,
		"client_label": doc.customer_name or (customers.get(doc.customer) or {}).get("customer_name") or doc.customer,
		"commercial": doc.get("custom_commercial") or None,
		"urgence": doc.get("custom_niveau_urgence") or "U0",
		"retirage": bool(doc.get("custom_retirage")),
		"date": _day(doc.transaction_date),
		"livraison": prochaine_livraison(doc, doc.items),
		"bon_commande": doc.get("custom_bon_de_commande_client") or None,
		"date_bon": _day(doc.get("custom_date_bon_de_commande")),
		"scan": _scan(doc),
		"devis": doc.get("custom_devis") or None,
		"demande": demande or None,
		"ticket": ticket or None,
		"dossier": dossier,
		"etudes": _etudes(doc.name) if doc.docstatus == 1 else {"total": 0, "en_cours": 0, "terminees": 0},
		"fabrication": fabrication(doc) if doc.docstatus == 1 else [],
		"documents": documents(doc, amounts) if doc.docstatus == 1 else [],
		"cree_par": get_fullname(doc.owner),
		"lignes": [_line(item, amounts) for item in doc.items],
		"livre": flt(doc.per_delivered),
		"facture": flt(doc.per_billed),
		"total": flt(doc.net_total) if amounts else None,
		"taxes": flt(doc.total_taxes_and_charges) if amounts else None,
		"total_ttc": flt(doc.grand_total) if amounts else None,
		"actions": allowed,
		"blocked": blocked(doc) if "valider" in allowed else [],
		"annulation_bloquee": annulation_bloquee(doc) if "annuler" in allowed else None,
		"comments": activity.comment_summary(COMMANDE, doc.name),
	}


def _for_work(name, modified, action):
	"""La commande à modifier : l'action doit être permise, et l'écran à jour."""
	require_bureau()
	doc = frappe.get_doc(COMMANDE, name)
	doc.check_permission("read")
	if modified and cstr(modified) != str(doc.modified):
		frappe.throw(_("Cette commande vient d'être modifiée par ailleurs. Elle a été rechargée : vérifiez-la, puis recommencez."), frappe.TimestampMismatchError)
	if action not in actions(doc):
		frappe.throw(_("Cette action n'est pas possible sur cette commande."), frappe.PermissionError)
	return doc


@frappe.whitelist(methods=["POST"])
def update_commande(name, modified, bon_commande=None, date_bon=None):
	"""N° et date du bon de commande du client, sur un brouillon."""
	from aurescrm.api.bureau_devis import _signed

	doc = _for_work(name, modified, "bon")
	if bon_commande is not None:
		doc.custom_bon_de_commande_client = cstr(bon_commande).strip() or None
	if date_bon is not None:
		if date_bon and getdate(date_bon) > getdate(today()):
			frappe.throw(_("La date du bon de commande ne peut pas être dans le futur."))
		doc.custom_date_bon_de_commande = getdate(date_bon) if date_bon else None
	with _signed(COMMANDE, doc.name):
		doc.save(ignore_permissions=True)
	return get_commande(name)


@frappe.whitelist(methods=["POST"])
def set_bon_scan(name, modified, file_url):
	"""Range dans la commande le scan du bon déjà envoyé, avant comme après la validation."""
	doc = _for_work(name, modified, "scan")
	if not frappe.db.exists("File", {"file_url": file_url, "attached_to_doctype": COMMANDE, "attached_to_name": name}):
		frappe.throw(_("Ce fichier n'est pas joint à cette commande."))
	bind_file(COMMANDE, name, SCAN_FIELD, file_url)
	doc.db_set(SCAN_FIELD, file_url, update_modified=True)
	doc.add_comment("Info", _("a joint le bon de commande scanné"))
	return get_commande(name)


@frappe.whitelist(methods=["POST"])
def validate_commande(name, modified):
	"""Soumet la commande. Les hooks créent le dossier de fabrication, mettent le devis à jour et préviennent le commercial."""
	from aurescrm.api.bureau_devis import _signed

	doc = _for_work(name, modified, "valider")
	reasons = blocked(doc)
	if reasons:
		frappe.throw(" ".join(reasons))
	with _signed(COMMANDE, doc.name):
		doc.flags.ignore_permissions = True
		doc.submit()
	# Les hooks écrivent des messages pour le Desk ; le bureau a sa propre confirmation.
	frappe.local.message_log = []
	return get_commande(name)


@frappe.whitelist(methods=["POST"])
def cancel_commande(name, modified, motif):
	"""Annule une commande validée, motif écrit dans le fil. Le devis repasse à « Ouvert »."""
	from aurescrm.api.bureau_devis import _signed

	doc = _for_work(name, modified, "annuler")
	motif = cstr(motif).strip()
	if not motif:
		frappe.throw(_("Le motif de l'annulation est obligatoire."))
	reason = annulation_bloquee(doc)
	if reason:
		frappe.throw(_("Cette commande ne peut plus être annulée : {0}").format(reason))
	with _signed(COMMANDE, doc.name):
		doc.flags.ignore_permissions = True
		doc.cancel()
	frappe.local.message_log = []
	doc.add_comment("Info", _("a annulé la commande : {0}").format(motif))
	return get_commande(name)


@frappe.whitelist(methods=["POST"])
def delete_commande(name, modified):
	"""Supprime un brouillon : le devis peut recevoir une nouvelle commande."""
	doc = _for_work(name, modified, "supprimer")
	devis = doc.get("custom_devis")
	frappe.delete_doc(COMMANDE, doc.name)
	return {"devis": devis}


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
