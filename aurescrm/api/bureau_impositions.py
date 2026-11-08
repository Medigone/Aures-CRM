# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Impositions du poste de bureau (/bureau/impositions) : liste et fiche, en lecture.

Une imposition se crée depuis une étude, à l'atelier. Ici, on la consulte, on choisit l'idéale d'un article,
et on repart à l'atelier pour la refaire. Le calcul de l'idéale reste dans `imposition.py`.
"""

import frappe
from frappe import _
from frappe.utils import cint, cstr, flt

from aurescrm.api import activity
from aurescrm.api.bureau import BELL_FIELD, _parse, condition_filters, doctype_filter_fields, has_child_filter, page_bounds, require_bureau, row_bell, row_tags
from aurescrm.api.bureau_articles import _customers
from aurescrm.api.bureau_etudes_pieces import sheet_drawing
from aurescrm.api.bureau_traces import _items, file_kind, sheet_label
from aurescrm.aures_crm.doctype.imposition.imposition import automatic_ideale, choose_ideale
from aurescrm.imposition.service import disposition_depuis_ligne, libelle_motif_detail

IMPOSITION = "Imposition"
OFFSET = "Etude Faisabilite"
OPEN_STATUSES = ("Nouveau", "En étude")
FIELDS = [
	"name", "modified", "creation", "client", "article", "trace", "procede", "nbr_poses", "n_col", "n_rang", "rotation",
	"format_imp", "format_laize", "format_developpement", "laize_pal", "format_laize_palette", "taux_chutes",
	"machine_impression", "machine_decoupe", "defaut", "origine_calcul", "calcul_imposition", "fichier_imp", "_user_tags", BELL_FIELD,
]
OPTIONAL_FIELDS = ("motif", "axe_motif", "decalage_laize", "decalage_depl", "pas_paire", "groupage", "obsolete", "ideale_manuelle")
VIEWS = ("valables", "ideales", "atelier", "main", "groupees", "obsoletes", "all")
SORT_KEYS = {"name", "designation", "client_label", "trace", "poses", "format", "chutes", "machine", "origine", "creation", "modified"}
ATELIER = "Moteur v1"


def _fields():
	meta = frappe.get_meta(IMPOSITION)
	return FIELDS + [field for field in OPTIONAL_FIELDS if meta.has_field(field)]


def in_view(view, row):
	if view == "all":
		return True
	if view == "obsoletes":
		return row["obsolete"]
	if row["obsolete"]:
		return False
	if view == "ideales":
		return row["ideale"]
	if view == "atelier":
		return row["origine"] == ATELIER
	if view == "main":
		return row["origine"] != ATELIER
	if view == "groupees":
		return bool(row["groupage"])
	return True


def _list_row(row, customers, items):
	client_label = (customers.get(row.client) or {}).get("customer_name") or row.client
	designation = items.get(row.article) or row.article
	return {
		"name": row.name,
		"modified": str(row.modified),
		"creation": str(row.creation),
		"tags": row_tags(row),
		"cloche": row_bell(row),
		"client": row.client,
		"client_label": client_label,
		"article": row.article,
		"designation": designation,
		"trace": row.trace,
		"procede": row.procede,
		"poses": cint(row.nbr_poses),
		"grille": f"{cint(row.n_col)} × {cint(row.n_rang)}" if cint(row.n_col) and cint(row.n_rang) else None,
		"format": sheet_label(row),
		"support": row.laize_pal or None,
		"chutes": flt(row.taux_chutes) if row.taux_chutes is not None else None,
		"machine": row.machine_impression or None,
		"origine": row.origine_calcul or "Manuel",
		"ideale": bool(row.defaut),
		"ideale_manuelle": bool(row.get("ideale_manuelle")),
		"obsolete": bool(row.get("obsolete")),
		"groupage": row.get("groupage") or None,
		"_search": " ".join(cstr(value) for value in (row.name, row.client, client_label, row.article, designation, row.trace, row.machine_impression, row.get("groupage"))).casefold(),
	}


def order_impositions(rows, sort=None, direction=None):
	if sort in SORT_KEYS:
		filled = [row for row in rows if row.get(sort) not in (None, "")]
		empty = [row for row in rows if row.get(sort) in (None, "")]
		numeric = sort in ("poses", "chutes")
		key = (lambda row: row[sort]) if numeric else (lambda row: cstr(row[sort]).casefold())
		return sorted(filled, key=key, reverse=cstr(direction) == "desc") + empty
	return sorted(rows, key=lambda row: row["creation"], reverse=True)


@frappe.whitelist()
def get_impositions(view="valables", conditions=None, search=None, start=0, page_length=None, sort=None, direction=None):
	require_bureau()
	if view not in VIEWS:
		frappe.throw(_("Vue inconnue."))
	if not frappe.has_permission(IMPOSITION, "read"):
		raise frappe.PermissionError
	filters = condition_filters(_parse(conditions), IMPOSITION)
	found = frappe.get_list(IMPOSITION, filters=filters, distinct=has_child_filter(filters, IMPOSITION), fields=_fields(), limit_page_length=0)
	customers = _customers(row.client for row in found)
	items = _items(row.article for row in found)
	rows = [_list_row(row, customers, items) for row in found]
	words = cstr(search).casefold().split()
	if words:
		rows = [row for row in rows if all(word in row["_search"] for word in words)]
	for row in rows:
		del row["_search"]
	ordered = order_impositions([row for row in rows if in_view(view, row)], sort, direction)
	first, length = page_bounds(len(ordered), start, page_length)
	return {
		"impositions": ordered[first : first + length],
		"counts": {name: sum(1 for row in rows if in_view(name, row)) for name in VIEWS},
		"total": len(ordered),
		"start": first,
		"page_length": length,
		"names": [row["name"] for row in ordered],
	}


@frappe.whitelist()
def get_imposition_options():
	require_bureau()
	if not frappe.has_permission(IMPOSITION, "read"):
		raise frappe.PermissionError
	return {"doctype": IMPOSITION, "filter_fields": doctype_filter_fields(IMPOSITION)}


def _open_study(doc):
	"""L'étude Offset encore ouverte de l'article, sur ce tracé ou sa version en service : c'est là qu'on refait l'imposition."""
	if not frappe.has_permission(OFFSET, "read"):
		return None
	rows = frappe.get_list(OFFSET, filters={"article": doc.article, "status": ["in", OPEN_STATUSES]}, fields=["name", "status"], order_by="creation desc", limit_page_length=1)
	return {"name": rows[0].name, "status": rows[0].status} if rows else None


