# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Articles du poste de bureau (/bureau/articles) : liste, fiche, création et modification.

Même contrat que `bureau_clients.py` : les listes passent par `frappe.get_list`, chaque écriture passe par
`doc.insert()` ou `doc.save()` pour garder les hooks de l'Item (code, désignation, cotations, description), et une
modification reçoit la date `modified` affichée à l'écran. Un document lié que le rôle ne peut pas lire donne une
liste vide. La fiche technique suit `article_schema`, c'est-à-dire les sections et les conditions du Desk.
"""

import frappe
from frappe import _
from frappe.utils import cint, cstr, flt, get_fullname

from aurescrm.api import activity
from aurescrm.api.bureau import TICKET, _parse, condition_filters, page_bounds, require_bureau, row_tags
from aurescrm.api.bureau_clients import COMMERCIAL_FIELD, CUSTOMER, RELATED_LIMIT, _note, _readable, bind_file, ticket_rows
from aurescrm.api.commercial_mobile import article_fiche, article_schema
from aurescrm.aures_crm.doctype.etude_technique.etude_technique import create_new_bat_from_etude
from aurescrm.api.commercial_mutations import ARTICLE_ITEM_GROUP, ARTICLE_UOM, Refused, _article_default, _article_value
from aurescrm.utils import create_sous_article

ITEM = "Item"
PROCEDE_FIELD = "custom_procédé"
OFFSET = "Offset"
FLEXO = "Flexo"
SALLE_BLANCHE = "Salle Blanche Pharma"
TYPE_CLIENT = "Client"
TYPE_GENERAL = "Général"
BAT_VALIDATED = ("BAT-E Validé", "BAT-P Validé")
BAT_OBSOLETE = "Obsolète"
MAQUETTE_ACTIVE = "Version Activée"
ROOT_ITEM_GROUP = "Tous les Groupes d'Articles"

LIST_FIELDS = [
	"name",
	"modified",
	"item_name",
	"item_group",
	"custom_type_article",
	"custom_client",
	PROCEDE_FIELD,
	"custom_support",
	"custom_grammage",
	"custom_type_support",
	"custom_epaisseur",
	"custom_epaisseur_sb",
	"custom_découpe",
	"custom_laize",
	"custom_cotations_article",
	"custom_dimensions_h_x_l",
	"custom_code_client",
	"custom_nbr_couleurs",
	"custom_nombre_de_couleurs",
	"custom_consommation_annuelle",
	"custom_article_compose",
	"custom_sous_article",
	"custom_article_parent",
	"_user_tags",
]

# Filtre de la liste → (champ de l'article, nature de la valeur), au format de `bureau.condition_filters`.
FILTER_FIELDS = {
	"designation": ("item_name", "text"),
	"reference": ("custom_code_client", "text"),
	"procede": (PROCEDE_FIELD, "choice"),
	"client": ("custom_client", "choice"),
	"groupe": ("item_group", "choice"),
	"type": ("custom_type_article", "choice"),
	"support": ("custom_support", "choice"),
	"tag": ("_user_tags", "text"),
}

VIEWS = {
	"all": lambda row: True,
	"offset": lambda row: row["procede"] == OFFSET,
	"flexo": lambda row: row["procede"] == FLEXO,
	"salle_blanche": lambda row: row["procede"] == SALLE_BLANCHE,
	# Un article général (matière, support) n'a pas de BAT : il n'a rien à faire dans cette vue.
	"sans_bat": lambda row: row["type"] == TYPE_CLIENT and row["bat"] not in BAT_VALIDATED,
	"compose": lambda row: bool(row["compose"]),
	"general": lambda row: row["type"] == TYPE_GENERAL,
}
SORT_KEYS = {"designation", "name", "client_label", "procede", "support", "format", "bat", "commande", "reference", "commercial", "groupe", "couleurs", "consommation"}

# Fichiers de la colonne d'identité → champ de l'article.
ARTICLE_FILES = {
	"image": "image",
	"fiche_technique": "custom_fiche_technique_article",
	"trace_decoupe": "custom_tracé_forme_découpe",
}
REQUIRED_MESSAGES = {
	"designation": _("Saisissez la désignation."),
	"client": _("Choisissez le client."),
	"procede": _("Choisissez le procédé."),
	"groupe": _("Choisissez le groupe d'article."),
}


def _select_options(fieldname):
	return [option for option in cstr(frappe.get_meta(ITEM).get_field(fieldname).options).split("\n") if option]


def support_label(item):
	"""Le support tel qu'on le nomme selon le procédé : « BBTB 275 g », « BOPP Transparent 30µ »."""
	procede = item.get(PROCEDE_FIELD)
	if procede == FLEXO:
		return " ".join(part for part in (item.get("custom_type_support"), item.get("custom_epaisseur")) if part) or None
	if procede == SALLE_BLANCHE:
		return item.get("custom_découpe") or item.get("custom_epaisseur_sb") or None
	paper, grammage = item.get("custom_support"), item.get("custom_grammage")
	return " ".join(part for part in (paper, f"{grammage} g" if grammage else None) if part) or None


