# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Couche métier du moteur d'imposition, découplée des DocTypes.

Entrées simples, dicts en sortie. Les quatre modules du moteur
(optimiseur, geometrie, lecture_trace, generateur_pdf) restent sans import frappe.
Les fonctions qui lisent l'ERP importent frappe localement.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from dataclasses import asdict, dataclass, field

from shapely.geometry import LineString


from aurescrm.imposition import cache_geometrie
from aurescrm.imposition.generateur_pdf import _poses_normalisees
from aurescrm.imposition.geometrie import SEUIL_TRAIT_COMMUN, detail_contact
from aurescrm.imposition.lecture_trace import (
	couleurs_inattendues,
	lire_trace,
	metriques_developpe,
	silhouette,
)
from aurescrm.imposition.optimiseur import (
	Disposition,
	Parametres,
	Variante,
	alertes,
	chiffrer,
	contrainte_bloquante,
	dispositions,
	coupes_bobine,
	evaluer_bobine_et_motif,
	evaluer_format,
	evaluer_format_et_motif,
	format_en_stock,
	motif_depuis_dict,
	positions,
	trois_scenarios,
	variantes,
	CHAMP_AXE,
	CHAMP_MOTIF,
	FAMILLE_TOUTES,
	LIBELLES_MOTIF,
	MOTIFS_ALIGNES,
	MOTIFS_DECALES,
	MOTIFS_NON,
)
from aurescrm.imposition.motifs import DROITE, RANGS

PINCE_DEFAUT = 10.0
MARGE_ARRIERE_DEFAUT = 15.0
LISIERE_DEFAUT = 15.6
PONT_DEFAUT = 2.5
TOLERANCE_DEVELOPPE = 0.5
TOLERANCE_FORMAT = 2.0
LIBELLE_REFERENCE = "RÉFÉRENCE"
MAX_POINTS_SVG = 400
MAX_SVG_OCTETS = 64 * 1024

# Réglage « Tête-bêche et quinconce » du Calcul Imposition, vers le paramètre du moteur.
REGLAGE_MOTIFS = {"Décalé autorisé": MOTIFS_DECALES, "Aligné seulement": MOTIFS_ALIGNES, "Non": MOTIFS_NON}
REGLAGE_MOTIFS_DEFAUT = "Décalé autorisé"


def motifs_depuis_reglage(reglage):
	return REGLAGE_MOTIFS.get(reglage or REGLAGE_MOTIFS_DEFAUT, MOTIFS_DECALES)


@dataclass
class EntreeCalcul:
	chemin: str
	pont: float = PONT_DEFAUT
	trait_commun: bool = True
	sens_fibre: str = "Libre"
	quantite: int = 0
	grammage: float = 0.0
	prix_tonne: float = 0.0
	formats_stock: tuple = ()
	bornes: dict = field(default_factory=dict)
	formats_etudies: list = field(default_factory=list)
	inclure_sur_mesure: bool = True
	format_reference: tuple | None = None
	dimensions_saisies: list | None = None
	mode: str = "atelier"  # "atelier" | "ef"
	lisiere_saisie: float | None = None
	pince_saisie: float | None = None
	marge_arriere_saisie: float | None = None
	ignorer_contraintes_machine: bool = False
	motifs: str = MOTIFS_DECALES


@dataclass
class ResultatCalcul:
	mesures: dict
	lignes: list
	variantes: list
	params: Parametres
	silhouette: dict | None
	empreinte: str
	coupe: list
	rainage: list
	poly: object


def empreinte_fichier(chemin):
	h = hashlib.sha1()
	with open(chemin, "rb") as f:
		for bloc in iter(lambda: f.read(1024 * 1024), b""):
			h.update(bloc)
	return h.hexdigest()


def geometrie(chemin, empreinte=None):
	"""(coupe, rainage, poly) — passe par le cache Redis si l'empreinte est connue."""
	empreinte = empreinte or empreinte_fichier(chemin)
	cached = cache_geometrie.lire(empreinte)
	if cached:
		return cached
	coupe, rainage = lire_trace(chemin)
	poly = silhouette(coupe, rainage)
	cache_geometrie.ecrire(empreinte, coupe, rainage, poly)
	return coupe, rainage, poly


def _fusionner_segments(segments, tol=0.05):
	"""Chaîne les segments bout à bout pour simplifier le path SVG."""
	restants = [((s[0][0], s[0][1]), (s[1][0], s[1][1])) for s in segments if s and len(s) == 2]
	chaines = []
	while restants:
		(ax, ay), (bx, by) = restants.pop()
		chaine = [(ax, ay), (bx, by)]
		progres = True
		while progres:
			progres = False
			for i, ((cx, cy), (dx, dy)) in enumerate(restants):
				hx, hy = chaine[-1]
				tx, ty = chaine[0]
				if abs(cx - hx) <= tol and abs(cy - hy) <= tol:
					chaine.append((dx, dy))
				elif abs(dx - hx) <= tol and abs(dy - hy) <= tol:
					chaine.append((cx, cy))
				elif abs(dx - tx) <= tol and abs(dy - ty) <= tol:
					chaine.insert(0, (cx, cy))
				elif abs(cx - tx) <= tol and abs(cy - ty) <= tol:
					chaine.insert(0, (dx, dy))
				else:
					continue
				restants.pop(i)
				progres = True
				break
		chaines.append(chaine)
	return chaines


