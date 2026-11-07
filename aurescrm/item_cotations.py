# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

"""Cotations article (Item.custom_cotations_article) : 1, 2 ou 3 cotes, séparateur x ou ×, décimales . ou ,, sans mm."""

import re

import frappe
from frappe import _
from frappe.utils import cint, get_fullname, now_datetime

# Segments : entiers ou décimales (56, 56.3, 56,3). Séparateur entre cotes : x (après normalisation du ×).
_NUM = r"\d+(?:[.,]\d+)?"
_COTATIONS_ONE = re.compile(rf"^({_NUM})$")
_COTATIONS_FULL = re.compile(rf"^({_NUM})x({_NUM})x({_NUM})$|^({_NUM})x({_NUM})$")

def _cotations_format_error():
	return _(
		"Les cotations article doivent comporter 1, 2 ou 3 cotes (ex. « 75 », « 75 mm », « 56x280 », « 56,3×280 », « 80x35x118 »). "
		"Séparateur : x ou ×. Décimales avec . ou ,. Sans mm."
	)


def _matches_cotations_format(s):
	return bool(_COTATIONS_ONE.match(s) or _COTATIONS_FULL.match(s))


def _canonicalize_cotations_segments(s):
	"""Après validation : virgule décimale → point pour stockage homogène."""
	return "x".join(part.replace(",", ".") for part in s.split("x"))


def normalize_cotations_article(value):
	"""Retourne la chaîne normalisée ou None si vide / sans / invalide."""
	if value is None:
		return None
	s = str(value).strip()
	if not s:
		return None
	if s.lower() == "sans":
		return None
	s = re.sub(r"\s*mm\s*$", "", s, flags=re.I).strip()
	s = re.sub(r"\s+", "", s)
	s = s.replace("×", "x").replace("X", "x")
	if _matches_cotations_format(s):
		return _canonicalize_cotations_segments(s)
	return None


def build_cotations_from_dimensions(largeur, hauteur, longueur):
	"""1 segment si une seule dimension ; 2 si largeur+hauteur ; 3 si longueur aussi. None si invalide."""
	lw = cint(largeur) if largeur is not None else 0
	h = cint(hauteur) if hauteur is not None else 0
	lo = cint(longueur) if longueur is not None else 0
	positives = sum(1 for v in (lw, h, lo) if v > 0)
	if positives == 0:
		return None
	if positives == 1:
		return str(lw if lw > 0 else h if h > 0 else lo)
	if lw > 0 and h > 0:
		if lo <= 0:
			return f"{lw}x{h}"
		return f"{lw}x{h}x{lo}"
	return None


def validate_cotations_article_format(value):
	"""Vide autorisé ; sinon doit matcher le format cible."""
	if value is None:
		return
	s = str(value).strip()
	if not s:
		return
	if not _matches_cotations_format(s):
		frappe.throw(_cotations_format_error())


def _apply_non_empty_user_cotations(doc, raw):
	"""Applique une saisie utilisateur non vide : normalise et assigne à doc."""
	norm = normalize_cotations_article(raw)
	if norm is None:
		frappe.throw(_cotations_format_error())
	doc.custom_cotations_article = norm
	validate_cotations_article_format(doc.custom_cotations_article)


def apply_cotations_from_user_string(item_name, dimensions_str, ignore_permissions=False):
	"""
	Met à jour Item.custom_cotations_article depuis une chaîne (ex. dimensions Trace),
	avec les mêmes règles que le formulaire Item. Utilise db.set_value après normalisation.

	`ignore_permissions` : conséquence d'un tracé que l'utilisateur a le droit de modifier, sans droit sur l'article.
	"""
	if not item_name:
		frappe.throw(_("Article manquant."))
	if not frappe.db.exists("Item", item_name):
		frappe.throw(_("Article introuvable."))
	if not ignore_permissions and not frappe.has_permission("Item", "write", item_name):
		frappe.throw(_("Permission refusée pour modifier l'article {0}.").format(item_name))

	raw = (dimensions_str or "").strip()
	if not raw:
		frappe.throw(_("Les dimensions sont obligatoires pour synchroniser l'article."))

	doc = frappe.get_doc("Item", item_name)
	previous = doc.get("custom_cotations_article")
	_apply_non_empty_user_cotations(doc, raw)
	frappe.db.set_value(
		"Item",
		item_name,
		"custom_cotations_article",
		doc.custom_cotations_article,
		update_modified=True,
	)
	if _normalized_for_trace_item_compare(previous) != _normalized_for_trace_item_compare(doc.custom_cotations_article):
		_note_change_from_trace(doc, previous)
	return doc.custom_cotations_article


def _has_origin_fields():
	return frappe.get_meta("Item").has_field("custom_cotations_bat")


def _note_change_from_trace(item, previous):
	"""Garde la trace du changement : le fil de l'article, et qui a remplacé des cotations venues d'un BAT."""
	trace = frappe.db.get_value("Trace", {"article": item.name}, "name")
	# Dans le fil, une ligne d'information nomme elle-même son auteur.
	who = get_fullname(frappe.session.user)
	if previous:
		text = _("{0} a remplacé les cotations {1} par {2} depuis le tracé {3}").format(who, previous, item.custom_cotations_article, trace)
	else:
		text = _("{0} a renseigné les cotations {1} depuis le tracé {2}").format(who, item.custom_cotations_article, trace)
	item.add_comment("Info", text)
	if _has_origin_fields() and item.get("custom_cotations_bat"):
		frappe.db.set_value(
			"Item",
			item.name,
			{"custom_cotations_trace_par": frappe.session.user, "custom_cotations_trace_le": now_datetime()},
			update_modified=False,
		)


