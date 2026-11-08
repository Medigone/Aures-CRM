# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Tracés du poste de bureau (/bureau/traces) : liste, fiche et versions.

Même contrat que `bureau_etudes.py` : la liste passe par `frappe.get_list`, les droits restent ceux de Frappe.
Un tracé se crée depuis une étude ; ici, on consulte et on met en service une nouvelle version, comme pour une
maquette. Les règles des versions sont dans `trace.py` (`create_version`).
"""

import base64
import os

import frappe
from frappe import _
from frappe.utils import cint, cstr, flt
from frappe.utils.file_manager import get_max_file_size

from aurescrm import item_cotations, trace_import
from aurescrm.api import activity
from aurescrm.api.bureau import BELL_FIELD, _parse, condition_filters, doctype_filter_fields, has_child_filter, page_bounds, require_bureau, row_bell, row_tags
from aurescrm.api.bureau_articles import _customers
from aurescrm.aures_crm.doctype.trace.trace import EN_SERVICE, OBSOLETE, create_version, has_versions, live_impositions_filters

TRACE = "Trace"
ETUDES = ("Etude Faisabilite", "Etude Faisabilite Flexo")
FIELDS = ["name", "modified", "creation", "client", "article", "procede", "dimensions", "points_colle", "fichier_trace", "_user_tags", BELL_FIELD]
VERSION_FIELDS = ["statut", "ver", "date_activation", "version_origine", "remplacee_par", "desc_changements"]
VIEWS = ("service", "sans_imposition", "image", "obsoletes", "all")
SORT_KEYS = {"name", "designation", "client_label", "procede", "dimensions", "points_colle", "fichier", "impositions", "ver", "statut", "creation", "modified"}
# L'atelier ne lit que les PDF ; une image se consulte mais ne se calcule pas.
PDF = ".pdf"


def file_kind(url):
	"""« pdf », « image » ou None : le moteur d'imposition ne lit que le PDF."""
	if not url:
		return None
	return "pdf" if os.path.splitext(cstr(url).split("?")[0])[1].lower() == PDF else "image"


def _file(url):
	return {"url": url, "name": os.path.basename(cstr(url).rstrip("/")), "kind": file_kind(url)} if url else None


def in_view(view, row):
	if view == "all":
		return True
	if view == "obsoletes":
		return row["statut"] == OBSOLETE
	if row["statut"] != EN_SERVICE:
		return False
	if view == "sans_imposition":
		return not row["impositions"]
	if view == "image":
		return row["fichier"] == "image"
	return True


def _live_counts(names):
	"""Impositions encore valables par tracé, en une requête."""
	if not names or not frappe.has_permission("Imposition", "read"):
		return {}
	filters = {**live_impositions_filters(None), "trace": ["in", list(names)]}
	rows = frappe.get_all("Imposition", filters=filters, fields=["trace", "count(name) as total"], group_by="trace")
	return {row.trace: cint(row.total) for row in rows}


def _items(names):
	names = list({name for name in names if name})
	if not names:
		return {}
	return dict(frappe.get_all("Item", filters={"name": ["in", names]}, fields=["name", "item_name"], as_list=True))


def _list_row(trace, customers, items, counts):
	client_label = (customers.get(trace.client) or {}).get("customer_name") or trace.client
	designation = items.get(trace.article) or trace.article
	return {
		"name": trace.name,
		"modified": str(trace.modified),
		"creation": str(trace.creation),
		"tags": row_tags(trace),
		"cloche": row_bell(trace),
		"statut": trace.get("statut") or EN_SERVICE,
		"ver": cint(trace.get("ver")) or 1,
		"client": trace.client,
		"client_label": client_label,
		"article": trace.article,
		"designation": designation,
		"procede": trace.procede,
		"dimensions": trace.dimensions,
		"points_colle": cint(trace.points_colle),
		"fichier": file_kind(trace.fichier_trace),
		"impositions": counts.get(trace.name, 0),
		"_search": " ".join(cstr(value) for value in (trace.name, trace.client, client_label, trace.article, designation, trace.dimensions)).casefold(),
	}