def _sous_echantillonner(coords, max_points):
	if len(coords) <= max_points:
		return coords
	if max_points < 2:
		return coords[:max_points]
	pas = (len(coords) - 1) / (max_points - 1)
	return [coords[round(i * pas)] for i in range(max_points)]


def _simplifier_polyligne(coords, epsilon):
	"""Douglas-Peucker : garde les coins, enlève les points colinéaires (ovale, Bézier)."""
	if len(coords) <= 2:
		return coords
	ligne = LineString(coords)
	if ligne.length == 0:
		return [coords[0]]
	out = list(ligne.simplify(epsilon, preserve_topology=False).coords)
	if len(out) < 2:
		return [coords[0], coords[-1]]
	out[0], out[-1] = coords[0], coords[-1]
	return out


def _reduire_chaines(chaines, max_points):
	"""Réduit sous max_points sans relier deux coins par une diagonale parasite."""
	epsilon = 0.15
	simpl = [_simplifier_polyligne(c, epsilon) for c in chaines]
	total = sum(len(c) for c in simpl)
	while total > max_points and epsilon < 2.0:
		epsilon *= 1.6
		simpl = [_simplifier_polyligne(c, epsilon) for c in chaines]
		total = sum(len(c) for c in simpl)
	if total <= max_points:
		return simpl
	reste = max_points
	budget = []
	for i, c in enumerate(simpl):
		n = max(2, round(max_points * len(c) / total)) if i < len(simpl) - 1 else reste
		n = min(n, len(c), reste)
		budget.append(max(2, n) if reste >= 2 else n)
		reste -= budget[-1]
	return [_sous_echantillonner(c, n) for c, n in zip(simpl, budget) if n >= 2]


def _segments_vers_path(segments, max_points=MAX_POINTS_SVG):
	if not segments:
		return ""
	chaines = _fusionner_segments(segments)
	if not chaines:
		return ""
	chaines = _reduire_chaines(chaines, max_points)
	parties = []
	for coords in chaines:
		if len(coords) < 2:
			continue
		x0, y0 = coords[0]
		d = [f"M{x0:.2f},{y0:.2f}"]
		for x, y in coords[1:]:
			d.append(f"L{x:.2f},{y:.2f}")
		parties.append("".join(d))
	return " ".join(parties)


def silhouette_svg(poly, coupe, rainage):
	"""Paths SVG simplifiés par rotation. Lossy : aperçu écran uniquement."""
	out = {}
	for rot in (0, 90):
		coupe_n, tourne = _poses_normalisees(coupe, poly, rot)
		rain_n, _ = _poses_normalisees(rainage, poly, rot)
		x0, y0, x1, y1 = tourne.bounds
		out[str(rot)] = {
			"path_coupe": _segments_vers_path(coupe_n),
			"path_rainage": _segments_vers_path(rain_n),
			"l": round(x1 - x0, 2),
			"d": round(y1 - y0, 2),
		}
	if len(json.dumps(out).encode()) > MAX_SVG_OCTETS:
		return None
	return out


def params_depuis_bornes(bornes, pont, trait_commun, sens_fibre, quantite, grammage, prix_tonne, formats_stock, motifs=MOTIFS_DECALES):
	bornes = bornes or {}

	def f(cle, defaut):
		if cle not in bornes or bornes[cle] in (None, ""):
			return float(defaut)
		return float(bornes[cle])

	return Parametres(
		laize_min=f("laize_min", 0),
		laize_max=f("laize_max", 0),
		depl_min=f("depl_min", 0),
		depl_max=f("depl_max", 0),
		pince=f("pince", PINCE_DEFAUT),
		marge_arriere=f("marge_arriere", MARGE_ARRIERE_DEFAUT),
		lisiere=f("lisiere", LISIERE_DEFAUT),
		pont=float(pont or PONT_DEFAUT),
		trait_commun=bool(trait_commun),
		sens_fibre=sens_fibre or "Libre",
		quantite=int(quantite or 0),
		grammage=float(grammage or 0),
		prix_tonne=float(prix_tonne or 0),
		formats_stock=tuple(formats_stock or ()),
		motifs=motifs or MOTIFS_DECALES,
	)


