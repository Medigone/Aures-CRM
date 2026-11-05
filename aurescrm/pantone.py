# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Couleurs de la fiche article : références Pantone et leur carré d'écran, teintes CMJN.

La table `Couleur Pantone` se charge une fois avec `import_reference`, depuis un fichier gardé hors du dépôt, qui est
public. Sans cette table, tout fonctionne avec des carrés neutres. Ces couleurs sont indicatives : le nuancier fait foi.
"""

import json
import os
import re

import frappe
from frappe import _
from frappe.utils import cint, cstr

DOCTYPE = "Couleur Pantone"
TABLE_FIELD = "custom_couleurs_article"
PANTONE = "Pantone"
CMJN = "CMJN"
SEARCH_LIMIT = 8
SALLE_BLANCHE = "Salle Blanche Pharma"

_PREFIX = re.compile(r"^(?:PANTONE|PMS)\s*|^P\s*(?=\d)")
_NUMBER_WITH_SUFFIX = re.compile(r"^(\d{3,5})\s*([CU])$")
_NUMBER = re.compile(r"^\d{3,5}$")
_HAS_SUFFIX = re.compile(r" [CU]$")


def normalize_code(raw):
	"""`P286C`, `286c` et `PANTONE 286 C` donnent `286 C`. Sans suffixe, le code reste sans suffixe : rien n'est deviné."""
	code = re.sub(r"[\s_\-®™]+", " ", cstr(raw)).strip().upper()
	code = _PREFIX.sub("", code, count=1).strip()
	match = _NUMBER_WITH_SUFFIX.match(code)
	return f"{match[1]} {match[2]}" if match else code


def cmjn_code(c, m, j, n):
	return f"C{cint(c)} M{cint(m)} J{cint(j)} N{cint(n)}"


def derive_impression(types):
	"""Impression et nombre de couleurs de l'article. Plusieurs teintes CMJN comptent toujours pour les 4 mêmes encres."""
	quadri = CMJN in types
	spots = sum(1 for kind in types if kind == PANTONE)
	if quadri and spots:
		return {"impression": "Quadri +Pantone", "couleurs": f"CMJN + {spots}", "total": 4 + spots}
	if quadri:
		return {"impression": "Quadri", "couleurs": "CMJN", "total": 4}
	return {"impression": "Pantone", "couleurs": str(spots), "total": spots}


def _clean_row(row):
	if row.type_couleur == CMJN:
		for channel in "cmjn":
			value = cint(row.get(channel))
			if not 0 <= value <= 100:
				frappe.throw(_("Un pourcentage CMJN doit être compris entre 0 et 100."))
			row.set(channel, value)
		row.code = cmjn_code(row.c, row.m, row.j, row.n)
	elif row.type_couleur == PANTONE:
		row.code = normalize_code(row.code)
		if not row.code:
			frappe.throw(_("Saisissez le code de la couleur Pantone."))
		for channel in "cmjn":
			row.set(channel, 0)
	else:
		frappe.throw(_("Type de couleur inconnu."))
	row.nom = cstr(row.nom).strip() or None


def sync_item_colors(doc, method=None):
	"""Hook de l'Item : les lignes de couleur décident de l'impression et du nombre de couleurs, partout où on les modifie.
	Un article sans ligne garde ses valeurs : le calcul des passages continue de les lire."""
	rows = doc.get(TABLE_FIELD) or []
	if not rows:
		return
	for row in rows:
		_clean_row(row)
	derived = derive_impression([row.type_couleur for row in rows])
	doc.custom_impression = derived["impression"]
	doc.custom_nbr_couleurs = derived["couleurs"]
	# Cette liste du Desk s'arrête à 8 : au-delà, la valeur en place reste.
	if doc.get("custom_procédé") == SALLE_BLANCHE and 1 <= derived["total"] <= 8:
		doc.custom_nombre_de_couleurs = str(derived["total"])


