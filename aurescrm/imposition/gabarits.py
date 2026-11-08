# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Gabarits standard d'étui à partir des cotes L × l × H, pour un test rapide quand le tracé n'existe pas encore.

Sans Frappe. Trois modèles ECMA :

| Modèle   | Haut                                  | Bas                                   |
|----------|---------------------------------------|---------------------------------------|
| A20      | rabat rentrant sur le dos             | rabat rentrant sur le dos             |
| A20.20   | rabat rentrant sur le dos             | rabat rentrant sur la face            |
| FOND_AUTO| rabat rentrant sur le dos             | fond automatique, quatre pattes       |

Le développé, de gauche à droite : patte de collage, face (L), côté (l), dos (L), côté (l). Le corps va de y = 0 à
y = H ; les rabats du haut montent au-dessus, ceux du bas descendent en dessous. Les segments sortent au format de
`lecture_trace.lire_trace` : en mm, Y vers le haut. Le contour exact d'un vrai tracé (encoches, arrondis, fentes)
n'y est pas : c'est un ordre de grandeur pour l'imposition, à remplacer par le tracé avant fabrication.
"""

import math

from shapely.affinity import translate
from shapely.geometry import Polygon
from shapely.ops import unary_union

A20 = "A20"
A20_20 = "A20.20"
FOND_AUTO = "FOND_AUTO"
MODELES = {
	A20: "ECMA A20, rabats rentrants du même côté",
	A20_20: "ECMA A20.20, rabats rentrants opposés",
	FOND_AUTO: "Fond automatique, rabat rentrant en haut",
}
PATTE_COLLAGE = 15.0
EPAISSEUR_DEFAUT = 0.4
# Biais de la patte de collage et retrait du rabat rentrant par rapport au couvercle.
ANGLE_PATTE = 15
RETRAIT_RENTRANT = 1.5
COTE_MIN, COTE_MAX = 10.0, 1500.0


class _Pan:
	"""Un rabat accroché à un panneau : son contour, la hauteur de ses deux bords et ses rainages propres."""

	def __init__(self, points, gauche, droite, rainages=()):
		self.poly = Polygon(points)
		self.gauche, self.droite = gauche, droite
		self.rainages = list(rainages)


def _miroir(points, sens):
	return [(x, y * sens) for x, y in points]


def _couvercle(x, largeur, profondeur, sens):
	"""Couvercle de la profondeur du côté, puis le rabat rentrant, plus étroit et aux coins abattus."""
	h = profondeur
	t = min(max(12.0, profondeur * 0.35), 25.0)
	r = min(t * 0.6, 8.0)
	a, b = x + RETRAIT_RENTRANT, x + largeur - RETRAIT_RENTRANT
	pts = [(x, 0), (x, h), (a, h), (a, h + t - r), (a + r, h + t), (b - r, h + t), (b, h + t - r), (b, h), (x + largeur, h), (x + largeur, 0)]
	return _Pan(_miroir(pts, sens), h, h, [[(a, h * sens), (b, h * sens)]])


def _anti_poussiere(x, largeur, profondeur, sens):
	"""Patte anti-poussière : à peu près la moitié de la profondeur, biseautée des deux côtés."""
	d = max(profondeur * 0.5, 8.0)
	pts = [(x, 0), (x, d * 0.5), (x + min(d * 0.4, largeur * 0.3), d), (x + largeur - 2, d), (x + largeur, d * 0.6), (x + largeur, 0)]
	return _Pan(_miroir(pts, sens), d * 0.5, d * 0.6)


def _fond_principal(x, largeur, profondeur):
	"""Fond automatique, grande patte de la face ou du dos : biseau à 45° et pli de collage en diagonale."""
	a = profondeur * 0.5
	pts = [(x, 0), (x, -a), (x + largeur - a, -a), (x + largeur, 0)]
	return _Pan(pts, a, 0, [[(x, 0), (x + a, -a)]])


def _fond_crochet(x, largeur, profondeur):
	"""Fond automatique, patte de côté à crochet."""
	b = profondeur * 0.75
	pts = [(x, 0), (x, -b), (x + largeur * 0.5, -b), (x + largeur, -b * 0.4), (x + largeur, 0)]
	return _Pan(pts, b, b * 0.4)


def verifier_cotes(longueur, largeur, hauteur):
	for nom, valeur in (("L", longueur), ("l", largeur), ("H", hauteur)):
		if not (COTE_MIN <= valeur <= COTE_MAX):
			raise ValueError(f"Cote {nom} hors limites : {valeur:g} mm (de {COTE_MIN:g} à {COTE_MAX:g}).")


def generer_gabarit(modele, longueur, largeur, hauteur, epaisseur=EPAISSEUR_DEFAUT, patte=PATTE_COLLAGE):
	"""(segments_coupe, segments_rainage) d'un étui standard, en mm, Y vers le haut, coin bas gauche du corps en (patte, 0)."""
	if modele not in MODELES:
		raise ValueError(f"Modèle de gabarit inconnu : {modele}.")
	L, l, H = float(longueur), float(largeur), float(hauteur)
	verifier_cotes(L, l, H)
	e = max(float(epaisseur or 0), 0.0)
	g = float(patte or PATTE_COLLAGE)
	# Panneaux : face, côté, dos, côté. Le couvercle couvre le côté plus l'épaisseur du carton.
	bords = [g, g + L, g + L + l, g + 2 * L + l, g + 2 * L + 2 * l]
	panneaux = [(bords[i], bords[i + 1] - bords[i]) for i in range(4)]
	profondeur = l + e

	haut = {1: _anti_poussiere, 2: _couvercle, 3: _anti_poussiere}
	if modele == A20:
		bas = {1: _anti_poussiere, 2: _couvercle, 3: _anti_poussiere}
	elif modele == A20_20:
		bas = {0: _couvercle, 1: _anti_poussiere, 3: _anti_poussiere}
	else:
		bas = None

	rabats_haut = {i: f(x, w, profondeur, 1) for i, f in haut.items() for x, w in [panneaux[i]]}
	if bas is not None:
		rabats_bas = {i: f(x, w, profondeur, -1) for i, f in bas.items() for x, w in [panneaux[i]]}
	else:
		rabats_bas = {i: (_fond_principal if i in (0, 2) else _fond_crochet)(x, w, l) for i, (x, w) in enumerate(panneaux)}

	biais = g * math.tan(math.radians(ANGLE_PATTE))
	collage = Polygon([(g, 0), (0, biais), (0, H - biais), (g, H)])
	corps = Polygon([(g, 0), (bords[-1], 0), (bords[-1], H), (g, H)])
	formes = [corps, collage]
	formes += [translate(r.poly, 0, H) for r in rabats_haut.values()]
	formes += [r.poly for r in rabats_bas.values()]
	contour = unary_union(formes)
	if contour.geom_type != "Polygon":
		raise ValueError("Le gabarit ne forme pas une seule pièce : vérifier les cotes.")

	coupe = _segments(list(contour.exterior.coords))
	# Entre deux rabats voisins du même bord : une coupe, de la charnière au plus bas des deux bords.
	for rabats, base, sens in ((rabats_haut, H, 1), (rabats_bas, 0, -1)):
		for i in range(3):
			gauche, droite = rabats.get(i), rabats.get(i + 1)
			if gauche and droite:
				h = min(gauche.droite, droite.gauche)
				coupe.append([(bords[i + 1], base), (bords[i + 1], base + sens * h)])

	rainage = [[(x, 0), (x, H)] for x in bords[:-1]]
	for rabats, base in ((rabats_haut, H), (rabats_bas, 0)):
		for i, rabat in rabats.items():
			x, w = panneaux[i]
			rainage.append([(x, base), (x + w, base)])
			rainage += [[(ax, ay + base), (bx, by + base)] for (ax, ay), (bx, by) in rabat.rainages]
	return coupe, rainage


