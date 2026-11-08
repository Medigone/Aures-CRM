# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Génération du PDF d'imposition à l'échelle 1:1.

Export CAD carton : voir `generateur_cf2` (CFF2 pour ArtiosCAD).
Hors périmètre : croix de repérage, gammes de contrôle, marques de coupe, DXF.
"""

import pymupdf
from shapely.affinity import rotate
from shapely.geometry import LineString

from aurescrm.imposition.lecture_trace import C_COUPE, C_RAINAGE, PT
from aurescrm.imposition.motifs import RANGS
from aurescrm.imposition.optimiseur import LIBELLES_MOTIF, positions

C_FEUILLE = (1.0, 0.498, 1.0)
TOLERANCE_DEBORD = 0.05  # mm


def _poses_normalisees(segments, poly, rotation):
	"""Segments ramenés dans le repère de la pose : rotation autour du centroïde de
	la silhouette, puis recalage sur le coin bas-gauche de la bbox tournée.

	Les segments bruts sont dans le repère de la page d'origine et la silhouette peut
	avoir été recalée : les deux doivent être exprimés dans le MÊME repère avant
	placement, sinon les poses sortent de la feuille. On fait donc passer partout le
	polygone NON translaté et la normalisation se fait ici.
	"""
	tourne = rotate(poly, rotation, origin="centroid")
	x0, y0, _, _ = tourne.bounds
	centre = poly.centroid
	out = []
	for (ax, ay), (bx, by) in segments:
		ligne = rotate(LineString([(ax, ay), (bx, by)]), rotation, origin=centre)
		(rax, ray), (rbx, rby) = list(ligne.coords)
		out.append(((rax - x0, ray - y0), (rbx - x0, rby - y0)))
	return out, tourne


def _controler_debord(disposition, parametres, places, normalisees):
	d, p = disposition, parametres
	max_x = max_y = 0.0
	for x, y, rotation in places:
		bx0, by0, bx1, by1 = normalisees[rotation][2].bounds
		max_x = max(max_x, p.lisiere + x + bx1 - bx0)
		max_y = max(max_y, p.pince + y + by1 - by0)
	if max_x > d.laize + TOLERANCE_DEBORD or max_y > d.depl + TOLERANCE_DEBORD:
		raise ValueError(
			f"Contrôle géométrique : les poses débordent de la feuille "
			f"({max_x:.2f} x {max_y:.2f} mm pour une feuille de {d.laize} x {d.depl} mm)"
		)


def segments_imposes(segments_coupe, segments_rainage, poly, disposition, parametres):
	"""Segments coupe/rainage placés sur la feuille, en mm, origine coin bas-gauche.

	Les poses viennent de `positions()` : grille droite, ou motif de deux poses dont la seconde peut être retournée.
	"""
	d, p = disposition, parametres
	places = positions(d)
	normalisees = {}
	for _x, _y, rotation in places:
		if rotation not in normalisees:
			coupe, tourne = _poses_normalisees(segments_coupe, poly, rotation)
			rain, _ = _poses_normalisees(segments_rainage, poly, rotation)
			normalisees[rotation] = (coupe, rain, tourne)
	_controler_debord(d, p, places, normalisees)
	places_coupe, places_rain = [], []
	for x, y, rotation in places:
		coupe, rain, _tourne = normalisees[rotation]
		dx = p.lisiere + x
		dy = p.pince + y
		for (ax, ay), (bx, by) in coupe:
			places_coupe.append(((ax + dx, ay + dy), (bx + dx, by + dy)))
		for (ax, ay), (bx, by) in rain:
			places_rain.append(((ax + dx, ay + dy), (bx + dx, by + dy)))
	return places_coupe, places_rain


def _mention_motif(d):
	if d.motif not in LIBELLES_MOTIF:
		return ""
	return f" | {LIBELLES_MOTIF[d.motif]} en {'rangs' if d.axe == RANGS else 'colonnes'}, décalage {d.decalage_laize} x {d.decalage_depl}"


def _ajouter_page(doc, coupe, rain, disposition, parametres, titre=""):
	d, p = disposition, parametres
	page = doc.new_page(width=d.laize * PT, height=d.depl * PT)
	hauteur = d.depl
	to_pt = lambda x, y: pymupdf.Point(x * PT, (hauteur - y) * PT)  # noqa: E731
	page.draw_rect(pymupdf.Rect(0, 0, d.laize * PT, d.depl * PT), color=C_FEUILLE, width=0.5)
	for segs, couleur, largeur in ((coupe, C_COUPE, 0.36), (rain, C_RAINAGE, 0.54)):
		for (ax, ay), (bx, by) in segs:
			page.draw_line(to_pt(ax, ay), to_pt(bx, by), color=couleur, width=largeur)
	page.insert_text(
		pymupdf.Point(8 * PT, 10 * PT),
		f"{titre} | {d.laize} x {d.depl} mm | {d.poses} poses ({d.n_col}x{d.n_rang}) | "
		f"pas {d.pas_laize} x {d.pas_depl} | pince {p.pince} | pont {p.pont}{_mention_motif(d)}",
		fontsize=7,
		color=(0.4, 0.4, 0.4),
	)


def generer_pdf_pages(chemin_sortie, segments_coupe, segments_rainage, poly, pages, parametres):
	"""Une page PDF par couple (disposition, titre). Retourne le chemin."""
	if not pages:
		raise ValueError("Aucune disposition à exporter.")
	doc = pymupdf.open()
	for disposition, titre in pages:
		coupe, rain = segments_imposes(
			segments_coupe, segments_rainage, poly, disposition, parametres
		)
		_ajouter_page(doc, coupe, rain, disposition, parametres, titre or "")
	doc.save(chemin_sortie)
	return chemin_sortie


def generer_pdf(chemin_sortie, segments_coupe, segments_rainage, poly, disposition, parametres, titre=""):
	"""Écrit le PDF d'imposition et retourne son chemin.

	`poly` doit être la silhouette NON translatée (même repère que les segments).
	"""
	return generer_pdf_pages(
		chemin_sortie,
		segments_coupe,
		segments_rainage,
		poly,
		[(disposition, titre)],
		parametres,
	)