def format_label(item):
	"""Dimensions selon le procédé, en millimètres : « 100×200×34 »."""
	procede = item.get(PROCEDE_FIELD)
	if procede == SALLE_BLANCHE:
		laize = cstr(item.get("custom_laize"))
		return f"Laize {laize.replace(' mm', '')}" if laize else None
	value = item.get("custom_dimensions_h_x_l") if procede == FLEXO else item.get("custom_cotations_article")
	return cstr(value).replace("x", "×").replace("X", "×") or None


def last_bats(names):
	"""Dernier BAT de chaque article : le plus récent encore en vigueur, sinon le plus récent devenu obsolète."""
	if not names or not _readable("BAT"):
		return {}
	rows = frappe.get_list("BAT", filters={"article": ["in", names]}, fields=["name", "article", "status", "image"], order_by="modified desc", limit_page_length=0)
	latest = {}
	for row in rows:
		current = latest.get(row.article)
		if not current or (current.status == BAT_OBSOLETE and row.status != BAT_OBSOLETE):
			latest[row.article] = row
	return latest


def _last_orders(names):
	if not names:
		return {}
	return dict(
		frappe.db.sql(
			"""
			select soi.item_code, max(so.transaction_date)
			from `tabSales Order Item` soi join `tabSales Order` so on so.name = soi.parent
			where soi.item_code in %(names)s and so.docstatus < 2
			group by soi.item_code
			""",
			{"names": names},
		)
	)


def _customers(names):
	"""Nom affiché et commercial des clients. L'article est déjà lisible : ce sont ses libellés, pas un accès au client."""
	names = list({name for name in names if name})
	if not names:
		return {}
	rows = frappe.get_all(CUSTOMER, filters={"name": ["in", names]}, fields=["name", "customer_name", "custom_nom_commercial", "custom_wilaya", COMMERCIAL_FIELD])
	return {row.name: row for row in rows}


def _procede(item):
	"""Le Desk met Offset par défaut, y compris sur un article général, qui n'a pas de procédé."""
	return None if item.get("custom_type_article") == TYPE_GENERAL else item.get(PROCEDE_FIELD)


def _list_row(item, customers, bats, orders):
	customer = customers.get(item.custom_client) or {}
	return {
		"name": item.name,
		"modified": item.modified,
		"tags": row_tags(item),
		"designation": item.item_name or item.name,
		"type": item.custom_type_article,
		"client": item.custom_client,
		"client_label": customer.get("customer_name") or item.custom_client,
		"commercial": customer.get("custom_nom_commercial"),
		"procede": _procede(item),
		"support": support_label(item),
		"format": format_label(item),
		"bat": (bats.get(item.name) or {}).get("status"),
		"commande": orders.get(item.name),
		"reference": item.custom_code_client,
		"groupe": item.item_group,
		"couleurs": item.custom_nbr_couleurs or item.custom_nombre_de_couleurs,
		"consommation": cint(item.custom_consommation_annuelle),
		"compose": cint(item.custom_article_compose),
		"sous_article": cint(item.custom_sous_article),
		"parent": item.custom_article_parent,
	}