def record_bat_cotations(item, value):
	"""À l'import d'un BAT : les cotations de l'article viennent de ce BAT, tout changement antérieur par le tracé est dépassé."""
	norm = normalize_cotations_article(value)
	if not norm or not _has_origin_fields():
		return
	item.custom_cotations_bat = norm
	item.custom_cotations_bat_par = frappe.session.user
	item.custom_cotations_bat_le = now_datetime()
	item.custom_cotations_trace_par = None
	item.custom_cotations_trace_le = None


def bat_confirmation(item_name, dimensions):
	"""Ce qu'il faut faire confirmer si ces dimensions remplacent des cotations encore telles que le BAT les a données. None sinon."""
	if not _has_origin_fields():
		return None
	item = frappe.db.get_value(
		"Item",
		item_name,
		["custom_cotations_article", "custom_cotations_bat", "custom_cotations_bat_par", "custom_cotations_bat_le"],
		as_dict=True,
	)
	if not item or not item.custom_cotations_bat:
		return None
	current = _normalized_for_trace_item_compare(item.custom_cotations_article)
	if current != _normalized_for_trace_item_compare(item.custom_cotations_bat):
		return None
	if current == _normalized_for_trace_item_compare(dimensions):
		return None
	return {
		"actuelles": item.custom_cotations_article,
		"nouvelles": normalize_cotations_article(dimensions),
		"par": get_fullname(item.custom_cotations_bat_par) if item.custom_cotations_bat_par else None,
		"le": str(item.custom_cotations_bat_le) if item.custom_cotations_bat_le else None,
	}


def cotations_origin(item):
	"""D'où viennent les cotations d'un article : du BAT, et si elles en ont bougé, par le tracé ou sur la fiche. None si aucun BAT n'en a donné."""
	if not _has_origin_fields() or not item.get("custom_cotations_bat"):
		return None
	current = _normalized_for_trace_item_compare(item.get("custom_cotations_article"))
	origin = {
		"bat": item.get("custom_cotations_bat"),
		"bat_par": get_fullname(item.get("custom_cotations_bat_par")) if item.get("custom_cotations_bat_par") else None,
		"bat_le": str(item.get("custom_cotations_bat_le")) if item.get("custom_cotations_bat_le") else None,
		"etat": "bat",
		"trace": None,
		"trace_par": None,
		"trace_le": None,
	}
	if current == _normalized_for_trace_item_compare(item.get("custom_cotations_bat")):
		return origin
	trace = frappe.db.get_value("Trace", {"article": item.get("name")}, ["name", "dimensions"], as_dict=True)
	by_trace = item.get("custom_cotations_trace_par") and trace and _normalized_for_trace_item_compare(trace.dimensions) == current
	if not by_trace:
		origin["etat"] = "fiche"
		return origin
	origin.update(
		etat="trace",
		trace=trace.name,
		trace_par=get_fullname(item.get("custom_cotations_trace_par")),
		trace_le=str(item.get("custom_cotations_trace_le")) if item.get("custom_cotations_trace_le") else None,
	)
	return origin


@frappe.whitelist()
def sync_item_cotations_from_trace(article, dimensions):
	"""Appel desk : synchronise les dimensions du tracé vers Item.custom_cotations_article."""
	return apply_cotations_from_user_string(article, dimensions)


def _normalized_for_trace_item_compare(value):
	"""Valeur comparable entre Trace.dimensions et Item.custom_cotations_article."""
	if value is None:
		return ""
	s = str(value).strip()
	if not s:
		return ""
	n = normalize_cotations_article(s)
	if n:
		return n
	s = re.sub(r"\s*mm\s*$", "", s, flags=re.I).strip()
	s = re.sub(r"\s+", "", s)
	s = s.replace("×", "x").replace("X", "x")
	n = normalize_cotations_article(s)
	if n:
		return n
	return s.lower()


@frappe.whitelist()
def trace_cotations_differ_from_item(trace_name, article):
	"""Retourne show_warning si les cotations article et les dimensions du tracé diffèrent (alerte chargé d'étude)."""
	if not trace_name or not article:
		return {"show_warning": False}
	if not frappe.db.exists("Trace", trace_name) or not frappe.db.exists("Item", article):
		return {"show_warning": False}
	t = frappe.db.get_value("Trace", trace_name, "dimensions")
	i = frappe.db.get_value("Item", article, "custom_cotations_article")
	nt = _normalized_for_trace_item_compare(t)
	ni = _normalized_for_trace_item_compare(i)
	return {"show_warning": nt != ni}


def validate_item_cotations_article(doc, method):
	if not doc.meta.has_field("custom_cotations_article"):
		return

	raw = (doc.get("custom_cotations_article") or "").strip()
	if raw.lower() == "sans":
		doc.custom_cotations_article = ""
		raw = ""

	if not raw:
		built = build_cotations_from_dimensions(
			doc.get("custom_largeur"),
			doc.get("custom_hauteur"),
			doc.get("custom_longueur"),
		)
		doc.custom_cotations_article = built if built else ""
		validate_cotations_article_format(doc.custom_cotations_article)
		return

	_apply_non_empty_user_cotations(doc, raw)
