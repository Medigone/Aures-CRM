# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Plusieurs articles d'un même support sur une seule feuille : chacun dans son bloc, avec ses poses.

Sans Frappe. Le nombre de poses de chaque article est saisi ; le moteur cherche, pour un format, la grille de chaque
article (grille droite ou motif, 0° ou 90°) qui fait exactement ce nombre de poses, puis range les blocs côte à côte
sur la laize, ou les uns au-dessus des autres sur le déplacement, avec le pont entre deux blocs. Deux articles
différents ne partagent jamais un trait de coupe. Une feuille porte toutes les poses : il en faut assez pour l'article
le plus demandé au regard de ses poses, et les autres sont surproduits.
"""

import itertools
import math
from dataclasses import dataclass, field

from aurescrm.imposition.optimiseur import _disposition, _motif_complet, encombrement, est_motif, positions

# Pour borner l'énumération : au plus tant de blocs candidats par article, et tant d'articles.
BLOCS_PAR_ARTICLE = 10
ARTICLES_MAX = 4
SENS_LAIZE = "laize"
SENS_DEPL = "depl"


@dataclass
class ArticleGroupe:
	"""Un article du groupage : ses variantes (celles de son propre calcul), ses poses et sa quantité."""

	variantes: list
	poses: int
	quantite: int = 0
	surface_utile_mm2: float = 0.0


@dataclass
class Bloc:
	article: int
	disposition: object
	x: float
	y: float
	largeur: float
	hauteur: float


@dataclass
class Groupage:
	laize: float
	depl: float
	sens: str
	blocs: list = field(default_factory=list)
	reste_laize: float = 0.0
	reste_depl: float = 0.0

	@property
	def poses(self):
		return sum(b.disposition.poses for b in self.blocs)


def diviseurs(n):
	return [d for d in range(1, n + 1) if n % d == 0]


def blocs_possibles(article: ArticleGroupe, laize_utile, depl_utile):
	"""Les grilles qui font exactement les poses demandées et tiennent dans la zone utile, sans les dominées."""
	vus = []
	for v in article.variantes:
		for n_col in diviseurs(article.poses):
			n_rang = article.poses // n_col
			if not _motif_complet(v, n_col, n_rang):
				continue
			largeur, hauteur = encombrement(v, n_col, n_rang)
			if largeur > laize_utile + 1e-6 or hauteur > depl_utile + 1e-6:
				continue
			vus.append((largeur, hauteur, v, n_col, n_rang))
	# Un bloc plus large ET plus haut qu'un autre ne sert à rien.
	vus.sort(key=lambda b: (b[0] * b[1], b[0]))
	gardes = []
	for b in vus:
		if not any(o[0] <= b[0] + 1e-6 and o[1] <= b[1] + 1e-6 for o in gardes):
			gardes.append(b)
	return gardes[:BLOCS_PAR_ARTICLE]


def grouper(articles, p, laize, depl):
	"""Le rangement le plus compact des blocs sur ce format, ou None si les poses demandées n'y tiennent pas."""
	if not articles or len(articles) > ARTICLES_MAX or any(a.poses < 1 for a in articles):
		return None
	laize_utile = laize - 2 * p.lisiere
	depl_utile = depl - p.pince - p.marge_arriere
	candidats = [blocs_possibles(a, laize_utile, depl_utile) for a in articles]
	if not all(candidats):
		return None
	jeu = p.pont
	meilleur = None
	for choix in itertools.product(*candidats):
		for sens in (SENS_LAIZE, SENS_DEPL):
			if sens == SENS_LAIZE:
				large = sum(b[0] for b in choix) + jeu * (len(choix) - 1)
				haut = max(b[1] for b in choix)
			else:
				large = max(b[0] for b in choix)
				haut = sum(b[1] for b in choix) + jeu * (len(choix) - 1)
			if large > laize_utile + 1e-6 or haut > depl_utile + 1e-6:
				continue
			# Le plus compact d'abord, puis le plus de place laissée d'un seul tenant.
			cle = (large * haut, -max(laize_utile - large, depl_utile - haut))
			if meilleur is None or cle < meilleur[0]:
				meilleur = (cle, choix, sens, large, haut)
	if not meilleur:
		return None
	_cle, choix, sens, large, haut = meilleur
	g = Groupage(laize=laize, depl=depl, sens=sens, reste_laize=round(laize_utile - large, 2), reste_depl=round(depl_utile - haut, 2))
	curseur = 0.0
	for index, (largeur, hauteur, v, n_col, n_rang) in enumerate(choix):
		d = _disposition(v, laize, depl, n_col, n_rang, format_impose=True)
		x, y = (curseur, 0.0) if sens == SENS_LAIZE else (0.0, curseur)
		g.blocs.append(Bloc(article=index, disposition=d, x=round(x, 3), y=round(y, 3), largeur=largeur, hauteur=hauteur))
		curseur += (largeur if sens == SENS_LAIZE else hauteur) + jeu
	return g