def order_articles(rows, sort=None, direction=None):
	"""Par désignation, ou par la colonne demandée. Une ligne sans valeur reste à la fin, dans les deux sens."""
	key = sort if sort in SORT_KEYS else "designation"
	descending = cstr(direction) == "desc" and sort in SORT_KEYS

	ordered = sorted(rows, key=lambda row: cstr(row["designation"]).casefold())
	filled = [row for row in ordered if row.get(key) not in (None, "", 0)]
	empty = [row for row in ordered if row.get(key) in (None, "", 0)]

	def value(row):
		item = row[key]
		return item if isinstance(item, (int, float)) else cstr(item).casefold()

	return sorted(filled, key=value, reverse=descending) + empty


def _search_filters(value):
	"""Recherche sur l'article et sur le nom du client, que l'article ne porte pas."""
	if not value:
		return None
	pattern = f"%{value}%"
	filters = [["item_name", "like", pattern], ["name", "like", pattern], ["custom_code_client", "like", pattern], ["custom_client", "like", pattern]]
	clients = frappe.get_all(CUSTOMER, filters={"customer_name": ["like", pattern]}, pluck="name", limit_page_length=200)
	if clients:
		filters.append(["custom_client", "in", clients])
	return filters


@frappe.whitelist()
def get_articles(view="all", conditions=None, search=None, start=0, page_length=None, sort=None, direction=None):
	"""Une page de la liste, le total, l'ordre de toute la vue, et les compteurs de toutes les vues pour les mêmes filtres."""
	require_bureau()
	if view not in VIEWS:
		frappe.throw(_("Vue inconnue."))
	items = frappe.get_list(
		ITEM,
		filters=[["disabled", "=", 0], *condition_filters(_parse(conditions), FILTER_FIELDS)],
		or_filters=_search_filters(cstr(search).strip()),
		fields=LIST_FIELDS,
		limit_page_length=0,
	)
	names = [item.name for item in items]
	customers, bats, orders = _customers(item.custom_client for item in items), last_bats(names), _last_orders(names)
	rows = [_list_row(item, customers, bats, orders) for item in items]
	counts = {name: sum(1 for row in rows if test(row)) for name, test in VIEWS.items()}
	ordered = order_articles([row for row in rows if VIEWS[view](row)], sort, direction)
	first, length = page_bounds(len(ordered), start, page_length)
	return {
		"articles": ordered[first : first + length],
		"counts": counts,
		"total": len(ordered),
		"start": first,
		"page_length": length,
		# Toute la vue, pour aller à l'article voisin depuis la fiche, au-delà de la page affichée.
		"names": [row["name"] for row in ordered],
	}


@frappe.whitelist()
def get_article_options():
	"""Valeurs proposées dans les filtres et la fenêtre, et sections de la fiche technique telles que le Desk les présente."""
	require_bureau()
	used = frappe.get_list(ITEM, filters={"disabled": 0, "custom_client": ["is", "set"]}, pluck="custom_client", distinct=True, limit_page_length=0)
	customers = _customers(used)
	clients = [{"value": name, "label": customers[name].customer_name or name} for name in customers]
	return {
		"procedes": _select_options(PROCEDE_FIELD),
		"types": _select_options("custom_type_article"),
		"groupes": [name for name in frappe.get_list("Item Group", order_by="name asc", pluck="name", limit_page_length=0) if name != ROOT_ITEM_GROUP],
		"supports": frappe.get_list("Type Papier", order_by="name asc", pluck="name", limit_page_length=0),
		"clients": sorted(clients, key=lambda client: cstr(client["label"]).casefold()),
		"groupe_defaut": ARTICLE_ITEM_GROUP,
		"can_create": bool(frappe.has_permission(ITEM, "create")),
		"schema": article_schema(),
	}


def _list_or_empty(doctype, filters, fields, order_by="modified desc"):
	if not _readable(doctype):
		return []
	return frappe.get_list(doctype, filters=filters, fields=fields, order_by=order_by, limit_page_length=RELATED_LIMIT)


