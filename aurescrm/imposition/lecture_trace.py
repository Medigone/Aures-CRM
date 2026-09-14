# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Lecture du PDF de tracé Esko et extraction de la silhouette du développé.

Convention de couleurs Esko chez Aures :

| Couleur RGB      | Signification                        |
|------------------|--------------------------------------|
| (0, 0, 0) noir   | contour de coupe                     |
| (1, 0, 0) rouge  | rainage                              |
| (0, 0, 1) bleu   | cotation et annotations -> ignorées  |
"""

import numpy as np
import pymupdf
from PIL import Image, ImageDraw
from scipy.ndimage import binary_fill_holes, label
from shapely.geometry import Polygon
from skimage import measure

PT = 72 / 25.4  # 1 mm en points PDF

C_COUPE = (0.0, 0.0, 0.0)
C_RAINAGE = (1.0, 0.0, 0.0)
C_COTATION = (0.0, 0.0, 1.0)
COULEURS_CONNUES = (C_COUPE, C_RAINAGE, C_COTATION)
TOLERANCE_COULEUR = 0.02


def _couleur_connue(col, tolerance=TOLERANCE_COULEUR):
	"""Mappe une couleur PDF vers la convention Esko, avec la même tolérance partout.

	Un trait quasi noir (0.01, 0, 0) doit être lu comme une coupe — pas ignoré
	par la lecture exacte puis absous par le garde-fou des couleurs inattendues.
	"""
	if not col or len(col) < 3:
		return None
	for connue in COULEURS_CONNUES:
		if all(abs(c - k) <= tolerance for c, k in zip(col[:3], connue)):
			return connue
	return None


def _bezier(a, b, c, d, n=24):
	return [
		(
			(1 - t) ** 3 * a.x + 3 * (1 - t) ** 2 * t * b.x + 3 * (1 - t) * t * t * c.x + t**3 * d.x,
			(1 - t) ** 3 * a.y + 3 * (1 - t) ** 2 * t * b.y + 3 * (1 - t) * t * t * c.y + t**3 * d.y,
		)
		for t in [i / n for i in range(1, n + 1)]
	]


def lire_trace(chemin):
	"""Retourne (segments_coupe, segments_rainage) en mm, repère Y vers le haut."""
	out = {C_COUPE: [], C_RAINAGE: []}
	with pymupdf.open(chemin) as doc:
		page = doc[0]
		H = page.rect.height
		for it in page.get_drawings():
			connue = _couleur_connue(it["color"])
			if connue not in out:
				continue
			for op in it["items"]:
				if op[0] == "l":
					out[connue].append([(op[1].x, op[1].y), (op[2].x, op[2].y)])
				elif op[0] == "c":
					pts = [(op[1].x, op[1].y)] + _bezier(op[1], op[2], op[3], op[4])
					out[connue] += [[a, b] for a, b in zip(pts, pts[1:])]
				elif op[0] == "re":
					r = op[1]
					c = [(r.x0, r.y0), (r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1), (r.x0, r.y0)]
					out[connue] += [[a, b] for a, b in zip(c, c[1:])]
		conv = lambda s: [  # noqa: E731
			[(x0 / PT, (H - y0) / PT), (x1 / PT, (H - y1) / PT)] for (x0, y0), (x1, y1) in s
		]
		return conv(out[C_COUPE]), conv(out[C_RAINAGE])


def couleurs_inattendues(chemin, tolerance=TOLERANCE_COULEUR):
	"""Couleurs de tracé hors convention (garde-fou n°3).

	Cas réel rencontré : une ouverture ovale cotée 81 x 146 mm absente de la couche
	noire, donc absente de l'imposition générée. Le moteur doit le signaler.
	"""
	trouvees = {}
	with pymupdf.open(chemin) as doc:
		for it in doc[0].get_drawings():
			col = it["color"]
			if col is None or _couleur_connue(col, tolerance):
				continue
			cle = tuple(round(c, 3) for c in col[:3])
			trouvees[cle] = trouvees.get(cle, 0) + len(it["items"])
	return sorted(trouvees.items(), key=lambda kv: -kv[1])


def silhouette(segments_coupe, segments_rainage=(), ppm=20, ep=2):
	"""Silhouette extérieure du développé, par rastérisation + remplissage.

	NE PAS remplacer par polygonize ni par une union tamponnée : selon les formes,
	le contour Esko n'est pas un cycle fermé. Deux cas rencontrés en production :
	  - fentes ouvertes entre rabats et pattes de poussière (étui pharma)
	  - bords du développé portés par une ligne de RAINAGE et non par une coupe
	    (boîte mouchoir) -> les lignes noires seules ne ferment rien du tout
	D'où la prise en compte du rouge dans le tracé, et le passage par le bitmap.
	"""
	segs = list(segments_coupe) + list(segments_rainage)
	if not segs:
		raise ValueError(
			"Aucun chemin noir ou rouge dans le PDF — vérifier la convention de couleurs du tracé "
			"(noir = coupe, rouge = rainage, bleu = cotation)."
		)
	xs = [v for s in segs for v in (s[0][0], s[1][0])]
	ys = [v for s in segs for v in (s[0][1], s[1][1])]
	x0, y0 = min(xs) - 2, min(ys) - 2
	W = int((max(xs) - x0 + 2) * ppm) + 1
	H = int((max(ys) - y0 + 2) * ppm) + 1
	img = Image.new("1", (W, H), 0)
	d = ImageDraw.Draw(img)
	for (ax, ay), (bx, by) in segs:
		d.line(
			[((ax - x0) * ppm, H - (ay - y0) * ppm), ((bx - x0) * ppm, H - (by - y0) * ppm)],
			fill=1,
			width=ep,
		)
	plein = binary_fill_holes(np.array(img, bool))
	lab, n = label(plein)
	if n == 0:
		raise ValueError("Aucune surface fermée — vérifier la convention de couleurs du tracé")
	tailles = [(lab == i).sum() for i in range(1, n + 1)]
	masque = lab == 1 + int(np.argmax(tailles))
	contour = max(measure.find_contours(masque.astype(float), 0.5), key=len)
	pts = [(x0 + p[1] / ppm, y0 + (H - p[0]) / ppm) for p in contour]
	poly = Polygon(pts).buffer(0).simplify(0.05)
	return poly.buffer(-ep / (2 * ppm), join_style=2)  # compense l'épaisseur du trait


def metriques_developpe(poly):
	"""(longueur, largeur, surface utile cm², remplissage bbox %) du développé."""
	x0, y0, x1, y1 = poly.bounds
	bw, bh = x1 - x0, y1 - y0
	aire_bbox = bw * bh
	return {
		"developpe_l": round(bw, 2),
		"developpe_d": round(bh, 2),
		"surface_utile": round(poly.area / 100.0, 1),  # mm² -> cm²
		"surface_utile_mm2": poly.area,
		"remplissage_bbox": round(100.0 * poly.area / aire_bbox, 1) if aire_bbox else 0.0,
	}
