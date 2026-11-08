# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Ce qui a déjà été fabriqué : l'imposition actuelle de l'article et celles d'articles proches, pour partir de l'existant.

Un article est proche s'il a le même procédé et des cotes à 10 % près sur chacune ; sans cotes, s'il a le même client
et le même support. Une seule imposition par article : l'idéale, sinon celle qui a le moins de chutes.
"""

import frappe
from frappe.utils import cint, flt

from aurescrm.api.bureau_articles import PROCEDE_FIELD, _customers
from aurescrm.api.bureau_etudes_pieces import _imposition_fields, _imposition_row, sheet_drawing, sheet_size
from aurescrm.item_cotations import normalize_cotations_article

IMPOSITION = "Imposition"
ITEM = "Item"
MAX_PROCHES = 6
# Écart relatif toléré sur chaque cote.
TOLERANCE = 0.10
ITEM_FIELDS = ["name", "item_name", "custom_client", "custom_support", "custom_grammage", "custom_cotations_article", PROCEDE_FIELD]


def cotes(valeur):
	"""Les cotes d'un article, triées : « 120x40x160 » et « 40x120x160 » sont le même étui posé autrement."""
	norm = normalize_cotations_article(valeur)
	if not norm:
		return ()
	return tuple(sorted(flt(part) for part in norm.split("x")))


def ecart_cotes(a, b):
	"""Le plus grand écart relatif entre deux jeux de cotes, None s'ils ne se comparent pas."""
	if not a or len(a) != len(b):
		return None
	return max(abs(x - y) / max(x, y, 1e-9) for x, y in zip(a, b))


def _meilleure(rows):
	"""L'idéale d'abord, puis celle qu'on sait dessiner, puis le moins de chutes."""
	return min(rows, key=lambda row: (not cint(row.get("defaut")), not cint(row.get("n_col")), row.get("taux_chutes") is None, flt(row.get("taux_chutes"))))


def _ligne(row, item, quantite, client_label):
	laize, depl = sheet_size(row)
	return {
		**_imposition_row(row, quantite),
		"dessin": sheet_drawing(row),
		"laize": laize,
		"depl": depl,
		"article": item.get("name") if item else row.get("article"),
		"designation": (item or {}).get("item_name") or row.get("article"),
		"client_label": client_label,
		"cotations": (item or {}).get("custom_cotations_article"),
		"n_col": cint(row.get("n_col")),
		"n_rang": cint(row.get("n_rang")),
	}


def references(doc):
	"""L'imposition actuelle de l'étude (ou l'idéale de l'article) et jusqu'à six impositions d'articles proches."""
	if not doc.article or not frappe.has_permission(IMPOSITION, "read") or not frappe.has_permission(ITEM, "read"):
		return None
	fields = list(dict.fromkeys(_imposition_fields() + ["article", "client"]))
	article = frappe.db.get_value(ITEM, doc.article, ITEM_FIELDS, as_dict=True) or {}
	quantite = cint(doc.quantite)

	propres = frappe.get_list(IMPOSITION, filters={"article": doc.article}, fields=fields, limit_page_length=0)
	actuelle = next((row for row in propres if row.name == doc.imposition), None)
	if not actuelle and propres:
		actuelle = _meilleure(propres)

	procede = article.get(PROCEDE_FIELD)
	miennes = cotes(article.get("custom_cotations_article"))
	candidats = frappe.get_list(IMPOSITION, filters={"article": ["!=", doc.article], "nbr_poses": [">", 0]}, fields=fields, limit_page_length=0)
	items = {row.name: row for row in frappe.get_list(ITEM, filters={"name": ["in", list({row.article for row in candidats if row.article})]}, fields=ITEM_FIELDS, limit_page_length=0)} if candidats else {}

	par_article = {}
	for row in candidats:
		item = items.get(row.article)
		if not item or (procede and item.get(PROCEDE_FIELD) != procede):
			continue
		if miennes:
			ecart = ecart_cotes(miennes, cotes(item.get("custom_cotations_article")))
			if ecart is None or ecart > TOLERANCE:
				continue
		elif not (item.custom_client == article.get("custom_client") and item.custom_support and item.custom_support == article.get("custom_support")):
			continue
		else:
			ecart = None
		par_article.setdefault(row.article, {"item": item, "ecart": ecart, "rows": []})["rows"].append(row)

	choisis = [(entry["item"], entry["ecart"], _meilleure(entry["rows"])) for entry in par_article.values()]
	client = article.get("custom_client")
	choisis.sort(key=lambda found: (found[0].custom_client != client, found[1] if found[1] is not None else 1, flt(found[2].taux_chutes)))
	choisis = choisis[:MAX_PROCHES]

	clients = _customers([client] + [item.custom_client for item, _ecart, _row in choisis])
	label = lambda name: (clients.get(name) or {}).get("customer_name") or name
	return {
		"cotations": article.get("custom_cotations_article"),
		"actuelle": {**_ligne(actuelle, article, quantite, label(client)), "liee": actuelle.name == doc.imposition} if actuelle else None,
		"proches": [{**_ligne(row, item, quantite, label(item.custom_client)), "ecart": round(ecart * 100, 1) if ecart is not None else None, "meme_client": item.custom_client == client} for item, ecart, row in choisis],
	}