def _prepresse(name):
	maquettes = _list_or_empty(
		"Maquette",
		{"article": name},
		["name", "status", "ver", "resume_couleurs", "date_creation", "date_activation", "desc_changements", "fichier_maquette", "nom_reference_par"],
		"creation desc",
	)
	# Champ à mise en forme sur le Desk : le texte seul quitte le serveur.
	for row in maquettes:
		row.desc_changements = _note(row.desc_changements)
	return {
		"maquettes": maquettes,
		"bats": _list_or_empty("BAT", {"article": name}, ["name", "status", "date", "maquette", "valide_par_nom", "fichier_valide", "image"], "creation desc"),
		"traces": _list_or_empty("Trace", {"article": name}, ["name", "dimensions", "fichier_trace"], "creation desc"),
		"impositions": _list_or_empty(
			"Imposition",
			{"article": name},
			["name", "machine_impression", "nbr_poses", "taux_chutes", "defaut", "fichier_imp"],
			"defaut desc, creation desc",
		),
		"cliches": _list_or_empty("Cliche", {"article": name, "docstatus": ["<", 2]}, ["name", "status", "date", "version", "version_active", "nbr_couleurs"], "version_active desc, creation desc"),
		"plans_flexo": _list_or_empty("Plan Flexo", {"article": name}, ["name", "date", "dimensions", "laize", "fichier"], "creation desc"),
		"etudes_techniques": _list_or_empty(
			"Etude Technique",
			{"article": name, "docstatus": ["<", 2]},
			["name", "status", "date", "nom_utilisateur", "machine", "nb_passages", "maquette", "bat"],
			"creation desc",
		),
	}


def _documents(doc):
	"""Fichiers de l'article, une ligne par fichier : le même peut servir de visuel et de tracé."""
	roles = {}
	for key, fieldname in ARTICLE_FILES.items():
		if doc.get(fieldname):
			roles.setdefault(doc.get(fieldname), []).append(key)
	rows = {}
	for file in frappe.get_all(
		"File",
		filters={"attached_to_doctype": ITEM, "attached_to_name": doc.name, "is_folder": 0},
		fields=["file_name", "file_url", "file_size", "owner", "creation"],
		order_by="creation desc",
	):
		if file.file_url in rows:
			continue
		rows[file.file_url] = {
			"file_name": file.file_name or file.file_url,
			"file_url": file.file_url,
			"file_size": cint(file.file_size),
			"owner_name": get_fullname(file.owner),
			"creation": str(file.creation),
			"roles": roles.get(file.file_url, []),
		}
	return list(rows.values())


def bat_gap(bats, maquettes):
	"""BAT validé dont la maquette n'est plus la version activée. Sans maquette renseignée sur le BAT, rien à comparer."""
	validated = next((row for row in bats if row.get("status") in BAT_VALIDATED), None)
	active = next((row for row in maquettes if row.get("status") == MAQUETTE_ACTIVE), None)
	if not validated or not active or not validated.get("maquette") or validated.get("maquette") == active.get("name"):
		return None
	return {"bat": validated.get("name"), "maquette_bat": validated.get("maquette"), "maquette_active": active.get("name")}


def _ventes(doctype, child, name):
	"""Une ligne par pièce et par ligne d'article : la quantité et le prix sont ceux de cet article, pas le total de la pièce."""
	if not _readable(doctype):
		return []
	fields = ["name", "transaction_date", "status", f"`tab{child}`.qty as qty", f"`tab{child}`.rate as rate", f"`tab{child}`.amount as amount"]
	if doctype == "Quotation":
		fields.append("custom_statut_commande")
	return frappe.get_list(
		doctype,
		filters=[[child, "item_code", "=", name], [doctype, "docstatus", "<", 2]],
		fields=fields,
		order_by=f"`tab{doctype}`.transaction_date desc, `tab{doctype}`.name desc",
		limit_page_length=RELATED_LIMIT,
	)


def _etudes(name):
	rows = []
	for doctype in ("Etude Faisabilite", "Etude Faisabilite Flexo"):
		for row in _list_or_empty(doctype, {"article": name, "docstatus": ["<", 2]}, ["name", "date_creation", "status", "quantite"], "creation desc"):
			row.doctype = doctype
			rows.append(row)
	rows.sort(key=lambda row: cstr(row.date_creation), reverse=True)
	return rows