def params_depuis_dict(d):
	d = dict(d or {})
	d["formats_stock"] = tuple(tuple(x) for x in (d.get("formats_stock") or ()))
	d["trait_commun"] = bool(d.get("trait_commun"))
	champs = {f.name for f in Parametres.__dataclass_fields__.values()}
	return Parametres(**{k: v for k, v in d.items() if k in champs})


def params_en_dict(p: Parametres):
	d = asdict(p)
	d["formats_stock"] = [list(x) for x in (p.formats_stock or ())]
	return d


def ligne_scenario(libelle, d: Disposition, params: Parametres, surface_utile_mm2, origine=""):
	chiffrage = chiffrer(d, params, surface_utile_mm2)
	return {
		"libelle": libelle,
		"origine": origine,
		"laize": d.laize,
		"depl": d.depl,
		"nb_poses": d.poses,
		"n_col": d.n_col,
		"n_rang": d.n_rang,
		"pas_laize": d.pas_laize,
		"pas_depl": d.pas_depl,
		"rotation": d.rotation,
		"trait_commun_laize": int(d.trait_commun_laize),
		"trait_commun_depl": int(d.trait_commun_depl),
		"surface_par_pose": round(d.surface_par_pose / 100.0, 1),
		"taux_chutes": chiffrage.get("taux_chutes", 0),
		"nb_feuilles": chiffrage.get("nb_feuilles", 0),
		"tonnage": chiffrage.get("tonnage", 0),
		"cout_matiere": chiffrage.get("cout_matiere", 0),
		"cout_par_1000": chiffrage.get("cout_par_1000", 0),
		"reste_laize": d.reste_laize,
		"reste_depl": d.reste_depl,
		"format_en_stock": int(format_en_stock(d, params)),
		"alerte": " ; ".join(alertes(d, params)),
		"retenu": 0,
		**champs_motif(d),
		"poses": poses_scenario(d),
	}


def champs_motif(d):
	"""Les champs du motif tels que les tables Scenario Imposition et Imposition les rangent."""
	return {
		"motif": CHAMP_MOTIF.get(d.motif, CHAMP_MOTIF[DROITE]),
		"axe_motif": CHAMP_AXE.get(d.axe, ""),
		"decalage_laize": d.decalage_laize,
		"decalage_depl": d.decalage_depl,
		"pas_paire": d.pas_paire,
	}


def poses_scenario(d):
	"""Les poses d'un scénario pour les écrans : [x, y, rotation] depuis la lisière et la pince, au dixième."""
	return [[round(x, 1), round(y, 1), r] for x, y, r in positions(d)]


def libelle_motif_detail(d):
	"""« Tête-bêche en colonnes, décalage 12,5 mm », pour le journal et les écrans. Vide pour une grille droite."""
	if d.motif not in LIBELLES_MOTIF:
		return ""
	nom = LIBELLES_MOTIF[d.motif].capitalize()
	axe = "en colonnes" if d.axe != RANGS else "en rangs"
	decalage = d.decalage_depl if d.axe != RANGS else d.decalage_laize
	if abs(decalage) < 0.05:
		return f"{nom} {axe}, alignés"
	return f"{nom} {axe}, décalage {abs(decalage):.1f} mm".replace(".", ",")


def avec_motif(libelle, d):
	"""Le libellé d'un format, suivi du motif quand c'en est un."""
	return f"{libelle} · {LIBELLES_MOTIF[d.motif]}" if d.motif in LIBELLES_MOTIF else libelle


def disposition_depuis_ligne(ligne):
	"""Une ligne de scénario (dict, ou ligne de table) redevient une Disposition."""
	get = ligne.get if hasattr(ligne, "get") else lambda cle, defaut=None: getattr(ligne, cle, defaut)

	def nombre(cle):
		return float(get(cle) or 0)

	return Disposition(
		libelle=get("libelle") or "",
		laize=nombre("laize"),
		depl=nombre("depl"),
		n_col=int(nombre("n_col")),
		n_rang=int(nombre("n_rang")),
		pas_laize=nombre("pas_laize"),
		pas_depl=nombre("pas_depl"),
		rotation=int(nombre("rotation")),
		trait_commun_laize=bool(int(nombre("trait_commun_laize"))),
		trait_commun_depl=bool(int(nombre("trait_commun_depl"))),
		**motif_depuis_dict(ligne),
	)


def libelle_bobine(laize, d, depl_max=0):
	libelle = f"Bobine {laize:.0f} mm — {d.n_col}×{d.n_rang} · coupe {d.depl:.0f} mm"
	return f"{libelle} (max {depl_max:.0f})" if depl_max > 0 else libelle


