# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Motifs à deux poses : tête-bêche (la seconde retournée à 180°) et quinconce (la seconde décalée seulement).

Le motif se répète comme une grille. En colonnes, la pose B se place à (dx, dy) de la pose A, la paire avance de
`pas_paire` en laize et de `pas_autre` en déplacement. Les rangs se traitent comme des colonnes sur la pose transposée
(x et y échangés), puis on échange les résultats.

Recherche en deux temps :
  1. sur image : chaque pose est tramée tous les 0,5 mm, un peu grossie pour ne rien manquer. Une corrélation (FFT)
     donne d'un coup, pour chaque translation, si deux poses se recouvrent. On balaie alors tous les pas et décalages
     par simples lectures de tableaux ;
  2. le meilleur motif est contrôlé et resserré avec la géométrie exacte, sur un voisinage de 4 × 3 poses.

Le pont se compte comme dans `geometrie.pas_minimal` : chaque pose élargie de pont/2, jamais une addition au pas.
"""

import math

import numpy as np
import shapely
from shapely.affinity import affine_transform, rotate, translate

TETE_BECHE = "tete_beche"
QUINCONCE = "quinconce"
DROITE = "droite"
COLONNES = "colonnes"
RANGS = "rangs"

TRAME_LARGE = 3.0  # mm par pixel au premier balayage, sur toute la plage
TRAME = 1.0  # mm par pixel au balayage fin, autour du meilleur ; la géométrie exacte resserre ensuite
DECALAGE_MINIMAL = 0.5  # mm : en dessous, un quinconce n'est qu'une grille droite
SERRAGE_MAX = 3.0  # mm : jusqu'où la géométrie exacte peut resserrer un pas trouvé sur image
BOSSE = 0.05  # mm, doublés à chaque essai tant qu'un recouvrement subsiste
BOSSE_MAX = 40.0  # mm : au-delà, le motif est abandonné
RANGS_VOISINS = (-2, -1, 0, 1, 2)


def _transposer(g):
	return affine_transform(g, [0, 1, 1, 0, 0, 0])


def _paire_b(pose, retournee):
	if not retournee:
		return pose
	x0, y0, x1, y1 = pose.bounds
	return rotate(pose, 180, origin=((x0 + x1) / 2, (y0 + y1) / 2))


class _Carte:
	"""Pour chaque translation t (en pixels de `trame` mm), vrai si `a` et `b + t` se recouvrent."""

	def __init__(self, a, b, largeur, hauteur, trame):
		nx, ny = int(math.ceil(largeur / trame)) + 2, int(math.ceil(hauteur / trame)) + 2
		gx, gy = np.meshgrid((np.arange(nx) + 0.5) * trame, (np.arange(ny) + 0.5) * trame, indexing="ij")
		# Grossies de trois quarts de pixel : une trame ne doit jamais manquer un recouvrement.
		marge = trame * 0.75
		ia = shapely.contains_xy(a.buffer(marge, join_style=2), gx, gy).astype(float)
		ib = shapely.contains_xy(b.buffer(marge, join_style=2), gx, gy).astype(float)
		fx, fy = 2 * nx + 1, 2 * ny + 1
		correlation = np.fft.irfft2(np.fft.rfft2(ia, (fx, fy)) * np.conj(np.fft.rfft2(ib, (fx, fy))), (fx, fy))
		self.trame, self.nx, self.ny = trame, nx, ny
		# Table des translations libres, de -nx à +nx et de -ny à +ny, bordée de cases libres : au-delà, les poses
		# ne peuvent plus se toucher, et un indice hors table se ramène à la bordure.
		touche = np.roll(np.roll(correlation > 0.5, nx, axis=0), ny, axis=1)[: 2 * nx + 1, : 2 * ny + 1]
		self.table = np.ones((2 * nx + 3, 2 * ny + 3), dtype=bool)
		self.table[1:-1, 1:-1] = ~touche

	def libre(self, tx, ty):
		"""Indices de translation (pixels), en tableaux : vrai là où les poses ne se touchent pas."""
		ix = np.clip(np.asarray(tx) + self.nx + 1, 0, 2 * self.nx + 2)
		iy = np.clip(np.asarray(ty) + self.ny + 1, 0, 2 * self.ny + 2)
		return self.table[ix, iy]

	def py_min(self):
		return next((t for t in range(1, 2 * self.ny) if self.libre(0, t) and self.libre(0, 2 * t)), None)


def _balayer(aa, ab, pys, dys_pour, retournee):
	"""Le motif le plus serré parmi les pas `pys` et les décalages `dys_pour(py)`, en pixels.

	Renvoie (surface, dx, dy, pas_paire, pas_autre) ou None.
	"""
	xs = np.arange(0, 2 * aa.nx + 1)
	minimal = DECALAGE_MINIMAL / aa.trame
	meilleur = None
	for py in pys:
		if py < 1 or not (aa.libre(0, py) and aa.libre(0, 2 * py)):
			continue
		dys = np.array([dy for dy in dys_pour(py) if retournee or (abs(dy) >= minimal and abs(py - dy) >= minimal)], dtype=int)
		if not dys.size:
			continue
		colonne = dys[:, None]
		# B à droite de A, sans toucher A, ni dans ce rang ni dans les rangs voisins.
		droite = np.ones((dys.size, xs.size), dtype=bool)
		for j in RANGS_VOISINS:
			droite &= ab.libre(xs[None, :], colonne + j * py)
		dx = np.argmax(droite, axis=1)
		# La paire suivante : son A ne touche ni A ni B, dans ce rang ni dans les rangs voisins.
		pas = np.broadcast_to(xs[None, :] >= np.maximum(dx, 1)[:, None], droite.shape).copy()
		for j in RANGS_VOISINS:
			pas &= aa.libre(xs, j * py)[None, :]
			pas &= ab.libre(dx[:, None] - xs[None, :], colonne + j * py)
		valides = droite.any(axis=1) & pas.any(axis=1)
		if not valides.any():
			continue
		pas_paire = np.argmax(pas, axis=1)
		surface = np.where(valides, pas_paire * py, np.iinfo(np.int64).max)
		i = int(np.argmin(surface))
		if meilleur is None or surface[i] < meilleur[0]:
			meilleur = (int(surface[i]), int(dx[i]), int(dys[i]), int(pas_paire[i]), int(py))
	return meilleur


def _sur_image(a, b, largeur, hauteur, aligne, retournee):
	"""Balayage large sur une trame de 3 mm, puis fin sur 1 mm autour du meilleur. Valeurs en mm, ou None."""
	large = _Carte(a, a, largeur, hauteur, TRAME_LARGE), _Carte(a, b, largeur, hauteur, TRAME_LARGE)
	py_min = large[0].py_min()
	if py_min is None:
		return None
	plage = range(py_min, py_min + int(math.ceil(hauteur / TRAME_LARGE)) + 1)
	trouve = _balayer(*large, plage, (lambda py: [0]) if aligne else (lambda py: range(0, py)), retournee)
	if not trouve:
		return None
	facteur = int(round(TRAME_LARGE / TRAME))
	_s, _dx, dy0, _p, py0 = (v * facteur for v in trouve)
	fin = _Carte(a, a, largeur, hauteur, TRAME), _Carte(a, b, largeur, hauteur, TRAME)
	voisins = range(-2 * facteur, 2 * facteur + 1)
	affine = _balayer(*fin, [py0 + k for k in voisins], (lambda py: [0]) if aligne else (lambda py: [dy0 + k for k in voisins]), retournee)
	if affine:
		_s, dx, dy, pas_paire, py = affine
		return dx * TRAME, dy * TRAME, pas_paire * TRAME, py * TRAME
	_s, dx, dy, pas_paire, py = trouve
	return dx * TRAME_LARGE, dy * TRAME_LARGE, pas_paire * TRAME_LARGE, py * TRAME_LARGE


def _voisinage(a, b, dx, dy, pas_paire, pas_autre):
	"""Une pose A et une pose B au centre d'un bloc de 4 colonnes sur 3 rangs, et toutes les poses du bloc."""
	poses = {}
	for k in range(4):
		forme, x, y0 = (a, (k // 2) * pas_paire, 0.0) if k % 2 == 0 else (b, (k // 2) * pas_paire + dx, dy)
		for j in range(-1, 2):
			poses[(k, j)] = translate(forme, x, y0 + j * pas_autre)
	return [poses[(2, 0)], poses[(1, 0)]], list(poses.values())


def recouvrement(a, b, dx, dy, pas_paire, pas_autre):
	"""Vrai si deux poses du motif, élargies de pont/2 chacune, se recouvrent."""
	centre, toutes = _voisinage(a, b, dx, dy, pas_paire, pas_autre)
	for g in centre:
		autres = np.array([h for h in toutes if h is not g], dtype=object)
		touche = shapely.intersects(g, autres)
		if touche.any() and (shapely.area(shapely.intersection(g, autres[touche])) > 1e-6).any():
			return True
	return False


def _exact(a, b, valeurs):
	"""Contrôle exact du motif trouvé sur image : on élargit tant que ça touche, puis on resserre au plus juste."""
	dx, dy, pas_paire, pas_autre = valeurs
	bosse = BOSSE
	while recouvrement(a, b, dx, dy, pas_paire, pas_autre):
		if bosse > BOSSE_MAX:
			return None
		pas_paire += bosse
		pas_autre += bosse
		bosse *= 2
	valeurs = [dx, dy, pas_paire, pas_autre]
	for indice in (3, 0, 2):
		haut, bas = valeurs[indice], max(0.0, valeurs[indice] - SERRAGE_MAX)
		for _ in range(12):
			milieu = (haut + bas) / 2
			essai = list(valeurs)
			essai[indice] = milieu
			if recouvrement(a, b, *essai):
				bas = milieu
			else:
				haut = milieu
		valeurs[indice] = haut
	# Resserrés à la limite exacte : un arrondi au centième vers le bas ferait mordre les poses d'un rien.
	dx, dy, pas_paire, pas_autre = (math.ceil(v * 100) / 100 for v in valeurs)
	pas_paire += 0.01
	for _ in range(20):
		if not recouvrement(a, b, dx, dy, pas_paire, pas_autre):
			return round(dx, 2), round(dy, 2), round(pas_paire, 2), round(pas_autre, 2)
		pas_paire += 0.01
		pas_autre += 0.01
	return None


def motif_optimal(pose, jeu, retournee, axe, aligne=False):
	"""Le meilleur motif de deux poses pour `pose` (déjà tournée, coin bas-gauche de son encombrement à l'origine).

	Renvoie un dict (decalage_laize, decalage_depl, pas_paire, pas_laize, pas_depl), ou None si rien ne tient.
	Pour un motif en colonnes, `pas_laize` est le pas moyen (pas_paire / 2) ; en rangs, c'est `pas_depl`.
	"""
	if not retournee and aligne:
		return None  # un quinconce aligné n'est qu'une grille droite
	if axe == RANGS:
		pose = _transposer(pose)
	x0, y0, x1, y1 = pose.bounds
	pose = translate(pose, -x0, -y0)
	a = pose.buffer(jeu / 2, join_style=2)
	b = _paire_b(pose, retournee).buffer(jeu / 2, join_style=2)
	# Les poses élargies débordent de jeu/2 : on les trame dans un cadre qui part de -jeu.
	cadre_a, cadre_b = translate(a, jeu, jeu), translate(b, jeu, jeu)
	trouve = _sur_image(cadre_a, cadre_b, x1 - x0 + 2 * jeu, y1 - y0 + 2 * jeu, aligne, retournee)
	if not trouve:
		return None
	valeurs = _exact(a, b, trouve)
	if not valeurs:
		return None
	dx, dy, pas_paire, pas_autre = valeurs
	if axe == RANGS:
		return {"decalage_laize": dy, "decalage_depl": dx, "pas_paire": pas_paire, "pas_laize": pas_autre, "pas_depl": round(pas_paire / 2, 2)}
	return {"decalage_laize": dx, "decalage_depl": dy, "pas_paire": pas_paire, "pas_laize": round(pas_paire / 2, 2), "pas_depl": pas_autre}