def _tickets(name):
	"""Un ticket ne porte pas d'article : il se retrouve par sa demande de faisabilité, son dossier d'essai ou son devis rapproché."""
	demandes = frappe.get_all("Articles Demande Faisabilite", filters={"article": name, "parenttype": "Demande Faisabilite"}, pluck="parent")
	dossiers = frappe.get_all("Articles Dossier Essai Blanc", filters={"article": name, "parenttype": "Dossier Essai Blanc"}, pluck="parent")
	devis = frappe.get_all("Quotation Item", filters={"item_code": name, "parenttype": "Quotation"}, pluck="parent")
	direct = set()
	if demandes:
		direct.update(frappe.get_all("Demande Faisabilite", filters={"name": ["in", demandes]}, pluck="ticket_commercial"))
	if dossiers:
		direct.update(frappe.get_all("Dossier Essai Blanc", filters={"name": ["in", dossiers]}, pluck="ticket_commercial"))
	direct.discard(None)
	direct.discard("")
	or_filters = []
	if direct:
		or_filters.append(["name", "in", list(direct)])
	if demandes:
		or_filters.append(["demande_faisabilite_rapprochee", "in", demandes])
	if devis:
		or_filters.append(["devis_rapproche", "in", devis])
	if not or_filters or not _readable(TICKET):
		return []
	return ticket_rows(or_filters=or_filters)


def _sous_articles(name):
	items = frappe.get_list(ITEM, filters={"custom_article_parent": name, "disabled": 0}, fields=[*LIST_FIELDS, "custom_quantite_sous_article"], order_by="name asc", limit_page_length=RELATED_LIMIT)
	bats = last_bats([item.name for item in items])
	return [
		{
			"name": item.name,
			"designation": item.item_name or item.name,
			"quantite": flt(item.custom_quantite_sous_article),
			"support": support_label(item),
			"format": format_label(item),
			"bat": (bats.get(item.name) or {}).get("status"),
		}
		for item in items
	]


def _article_payload(doc):
	customer = _customers([doc.custom_client]).get(doc.custom_client) or {}
	prepresse = _prepresse(doc.name)
	bats = last_bats([doc.name])
	last = bats.get(doc.name) or {}
	parent = frappe.db.get_value(ITEM, doc.custom_article_parent, "item_name") if doc.custom_article_parent else None
	schema = article_schema()
	return {
		"name": doc.name,
		"modified": doc.modified,
		"tags": row_tags(doc.as_dict()),
		"designation": doc.item_name or doc.name,
		"type": doc.custom_type_article,
		"procede": _procede(doc),
		"support": support_label(doc),
		"format": format_label(doc),
		"reference": doc.custom_code_client,
		"ancien_code": doc.custom_ancien_code,
		"groupe": doc.item_group,
		"unite": doc.stock_uom,
		"consommation": cint(doc.custom_consommation_annuelle),
		"couleurs": doc.custom_nbr_couleurs or doc.custom_nombre_de_couleurs,
		"compose": cint(doc.custom_article_compose),
		"sous_article": cint(doc.custom_sous_article),
		"parent": doc.custom_article_parent,
		"parent_label": parent,
		"quantite_parent": flt(doc.custom_quantite_sous_article),
		"client": doc.custom_client,
		"client_label": customer.get("customer_name") or doc.custom_client,
		"wilaya": customer.get("custom_wilaya"),
		"commercial": customer.get("custom_nom_commercial"),
		"commercial_user": customer.get(COMMERCIAL_FIELD),
		"bat": last.get("status"),
		# Le visuel de l'article, sinon l'image de son dernier BAT.
		"image": doc.image or last.get("image"),
		"own_image": bool(doc.image),
		"fichiers": {key: doc.get(fieldname) for key, fieldname in ARTICLE_FILES.items()},
		"documents": _documents(doc),
		"fiche": article_fiche(doc, schema["fields"]),
		"prepresse": prepresse,
		"ecart_bat": bat_gap(prepresse["bats"], prepresse["maquettes"]),
		"commandes": _ventes("Sales Order", "Sales Order Item", doc.name),
		"devis": _ventes("Quotation", "Quotation Item", doc.name),
		"etudes": _etudes(doc.name),
		"tickets": _tickets(doc.name),
		"sous_articles": _sous_articles(doc.name) if cint(doc.custom_article_compose) else [],
		"comments": activity.comment_summary(ITEM, doc.name),
		"can_edit": bool(doc.has_permission("write")),
		"droits_prepresse": {
			"maquette": bool(frappe.has_permission("Maquette", "write")),
			"nouvelle_version": bool(frappe.has_permission("Maquette", "create")),
			"bat": bool(frappe.has_permission("BAT", "create")),
		},
	}


