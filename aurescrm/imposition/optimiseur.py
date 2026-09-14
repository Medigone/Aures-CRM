# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Dispositions admissibles, scénarios et chiffrage matière.

Trois fonctions d'entrée :
  - `dispositions()`    : génère les formats de feuille SUR MESURE
  - `evaluer_format()`  : remplit au mieux une PALETTE (laize × depl imposés)
  - `evaluer_bobine()`  : laize fixe, coupe au besoin plafonnée par depl_max

L'espace de recherche est minuscule (2 rotations x 12 colonnes x 12 rangs) :
l'énumération exhaustive donne l'optimum exact. Pas d'heuristique, pas de
placement libre — en découpe forme la disposition est forcément un réseau
régulier (filets droits et continus, éjection).

Note sur l'orientation de la grille : faire tourner la grille de 90° sur la
feuille sans faire tourner la pose est géométriquement faux (le pas mesuré
selon Y ne s'applique pas selon X). Le cas « grille pivotée » est donc couvert
par l'énumération des rotations de la pose, qui donne exactement les mêmes
formats de feuille, avec une rotation cohérente pour la génération du PDF.
"""

import math
from dataclasses import asdict, dataclass, field

from shapely.affinity import rotate, translate

from aurescrm.imposition.geometrie import pas_retenus

N_MAX_COL = 12
N_MAX_RANG = 12


def _hors_maxi(valeur, maxi):
	"""0 = pas de plafond (simulation libre)."""
	return bool(maxi) and valeur > maxi + 1e-6


def _hors_mini(valeur, mini):
	"""0 = pas de plancher."""
	return bool(mini) and valeur < mini - 1e-6


def format_dans_bornes(laize, depl, p: "Parametres"):
	if _hors_maxi(laize, p.laize_max) or _hors_mini(laize, p.laize_min):
		return False
	if _hors_maxi(depl, p.depl_max) or _hors_mini(depl, p.depl_min):
		return False
	return True


SENS_FIBRE_LIBRE = "Libre"
SENS_FIBRE_0 = "0°"
SENS_FIBRE_90 = "90°"


@dataclass
class Parametres:
	"""Contraintes machine + support. Les bornes sont l'INTERSECTION des machines
	d'impression et de découpe : la contrainte bloquante est presque toujours la
	platine de découpe, pas la presse."""

	laize_min: float = 0.0
	laize_max: float = 1020.0
	depl_min: float = 0.0
	depl_max: float = 720.0
	pince: float = 10.0
	marge_arriere: float = 15.0
	lisiere: float = 15.6
	pont: float = 2.5
	trait_commun: bool = True
	sens_fibre: str = SENS_FIBRE_LIBRE
	quantite: int = 0
	grammage: float = 0.0
	prix_tonne: float = 0.0
	formats_stock: tuple = ()  # ((laize, depl), ...)


@dataclass
class Disposition:
	libelle: str
	laize: float
	depl: float
	n_col: int
	n_rang: int
	pas_laize: float
	pas_depl: float
	rotation: int
	trait_commun_laize: bool = False
	trait_commun_depl: bool = False
	reste_laize: float = 0.0
	reste_depl: float = 0.0
	format_impose: bool = False
	poses: int = field(init=False)
	surface_par_pose: float = field(init=False)  # mm² de feuille consommés par pose

	def __post_init__(self):
		self.poses = self.n_col * self.n_rang
		self.surface_par_pose = self.laize * self.depl / self.poses if self.poses else 0.0


@dataclass
class Variante:
	"""Pas et encombrement d'une rotation. Suffit à évaluer n'importe quel format."""

	rotation: int
	bbox_l: float
	bbox_d: float
	pas_laize: float
	pas_depl: float
	trait_commun_laize: bool
	trait_commun_depl: bool

	def en_dict(self):
		return asdict(self)

	@classmethod
	def depuis_dict(cls, d):
		return cls(
			rotation=int(d["rotation"]),
			bbox_l=float(d["bbox_l"]),
			bbox_d=float(d["bbox_d"]),
			pas_laize=float(d["pas_laize"]),
			pas_depl=float(d["pas_depl"]),
			trait_commun_laize=bool(d["trait_commun_laize"]),
			trait_commun_depl=bool(d["trait_commun_depl"]),
		)


def _rotations(p: Parametres):
	if p.sens_fibre == SENS_FIBRE_0:
		return (0,)
	if p.sens_fibre == SENS_FIBRE_90:
		return (90,)
	return (0, 90)


def variantes(poly, p: Parametres):
	"""Pour chaque rotation admissible : encombrement, pas, trait commun."""
	out = []
	for rot in _rotations(p):
		g = rotate(poly, rot, origin="centroid")
		x0, y0, x1, y1 = g.bounds
		bw, bh = x1 - x0, y1 - y0
		g = translate(g, -x0, -y0)
		px, py, tcx, tcy = pas_retenus(g, p.pont, p.trait_commun)
		if not px or not py:
			continue
		out.append(
			Variante(
				rotation=rot,
				bbox_l=bw,
				bbox_d=bh,
				pas_laize=px,
				pas_depl=py,
				trait_commun_laize=tcx,
				trait_commun_depl=tcy,
			)
		)
	return out


def _vars(poly, p: Parametres, vars_=None):
	"""Résout les variantes : liste fournie (poly jamais lu) ou calcul depuis le polygone."""
	if vars_ is not None:
		return [v if isinstance(v, Variante) else Variante.depuis_dict(v) for v in vars_]
	return variantes(poly, p)


def dispositions(poly, p: Parametres, vars_=None):
	"""Formats de feuille sur mesure accueillant exactement n_col x n_rang poses."""
	res = []
	for v in _vars(poly, p, vars_):
		rot, bw, bh, px, py, tcx, tcy = (
			v.rotation,
			v.bbox_l,
			v.bbox_d,
			v.pas_laize,
			v.pas_depl,
			v.trait_commun_laize,
			v.trait_commun_depl,
		)
		for nc in range(1, N_MAX_COL + 1):
			for nr in range(1, N_MAX_RANG + 1):
				laize = bw + (nc - 1) * px + 2 * p.lisiere
				depl = bh + (nr - 1) * py + p.pince + p.marge_arriere
				if not format_dans_bornes(laize, depl, p):
					continue
				res.append(
					Disposition(
						libelle=f"{rot}° — {nc}x{nr}",
						laize=round(laize, 1),
						depl=round(depl, 1),
						n_col=nc,
						n_rang=nr,
						pas_laize=px,
						pas_depl=py,
						rotation=rot,
						trait_commun_laize=tcx,
						trait_commun_depl=tcy,
					)
				)
	return res


def evaluer_format(poly, p: Parametres, laize, depl, vars_=None):
	"""Meilleur remplissage d'une feuille IMPOSÉE (format en stock, ou référence)."""
	best = None
	for v in _vars(poly, p, vars_):
		rot, bw, bh, px, py, tcx, tcy = (
			v.rotation,
			v.bbox_l,
			v.bbox_d,
			v.pas_laize,
			v.pas_depl,
			v.trait_commun_laize,
			v.trait_commun_depl,
		)
		laize_utile = laize - 2 * p.lisiere
		depl_utile = depl - p.pince - p.marge_arriere
		if bw > laize_utile or bh > depl_utile:
			continue
		# La PREMIÈRE pose consomme son encombrement complet, les suivantes le pas
		# seulement. Oublier le « 1 + » est l'erreur de calcul classique.
		nc = 1 + int((laize_utile - bw + 1e-6) // px)
		nr = 1 + int((depl_utile - bh + 1e-6) // py)
		nc = min(nc, N_MAX_COL)
		nr = min(nr, N_MAX_RANG)
		d = Disposition(
			libelle=f"{rot}° — {nc}x{nr}",
			laize=round(laize, 1),
			depl=round(depl, 1),
			n_col=nc,
			n_rang=nr,
			pas_laize=px,
			pas_depl=py,
			rotation=rot,
			trait_commun_laize=tcx,
			trait_commun_depl=tcy,
			reste_laize=round(laize_utile - (bw + (nc - 1) * px), 2),
			reste_depl=round(depl_utile - (bh + (nr - 1) * py), 2),
			format_impose=True,
		)
		if best is None or d.poses > best.poses:
			best = d
	return best


def evaluer_bobine(poly, p: Parametres, laize, depl_max, vars_=None):
	"""Laize imposée, déplacement = coupe calculée.

	`depl_max` ≤ 0 : pas de plafond, on coupe au besoin (1 à N_MAX_RANG).
	Sinon : uniquement les rangs dont la coupe tient sous le plafond.
	On retient le min de `surface_par_pose`, départage au max de poses.
	"""
	try:
		laize = float(laize or 0)
		depl_max = float(depl_max or 0)
	except (TypeError, ValueError):
		return None
	if laize <= 0:
		return None

	best = None
	for v in _vars(poly, p, vars_):
		rot, bw, bh, px, py, tcx, tcy = (
			v.rotation,
			v.bbox_l,
			v.bbox_d,
			v.pas_laize,
			v.pas_depl,
			v.trait_commun_laize,
			v.trait_commun_depl,
		)
		laize_utile = laize - 2 * p.lisiere
		if bw > laize_utile or not px or not py:
			continue
		nc = 1 + int((laize_utile - bw + 1e-6) // px)
		nc = min(max(nc, 0), N_MAX_COL)
		if nc < 1:
			continue
		for nr in range(1, N_MAX_RANG + 1):
			depl = bh + (nr - 1) * py + p.pince + p.marge_arriere
			if depl_max > 0 and depl > depl_max + 1e-6:
				break
			if not format_dans_bornes(laize, depl, p):
				continue
			d = Disposition(
				libelle=f"{rot}° — {nc}x{nr}",
				laize=round(laize, 1),
				depl=round(depl, 1),
				n_col=nc,
				n_rang=nr,
				pas_laize=px,
				pas_depl=py,
				rotation=rot,
				trait_commun_laize=tcx,
				trait_commun_depl=tcy,
				reste_laize=round(laize_utile - (bw + (nc - 1) * px), 2),
				reste_depl=round(depl_max - depl, 2) if depl_max > 0 else 0.0,
				format_impose=True,
			)
			if best is None:
				best = d
				continue
			if d.surface_par_pose < best.surface_par_pose - 1e-9:
				best = d
			elif abs(d.surface_par_pose - best.surface_par_pose) <= 1e-9 and d.poses > best.poses:
				best = d
	return best


def chiffrer(d: Disposition, p: Parametres, surface_utile_mm2):
	"""Feuilles, tonnage, taux de chutes et coût matière pour la quantité commandée."""
	if not d or not d.poses:
		return {}
	nb_feuilles = math.ceil(p.quantite / d.poses) if p.quantite else 0
	m2 = nb_feuilles * d.laize * d.depl / 1e6
	tonnage = m2 * p.grammage / 1e6 if p.grammage else 0.0
	taux_chutes = 100 * (1 - surface_utile_mm2 / d.surface_par_pose) if d.surface_par_pose else 0.0
	cout_matiere = round(tonnage * p.prix_tonne, 2) if p.prix_tonne else 0.0
	feuilles_1000 = math.ceil(1000 / d.poses)
	m2_1000 = feuilles_1000 * d.laize * d.depl / 1e6
	tonnage_1000 = m2_1000 * p.grammage / 1e6 if p.grammage else 0.0
	cout_par_1000 = round(tonnage_1000 * p.prix_tonne, 2) if p.prix_tonne else 0.0
	return {
		"nb_feuilles": nb_feuilles,
		"m2": round(m2, 1),
		"tonnage": round(tonnage, 3),
		"taux_chutes": round(taux_chutes, 1),
		"cout_matiere": cout_matiere,
		"cout_par_1000": cout_par_1000,
	}


def format_en_stock(d: Disposition, p: Parametres, tol=2.0):
	return any(
		abs(d.laize - laize) <= tol and d.depl <= depl + tol for laize, depl in (p.formats_stock or ())
	)


def alertes(d: Disposition, p: Parametres):
	"""Contraintes à afficher en clair sur la ligne de scénario."""
	msgs = []
	if p.formats_stock:
		if not format_en_stock(d, p):
			msgs.append(f"format absent du stock — nécessite une refente en {d.laize:.1f} mm")
	else:
		msgs.append("aucun format de stock renseigné sur le support")
	if _hors_maxi(d.laize, p.laize_max) or _hors_maxi(d.depl, p.depl_max):
		msgs.append(
			f"dépasse le format maxi machine ({p.laize_max:.0f} x {p.depl_max:.0f} mm)"
		)
	if p.laize_min and d.laize < p.laize_min:
		msgs.append(f"sous le format mini machine en laize ({p.laize_min:.0f} mm)")
	if p.depl_min and d.depl < p.depl_min:
		msgs.append(f"sous le format mini machine en déplacement ({p.depl_min:.0f} mm)")
	if d.format_impose:
		if 0 <= d.reste_laize < 1:
			msgs.append(
				f"reste {d.reste_laize:.2f} mm en laize — une colonne peut être perdue, sensible au pont"
			)
		if 0 <= d.reste_depl < 1:
			msgs.append(
				f"reste {d.reste_depl:.2f} mm en déplacement — une rangée peut être perdue, sensible au pont"
			)
	return msgs


def contrainte_bloquante(poly, p: Parametres, vars_=None):
	"""Garde-fou n°5 : dire QUELLE contrainte interdit toute disposition."""
	if p.laize_max and p.laize_min > p.laize_max:
		return (
			f"intersection vide en laize : mini {p.laize_min:.0f} mm > maxi {p.laize_max:.0f} mm"
		)
	if p.depl_max and p.depl_min > p.depl_max:
		return (
			f"intersection vide en déplacement : mini {p.depl_min:.0f} mm > maxi {p.depl_max:.0f} mm"
		)
	details = []
	for v in _vars(poly, p, vars_):
		rot, bw, bh = v.rotation, v.bbox_l, v.bbox_d
		laize_1 = bw + 2 * p.lisiere
		depl_1 = bh + p.pince + p.marge_arriere
		if _hors_maxi(laize_1, p.laize_max):
			details.append(
				f"rotation {rot}° : laize mini nécessaire {laize_1:.1f} mm "
				f"> laize maxi machine {p.laize_max:.1f} mm"
			)
		elif _hors_maxi(depl_1, p.depl_max):
			details.append(
				f"rotation {rot}° : déplacement mini nécessaire {depl_1:.1f} mm "
				f"> déplacement maxi machine {p.depl_max:.1f} mm"
			)
		elif _hors_mini(laize_1, p.laize_min) or _hors_mini(depl_1, p.depl_min):
			details.append(
				f"rotation {rot}° : format mini machine ({p.laize_min:.0f} x {p.depl_min:.0f} mm) "
				f"non atteint par une pose unique ({laize_1:.1f} x {depl_1:.1f} mm)"
			)
		else:
			details.append(f"rotation {rot}° : aucune combinaison n_col/n_rang dans les bornes machine")
	if not details:
		details.append(
			"aucune rotation admissible — le sens fibre imposé élimine toutes les orientations"
		)
	return " ; ".join(details)


def trois_scenarios(dispos, p: Parametres):
	"""A = matière minimale | B = charge machine minimale | C = format déjà en stock.

	Ne PAS sortir les trois meilleurs taux de chutes : on obtiendrait trois variantes
	quasi identiques, sans valeur de décision. Sur un dossier à fort volume, le nombre
	de feuilles pèse souvent plus lourd que la matière (cas réel : -3,1 % de carton
	pour +19 % de passages presse et platine — mauvais en coût complet).
	"""
	if not dispos:
		return {}
	sortie = {}
	sortie["A — Matière minimale"] = min(dispos, key=lambda d: d.surface_par_pose)
	if p.quantite:
		sortie["B — Charge machine minimale"] = min(
			dispos, key=lambda d: (math.ceil(p.quantite / d.poses), d.surface_par_pose)
		)
	else:
		sortie["B — Charge machine minimale"] = max(
			dispos, key=lambda d: (d.poses, -d.surface_par_pose)
		)
	en_stock = [d for d in dispos if format_en_stock(d, p)]
	sortie["C — Format en stock"] = (
		min(en_stock, key=lambda d: d.surface_par_pose) if en_stock else None
	)
	return sortie
