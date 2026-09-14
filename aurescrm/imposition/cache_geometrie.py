# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Mémo Redis du polygone exact et des segments, clé = SHA1 du PDF.

frappe.cache est optionnel : hors site (tests unittest) le cache est un no-op.
Le polygone est sérialisé en WKB hex ; les segments restent des listes JSON.
"""

from shapely import wkb

PREFIXE = "imposition:geom:"
TTL = 6 * 3600


def _backend():
	try:
		import frappe

		return frappe.cache
	except Exception:
		return None


def lire(empreinte):
	if not empreinte:
		return None
	cache = _backend()
	if cache is None:
		return None
	brut = cache.get_value(PREFIXE + empreinte)
	if not brut or not isinstance(brut, dict) or "poly" not in brut:
		return None
	try:
		poly = wkb.loads(brut["poly"], hex=True)
	except Exception:
		return None
	return brut.get("coupe") or [], brut.get("rainage") or [], poly


def ecrire(empreinte, coupe, rainage, poly):
	if not empreinte or poly is None:
		return
	cache = _backend()
	if cache is None:
		return
	cache.set_value(
		PREFIXE + empreinte,
		{"poly": poly.wkb_hex, "coupe": coupe, "rainage": rainage},
		expires_in_sec=TTL,
	)