def simuler_coupes_bobine(vars_, params: Parametres, laize, depl_max, surface_mm2):
	"""Une ligne par coupe possible de cette bobine, grille droite et motifs, de la moins gourmande à la plus."""
	coupes = coupes_bobine(None, params, laize, depl_max, vars_=vars_, famille=FAMILLE_TOUTES)
	coupes.sort(key=lambda d: (d.n_rang, d.surface_par_pose))
	return [ligne_scenario(avec_motif(libelle_bobine(laize, d, depl_max), d), d, params, surface_mm2, origine="Bobine") for d in coupes]


def simuler_formats(vars_, params: Parametres, laize, depl, surface_mm2, libelle=""):
	"""L'essai d'un format : la grille droite, et le motif s'il fait plus de poses."""
	libelle = libelle or f"{laize:.0f} x {depl:.0f}"
	return [
		ligne_scenario(avec_motif(libelle, d), d, params, surface_mm2, origine="Simulation")
		for d in evaluer_format_et_motif(None, params, laize, depl, vars_=vars_)
	]


def simuler_format(vars_, params: Parametres, laize, depl, surface_mm2, libelle=""):
	d = evaluer_format(None, params, laize, depl, vars_=vars_)
	if not d:
		return None
	return ligne_scenario(
		libelle or f"{laize:.0f} x {depl:.0f}",
		d,
		params,
		surface_mm2,
		origine="Simulation",
	)


def simuler_grille(vars_, params: Parametres, rotation, n_col, n_rang, surface_mm2):
	vars_ = [v if isinstance(v, Variante) else Variante.depuis_dict(v) for v in (vars_ or [])]
	v = next((x for x in vars_ if int(x.rotation) == int(rotation) and x.motif not in LIBELLES_MOTIF), None)
	if not v or n_col < 1 or n_rang < 1:
		return None
	laize = v.bbox_l + (n_col - 1) * v.pas_laize + 2 * params.lisiere
	depl = v.bbox_d + (n_rang - 1) * v.pas_depl + params.pince + params.marge_arriere
	d = Disposition(
		libelle=f"{rotation}° — {n_col}x{n_rang}",
		laize=round(laize, 1),
		depl=round(depl, 1),
		n_col=int(n_col),
		n_rang=int(n_rang),
		pas_laize=v.pas_laize,
		pas_depl=v.pas_depl,
		rotation=int(rotation),
		trait_commun_laize=v.trait_commun_laize,
		trait_commun_depl=v.trait_commun_depl,
	)
	return ligne_scenario(d.libelle, d, params, surface_mm2, origine="Simulation")


def journal_motifs(vars_, params: Parametres):
	"""Ce que le tête-bêche et le quinconce ont donné, dans le journal du calcul."""
	if params.motifs == MOTIFS_NON:
		return "Tête-bêche et quinconce : non cherchés (réglage du calcul)."
	motifs = [v for v in vars_ if v.motif in LIBELLES_MOTIF]
	if not motifs:
		return "Tête-bêche et quinconce : aucun motif ne fait mieux que la grille droite."
	droites = {v.rotation: v.pas_laize * v.pas_depl for v in vars_ if v.motif not in LIBELLES_MOTIF}
	lignes = ["Tête-bêche et quinconce, surface par pose comparée à la grille droite :"]
	for v in motifs:
		surface = v.pas_laize * v.pas_depl
		gain = 100 * (1 - surface / droites[v.rotation]) if droites.get(v.rotation) else 0.0
		lignes.append(f"  {v.rotation}° — {libelle_motif_detail(v)} : {surface / 100:.1f} cm², {gain:.1f} % de moins.")
	return "\n".join(lignes)


def journal_trait_commun(poly, params: Parametres):
	lignes = []
	for axe, nom in (("x", "laize"), ("y", "déplacement")):
		serre, zones, longueur, interface = detail_contact(poly, axe)
		if serre is None:
			lignes.append(f"Trait commun en {nom} : non évaluable.")
			continue
		part = 100 * longueur / interface if interface else 0
		retenu = params.trait_commun and zones == 1 and longueur >= SEUIL_TRAIT_COMMUN * interface
		lignes.append(
			f"Trait commun en {nom} : {'OUI' if retenu else 'NON'} — pas serré {serre} mm, "
			f"{zones} zone(s) de contact, {longueur:.1f} mm sur {interface:.1f} ({part:.0f} %, "
			f"seuil {SEUIL_TRAIT_COMMUN * 100:.0f} %)."
		)
	return " ".join(lignes)


def diagnostic_bornes(bornes):
	"""Si l'intersection impression/découpe est un intervalle vide, expliquer pourquoi."""
	bornes = bornes or {}
	laize_min = float(bornes.get("laize_min") or 0)
	laize_max = float(bornes.get("laize_max") or 0)
	depl_min = float(bornes.get("depl_min") or 0)
	depl_max = float(bornes.get("depl_max") or 0)
	parts = []
	if laize_max and laize_min > laize_max:
		parts.append(
			f"laize : le plus grand des minis ({laize_min:.0f} mm) dépasse "
			f"le plus petit des maxis ({laize_max:.0f} mm)"
		)
	if depl_max and depl_min > depl_max:
		parts.append(
			f"déplacement : le plus grand des minis ({depl_min:.0f} mm) dépasse "
			f"le plus petit des maxis ({depl_max:.0f} mm)"
		)
	return parts


