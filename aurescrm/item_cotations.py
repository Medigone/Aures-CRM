# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

"""Cotations article (Item.custom_cotations_article) : 2 ou 3 cotes, séparateur x ou ×, décimales . ou ,, sans mm."""

import re

import frappe
from frappe import _
from frappe.utils import cint

# Segments : entiers ou décimales (56, 56.3, 56,3). Séparateur entre cotes : x (après normalisation du ×).
_NUM = r"\d+(?:[.,]\d+)?"
_COTATIONS_FULL = re.compile(rf"^({_NUM})x({_NUM})x({_NUM})$|^({_NUM})x({_NUM})$")


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
	if _COTATIONS_FULL.match(s):
		return _canonicalize_cotations_segments(s)
	return None


def build_cotations_from_dimensions(largeur, hauteur, longueur):
	"""2 segments si longueur absente ou 0 ; sinon 3 segments. None si largeur ou hauteur invalides."""
	lw = cint(largeur) if largeur is not None else 0
	h = cint(hauteur) if hauteur is not None else 0
	lo = cint(longueur) if longueur is not None else 0
	if lw <= 0 or h <= 0:
		return None
	if lo <= 0:
		return f"{lw}x{h}"
	return f"{lw}x{h}x{lo}"


def validate_cotations_article_format(value):
	"""Vide autorisé ; sinon doit matcher le format cible."""
	if value is None:
		return
	s = str(value).strip()
	if not s:
		return
	if not _COTATIONS_FULL.match(s):
		frappe.throw(
			_(
				"Les cotations article doivent comporter 2 ou 3 cotes (ex. « 56x280 », « 56,3×280 », « 80x35x118 »). "
				"Séparateur : x ou ×. Décimales avec . ou ,. Sans mm."
			)
		)


def _apply_non_empty_user_cotations(doc, raw):
	"""Applique une saisie utilisateur non vide : normalise et assigne à doc."""
	norm = normalize_cotations_article(raw)
	if norm is None:
		frappe.throw(
			_(
				"Les cotations article doivent comporter 2 ou 3 cotes (ex. « 56x280 », « 56,3×280 », « 80x35x118 »). "
				"Séparateur : x ou ×. Décimales avec . ou ,. Sans mm."
			)
		)
	doc.custom_cotations_article = norm
	validate_cotations_article_format(doc.custom_cotations_article)


def apply_cotations_from_user_string(item_name, dimensions_str):
	"""
	Met à jour Item.custom_cotations_article depuis une chaîne (ex. dimensions Trace),
	avec les mêmes règles que le formulaire Item. Utilise db.set_value après normalisation.
	"""
	if not item_name:
		frappe.throw(_("Article manquant."))
	if not frappe.db.exists("Item", item_name):
		frappe.throw(_("Article introuvable."))
	if not frappe.has_permission("Item", "write", item_name):
		frappe.throw(_("Permission refusée pour modifier l'article {0}.").format(item_name))

	raw = (dimensions_str or "").strip()
	if not raw:
		frappe.throw(_("Les dimensions sont obligatoires pour synchroniser l'article."))

	doc = frappe.get_doc("Item", item_name)
	_apply_non_empty_user_cotations(doc, raw)
	frappe.db.set_value(
		"Item",
		item_name,
		"custom_cotations_article",
		doc.custom_cotations_article,
		update_modified=True,
	)
	return doc.custom_cotations_article


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
