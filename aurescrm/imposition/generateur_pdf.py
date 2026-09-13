# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Génération du PDF d'imposition à l'échelle 1:1.

Hors périmètre v1 : croix de repérage, gammes de contrôle, marques de coupe,
cartouche de dossier, export CF2/DXF.
"""

import pymupdf
from shapely.affinity import rotate
from shapely.geometry import LineString

from aurescrm.imposition.lecture_trace import C_COUPE, C_RAINAGE, PT

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


def generer_pdf(chemin_sortie, segments_coupe, segments_rainage, poly, disposition, parametres, titre=""):
	"""Écrit le PDF d'imposition et retourne son chemin.

	`poly` doit être la silhouette NON translatée (même repère que les segments).
	"""
	d, p = disposition, parametres
	coupe, tourne = _poses_normalisees(segments_coupe, poly, d.rotation)
	rain, _ = _poses_normalisees(segments_rainage, poly, d.rotation)

	bx0, by0, bx1, by1 = tourne.bounds
	bw, bh = bx1 - bx0, by1 - by0
	max_x = p.lisiere + (d.n_col - 1) * d.pas_laize + bw
	max_y = p.pince + (d.n_rang - 1) * d.pas_depl + bh
	if max_x > d.laize + TOLERANCE_DEBORD or max_y > d.depl + TOLERANCE_DEBORD:
		raise ValueError(
			f"Contrôle géométrique : les poses débordent de la feuille "
			f"({max_x:.2f} x {max_y:.2f} mm pour une feuille de {d.laize} x {d.depl} mm)"
		)

	doc = pymupdf.open()
	page = doc.new_page(width=d.laize * PT, height=d.depl * PT)
	hauteur = d.depl
	to_pt = lambda x, y: pymupdf.Point(x * PT, (hauteur - y) * PT)  # noqa: E731

	page.draw_rect(pymupdf.Rect(0, 0, d.laize * PT, d.depl * PT), color=C_FEUILLE, width=0.5)
	for i in range(d.n_col):
		for j in range(d.n_rang):
			dx = p.lisiere + i * d.pas_laize
			dy = p.pince + j * d.pas_depl
			for segs, couleur, largeur in ((coupe, C_COUPE, 0.36), (rain, C_RAINAGE, 0.54)):
				for (ax, ay), (bx, by) in segs:
					page.draw_line(
						to_pt(ax + dx, ay + dy), to_pt(bx + dx, by + dy), color=couleur, width=largeur
					)
	page.insert_text(
		pymupdf.Point(8 * PT, 10 * PT),
		f"{titre} | {d.laize} x {d.depl} mm | {d.poses} poses ({d.n_col}x{d.n_rang}) | "
		f"pas {d.pas_laize} x {d.pas_depl} | pince {p.pince} | pont {p.pont}",
		fontsize=7,
		color=(0.4, 0.4, 0.4),
	)
	doc.save(chemin_sortie)
	return chemin_sortie