def positions_groupe(g: Groupage):
	"""(article, x, y, rotation) de chaque pose, depuis la lisière et la pince, comme `positions()`."""
	return [(b.article, x + b.x, y + b.y, rot) for b in g.blocs for x, y, rot in positions(b.disposition)]


def feuilles(g: Groupage, articles):
	"""Les feuilles à tirer : assez pour chaque article ; et ce que chacun reçoit en trop."""
	besoins = [math.ceil(a.quantite / b.disposition.poses) if a.quantite else 0 for a, b in zip(articles, g.blocs)]
	tirage = max(besoins) if besoins else 0
	surplus = [tirage * b.disposition.poses - a.quantite if a.quantite else 0 for a, b in zip(articles, g.blocs)]
	return tirage, besoins, surplus


def taux_chutes_feuille(g: Groupage, articles):
	"""Part de la feuille entière qui part en chutes, toutes poses déduites."""
	utile = sum(a.surface_utile_mm2 * b.disposition.poses for a, b in zip(articles, g.blocs))
	return round(100 * (1 - utile / (g.laize * g.depl)), 1) if g.laize and g.depl else 0.0


def libelle_bloc(d):
	motif = f" {d.motif}" if est_motif(d) else ""
	return f"{d.n_col} x {d.n_rang}{motif} à {int(d.rotation)}°"


def segments_groupe(geometries, g: Groupage, p):
	"""Les segments de coupe et de rainage de toute la feuille. `geometries` : (coupe, rainage, poly) par article."""
	from copy import copy

	from aurescrm.imposition.generateur_pdf import segments_imposes

	coupe, rainage = [], []
	for b in g.blocs:
		decale = copy(p)
		decale.lisiere = p.lisiere + b.x
		decale.pince = p.pince + b.y
		c, r, poly = geometries[b.article]
		bc, br = segments_imposes(c, r, poly, b.disposition, decale)
		coupe += bc
		rainage += br
	return coupe, rainage


def generer_pdf_groupe(chemin, geometries, g: Groupage, p, titre=""):
	"""Une page à l'échelle 1:1, comme l'imposition d'un seul article : noir coupe, rouge rainage."""
	import pymupdf

	from aurescrm.imposition.generateur_pdf import C_FEUILLE
	from aurescrm.imposition.lecture_trace import C_COUPE, C_RAINAGE, PT

	coupe, rainage = segments_groupe(geometries, g, p)
	doc = pymupdf.open()
	page = doc.new_page(width=g.laize * PT, height=g.depl * PT)
	to_pt = lambda x, y: pymupdf.Point(x * PT, (g.depl - y) * PT)  # noqa: E731
	page.draw_rect(pymupdf.Rect(0, 0, g.laize * PT, g.depl * PT), color=C_FEUILLE, width=0.5)
	for segs, couleur, largeur in ((coupe, C_COUPE, 0.36), (rainage, C_RAINAGE, 0.54)):
		for (ax, ay), (bx, by) in segs:
			page.draw_line(to_pt(ax, ay), to_pt(bx, by), color=couleur, width=largeur)
	page.insert_text(pymupdf.Point(8 * PT, 10 * PT), f"{titre} | {g.laize:g} x {g.depl:g} mm | {g.poses} poses | pince {p.pince} | pont {p.pont}", fontsize=7, color=(0.4, 0.4, 0.4))
	doc.save(chemin)
	doc.close()
	return chemin