@frappe.whitelist()
def get_article(name):
	require_bureau()
	doc = frappe.get_doc(ITEM, name)
	doc.check_permission("read")
	return _article_payload(doc)


def _clean_values(values):
	values = _parse(values) or {}
	fiche = values.pop("fiche", None) or {}
	return {key: cstr(value).strip() for key, value in values.items()}, fiche


def _require(values, keys):
	for key in keys:
		if not values.get(key):
			frappe.throw(REQUIRED_MESSAGES[key])


def _check_choice(value, choices, message):
	if value not in choices:
		frappe.throw(message)


def _duplicate_message(designation, client=None, current=None):
	"""Un client n'a qu'un article de ce nom ; pour un article général, le contrôle porte sur tous les articles généraux."""
	label = designation.upper()
	filters = {"item_code": label}
	filters.update({"custom_client": client} if client else {"custom_type_article": TYPE_GENERAL})
	existing = frappe.db.get_value(ITEM, filters, "name")
	if not existing or existing == current:
		return None
	if client:
		return _("Le client a déjà un article « {0} ».").format(label)
	return _("Un article général « {0} » existe déjà.").format(label)


def _check_unique(designation, client=None, current=None):
	message = _duplicate_message(designation, client, current)
	if message:
		frappe.throw(message)


@frappe.whitelist()
def check_article_designation(designation, client=None):
	"""Contrôle avant la fiche technique : la désignation est refusée dès la première phase, pas après toute la saisie."""
	require_bureau()
	return {"message": _duplicate_message(cstr(designation).strip(), client or None)}


def _apply_fiche(doc, fiche):
	"""Seuls les champs de la fiche technique du Desk passent, chacun contrôlé selon son type."""
	fields = {field["fieldname"]: field for group in article_schema()["groups"] for field in group["fields"]}
	for fieldname, value in (fiche or {}).items():
		if fieldname not in fields:
			frappe.throw(_("Le champ {0} ne se modifie pas ici.").format(fieldname))
		try:
			doc.set(fieldname, _article_value(fields[fieldname], value))
		except Refused as error:
			frappe.throw(str(error))


@frappe.whitelist(methods=["POST"])
def create_article(values=None):
	"""Crée un article client ou général. Le code vient du hook de nommage, la description des hooks de l'Item."""
	require_bureau()
	values, fiche = _clean_values(values)
	kind = values.get("type") or TYPE_CLIENT
	_check_choice(kind, _select_options("custom_type_article"), _("Type d'article inconnu."))
	general = kind == TYPE_GENERAL
	_require(values, ["designation", "groupe"] if general else ["designation", "client", "procede", "groupe"])
	if not general:
		_check_choice(values["procede"], _select_options(PROCEDE_FIELD), _("Procédé inconnu."))
	_check_unique(values["designation"], None if general else values["client"])
	doc = frappe.new_doc(ITEM)
	doc.update(
		{
			"item_code": values["designation"],
			"custom_type_article": kind,
			"item_group": values["groupe"],
			"stock_uom": _article_default("UOM", ARTICLE_UOM, "stock_uom"),
			"is_stock_item": 1,
		}
	)
	if general:
		doc.custom_ancien_code = values.get("ancien_code") or None
	else:
		doc.custom_client = values["client"]
		doc.set(PROCEDE_FIELD, values["procede"])
		doc.custom_code_client = values.get("reference") or None
		_apply_fiche(doc, fiche)
	doc.insert()
	return {"name": doc.name}