def set_item_colors(doc, lines):
	"""Remplace les lignes de couleur de l'article. Les contrôles se font au `validate`."""
	doc.set(TABLE_FIELD, [])
	for line in lines or []:
		doc.append(
			TABLE_FIELD,
			{
				"type_couleur": cstr(line.get("type_couleur")),
				"code": cstr(line.get("code")).strip(),
				"nom": line.get("nom"),
				**{channel: line.get(channel) for channel in "cmjn"},
			},
		)


def _reference(codes):
	if not codes:
		return {}
	rows = frappe.get_all(DOCTYPE, filters={"name": ["in", list(codes)]}, fields=["name", "hex", "approximative"], limit_page_length=0)
	return {row.name: row for row in rows}


def describe(codes):
	"""Pour chaque code déjà normalisé : son libellé, son carré s'il est connu, et s'il lui manque son suffixe C ou U."""
	wanted = set(codes)
	for code in codes:
		if not _HAS_SUFFIX.search(code):
			wanted.update({f"{code} C", f"{code} U"})
	known = _reference(wanted)
	out = {}
	for code in codes:
		found = known.get(code)
		needs_suffix = not found and not _HAS_SUFFIX.search(code) and bool(_NUMBER.match(code) or f"{code} C" in known or f"{code} U" in known)
		out[code] = {
			"code": code,
			"label": f"PANTONE {code}" if found or needs_suffix or _NUMBER_WITH_SUFFIX.match(code) else code,
			"hex": found.hex if found else None,
			"approximative": cint(found.approximative) if found else 0,
			"needs_suffix": int(needs_suffix),
		}
	return out


def item_colors(doc):
	"""Lignes de couleur de l'article, avec leur carré. La teinte d'une ligne CMJN se calcule à l'affichage."""
	rows = doc.get(TABLE_FIELD) or []
	details = describe([row.code for row in rows if row.type_couleur == PANTONE and row.code])
	out = []
	for row in rows:
		line = {"type_couleur": row.type_couleur, "code": row.code, "nom": row.nom or "", "c": cint(row.c), "m": cint(row.m), "j": cint(row.j), "n": cint(row.n)}
		if row.type_couleur == PANTONE:
			line.update(details.get(row.code) or {})
		out.append(line)
	return out


def search(query):
	"""Saisie d'un code Pantone : ce que donne le texte tapé, et quelques suggestions, les codes les plus courts d'abord."""
	code = normalize_code(query)
	if not code:
		return {"exact": None, "suggestions": []}
	pattern = re.sub(r"[%_\\]", "", code)
	names = frappe.get_all(DOCTYPE, filters={"name": ["like", f"{pattern}%"]}, pluck="name", limit_page_length=200)
	names = sorted(names, key=lambda name: (len(name), name))[:SEARCH_LIMIT]
	details = describe([code, *names])
	return {"exact": details[code], "suggestions": [details[name] for name in names]}


def import_reference(path=None):
	"""Charge la table depuis le fichier hors dépôt. Une ligne corrigée à la main (`Manuel`) n'est jamais remplacée.
	bench --site <site> execute aurescrm.pantone.import_reference"""
	path = path or frappe.get_site_path("private", "pantone_reference.json")
	if not os.path.exists(path):
		frappe.throw(_("Fichier de référence introuvable : {0}").format(path))
	with open(path, encoding="utf-8") as handle:
		rows = json.load(handle)
	existing = {row.name: row for row in frappe.get_all(DOCTYPE, fields=["name", "hex", "source", "approximative"], limit_page_length=0)}
	counts = {"ajoutees": 0, "mises_a_jour": 0, "manuelles_gardees": 0, "inchangees": 0}
	for row in rows:
		current = existing.get(row["code"])
		if not current:
			frappe.get_doc({"doctype": DOCTYPE, **row}).insert(ignore_permissions=True)
			counts["ajoutees"] += 1
		elif current.source == "Manuel":
			counts["manuelles_gardees"] += 1
		elif (current.hex, current.source, cint(current.approximative)) == (row["hex"], row["source"], cint(row["approximative"])):
			counts["inchangees"] += 1
		else:
			frappe.db.set_value(DOCTYPE, row["code"], {"hex": row["hex"], "source": row["source"], "approximative": row["approximative"]})
			counts["mises_a_jour"] += 1
	frappe.db.commit()
	return counts