def order_traces(rows, sort=None, direction=None):
	"""Les plus récents d'abord, ou par la colonne demandée, les lignes sans valeur à la fin."""
	if sort in SORT_KEYS:
		filled = [row for row in rows if row.get(sort) not in (None, "")]
		empty = [row for row in rows if row.get(sort) in (None, "")]
		numeric = sort in ("points_colle", "impositions", "ver")
		key = (lambda row: row[sort]) if numeric else (lambda row: cstr(row[sort]).casefold())
		return sorted(filled, key=key, reverse=cstr(direction) == "desc") + empty
	return sorted(rows, key=lambda row: row["creation"], reverse=True)


@frappe.whitelist()
def get_traces(view="service", conditions=None, search=None, start=0, page_length=None, sort=None, direction=None):
	"""Une page de la liste, le total, l'ordre de toute la vue, et les compteurs de toutes les vues pour les mêmes filtres."""
	require_bureau()
	if view not in VIEWS:
		frappe.throw(_("Vue inconnue."))
	if not frappe.has_permission(TRACE, "read"):
		raise frappe.PermissionError
	filters = condition_filters(_parse(conditions), TRACE)
	fields = FIELDS + (VERSION_FIELDS[:2] if has_versions() else [])
	found = frappe.get_list(TRACE, filters=filters, distinct=has_child_filter(filters, TRACE), fields=fields, limit_page_length=0)
	customers = _customers(row.client for row in found)
	items = _items(row.article for row in found)
	counts = _live_counts(row.name for row in found)
	rows = [_list_row(row, customers, items, counts) for row in found]
	words = cstr(search).casefold().split()
	if words:
		rows = [row for row in rows if all(word in row["_search"] for word in words)]
	for row in rows:
		del row["_search"]
	ordered = order_traces([row for row in rows if in_view(view, row)], sort, direction)
	first, length = page_bounds(len(ordered), start, page_length)
	return {
		"traces": ordered[first : first + length],
		"counts": {name: sum(1 for row in rows if in_view(name, row)) for name in VIEWS},
		"total": len(ordered),
		"start": first,
		"page_length": length,
		"names": [row["name"] for row in ordered],
	}


@frappe.whitelist()
def get_trace_options():
	require_bureau()
	if not frappe.has_permission(TRACE, "read"):
		raise frappe.PermissionError
	return {"doctype": TRACE, "filter_fields": doctype_filter_fields(TRACE)}


def _versions(doc):
	"""Toutes les versions du tracé de cet article, la plus récente d'abord."""
	if not has_versions():
		return [{"name": doc.name, "ver": 1, "statut": EN_SERVICE, "date_activation": None, "desc_changements": None, "fichier": _file(doc.fichier_trace), "dimensions": doc.dimensions}]
	rows = frappe.get_list(TRACE, filters={"article": doc.article}, fields=["name", "ver", "statut", "date_activation", "desc_changements", "fichier_trace", "dimensions", "owner", "creation"], order_by="ver desc, creation desc", limit_page_length=0)
	return [
		{
			"name": row.name,
			"ver": cint(row.ver) or 1,
			"statut": row.statut or EN_SERVICE,
			"date_activation": str(row.date_activation) if row.date_activation else str(row.creation)[:10],
			"desc_changements": row.desc_changements,
			"fichier": _file(row.fichier_trace),
			"dimensions": row.dimensions,
			"par": frappe.utils.get_fullname(row.owner),
		}
		for row in rows
	]