def _article_for_write(name, modified):
	"""Article à modifier : mêmes droits que le Desk, et version identique à celle affichée à l'écran."""
	require_bureau()
	doc = frappe.get_doc(ITEM, name)
	doc.check_permission("write")
	if modified and cstr(modified) != str(doc.modified):
		frappe.throw(
			_("Cet article vient d'être modifié par ailleurs. Il a été rechargé : vérifiez-le, puis recommencez."),
			frappe.TimestampMismatchError,
		)
	return doc


@frappe.whitelist(methods=["POST"])
def update_article(name, modified, values=None):
	"""Seuls les champs changés arrivent : ce qu'un autre a modifié sur le Desk entre-temps sur un autre champ reste."""
	doc = _article_for_write(name, modified)
	values, fiche = _clean_values(values)
	_require(values, [key for key in ("designation", "groupe") if key in values])
	if "designation" in values:
		_check_unique(values["designation"], doc.custom_client, doc.name)
		doc.item_code = values["designation"]
	if "groupe" in values:
		doc.item_group = values["groupe"]
	if "procede" in values:
		_require(values, ["procede"])
		_check_choice(values["procede"], _select_options(PROCEDE_FIELD), _("Procédé inconnu."))
		doc.set(PROCEDE_FIELD, values["procede"])
	if "reference" in values:
		doc.custom_code_client = values["reference"] or None
	if "ancien_code" in values:
		doc.custom_ancien_code = values["ancien_code"] or None
	if "consommation" in values:
		doc.custom_consommation_annuelle = cint(values["consommation"]) or None
	_apply_fiche(doc, fiche)
	doc.save()
	return _article_payload(doc)


@frappe.whitelist(methods=["POST"])
def set_article_file(name, modified, piece, file_url):
	"""Range un fichier déjà joint dans le champ choisi : visuel, BAT ou tracé de découpe. Sans fichier, le champ se vide."""
	doc = _article_for_write(name, modified)
	if piece not in ARTICLE_FILES:
		frappe.throw(_("Pièce inconnue."))
	if file_url:
		if not frappe.db.exists("File", {"file_url": file_url, "attached_to_doctype": ITEM, "attached_to_name": name}):
			frappe.throw(_("Ce fichier n'est pas joint à cet article."))
		bind_file(ITEM, name, ARTICLE_FILES[piece], file_url)
	doc.set(ARTICLE_FILES[piece], file_url or None)
	doc.save()
	return _article_payload(doc)


@frappe.whitelist(methods=["POST"])
def remove_article_file(name, modified, file_url):
	"""Retire le fichier de l'article, et des champs qui s'en servent."""
	doc = _article_for_write(name, modified)
	files = frappe.get_all("File", filters={"file_url": file_url, "attached_to_doctype": ITEM, "attached_to_name": name}, pluck="name")
	if not files:
		frappe.throw(_("Ce fichier n'est pas joint à cet article."))
	used = [fieldname for fieldname in ARTICLE_FILES.values() if doc.get(fieldname) == file_url]
	for fieldname in used:
		doc.set(fieldname, None)
	if used:
		doc.save()
	# Droits contrôlés ci-dessus : le rôle n'a pas forcément de droit direct sur le DocType File.
	for file in files:
		frappe.delete_doc("File", file, ignore_permissions=True)
	return _article_payload(frappe.get_doc(ITEM, name))


def _maquette_for_write(name, maquette):
	require_bureau()
	doc = frappe.get_doc("Maquette", maquette)
	if doc.article != name:
		frappe.throw(_("Cette maquette n'appartient pas à cet article."))
	doc.check_permission("write")
	return doc


def _refreshed(name):
	frappe.get_doc(ITEM, name).check_permission("read")
	return _article_payload(frappe.get_doc(ITEM, name))


