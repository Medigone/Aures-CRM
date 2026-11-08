# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Dispositions admissibles, scénarios et chiffrage matière.

Trois fonctions d'entrée :
  - `dispositions()`    : génère les formats de feuille SUR MESURE
  - `evaluer_format()`  : remplit au mieux une PALETTE (laize × depl imposés)
  - `evaluer_bobine()`  : laize fixe, coupe au besoin plafonnée par depl_max
  - `coupes_bobine()`   : les mêmes coupes, toutes, pour les comparer

L'espace de recherche est minuscule (2 rotations x 12 colonnes x 12 rangs) :
l'énumération exhaustive donne l'optimum exact. Pas d'heuristique, pas de
placement libre — en découpe forme la disposition est forcément un réseau
régulier (filets droits et continus, éjection).

Deux familles de variantes : la grille droite (une pose répétée) et les motifs
de deux poses (`motifs.py`) : tête-bêche, la seconde retournée à 180°, ou
quinconce, la seconde décalée. Un motif reste un réseau régulier, la paire se
répète comme une pose. `positions()` est le seul endroit qui place les poses :
le PDF, le CF2 et les écrans le reprennent.

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
from aurescrm.imposition.motifs import COLONNES, DROITE, QUINCONCE, RANGS, TETE_BECHE, motif_optimal

N_MAX_COL = 12
N_MAX_RANG = 12

# Réglage « Tête-bêche et quinconce » du calcul.
MOTIFS_DECALES = "decale"
MOTIFS_ALIGNES = "aligne"
MOTIFS_NON = "non"
# Un motif doit faire gagner au moins cela de surface par pose sur la grille droite : sinon, une ligne de plus sans
# intérêt dans le tableau.
GAIN_MINIMAL_MOTIF = 0.005

LIBELLES_MOTIF = {TETE_BECHE: "tête-bêche", QUINCONCE: "quinconce"}
# Valeurs des champs Select des tables Scenario Imposition et Imposition, et des écrans.
CHAMP_MOTIF = {DROITE: "Grille droite", TETE_BECHE: "Tête-bêche", QUINCONCE: "Quinconce"}
CHAMP_AXE = {COLONNES: "Colonnes", RANGS: "Rangs"}
_MOTIF_DEPUIS_CHAMP = {v: k for k, v in CHAMP_MOTIF.items()}
_AXE_DEPUIS_CHAMP = {v: k for k, v in CHAMP_AXE.items()}

# Familles de variantes à évaluer.
FAMILLE_DROITE = "droite"
FAMILLE_MOTIF = "motif"
FAMILLE_TOUTES = "toutes"


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

# Fibre par format : celle de la feuille (catalogue du support ou atelier), et celle que le tracé exige.
# Repère du tracé : « Verticale » = fibre le long de la hauteur du PDF de tracé. À 0°, la hauteur du tracé suit le
# déplacement de la feuille ; à 90°, la laize.
FIBRE_LAIZE = "En laize"
FIBRE_DEPL = "En déplacement"
FIBRES_FEUILLE = (FIBRE_LAIZE, FIBRE_DEPL)
TRACE_LIBRE = "Libre"
TRACE_VERTICALE = "Verticale"
TRACE_HORIZONTALE = "Horizontale"
FIBRES_TRACE = (TRACE_LIBRE, TRACE_VERTICALE, TRACE_HORIZONTALE)


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
	motifs: str = MOTIFS_DECALES


@dataclass
class Motif:
	"""Ce qui distingue un motif de deux poses d'une grille droite. Valeurs nulles : grille droite.

	En colonnes, la pose B (colonnes impaires) se place à (decalage_laize, decalage_depl) de la pose A et la paire
	avance de `pas_paire` en laize ; en rangs, c'est la même chose sur l'autre axe.
	"""

	motif: str = DROITE
	axe: str = ""
	decalage_laize: float = 0.0
	decalage_depl: float = 0.0
	pas_paire: float = 0.0