def _impositions(doc):
	if not frappe.has_permission("Imposition", "read"):
		return None
	meta = frappe.get_meta("Imposition")
	fields = ["name", "nbr_poses", "format_imp", "format_laize", "format_developpement", "taux_chutes", "machine_impression", "defaut", "origine_calcul", "creation"]
	fields += [field for field in ("obsolete", "groupage", "ideale_manuelle") if meta.has_field(field)]
	rows = frappe.get_list("Imposition", filters={"trace": doc.name}, fields=fields, order_by="defaut desc, taux_chutes asc", limit_page_length=0)
	return [
		{
			"name": row.name,
			"poses": cint(row.nbr_poses),
			"format": sheet_label(row),
			"chutes": flt(row.taux_chutes) if row.taux_chutes is not None else None,
			"machine": row.machine_impression or None,
			"ideale": bool(row.defaut),
			"obsolete": bool(row.get("obsolete")),
			"groupage": row.get("groupage") or None,
			"origine": row.origine_calcul or "Manuel",
			"creation": str(row.creation),
		}
		for row in rows
	]


def sheet_label(row):
	laize, developpement = flt(row.get("format_laize")), flt(row.get("format_developpement"))
	if laize and developpement:
		return f"{laize:g} × {developpement:g}"
	return cstr(row.get("format_imp")).replace("x", " × ").strip() or None


def _etudes(doc):
	rows = []
	for doctype in ETUDES:
		if not frappe.has_permission(doctype, "read"):
			continue
		meta = frappe.get_meta(doctype)
		fields = ["name", "status", "demande_faisabilite", "creation"] + (["assigne_a_nom"] if meta.has_field("assigne_a_nom") else [])
		for row in frappe.get_list(doctype, filters={"trace": doc.name}, fields=fields, order_by="creation desc", limit_page_length=50):
			rows.append({"name": row.name, "status": row.status, "demande": row.demande_faisabilite, "assigne": row.get("assigne_a_nom") or None, "creation": str(row.creation)})
	return sorted(rows, key=lambda row: row["creation"], reverse=True)


def _formes(doc):
	if not frappe.has_permission("Forme Decoupe", "read"):
		return []
	fields = ["name", "numero", "dimensions"] + (["a_refaire"] if frappe.get_meta("Forme Decoupe").has_field("a_refaire") else [])
	return [{"name": row.name, "numero": row.numero, "a_refaire": bool(row.get("a_refaire"))} for row in frappe.get_list("Forme Decoupe", filters={"trace": doc.name}, fields=fields, limit_page_length=50)]


def can_create_version(doc):
	return has_versions() and (doc.get("statut") or EN_SERVICE) == EN_SERVICE and bool(frappe.has_permission(TRACE, "create")) and bool(doc.has_permission("write"))


@frappe.whitelist()
def get_trace(name):
	"""Un tracé pour l'aperçu et la fiche : champs, versions, ce qui s'appuie dessus, ce que ce rôle peut faire."""
	require_bureau()
	doc = frappe.get_doc(TRACE, name)
	doc.check_permission("read")
	customers = _customers([doc.client])
	impositions = _impositions(doc)
	live = [row for row in impositions or [] if not row["obsolete"]]
	return {
		"name": doc.name,
		"modified": str(doc.modified),
		"creation": str(doc.creation),
		"tags": row_tags(doc) if doc.get("_user_tags") else [],
		"can_write": bool(doc.has_permission("write")),
		"can_version": can_create_version(doc),
		# Tant qu'aucune imposition ne s'appuie dessus, le fichier se remplace sans nouvelle version.
		"can_replace_file": bool(doc.has_permission("write")) and (doc.get("statut") or EN_SERVICE) == EN_SERVICE and not live,
		"statut": doc.get("statut") or EN_SERVICE,
		"ver": cint(doc.get("ver")) or 1,
		"date_activation": str(doc.get("date_activation")) if doc.get("date_activation") else None,
		"version_origine": doc.get("version_origine") or None,
		"remplacee_par": doc.get("remplacee_par") or None,
		"desc_changements": doc.get("desc_changements") or None,
		"client": doc.client,
		"client_label": (customers.get(doc.client) or {}).get("customer_name") or doc.client,
		"article": doc.article,
		"designation": frappe.db.get_value("Item", doc.article, "item_name") or doc.article,
		"cotations": frappe.db.get_value("Item", doc.article, "custom_cotations_article") if frappe.get_meta("Item").has_field("custom_cotations_article") else None,
		"procede": doc.procede,
		"dimensions": doc.dimensions,
		"points_colle": cint(doc.points_colle),
		"fichier": _file(doc.fichier_trace),
		"versions": _versions(doc),
		"impositions": impositions,
		"etudes": _etudes(doc),
		"formes": _formes(doc),
		"comments": activity.comment_summary(TRACE, doc.name),
	}