def _atelier(doc):
	"""Où mène « Refaire à l'atelier » : l'étude ouverte de l'article, sinon un test rapide avec le tracé chargé."""
	if not (frappe.has_permission("Calcul Imposition", "read") and frappe.has_permission("Calcul Imposition", "create")):
		return None
	etude = _open_study(doc)
	if etude:
		return {"etude": etude["name"], "status": etude["status"]}
	trace = _current_trace_of(doc)
	# L'atelier ne lit que le PDF : un tracé en image ne se teste pas.
	if not trace or file_kind(frappe.db.get_value("Trace", trace, "fichier_trace")) != "pdf":
		return None
	return {"trace": trace}


def _current_trace_of(doc):
	"""Le tracé en service : celui de l'imposition, ou la version qui l'a remplacé."""
	if not doc.trace:
		return None
	name, seen = doc.trace, set()
	while name and name not in seen:
		seen.add(name)
		after = frappe.db.get_value("Trace", name, "remplacee_par") if frappe.get_meta("Trace").has_field("remplacee_par") else None
		if not after:
			return name
		name = after
	return name


def _others(doc):
	"""Les autres impositions du même article, celles du tracé en service d'abord."""
	fields = ["name", "trace", "nbr_poses", "format_imp", "format_laize", "format_developpement", "taux_chutes", "defaut", "origine_calcul"]
	fields += [field for field in ("obsolete", "groupage") if frappe.get_meta(IMPOSITION).has_field(field)]
	rows = frappe.get_list(IMPOSITION, filters={"article": doc.article, "name": ["!=", doc.name]}, fields=fields, order_by="defaut desc, taux_chutes asc", limit_page_length=50)
	return [
		{
			"name": row.name,
			"trace": row.trace,
			"poses": cint(row.nbr_poses),
			"format": sheet_label(row),
			"chutes": flt(row.taux_chutes) if row.taux_chutes is not None else None,
			"ideale": bool(row.defaut),
			"obsolete": bool(row.get("obsolete")),
			"groupage": row.get("groupage") or None,
			"origine": row.origine_calcul or "Manuel",
		}
		for row in sorted(rows, key=lambda row: bool(row.get("obsolete")))
	]


def _etudes(doc):
	if not frappe.has_permission(OFFSET, "read"):
		return []
	rows = frappe.get_list(OFFSET, filters={"imposition": doc.name}, fields=["name", "status", "demande_faisabilite"], order_by="creation desc", limit_page_length=20)
	return [{"name": row.name, "status": row.status, "demande": row.demande_faisabilite} for row in rows]


def can_choose(doc):
	"""Choisir l'idéale : le poste Étude, qui écrit les impositions. Jamais une obsolète ni une feuille groupée."""
	return bool(doc.has_permission("write")) and not doc.get("obsolete") and not doc.get("groupage") and frappe.get_meta(IMPOSITION).has_field("ideale_manuelle")


