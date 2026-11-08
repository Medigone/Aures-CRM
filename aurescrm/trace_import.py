# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Lecture d'un PDF de tracé Esko (ArtiosCAD), comme l'import du BAT : rien n'est enregistré, tout est proposé.

Ce qu'un tracé d'Aures contient :
- son titre (métadonnée, sinon nom du fichier) : « TRA-26-11-4607-Etui Novaspry 33x33x110mm », soit la
  référence ArtiosCAD, la désignation et les cotations L × l × H ;
- les cotes du dessin, en texte : elles servent à recouper les cotations du titre ;
- les traits : noir pour la coupe, rouge pour le rainage (convention de `imposition/lecture_trace.py`).
"""

import os
import re

import pymupdf

from aurescrm import item_cotations
from aurescrm.imposition.lecture_trace import C_COUPE, C_RAINAGE, PT, _couleur_connue

NUMBER = r"\d+(?:[.,]\d+)?"
# Deux ou trois cotes séparées par x, suivies de « mm » : 72x46.5x107mm, 115 x 69 x 229 mm.
TITLE_COTATIONS = re.compile(rf"({NUMBER})\s*[x×X]\s*({NUMBER})(?:\s*[x×X]\s*({NUMBER}))?\s*mm", re.I)
ARTIOS_REFERENCE = re.compile(r"\bTRA-\d{2}-\d{2}-\d{3,5}\b")
# Une cote du dessin : un nombre seul.
COTE = re.compile(rf"^{NUMBER}$")
TOLERANCE_MM = 0.05


def _number(text):
	return float(str(text).replace(",", "."))


def _title(document, filename):
	title = (document.metadata or {}).get("title") or ""
	return title.strip() or os.path.splitext(os.path.basename(filename or ""))[0]


def title_cotations(title):
	"""Les cotations du titre, au format de l'article (72x46.5x107), ou None. La dernière occurrence compte."""
	found = TITLE_COTATIONS.findall(title or "")
	if not found:
		return None
	values = [value for value in found[-1] if value]
	return item_cotations.normalize_cotations_article("x".join(values))


def designation_of(title):
	"""Ce qui reste du titre sans référence ni cotations : la désignation donnée dans ArtiosCAD."""
	text = ARTIOS_REFERENCE.sub("", title or "")
	text = TITLE_COTATIONS.sub("", text)
	text = re.sub(r"\.pdf$", "", text, flags=re.I)
	return re.sub(r"\s+", " ", text).strip(" -_") or None


def drawing_cotes(page):
	"""Les nombres écrits sur le dessin : ce sont les cotes."""
	return [_number(word[4]) for word in page.get_text("words") if COTE.match(word[4])]


def _contains(values, wanted):
	return any(abs(value - wanted) <= TOLERANCE_MM for value in values)


def lines_box(page):
	"""Cadre de la coupe en mm, nombre de traits de coupe et de rainage, couleurs hors convention."""
	coupe = rainage = 0
	box = None
	others = set()
	for drawing in page.get_drawings():
		color = drawing.get("color")
		known = _couleur_connue(color)
		if known == C_COUPE:
			coupe += len(drawing["items"])
			box = drawing["rect"] if box is None else box | drawing["rect"]
		elif known == C_RAINAGE:
			rainage += len(drawing["items"])
		elif color and known is None:
			others.add(tuple(round(c, 2) for c in color[:3]))
	size = (round(box.width / PT, 1), round(box.height / PT, 1)) if box is not None else None
	return {"coupe": coupe, "rainage": rainage, "developpe": size, "autres_couleurs": len(others)}


def analyze(data, filename=""):
	"""Ce que le PDF dit du tracé. Les cotations proposées sont celles du titre, recoupées avec les cotes du dessin."""
	try:
		document = pymupdf.open(stream=data, filetype="pdf")
	except Exception:
		return {"lisible": False, "message": "Ce fichier ne s'ouvre pas comme un PDF."}
	with document:
		if not document.page_count:
			return {"lisible": False, "message": "Ce PDF n'a aucune page."}
		page = document[0]
		title = _title(document, filename)
		cotations = title_cotations(title)
		cotes = drawing_cotes(page)
		lines = lines_box(page)
		confirmees = bool(cotations) and all(_contains(cotes, _number(value)) for value in cotations.split("x"))
		reference = ARTIOS_REFERENCE.search(title or "")
		return {
			"lisible": True,
			"titre": title,
			"reference": reference.group(0) if reference else None,
			"designation": designation_of(title),
			"cotations": cotations,
			# Toutes les cotations du titre se retrouvent dans les cotes du dessin.
			"confirmees": confirmees,
			"cotes": len(cotes),
			"developpe": lines["developpe"],
			"atelier": lines["coupe"] > 0,
			"rainage": lines["rainage"] > 0,
			"autres_couleurs": lines["autres_couleurs"],
			"pages": document.page_count,
			"createur": (document.metadata or {}).get("creator") or None,
		}