# Aperçu d'un PDF : la première page en image, assez large pour lire les cotes, gardée un jour.
PREVIEW_WIDTH = 1400
PREVIEW_TTL = 24 * 3600


def content_box(page):
	"""Le cadre du dessin et de ses cotes : un tracé occupe souvent un coin d'une grande page blanche."""
	import fitz

	box = fitz.Rect()
	for drawing in page.get_drawings():
		box |= drawing["rect"]
	for block in page.get_text("blocks"):
		box |= fitz.Rect(block[:4])
	if box.is_empty or box.width < 1 or box.height < 1:
		return page.rect
	margin = max(box.width, box.height) * 0.03
	return (box + (-margin, -margin, margin, margin)) & page.rect


def render_pdf_preview(content, width=PREVIEW_WIDTH):
	"""La première page d'un PDF en PNG, et son nombre de pages. None si le fichier ne se lit pas."""
	import fitz

	try:
		with fitz.open(stream=content, filetype="pdf") as document:
			if not document.page_count:
				return None
			page = document[0]
			clip = content_box(page)
			zoom = min(width / clip.width, 8) if clip.width else 1
			pixmap = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=clip, alpha=False)
			return {"png": pixmap.tobytes("png"), "pages": document.page_count, "width": pixmap.width, "height": pixmap.height}
	except Exception:
		return None


@frappe.whitelist()
def get_trace_preview(name):
	"""L'aperçu du PDF du tracé, en image : il s'affiche partout pareil, sans visionneuse du navigateur."""
	require_bureau()
	doc = frappe.get_doc(TRACE, name)
	doc.check_permission("read")
	url = doc.fichier_trace
	if file_kind(url) != "pdf":
		return None
	key = f"bureau-trace-apercu:{url}"
	cached = frappe.cache().get_value(key)
	if cached:
		return cached
	file_name = frappe.db.get_value("File", {"file_url": url}, "name")
	if not file_name:
		return None
	try:
		content = frappe.get_doc("File", file_name).get_content()
	except Exception:
		return None
	rendered = render_pdf_preview(content)
	if not rendered:
		return None
	result = {
		"image": "data:image/png;base64," + base64.b64encode(rendered["png"]).decode(),
		"pages": rendered["pages"],
		"width": rendered["width"],
		"height": rendered["height"],
	}
	frappe.cache().set_value(key, result, expires_in_sec=PREVIEW_TTL)
	return result


def _trace_for_work(name, modified):
	require_bureau()
	doc = frappe.get_doc(TRACE, name)
	doc.check_permission("write")
	if modified and cstr(modified) != str(doc.modified):
		frappe.throw(_("Ce tracé vient d'être modifié par ailleurs. Il a été rechargé : vérifiez-le, puis recommencez."), frappe.TimestampMismatchError)
	return doc