@frappe.whitelist()
def get_imposition(name):
	require_bureau()
	doc = frappe.get_doc(IMPOSITION, name)
	doc.check_permission("read")
	customers = _customers([doc.client])
	trace = frappe.db.get_value("Trace", doc.trace, ["name", "dimensions", "fichier_trace", "ver", "statut"] if frappe.get_meta("Trace").has_field("statut") else ["name", "dimensions", "fichier_trace"], as_dict=True) if doc.trace else None
	row = doc.as_dict()
	choosable = can_choose(doc)
	return {
		"name": doc.name,
		"modified": str(doc.modified),
		"creation": str(doc.creation),
		"tags": row_tags(doc) if doc.get("_user_tags") else [],
		"can_write": bool(doc.has_permission("write")),
		"can_choose": choosable and not (doc.defaut and doc.get("ideale_manuelle")),
		"can_auto": choosable and bool(doc.get("ideale_manuelle")),
		"client": doc.client,
		"client_label": (customers.get(doc.client) or {}).get("customer_name") or doc.client,
		"article": doc.article,
		"designation": frappe.db.get_value("Item", doc.article, "item_name") or doc.article,
		"procede": doc.procede,
		"trace": {"name": trace.name, "dimensions": trace.dimensions, "ver": cint(trace.get("ver")) or 1, "statut": trace.get("statut") or "En service"} if trace else None,
		"poses": cint(doc.nbr_poses),
		"n_col": cint(doc.n_col),
		"n_rang": cint(doc.n_rang),
		"rotation": cint(doc.rotation),
		"motif": libelle_motif_detail(disposition_depuis_ligne(row)) if cint(doc.n_col) else None,
		"format": sheet_label(doc),
		"support": doc.laize_pal or None,
		"format_support": doc.format_laize_palette or None,
		"chutes": flt(doc.taux_chutes) if doc.taux_chutes is not None else None,
		"pas_laize": flt(doc.pas_laize) or None,
		"pas_depl": flt(doc.pas_depl) or None,
		"pont": flt(doc.pont) or None,
		"trait_commun": [label for label, field in ((_("en laize"), "trait_commun_laize"), (_("en déplacement"), "trait_commun_depl")) if doc.get(field)],
		"machine": doc.machine_impression or None,
		"machine_decoupe": doc.machine_decoupe or None,
		"forme": doc.forme_decoupe or None,
		"origine": doc.origine_calcul or "Manuel",
		"calcul": doc.calcul_imposition if doc.calcul_imposition and frappe.has_permission("Calcul Imposition", "read") else None,
		"ideale": bool(doc.defaut),
		"ideale_manuelle": bool(doc.get("ideale_manuelle")),
		"obsolete": bool(doc.get("obsolete")),
		"groupage": doc.get("groupage") or None,
		"articles_groupes": [{"article": line.get("article"), "poses": cint(line.get("nbr_poses") or line.get("poses"))} for line in doc.get("articles_groupes") or []],
		"fichier": {"url": doc.fichier_imp, "name": cstr(doc.fichier_imp).rstrip("/").split("/")[-1]} if doc.fichier_imp else None,
		"dessin": sheet_drawing(row),
		"atelier": _atelier(doc),
		"autres": _others(doc),
		"etudes": _etudes(doc),
		"comments": activity.comment_summary(IMPOSITION, doc.name),
	}


def _for_work(name, modified):
	require_bureau()
	doc = frappe.get_doc(IMPOSITION, name)
	doc.check_permission("write")
	if modified and cstr(modified) != str(doc.modified):
		frappe.throw(_("Cette imposition vient d'être modifiée par ailleurs. Elle a été rechargée : vérifiez-la, puis recommencez."), frappe.TimestampMismatchError)
	return doc


@frappe.whitelist(methods=["POST"])
def set_imposition_ideale(name, modified):
	"""Fixe l'idéale de l'article à la main : le calcul automatique ne la remplace plus."""
	doc = _for_work(name, modified)
	if not can_choose(doc):
		frappe.throw(_("Cette imposition ne peut pas devenir l'idéale."))
	choose_ideale(doc)
	return get_imposition(name)


@frappe.whitelist(methods=["POST"])
def set_imposition_auto(name, modified):
	"""Rend le choix de l'idéale au calcul automatique : le moins de chutes, puis la plus récente."""
	doc = _for_work(name, modified)
	automatic_ideale(doc)
	return get_imposition(name)


def _readable(name):
	require_bureau()
	frappe.get_doc(IMPOSITION, name).check_permission("read")
	return name


@frappe.whitelist()
def get_imposition_activity(name):
	return activity.get_feed(IMPOSITION, _readable(name))


@frappe.whitelist(methods=["POST"])
def add_imposition_comment(name, text, mentions=None):
	return activity.add_comment(IMPOSITION, _readable(name), text, mentions)


@frappe.whitelist(methods=["POST"])
def update_imposition_comment(name, comment, text, mentions=None):
	return activity.update_comment(IMPOSITION, _readable(name), comment, text, mentions)


@frappe.whitelist(methods=["POST"])
def delete_imposition_comment(name, comment):
	return activity.delete_comment(IMPOSITION, _readable(name), comment)