def _est_bobine(fmt):
	v = fmt.get("bobine") if isinstance(fmt, dict) else getattr(fmt, "bobine", 0)
	if v in (True, 1, "1"):
		return True
	return str(v).strip().lower() in ("true", "yes")


def _laize_hors_bornes(laize, params: Parametres):
	if params.laize_max and laize > params.laize_max + 1e-6:
		return True
	if params.laize_min and laize < params.laize_min - 1e-6:
		return True
	return False


def _hors_bornes(laize, depl, params: Parametres):
	if _laize_hors_bornes(laize, params):
		return True
	if params.depl_max and depl > params.depl_max + 1e-6:
		return True
	if params.depl_min and depl < params.depl_min - 1e-6:
		return True
	return False


def bornes_libres():
	"""Pince / lisière par défaut, aucun plafond de format."""
	return {
		"laize_min": 0.0,
		"laize_max": 0.0,
		"depl_min": 0.0,
		"depl_max": 0.0,
		"pince": PINCE_DEFAUT,
		"marge_arriere": MARGE_ARRIERE_DEFAUT,
		"lisiere": LISIERE_DEFAUT,
	}


def bornes_ou_libres(bornes):
	base = bornes_libres()
	src = bornes or {}
	for cle in ("laize_min", "laize_max", "depl_min", "depl_max"):
		try:
			base[cle] = float(src.get(cle) or 0)
		except (TypeError, ValueError):
			pass
	for cle in ("pince", "marge_arriere", "lisiere"):
		try:
			val = float(src.get(cle) or 0)
		except (TypeError, ValueError):
			val = 0.0
		if val:
			base[cle] = val
	return base


def saisie_vers_bornes(bornes, lisiere=None, pince=None, marge_arriere=None, ignorer=False):
	"""Surcharge ingénieur : lisière / pince / marge, et optionnellement plus de min/max."""
	out = dict(bornes or {})
	for cle, val in (("lisiere", lisiere), ("pince", pince), ("marge_arriere", marge_arriere)):
		if val in (None, ""):
			continue
		out[cle] = float(val)
	if ignorer:
		out["laize_min"] = 0.0
		out["laize_max"] = 0.0
		out["depl_min"] = 0.0
		out["depl_max"] = 0.0
	return out


def appliquer_saisie_sur_params(
	params: Parametres, lisiere=None, pince=None, marge_arriere=None, ignorer=False
):
	"""Applique la saisie atelier sur des Parametres déjà chargés (simulation)."""
	if pince not in (None, ""):
		params.pince = float(pince)
	if marge_arriere not in (None, ""):
		params.marge_arriere = float(marge_arriere)
	if lisiere not in (None, ""):
		params.lisiere = float(lisiere)
	if ignorer:
		params.laize_min = 0.0
		params.laize_max = 0.0
		params.depl_min = 0.0
		params.depl_max = 0.0
	return params