@dataclass
class Disposition(Motif):
	libelle: str = ""
	laize: float = 0.0
	depl: float = 0.0
	n_col: int = 0
	n_rang: int = 0
	pas_laize: float = 0.0
	pas_depl: float = 0.0
	rotation: int = 0
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
class Variante(Motif):
	"""Pas et encombrement d'une rotation. Suffit à évaluer n'importe quel format.

	Pour un motif, `pas_laize` et `pas_depl` sont les pas moyens par pose : leur produit est la surface par pose.
	"""

	rotation: int = 0
	bbox_l: float = 0.0
	bbox_d: float = 0.0
	pas_laize: float = 0.0
	pas_depl: float = 0.0
	trait_commun_laize: bool = False
	trait_commun_depl: bool = False

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
			**motif_depuis_dict(d),
		)


def motif_depuis_dict(d):
	"""Les champs du motif d'une ligne, d'un dict ou d'un document. Sans motif : grille droite."""
	get = d.get if hasattr(d, "get") else lambda cle, defaut=None: getattr(d, cle, defaut)
	motif = get("motif") or DROITE
	motif = _MOTIF_DEPUIS_CHAMP.get(motif, motif)
	if motif not in (TETE_BECHE, QUINCONCE):
		return {"motif": DROITE, "axe": "", "decalage_laize": 0.0, "decalage_depl": 0.0, "pas_paire": 0.0}
	axe = get("axe") or get("axe_motif") or COLONNES
	return {
		"motif": motif,
		"axe": _AXE_DEPUIS_CHAMP.get(axe, axe),
		"decalage_laize": float(get("decalage_laize") or 0),
		"decalage_depl": float(get("decalage_depl") or 0),
		"pas_paire": float(get("pas_paire") or 0),
	}


def motif_en_dict(m):
	return {"motif": m.motif, "axe": m.axe, "decalage_laize": m.decalage_laize, "decalage_depl": m.decalage_depl, "pas_paire": m.pas_paire}


def est_motif(m):
	return m.motif in (TETE_BECHE, QUINCONCE)


def libelle_grille(rotation, n_col, n_rang, motif=DROITE):
	libelle = f"{rotation}° — {n_col}x{n_rang}"
	return f"{libelle} · {LIBELLES_MOTIF[motif]}" if motif in LIBELLES_MOTIF else libelle