def _segments(points):
	return [[(round(ax, 3), round(ay, 3)), (round(bx, 3), round(by, 3))] for (ax, ay), (bx, by) in zip(points, points[1:]) if (ax, ay) != (bx, by)]


def encombrement(coupe):
	"""Largeur et hauteur du développé, en mm."""
	xs = [v for s in coupe for v in (s[0][0], s[1][0])]
	ys = [v for s in coupe for v in (s[0][1], s[1][1])]
	return max(xs) - min(xs), max(ys) - min(ys)


def ecrire_pdf(chemin, coupe, rainage, titre="", marge=10.0):
	"""Le gabarit en PDF, noir pour la coupe, rouge pour le rainage : `lire_trace` le relit comme un tracé Esko."""
	import pymupdf

	from aurescrm.imposition.lecture_trace import C_COUPE, C_RAINAGE, PT

	xs = [v for s in coupe + rainage for v in (s[0][0], s[1][0])]
	ys = [v for s in coupe + rainage for v in (s[0][1], s[1][1])]
	x0, y0 = min(xs) - marge, min(ys) - marge
	largeur, hauteur = max(xs) - x0 + marge, max(ys) - y0 + marge
	doc = pymupdf.open()
	page = doc.new_page(width=largeur * PT, height=hauteur * PT)
	to_pt = lambda x, y: pymupdf.Point((x - x0) * PT, (hauteur - (y - y0)) * PT)  # noqa: E731
	for segs, couleur in ((coupe, C_COUPE), (rainage, C_RAINAGE)):
		for (ax, ay), (bx, by) in segs:
			page.draw_line(to_pt(ax, ay), to_pt(bx, by), color=couleur, width=0.5)
	if titre:
		# Gris : ni noir ni rouge, la lecture du tracé l'ignore.
		page.insert_text(pymupdf.Point(4 * PT, 6 * PT), titre, fontsize=7, color=(0.45, 0.45, 0.45))
	doc.save(chemin)
	doc.close()
	return chemin