def preparer(entree: EntreeCalcul, journal):
	"""Lecture du PDF, développé, variantes et silhouette — sans évaluer de formats."""
	chemin = entree.chemin
	if not chemin or not os.path.exists(chemin):
		raise ValueError("PDF de tracé introuvable.")
	journal.append(f"Fichier lu : {os.path.basename(chemin)}")
	empreinte = empreinte_fichier(chemin)

	for couleur, nb in couleurs_inattendues(chemin):
		journal.append(
			f"AVERTISSEMENT : {nb} chemin(s) en couleur {couleur} hors convention "
			"(noir = coupe, rouge = rainage, bleu = cotation) — vérifier qu'aucune découpe ne manque."
		)

	coupe, rainage, poly = geometrie(chemin, empreinte)
	journal.append(
		f"Tracé lu : {len(coupe)} segments de coupe, {len(rainage)} de rainage."
	)
	mesures = metriques_developpe(poly)
	journal.append(
		f"Développé {mesures['developpe_l']} x {mesures['developpe_d']} mm — "
		f"surface utile {mesures['surface_utile']} cm² — remplissage bbox {mesures['remplissage_bbox']} %."
	)

	saisies = entree.dimensions_saisies
	if saisies and len(saisies) == 2:
		calcules = sorted([mesures["developpe_l"], mesures["developpe_d"]])
		ecarts = [abs(a - b) for a, b in zip(calcules, sorted(saisies))]
		if max(ecarts) > TOLERANCE_DEVELOPPE:
			raise ValueError(
				f"Développé calculé {calcules[0]:.1f} x {calcules[1]:.1f} mm incohérent avec les "
				f"dimensions du Tracé {saisies[0]:.1f} x {saisies[1]:.1f} mm "
				f"(écart {max(ecarts):.1f} mm > {TOLERANCE_DEVELOPPE} mm). Aucun scénario proposé."
			)
		journal.append(f"Recoupement avec le Tracé : écart max {max(ecarts):.2f} mm — OK.")
	else:
		journal.append(
			"Recoupement du développé non effectué (pas de cotes de développé comparables, "
			"ou PDF distinct du fichier du Tracé)."
		)

	bornes = bornes_ou_libres(entree.bornes)
	bornes = saisie_vers_bornes(
		bornes,
		lisiere=entree.lisiere_saisie,
		pince=entree.pince_saisie,
		marge_arriere=entree.marge_arriere_saisie,
		ignorer=entree.ignorer_contraintes_machine,
	)
	if bornes.get("laize_max") and bornes.get("depl_max"):
		journal.append(
			"Bornes machine retenues (intersection impression/découpe) : "
			f"laize {float(bornes['laize_min']):.0f}–{float(bornes['laize_max']):.0f} mm, "
			f"déplacement {float(bornes['depl_min']):.0f}–{float(bornes['depl_max']):.0f} mm, "
			f"pince {bornes.get('pince')}, marge arrière {bornes.get('marge_arriere')}, "
			f"lisière {bornes.get('lisiere')}."
		)
		vides = diagnostic_bornes(bornes)
		if vides:
			raise ValueError(
				"Aucune feuille ne peut passer à la fois en impression et en découpe — "
				+ " ; ".join(vides)
				+ ". Vérifier les formats mini/maxi des deux fiches Machine."
			)
	else:
		journal.append(
			"Aucune borne machine : simulation libre "
			f"(pince {bornes['pince']}, marge {bornes['marge_arriere']}, lisière {bornes['lisiere']})."
		)

	params = params_depuis_bornes(
		bornes,
		entree.pont,
		entree.trait_commun,
		entree.sens_fibre,
		entree.quantite,
		entree.grammage,
		entree.prix_tonne,
		entree.formats_stock,
		entree.motifs,
	)
	vars_ = variantes(poly, params, empreinte=empreinte)
	svg = silhouette_svg(poly, coupe, rainage)
	if svg is None:
		journal.append("Aperçu graphique désactivé : silhouette trop lourde (> 64 Ko).")

	return ResultatCalcul(
		mesures=mesures,
		lignes=[],
		variantes=[v.en_dict() for v in vars_],
		params=params,
		silhouette=svg,
		empreinte=empreinte,
		coupe=coupe,
		rainage=rainage,
		poly=poly,
	)