@frappe.whitelist(methods=["POST"])
def reference_maquette(name, maquette):
	"""Même règle que le bouton Référencée du Desk."""
	if not _maquette_for_write(name, maquette).set_status_referenced():
		frappe.throw(_("Seule une maquette à référencer peut être référencée."))
	return _refreshed(name)


@frappe.whitelist(methods=["POST"])
def activate_maquette(name, maquette):
	"""Même règle que le bouton Activer du Desk : l'ancienne version et ses BAT deviennent obsolètes."""
	if not _maquette_for_write(name, maquette).activate_version():
		frappe.throw(_("Seule une maquette référencée ou obsolète peut être activée."))
	return _refreshed(name)


@frappe.whitelist(methods=["POST"])
def new_maquette_version(name, maquette, changes):
	"""Même règle que le bouton Nouvelle Version du Desk : un PV de destruction part en brouillon."""
	doc = _maquette_for_write(name, maquette)
	frappe.has_permission("Maquette", "create", throw=True)
	if doc.status != MAQUETTE_ACTIVE:
		frappe.throw(_("Une nouvelle version part de la version activée."))
	if not cstr(changes).strip():
		frappe.throw(_("Décrivez ce qui change."))
	result = doc.create_new_version(cstr(changes).strip())
	created = result["new_version"] if isinstance(result, dict) else result
	return {"name": created, "article": _refreshed(name)}


@frappe.whitelist(methods=["POST"])
def set_maquette_file(name, maquette, file_url):
	"""Range le fichier déjà joint à la maquette dans son champ."""
	doc = _maquette_for_write(name, maquette)
	if not frappe.db.exists("File", {"file_url": file_url, "attached_to_doctype": "Maquette", "attached_to_name": maquette}):
		frappe.throw(_("Ce fichier n'est pas joint à cette maquette."))
	bind_file("Maquette", maquette, "fichier_maquette", file_url)
	doc.fichier_maquette = file_url
	doc.save()
	return _refreshed(name)


@frappe.whitelist(methods=["POST"])
def create_article_bat(name, etude):
	"""Même règle que le bouton du Desk sur l'étude technique : l'éventuel ancien BAT de l'étude devient obsolète."""
	require_bureau()
	frappe.has_permission("BAT", "create", throw=True)
	doc = frappe.get_doc("Etude Technique", etude)
	if doc.article != name:
		frappe.throw(_("Cette étude technique n'appartient pas à cet article."))
	doc.check_permission("write")
	if not doc.maquette:
		frappe.throw(_("L'étude technique {0} n'a pas de maquette : renseignez-la d'abord.").format(etude))
	result = create_new_bat_from_etude(etude)
	if result.get("status") != "success":
		frappe.throw(result.get("message") or _("Le BAT n'a pas pu être créé."))
	return _refreshed(name)


@frappe.whitelist(methods=["POST"])
def make_composed(name, modified):
	"""Transforme l'article en article composé, comme le bouton du Desk."""
	doc = _article_for_write(name, modified)
	if cint(doc.custom_sous_article):
		frappe.throw(_("Un sous-article ne peut pas devenir un article composé."))
	doc.custom_article_compose = 1
	doc.save()
	return _article_payload(doc)


@frappe.whitelist(methods=["POST"])
def add_sous_article(name, designation, quantite):
	"""Même création que sur le Desk : le sous-article reprend la fiche de son parent."""
	require_bureau()
	child = create_sous_article(name, designation, quantite)
	return {"name": child, "article": _article_payload(frappe.get_doc(ITEM, name))}


@frappe.whitelist()
def get_article_activity(name):
	require_bureau()
	return activity.get_feed(ITEM, name)


@frappe.whitelist(methods=["POST"])
def add_article_comment(name, text, mentions=None):
	require_bureau()
	return activity.add_comment(ITEM, name, text, mentions)


@frappe.whitelist(methods=["POST"])
def update_article_comment(name, comment, text, mentions=None):
	require_bureau()
	return activity.update_comment(ITEM, name, comment, text, mentions)


@frappe.whitelist(methods=["POST"])
def delete_article_comment(name, comment):
	require_bureau()
	return activity.delete_comment(ITEM, name, comment)