def positions(d, n_col=None, n_rang=None):
	"""(x, y, rotation) de chaque pose : coin bas-gauche de son encombrement, depuis la lisière et la pince.

	Le seul endroit qui place les poses. Ordre : colonne par colonne, de bas en haut.
	"""
	n_col = d.n_col if n_col is None else n_col
	n_rang = d.n_rang if n_rang is None else n_rang
	rot = int(d.rotation) % 360
	if not est_motif(d):
		return [(i * d.pas_laize, j * d.pas_depl, rot) for i in range(n_col) for j in range(n_rang)]
	rot_b = (rot + 180) % 360 if d.motif == TETE_BECHE else rot
	dl, dd, paire = d.decalage_laize, d.decalage_depl, d.pas_paire
	out = []
	if d.axe == RANGS:
		x_a, x_b = (max(0.0, -dl), max(0.0, dl)) if n_rang >= 2 else (0.0, 0.0)
		for i in range(n_col):
			for j in range(n_rang):
				impaire = j % 2
				out.append(((x_b if impaire else x_a) + i * d.pas_laize, (j // 2) * paire + impaire * dd, rot_b if impaire else rot))
		return out
	y_a, y_b = (max(0.0, -dd), max(0.0, dd)) if n_col >= 2 else (0.0, 0.0)
	for i in range(n_col):
		impaire = i % 2
		for j in range(n_rang):
			out.append(((i // 2) * paire + impaire * dl, (y_b if impaire else y_a) + j * d.pas_depl, rot_b if impaire else rot))
	return out


def encombrement(v, n_col, n_rang):
	"""Largeur et hauteur occupées par n_col × n_rang poses : la première consomme son encombrement, les suivantes
	le pas. Oublier le « 1 + » est l'erreur de calcul classique."""
	bw, bh = v.bbox_l, v.bbox_d
	if not est_motif(v):
		return bw + (n_col - 1) * v.pas_laize, bh + (n_rang - 1) * v.pas_depl
	dl, dd, paire = v.decalage_laize, v.decalage_depl, v.pas_paire
	if v.axe == RANGS:
		haut = max((j // 2) * paire + (j % 2) * dd for j in (n_rang - 1, n_rang - 2) if j >= 0)
		return bw + (n_col - 1) * v.pas_laize + (abs(dl) if n_rang >= 2 else 0.0), bh + haut
	large = max((i // 2) * paire + (i % 2) * dl for i in (n_col - 1, n_col - 2) if i >= 0)
	return bw + large, bh + (n_rang - 1) * v.pas_depl + (abs(dd) if n_col >= 2 else 0.0)


def _motif_complet(v, n_col, n_rang):
	"""Un motif sans sa seconde pose n'est qu'une grille droite : on l'écarte."""
	if not est_motif(v):
		return True
	return n_rang >= 2 if v.axe == RANGS else n_col >= 2


def _disposition(v, laize, depl, n_col, n_rang, **autres):
	return Disposition(
		libelle=libelle_grille(v.rotation, n_col, n_rang, v.motif),
		laize=round(laize, 1),
		depl=round(depl, 1),
		n_col=n_col,
		n_rang=n_rang,
		pas_laize=v.pas_laize,
		pas_depl=v.pas_depl,
		rotation=v.rotation,
		trait_commun_laize=v.trait_commun_laize,
		trait_commun_depl=v.trait_commun_depl,
		**motif_en_dict(v),
		**autres,
	)


def _rotations(p: Parametres):
	if p.sens_fibre == SENS_FIBRE_0:
		return (0,)
	if p.sens_fibre == SENS_FIBRE_90:
		return (90,)
	return (0, 90)


def rotations_format(fibre_trace, fibre_feuille):
	"""Les rotations de pose permises sur une feuille : (0, 90) si le tracé ou la feuille n'imposent rien."""
	if fibre_trace not in (TRACE_VERTICALE, TRACE_HORIZONTALE) or fibre_feuille not in FIBRES_FEUILLE:
		return (0, 90)
	# Verticale sur le tracé et fibre en déplacement : la pose reste droite ; chaque inversion la tourne d'un quart.
	droite = (fibre_trace == TRACE_VERTICALE) == (fibre_feuille == FIBRE_DEPL)
	return (0,) if droite else (90,)


def filtrer_fibre(vars_, rotations):
	"""Les variantes dont l'orientation respecte la fibre ; un motif tête-bêche (B à +180°) garde celle de A."""
	return [v for v in vars_ or [] if int(v.rotation) % 180 in rotations]


def _pose_tournee(poly, rot):
	g = rotate(poly, rot, origin="centroid")
	x0, y0, x1, y1 = g.bounds
	return translate(g, -x0, -y0), x1 - x0, y1 - y0


def _quart_de_tour(m, axe):
	"""Le même motif, toute la feuille tournée de 90° : les colonnes deviennent des rangs, et inversement.

	(x, y) devient (-y, x) : le décalage de B et les pas s'échangent, un décalage négatif sur l'axe de la paire se
	ramène à la paire voisine.
	"""
	if axe == COLONNES:
		return RANGS, {"decalage_laize": -m["decalage_depl"], "decalage_depl": m["decalage_laize"], "pas_paire": m["pas_paire"], "pas_laize": m["pas_depl"], "pas_depl": m["pas_laize"]}
	decalage = -m["decalage_depl"]
	if decalage < 0:
		decalage += m["pas_paire"]
	return COLONNES, {"decalage_laize": round(decalage, 2), "decalage_depl": m["decalage_laize"], "pas_paire": m["pas_paire"], "pas_laize": m["pas_depl"], "pas_depl": m["pas_laize"]}


def _variantes_motif(poly, p: Parametres, droites, empreinte=None):
	"""Les motifs qui font mieux que la grille droite de même rotation. Les deux rotations libres : on ne cherche qu'à
	0° et on tourne le résultat, la feuille entière tournée de 90° restant un motif valable."""
	from aurescrm.imposition import cache_geometrie

	if p.motifs == MOTIFS_NON or not droites:
		return []
	aligne = p.motifs == MOTIFS_ALIGNES
	rotations = [v.rotation for v in droites]
	cherchees = [0] if rotations == [0, 90] else rotations
	trouves = {}
	for rot in cherchees:
		pose, _bw, _bh = _pose_tournee(poly, rot)
		for motif in (TETE_BECHE, QUINCONCE):
			for axe in (COLONNES, RANGS):
				cle = f"v1:{empreinte}:{rot}:{p.pont}:{motif}:{axe}:{int(aligne)}" if empreinte else None
				m = cache_geometrie.lire_motif(cle)
				if m is None:
					m = motif_optimal(pose, p.pont, motif == TETE_BECHE, axe, aligne) or {}
					cache_geometrie.ecrire_motif(cle, m)
				if m:
					trouves[(rot, motif, axe)] = m
					if rot == 0 and 90 in rotations and len(cherchees) == 1:
						axe_90, m_90 = _quart_de_tour(m, axe)
						trouves[(90, motif, axe_90)] = m_90
	out = []
	for (rot, motif, axe), m in trouves.items():
		droite = next(v for v in droites if v.rotation == rot)
		if m["pas_laize"] * m["pas_depl"] > droite.pas_laize * droite.pas_depl * (1 - GAIN_MINIMAL_MOTIF):
			continue
		out.append(
			Variante(
				rotation=rot,
				bbox_l=droite.bbox_l,
				bbox_d=droite.bbox_d,
				pas_laize=m["pas_laize"],
				pas_depl=m["pas_depl"],
				trait_commun_laize=False,
				trait_commun_depl=False,
				motif=motif,
				axe=axe,
				decalage_laize=m["decalage_laize"],
				decalage_depl=m["decalage_depl"],
				pas_paire=m["pas_paire"],
			)
		)
	return out


def variantes(poly, p: Parametres, empreinte=None, avec_motifs=True):
	"""Pour chaque rotation admissible : encombrement, pas, trait commun. Puis les motifs qui font mieux."""
	out = []
	for rot in _rotations(p):
		g, bw, bh = _pose_tournee(poly, rot)
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
	return out + (_variantes_motif(poly, p, list(out), empreinte) if avec_motifs else [])


def _vars(poly, p: Parametres, vars_=None, famille=FAMILLE_DROITE):
	"""Résout les variantes : liste fournie (poly jamais lu) ou calcul depuis le polygone, puis garde la famille."""
	if vars_ is not None:
		tout = [v if isinstance(v, Variante) else Variante.depuis_dict(v) for v in vars_]
	else:
		tout = variantes(poly, p, avec_motifs=famille != FAMILLE_DROITE)
	if famille == FAMILLE_TOUTES:
		return tout
	return [v for v in tout if est_motif(v) == (famille == FAMILLE_MOTIF)]


def _plus_grand(n_max, tient):
	"""Le plus grand n de 1 à n_max pour lequel `tient(n)`, 0 si aucun. `tient` est monotone."""
	n = 0
	for k in range(1, n_max + 1):
		if not tient(k):
			break
		n = k
	return n


def _remplir(v, laize_utile, depl_utile):
	"""Le plus de poses de la variante dans la zone utile : (n_col, n_rang), ou None."""
	if not est_motif(v):
		if v.bbox_l > laize_utile or v.bbox_d > depl_utile:
			return None
		nc = 1 + int((laize_utile - v.bbox_l + 1e-6) // v.pas_laize)
		nr = 1 + int((depl_utile - v.bbox_d + 1e-6) // v.pas_depl)
		return min(nc, N_MAX_COL), min(nr, N_MAX_RANG)
	if v.axe == RANGS:
		nr = _plus_grand(N_MAX_RANG, lambda n: encombrement(v, 1, n)[1] <= depl_utile + 1e-6)
		nc = _plus_grand(N_MAX_COL, lambda n: encombrement(v, n, nr)[0] <= laize_utile + 1e-6) if nr else 0
	else:
		nc = _plus_grand(N_MAX_COL, lambda n: encombrement(v, n, 1)[0] <= laize_utile + 1e-6)
		nr = _plus_grand(N_MAX_RANG, lambda n: encombrement(v, nc, n)[1] <= depl_utile + 1e-6) if nc else 0
	if not nc or not nr or not _motif_complet(v, nc, nr):
		return None
	return nc, nr


def dispositions(poly, p: Parametres, vars_=None):
	"""Formats de feuille sur mesure accueillant exactement n_col x n_rang poses. Grille droite seulement."""
	res = []
	for v in _vars(poly, p, vars_):
		for nc in range(1, N_MAX_COL + 1):
			for nr in range(1, N_MAX_RANG + 1):
				largeur, hauteur = encombrement(v, nc, nr)
				laize = largeur + 2 * p.lisiere
				depl = hauteur + p.pince + p.marge_arriere
				if not format_dans_bornes(laize, depl, p):
					continue
				res.append(_disposition(v, laize, depl, nc, nr))
	return res


def evaluer_format(poly, p: Parametres, laize, depl, vars_=None, famille=FAMILLE_DROITE):
	"""Meilleur remplissage d'une feuille IMPOSÉE (format en stock, ou référence), dans une famille de variantes."""
	best = None
	laize_utile = laize - 2 * p.lisiere
	depl_utile = depl - p.pince - p.marge_arriere
	for v in _vars(poly, p, vars_, famille):
		grille = _remplir(v, laize_utile, depl_utile)
		if not grille:
			continue
		nc, nr = grille
		largeur, hauteur = encombrement(v, nc, nr)
		d = _disposition(
			v,
			laize,
			depl,
			nc,
			nr,
			reste_laize=round(laize_utile - largeur, 2),
			reste_depl=round(depl_utile - hauteur, 2),
			format_impose=True,
		)
		if best is None or d.poses > best.poses:
			best = d
	return best


def evaluer_format_et_motif(poly, p: Parametres, laize, depl, vars_=None):
	"""La grille droite, puis le meilleur motif s'il fait plus de poses sur la même feuille."""
	droite = evaluer_format(poly, p, laize, depl, vars_=vars_)
	motif = evaluer_format(poly, p, laize, depl, vars_=vars_, famille=FAMILLE_MOTIF)
	if motif and (not droite or motif.poses > droite.poses):
		return [d for d in (droite, motif) if d]
	return [droite] if droite else []


def coupes_bobine(poly, p: Parametres, laize, depl_max, vars_=None, famille=FAMILLE_DROITE):
	"""Toutes les coupes possibles d'une bobine : laize imposée, un déplacement par nombre de rangs.

	`depl_max` ≤ 0 : pas de plafond, de 1 à N_MAX_RANG rangs.
	Sinon : uniquement les rangs dont la coupe tient sous le plafond.
	"""
	try:
		laize = float(laize or 0)
		depl_max = float(depl_max or 0)
	except (TypeError, ValueError):
		return []
	if laize <= 0:
		return []

	laize_utile = laize - 2 * p.lisiere
	coupes = []
	for v in _vars(poly, p, vars_, famille):
		if v.bbox_l > laize_utile or not v.pas_laize or not v.pas_depl:
			continue
		for nr in range(1, N_MAX_RANG + 1):
			nc = _plus_grand(N_MAX_COL, lambda n: encombrement(v, n, nr)[0] <= laize_utile + 1e-6)
			if nc < 1:
				break
			largeur, hauteur = encombrement(v, nc, nr)
			depl = hauteur + p.pince + p.marge_arriere
			if depl_max > 0 and depl > depl_max + 1e-6:
				break
			if not _motif_complet(v, nc, nr) or not format_dans_bornes(laize, depl, p):
				continue
			coupes.append(
				_disposition(
					v,
					laize,
					depl,
					nc,
					nr,
					reste_laize=round(laize_utile - largeur, 2),
					reste_depl=round(depl_max - depl, 2) if depl_max > 0 else 0.0,
					format_impose=True,
				)
			)
	return coupes


def _moins_de_surface(d, best):
	if best is None or d.surface_par_pose < best.surface_par_pose - 1e-9:
		return True
	return abs(d.surface_par_pose - best.surface_par_pose) <= 1e-9 and d.poses > best.poses


def evaluer_bobine(poly, p: Parametres, laize, depl_max, vars_=None, famille=FAMILLE_DROITE):
	"""Laize imposée, déplacement = coupe calculée.

	On retient le min de `surface_par_pose`, départage au max de poses.
	"""
	best = None
	for d in coupes_bobine(poly, p, laize, depl_max, vars_=vars_, famille=famille):
		if _moins_de_surface(d, best):
			best = d
	return best


def evaluer_bobine_et_motif(poly, p: Parametres, laize, depl_max, vars_=None):
	"""La meilleure coupe en grille droite, puis le meilleur motif s'il consomme moins de feuille par pose."""
	droite = evaluer_bobine(poly, p, laize, depl_max, vars_=vars_)
	motif = evaluer_bobine(poly, p, laize, depl_max, vars_=vars_, famille=FAMILLE_MOTIF)
	if motif and (not droite or motif.surface_par_pose < droite.surface_par_pose - 1e-9):
		return [d for d in (droite, motif) if d]
	return [droite] if droite else []


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