def calculer(entree: EntreeCalcul, journal):
	prep = preparer(entree, journal)
	params = prep.params
	besoin_plafond = (entree.mode == "ef" or entree.inclure_sur_mesure) and not (
		entree.ignorer_contraintes_machine
	)
	if besoin_plafond and (not params.laize_max or not params.depl_max):
		raise ValueError(
			"Format maxi absent sur la (les) machine(s) sélectionnée(s) — "
			"renseigner format max laize et format max développement, "
			"ou cocher « Ignorer min/max machine »."
		)

	vars_ = [Variante.depuis_dict(v) for v in prep.variantes]
	poly = prep.poly
	mesures = prep.mesures
	surface = mesures["surface_utile_mm2"]
	lignes = []

	if entree.mode == "ef":
		dispos = dispositions(poly, params, vars_=vars_)
		journal.append(f"{len(dispos)} disposition(s) admissible(s).")
		if not dispos:
			raise ValueError("Aucune disposition admissible — " + contrainte_bloquante(None, params, vars_=vars_))
		for libelle, d in trois_scenarios(dispos, params).items():
			if d:
				lignes.append(ligne_scenario(libelle, d, params, surface, origine="Sur mesure"))
		if entree.format_reference:
			laize_ref, depl_ref = entree.format_reference
			reference = evaluer_format(None, params, laize_ref, depl_ref, vars_=vars_)
			if reference:
				lignes.append(
					ligne_scenario(
						f"{LIBELLE_REFERENCE} — {laize_ref:.0f} x {depl_ref:.0f}",
						reference,
						params,
						surface,
						origine="Référence",
					)
				)
			else:
				journal.append(
					f"RÉFÉRENCE {laize_ref:.0f} x {depl_ref:.0f} mm : aucune pose ne tient sur ce format."
				)
	else:
		if not entree.formats_etudies and not entree.inclure_sur_mesure:
			raise ValueError("Aucun format coché — rien à évaluer.")
		for fmt in entree.formats_etudies or []:
			laize = float(fmt.get("laize") or 0)
			depl = float(fmt.get("depl") or 0)
			est_bobine = _est_bobine(fmt)
			if not entree.ignorer_contraintes_machine:
				hors = (
					_laize_hors_bornes(laize, params)
					if est_bobine
					else _hors_bornes(laize, depl, params)
				)
				if hors:
					journal.append(
						f"Format {laize:.0f} × {depl:.0f} mm écarté : hors bornes machine "
						f"({params.laize_min:.0f}–{params.laize_max:.0f} × "
						f"{params.depl_min:.0f}–{params.depl_max:.0f})."
					)
					continue
			if est_bobine:
				trouvees = evaluer_bobine_et_motif(None, params, laize, depl, vars_=vars_)
				if not trouvees:
					plafond = f" (max {depl:.0f})" if depl > 0 else ""
					journal.append(
						f"Bobine {laize:.0f} mm{plafond} : aucune pose ne tient "
						"(coupe trop longue ou laize insuffisante)."
					)
					continue
				for d in trouvees:
					lignes.append(ligne_scenario(avec_motif(libelle_bobine(laize, d, depl), d), d, params, surface, origine="Bobine"))
				continue
			trouvees = evaluer_format_et_motif(None, params, laize, depl, vars_=vars_)
			if not trouvees:
				journal.append(
					f"Format {laize:.0f} × {depl:.0f} mm : aucune pose ne tient."
				)
				continue
			libelle = fmt.get("libelle") or f"{laize:.0f} × {depl:.0f}"
			for d in trouvees:
				lignes.append(
					ligne_scenario(avec_motif(libelle, d), d, params, surface, origine="Format étudié")
				)
		if entree.inclure_sur_mesure:
			dispos = dispositions(poly, params, vars_=vars_)
			journal.append(f"{len(dispos)} disposition(s) sur mesure admissible(s).")
			if dispos:
				for libelle, d in trois_scenarios(dispos, params).items():
					if d:
						lignes.append(ligne_scenario(libelle, d, params, surface, origine="Sur mesure"))
			elif not lignes:
				raise ValueError(
					"Aucune disposition admissible — " + contrainte_bloquante(None, params, vars_=vars_)
				)
		if not lignes:
			raise ValueError(
				"Aucune disposition admissible — " + contrainte_bloquante(None, params, vars_=vars_)
			)

	journal.append(journal_trait_commun(poly, params))
	journal.append(journal_motifs(vars_, params))

	return ResultatCalcul(
		mesures=mesures,
		lignes=lignes,
		variantes=prep.variantes,
		params=params,
		silhouette=prep.silhouette,
		empreinte=prep.empreinte,
		coupe=prep.coupe,
		rainage=prep.rainage,
		poly=poly,
	)


# ---------------------------------------------------------------------------
# Accès ERP (frappe importé localement)
# ---------------------------------------------------------------------------


def support_technique_article(article):
	if not article:
		return None
	import frappe

	item = frappe.db.get_value("Item", article, ["custom_support", "custom_grammage"], as_dict=True)
	if not item or not item.custom_support or not item.custom_grammage:
		return None
	from aurescrm.aures_crm.doctype.support_technique.support_technique import (
		get_support_technique,
	)

	return get_support_technique(item.custom_support, item.custom_grammage)


def bornes_machine(machine):
	if not machine:
		return None
	import frappe

	return frappe.db.get_value(
		"Machine",
		machine,
		[
			"nom",
			"format_min_laize",
			"format_max_laize",
			"format_min_developpement",
			"format_max_developpement",
			"marge_pince",
			"marge_arriere",
			"lisiere_min",
			"grammage_min",
			"grammage_max",
		],
		as_dict=True,
	)


def intersection_bornes(machines):
	bornes = {
		"laize_min": 0.0,
		"laize_max": 0.0,
		"depl_min": 0.0,
		"depl_max": 0.0,
		"pince": 0.0,
		"marge_arriere": 0.0,
		"lisiere": 0.0,
	}
	vues = [m for m in machines if m]
	if not vues:
		return bornes

	def f(val):
		try:
			return float(val or 0)
		except (TypeError, ValueError):
			return 0.0

	bornes["laize_min"] = max(f(m.format_min_laize) for m in vues)
	bornes["depl_min"] = max(f(m.format_min_developpement) for m in vues)
	maxis_laize = [f(m.format_max_laize) for m in vues if f(m.format_max_laize)]
	maxis_depl = [f(m.format_max_developpement) for m in vues if f(m.format_max_developpement)]
	bornes["laize_max"] = min(maxis_laize) if maxis_laize else 0.0
	bornes["depl_max"] = min(maxis_depl) if maxis_depl else 0.0
	bornes["pince"] = max(f(m.marge_pince) for m in vues) or PINCE_DEFAUT
	bornes["marge_arriere"] = max(f(m.marge_arriere) for m in vues) or MARGE_ARRIERE_DEFAUT
	bornes["lisiere"] = max(f(m.lisiere_min) for m in vues) or LISIERE_DEFAUT
	return bornes


