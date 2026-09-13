# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Pas de répétition et détection du trait commun."""

from shapely import prepared
from shapely.affinity import translate

SEUIL_TRAIT_COMMUN = 0.40  # part de l'interface à couvrir — À VALIDER SUR L'HISTORIQUE


def pas_minimal(poly, axe, jeu):
	"""Plus petit pas de répétition sans chevauchement, précision 0,01 mm.

	PIÈGE MAJEUR : le pont ne s'ajoute PAS au pas. Sur des bords inclinés (flancs
	de rabats), un jeu perpendiculaire de 2,5 mm se traduit par 3,2 mm de pas
	supplémentaire. Il faut donc passer par un offset géométrique (buffer),
	jamais par une addition. Une feuille de calcul se trompe ici.

	On vérifie k=1 ET k=2 : sur une forme non convexe, l'ensemble des translations
	valides peut être non connexe, et un pas valide au premier voisin peut
	provoquer un chevauchement avec le second.
	"""
	A = poly.buffer(jeu / 2, join_style=2)
	pa = prepared.prep(A)
	x0, y0, x1, y1 = A.bounds
	lim = (x1 - x0 if axe == "x" else y1 - y0) + 1

	def libre(t):
		for k in (1, 2):
			d = k * t
			B = translate(A, d, 0) if axe == "x" else translate(A, 0, d)
			if pa.intersects(B) and A.intersection(B).area > 1e-6:
				return False
		return True

	grossier, t = 0.5, 0.0
	while t <= lim and not libre(t):
		t += grossier
	if t > lim:
		return None
	lo, hi = max(0.0, t - grossier), t
	for _ in range(28):  # bissection -> 0,01 mm
		mid = (lo + hi) / 2
		if libre(mid):
			hi = mid
		else:
			lo = mid
	return round(hi, 2)


def contact_droit(poly, axe, pas, tol=0.15):
	"""Nature du contact entre deux poses accolées.

	Le trait commun exige UNE SEULE zone de contact continue. Deux zones séparées
	signifieraient partager deux filets distincts avec, entre eux, une chute non
	éjectable — infabriquable.

	Retourne (nombre_de_zones, longueur_de_la_plus_longue).
	"""
	B = translate(poly, pas, 0) if axe == "x" else translate(poly, 0, pas)
	inter = poly.buffer(tol).intersection(B.buffer(tol))
	if inter.is_empty:
		return 0, 0.0
	parts = [inter] if inter.geom_type == "Polygon" else list(inter.geoms)
	return len(parts), max(g.length / 2 for g in parts)


def pas_retenus(poly, jeu, trait_commun_autorise):
	"""Renvoie (pas_x, pas_y, trait_commun_x, trait_commun_y)."""
	x0, y0, x1, y1 = poly.bounds
	bw, bh = x1 - x0, y1 - y0
	px, py = pas_minimal(poly, "x", jeu), pas_minimal(poly, "y", jeu)
	tc = {"x": False, "y": False}
	if trait_commun_autorise:
		for axe in ("x", "y"):
			serre = pas_minimal(poly, axe, 0.0)
			if serre is None:
				continue
			nz, lg = contact_droit(poly, axe, serre)
			interface = bh if axe == "x" else bw
			if nz == 1 and lg >= SEUIL_TRAIT_COMMUN * interface:
				tc[axe] = True
				if axe == "x":
					px = serre
				else:
					py = serre
	return px, py, tc["x"], tc["y"]


def detail_contact(poly, axe):
	"""Diagnostic lisible pour le journal de calcul : (pas_serré, zones, longueur, interface)."""
	x0, y0, x1, y1 = poly.bounds
	interface = (y1 - y0) if axe == "x" else (x1 - x0)
	serre = pas_minimal(poly, axe, 0.0)
	if serre is None:
		return None, 0, 0.0, interface
	nz, lg = contact_droit(poly, axe, serre)
	return serre, nz, lg, interface
