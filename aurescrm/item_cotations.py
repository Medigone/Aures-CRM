# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

"""Cotations article (Item.custom_cotations_article) : formats 156x280 ou 80x35x118, x minuscule, sans mm."""

import re

import frappe
from frappe import _
from frappe.utils import cint

_COTATIONS_FULL = re.compile(r"^(\d+x\d+x\d+|\d+x\d+)$")


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
	s = s.replace("X", "x")
	if _COTATIONS_FULL.match(s):
		return s
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
			_("Les cotations article doivent être au format « 156x280 » ou « 80x35x118 » (x minuscule, sans mm).")
		)


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

	norm = normalize_cotations_article(raw)
	if norm is None:
		frappe.throw(
			_("Les cotations article doivent être au format « 156x280 » ou « 80x35x118 » (x minuscule, sans mm).")
		)
	doc.custom_cotations_article = norm
	validate_cotations_article_format(doc.custom_cotations_article)