def est_pdf(url):
	if not url:
		return False
	return os.path.splitext(url.split("?", 1)[0])[1].lower() == ".pdf"


def chemin_pdf(fichier_url, throw=True):
	import frappe

	if not fichier_url:
		if throw:
			frappe.throw("Aucun fichier de tracé : déposer un PDF Esko.")
		return None
	if not est_pdf(fichier_url):
		if throw:
			frappe.throw(
				f"Le fichier de tracé n'est pas un PDF ({fichier_url}). "
				"Joindre le PDF Esko (noir = coupe, rouge = rainage)."
			)
		return None
	name = frappe.db.get_value("File", {"file_url": fichier_url}, "name")
	if not name:
		if throw:
			frappe.throw(f"Fichier introuvable dans la bibliothèque : {fichier_url}")
		return None
	chemin = frappe.get_doc("File", name).get_full_path()
	if not os.path.exists(chemin):
		if throw:
			frappe.throw(f"Fichier absent du disque : {fichier_url}")
		return None
	return chemin


def fichier_est_celui_du_trace(fichier_depose, fichier_du_trace):
	"""True si le PDF déposé est le fichier du Tracé (même nom, hors query-string)."""
	if not fichier_depose or not fichier_du_trace:
		return False

	def nom(p):
		return os.path.basename(str(p).split("?")[0])

	return nom(fichier_depose) == nom(fichier_du_trace)


def dimensions_trace(trace):
	if not trace:
		return None
	import frappe
	from frappe.utils import cstr

	brut = cstr(frappe.db.get_value("Trace", trace, "dimensions"))
	nombres = re.findall(r"\d+(?:[.,]\d+)?", brut.replace(",", "."))
	if len(nombres) != 2:
		return None
	return sorted(float(n) for n in nombres)


def _proche(a, b, tol=TOLERANCE_FORMAT):
	return abs(float(a) - float(b)) <= tol


def formats_connus(article=None, trace=None, bornes=None, support=None, stock_seul=False):
	"""Liste dédoublonnée des formats proposables.

	`stock_seul=True` (atelier) : uniquement `formats_feuilles` du Support Technique.
	Sinon (EF) : stock + impositions existantes + maxi machine.
	"""
	proposes = []

	def ajouter(laize, depl, origine, libelle, coche=False, bobine=False):
		try:
			laize, depl = float(laize or 0), float(depl or 0)
		except (TypeError, ValueError):
			return
		if laize <= 0:
			return
		if not bobine and depl <= 0:
			return
		bobine = bool(bobine)
		for p in proposes:
			if (
				_proche(p["laize"], laize)
				and _proche(p["depl"], depl)
				and bool(p.get("bobine")) == bobine
			):
				return
		proposes.append(
			{
				"laize": laize,
				"depl": depl,
				"origine": origine,
				"libelle": libelle or f"{laize:.0f} × {depl:.0f}",
				"coche_par_defaut": int(coche),
				"bobine": int(bobine),
			}
		)

	if support:
		nom_support = getattr(support, "support", None) or ""
		grammage = getattr(support, "grammage", None) or ""
		for f in support.formats_feuilles or []:
			bobine = _est_bobine(f)
			try:
				laize, depl = float(f.laize or 0), float(f.depl or 0)
			except (TypeError, ValueError):
				continue
			if bobine:
				if depl > 0:
					libelle = f"{nom_support} {grammage} g — Bobine {laize:.0f} mm (max {depl:.0f})".strip()
				else:
					libelle = f"{nom_support} {grammage} g — Bobine {laize:.0f} mm".strip()
			else:
				libelle = f"{nom_support} {grammage} g — {laize:.0f} × {depl:.0f}".strip()
			ajouter(laize, depl, "Stock", libelle, coche=True, bobine=bobine)

	if stock_seul:
		return proposes

	import frappe
	from frappe.utils import flt

	filtres = {}
	if article:
		filtres["article"] = article
	if trace:
		filtres["trace"] = trace
	if filtres:
		rows = frappe.get_all(
			"Imposition",
			filters=filtres,
			fields=["format_laize", "format_developpement"],
			order_by="modified desc",
			limit=20,
		)
		for row in rows:
			ajouter(
				row.format_laize,
				row.format_developpement,
				"Imposition existante",
				f"Imposition existante — {flt(row.format_laize):.0f} × {flt(row.format_developpement):.0f}",
				coche=True,
			)

	if bornes and flt(bornes.get("laize_max")) and flt(bornes.get("depl_max")):
		ajouter(
			bornes["laize_max"],
			bornes["depl_max"],
			"Maxi machine",
			f"Maxi machine — {flt(bornes['laize_max']):.0f} × {flt(bornes['depl_max']):.0f}",
			coche=False,
		)
	return proposes