def version_dimensions(doc, dimensions, confirm_bat):
	"""Dimensions de la nouvelle version. En Offset elles deviennent les cotations de l'article : effacer celles d'un BAT se confirme d'abord."""
	raw = cstr(dimensions).strip() or cstr(doc.dimensions)
	if not raw:
		frappe.throw(_("Indiquez les dimensions du tracé."))
	if doc.procede == "Flexo":
		return raw, None
	normalized = item_cotations.normalize_cotations_article(raw)
	if not normalized:
		frappe.throw(item_cotations._cotations_format_error())
	if normalized == cstr(doc.dimensions) or cint(confirm_bat):
		return normalized, None
	return normalized, item_cotations.bat_confirmation(doc.article, normalized)


@frappe.whitelist(methods=["POST"])
def create_trace_version(name, modified, desc_changements, dimensions=None, points_colle=None, confirm_bat=0, copy_file=1):
	"""Met en service une nouvelle version depuis la fiche du tracé. Le fichier suit, par l'envoi différé."""
	doc = _trace_for_work(name, modified)
	if not can_create_version(doc):
		frappe.throw(_("Seule la version en service d'un tracé reçoit une nouvelle version, par une personne qui peut créer des tracés."))
	dims, confirmation = version_dimensions(doc, dimensions, confirm_bat)
	if confirmation:
		return {"confirmation": confirmation}
	result = create_version(doc, desc_changements, dims, points_colle, copy_file)
	return {**result, "trace": get_trace(result["name"])}


@frappe.whitelist(methods=["POST"])
def set_trace_file(name, modified, file_url):
	"""Range le fichier envoyé sur le tracé : une version neuve, ou un tracé sur lequel aucune imposition ne s'appuie encore."""
	doc = _trace_for_work(name, modified)
	if not get_trace(name)["can_replace_file"]:
		frappe.throw(_("Des impositions s'appuient sur ce fichier : créez une nouvelle version du tracé pour le changer."))
	if not frappe.db.exists("File", {"file_url": file_url, "attached_to_doctype": TRACE, "attached_to_name": doc.name}):
		frappe.throw(_("Ce fichier n'est pas joint à ce tracé."))
	doc.fichier_trace = file_url
	doc.save()
	# Les études ouvertes du tracé gardent la copie du fichier, comme sur le Desk.
	for doctype in ETUDES:
		for etude in frappe.get_all(doctype, filters={"trace": doc.name, "status": ["in", ("Nouveau", "En étude")]}, pluck="name"):
			frappe.db.set_value(doctype, etude, "fichier_trace", file_url)
	return get_trace(name)


@frappe.whitelist(methods=["POST"])
def analyze_trace_pdf():
	"""Lit un PDF de tracé choisi dans une fenêtre, sans rien enregistrer : cotations du titre recoupées avec les cotes, développé, traits."""
	require_bureau()
	if not (frappe.has_permission(TRACE, "create") or frappe.has_permission(TRACE, "write")):
		raise frappe.PermissionError
	upload = frappe.request.files.get("file") if frappe.request else None
	if not upload:
		frappe.throw(_("Aucun fichier reçu."))
	limit = get_max_file_size()
	data = upload.stream.read(limit + 1)
	if len(data) > limit:
		frappe.throw(_("Ce fichier est trop lourd."))
	result = trace_import.analyze(data, upload.filename or "")
	if result.get("developpe"):
		result["developpe"] = list(result["developpe"])
	return result


def _readable_trace(name):
	require_bureau()
	frappe.get_doc(TRACE, name).check_permission("read")
	return name


@frappe.whitelist()
def get_trace_activity(name):
	return activity.get_feed(TRACE, _readable_trace(name))


@frappe.whitelist(methods=["POST"])
def add_trace_comment(name, text, mentions=None):
	return activity.add_comment(TRACE, _readable_trace(name), text, mentions)


@frappe.whitelist(methods=["POST"])
def update_trace_comment(name, comment, text, mentions=None):
	return activity.update_comment(TRACE, _readable_trace(name), comment, text, mentions)


@frappe.whitelist(methods=["POST"])
def delete_trace_comment(name, comment):
	return activity.delete_comment(TRACE, _readable_trace(name), comment)
