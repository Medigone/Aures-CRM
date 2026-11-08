# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Cotations du PDF d'imposition : format, marges, pas et développé, dessinés en bleu autour de la feuille.

Le bleu est la couleur des cotations dans la convention Esko : `lecture_trace` l'ignore, un PDF coté se relit donc
comme avant. La page grandit de MARGE mm de chaque côté ; la feuille reste à l'échelle 1:1 au milieu.

Repère : mm, origine au coin bas-gauche de la feuille, Y vers le haut, comme `segments_imposes`.
"""

from dataclasses import dataclass

C_COTATION = (0.0, 0.0, 1.0)
MARGE = 32.0
# Distance au bord de la feuille des deux niveaux de cotes.
NIVEAU_1 = 9.0
NIVEAU_2 = 20.0
FLECHE = 2.2
TEXTE = 7.5


@dataclass
class Cote:
	"""Une cote de a à b (en mm) sur l'axe `axe` (« h » horizontal, « v » vertical), posée à la coordonnée `position`.

	`depuis` : le bord de la feuille d'où partent les lignes d'attache (0 en bas ou à gauche, la laize ou le
	déplacement en haut ou à droite).
	"""

	axe: str
	a: float
	b: float
	position: float
	texte: str
	depuis: float = 0.0


def mm_texte(valeur):
	arrondi = round(float(valeur), 2)
	return (f"{arrondi:.2f}".rstrip("0").rstrip(".")).replace(".", ",")


def cotes_feuille(laize, depl, p):
	"""Format et marges, toujours présents."""
	cotes = [
		Cote("h", 0, laize, -NIVEAU_2, f"Laize {mm_texte(laize)}"),
		Cote("v", 0, depl, -NIVEAU_2, f"Déplacement {mm_texte(depl)}"),
	]
	if p.lisiere > 0:
		cotes += [Cote("h", 0, p.lisiere, depl + NIVEAU_1, f"Lisière {mm_texte(p.lisiere)}", depl), Cote("h", laize - p.lisiere, laize, depl + NIVEAU_1, mm_texte(p.lisiere), depl)]
	if p.pince > 0:
		cotes.append(Cote("v", 0, p.pince, laize + NIVEAU_1, f"Pince {mm_texte(p.pince)}", laize))
	if p.marge_arriere > 0:
		cotes.append(Cote("v", depl - p.marge_arriere, depl, laize + NIVEAU_1, f"Arrière {mm_texte(p.marge_arriere)}", laize))
	return cotes


def cotes_poses(d, p, pose_l, pose_d, x0=0.0, y0=0.0):
	"""Développé de la première pose (sous la feuille et à gauche) et pas entre poses (au-dessus et à droite)."""
	gauche, bas = p.lisiere + x0, p.pince + y0
	cotes = []
	if pose_l and pose_d:
		cotes += [Cote("h", gauche, gauche + pose_l, -NIVEAU_1, f"Pose {mm_texte(pose_l)}"), Cote("v", bas, bas + pose_d, -NIVEAU_1, f"Pose {mm_texte(pose_d)}")]
	if d.n_col > 1 and d.pas_laize:
		cotes.append(Cote("h", gauche, gauche + d.pas_laize, d.depl + NIVEAU_2, f"Pas {mm_texte(d.pas_laize)}", d.depl))
	if d.n_rang > 1 and d.pas_depl:
		cotes.append(Cote("v", bas, bas + d.pas_depl, d.laize + NIVEAU_2, f"Pas {mm_texte(d.pas_depl)}", d.laize))
	return cotes


def dessiner(page, to_pt, cotes, pt):
	"""Trace chaque cote : ligne d'attache depuis la feuille, ligne de cote fléchée, valeur au milieu."""
	import pymupdf

	for c in cotes:
		if abs(c.b - c.a) < 0.05:
			continue
		if c.axe == "h":
			for x in (c.a, c.b):
				page.draw_line(to_pt(x, c.depuis), to_pt(x, c.position + (-1.5 if c.position < 0 else 1.5)), color=C_COTATION, width=0.3)
			_fleche_ligne(page, to_pt(c.a, c.position), to_pt(c.b, c.position), pt)
			largeur = pymupdf.get_text_length(c.texte, fontsize=TEXTE)
			debut, fin = to_pt(c.a, c.position), to_pt(c.b, c.position)
			# Trop court pour son texte : la valeur passe après la flèche de droite.
			x = (debut.x + fin.x) / 2 - largeur / 2 if fin.x - debut.x > largeur + 2 * FLECHE * pt else fin.x + 2
			page.insert_text(pymupdf.Point(x, debut.y - 1.6), c.texte, fontsize=TEXTE, color=C_COTATION)
		else:
			for y in (c.a, c.b):
				page.draw_line(to_pt(c.depuis, y), to_pt(c.position + (-1.5 if c.position < 0 else 1.5), y), color=C_COTATION, width=0.3)
			_fleche_ligne(page, to_pt(c.position, c.a), to_pt(c.position, c.b), pt)
			largeur = pymupdf.get_text_length(c.texte, fontsize=TEXTE)
			bas, haut = to_pt(c.position, c.a), to_pt(c.position, c.b)
			# Trop court : la valeur passe au-dessus de la flèche du haut.
			y = (bas.y + haut.y) / 2 + largeur / 2 if bas.y - haut.y > largeur + 2 * FLECHE * pt else haut.y - 2
			page.insert_text(pymupdf.Point(bas.x - 1.6, y), c.texte, fontsize=TEXTE, color=C_COTATION, rotate=90)


def _fleche_ligne(page, a, b, pt):
	import pymupdf

	page.draw_line(a, b, color=C_COTATION, width=0.35)
	vecteur = pymupdf.Point(b.x - a.x, b.y - a.y)
	longueur = (vecteur.x**2 + vecteur.y**2) ** 0.5 or 1.0
	ux, uy = vecteur.x / longueur, vecteur.y / longueur
	taille = FLECHE * pt
	for bout, sens in ((a, 1), (b, -1)):
		base = pymupdf.Point(bout.x + sens * ux * taille, bout.y + sens * uy * taille)
		gauche = pymupdf.Point(base.x - uy * taille * 0.45, base.y + ux * taille * 0.45)
		droite = pymupdf.Point(base.x + uy * taille * 0.45, base.y - ux * taille * 0.45)
		page.draw_polyline([gauche, bout, droite], color=C_COTATION, fill=C_COTATION, width=0.2, closePath=True)
