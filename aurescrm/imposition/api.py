# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Interface Frappe du moteur d'imposition.

Flux : « Calculer l'imposition » (dialogue) -> job de fond -> table de scénarios
-> l'ingénieur coche UNE ligne -> « Créer l'Imposition ».

Le calcul prend 2 à 10 s selon la forme : il tourne dans la queue `long`,
jamais dans le cycle de requête.
"""

import os
import re
import tempfile

import frappe
from frappe.utils import cint, cstr, flt

from aurescrm.imposition.generateur_pdf import generer_pdf
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
	alertes,
	chiffrer,
	contrainte_bloquante,
	dispositions,
	evaluer_format,
	format_en_stock,
	trois_scenarios,
)

PINCE_DEFAUT = 10.0
MARGE_ARRIERE_DEFAUT = 15.0
LISIERE_DEFAUT = 15.6
PONT_DEFAUT = 2.5
TOLERANCE_DEVELOPPE = 0.5  # mm — garde-fou n°1
LIBELLE_REFERENCE = "RÉFÉRENCE"


# ---------------------------------------------------------------------------
# Paramètres : pré-remplissage du dialogue
# ---------------------------------------------------------------------------
def _support_technique_de_l_article(article):
	if not article:
		return None
	item = frappe.db.get_value("Item", article, ["custom_support", "custom_grammage"], as_dict=True)
	if not item or not item.custom_support or not item.custom_grammage:
		return None
	from aurescrm.aures_crm.doctype.support_technique.support_technique import (
		get_support_technique,
	)

	return get_support_technique(item.custom_support, item.custom_grammage)


def _bornes_machine(machine):
	"""Bornes d'une machine, ou None si la machine n'est pas renseignée."""
	if not machine:
		return None
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


def _intersection_bornes(machines):
	"""Intersection des contraintes impression ET découpe (la platine borne le plus souvent)."""
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
	bornes["laize_min"] = max(flt(m.format_min_laize) for m in vues)
	bornes["depl_min"] = max(flt(m.format_min_developpement) for m in vues)
	maxis_laize = [flt(m.format_max_laize) for m in vues if flt(m.format_max_laize)]
	maxis_depl = [flt(m.format_max_developpement) for m in vues if flt(m.format_max_developpement)]
	bornes["laize_max"] = min(maxis_laize) if maxis_laize else 0.0
	bornes["depl_max"] = min(maxis_depl) if maxis_depl else 0.0
	bornes["pince"] = max(flt(m.marge_pince) for m in vues) or PINCE_DEFAUT
	bornes["marge_arriere"] = max(flt(m.marge_arriere) for m in vues) or MARGE_ARRIERE_DEFAUT
	bornes["lisiere"] = max(flt(m.lisiere_min) for m in vues) or LISIERE_DEFAUT
	return bornes


def _format_reference(etude):
	"""Format habituellement utilisé pour cet article : dernière Imposition existante.

	Sans point de comparaison, l'ingénieur ne peut pas juger si l'outil lui apporte
	quelque chose — la ligne RÉFÉRENCE est systématique.
	"""
	filtres = {"article": etude.article}
	if etude.trace:
		filtres["trace"] = etude.trace
	rows = frappe.get_all(
		"Imposition",
		filters=filtres,
		fields=["format_laize", "format_developpement"],
		order_by="modified desc",
		limit=5,
	)
	for row in rows:
		if flt(row.format_laize) > 0 and flt(row.format_developpement) > 0:
			return flt(row.format_laize), flt(row.format_developpement)
	return None, None


@frappe.whitelist()
def get_parametres_defaut(etude):
	"""Valeurs pré-remplies du dialogue « Calculer l'imposition »."""
	doc = frappe.get_doc("Etude Faisabilite", etude)
	doc.check_permission("read")

	support = _support_technique_de_l_article(doc.article)
	impression = _bornes_machine(doc.machine_prevue)
	decoupe = _bornes_machine(doc.get("machine_decoupe"))
	bornes = _intersection_bornes([impression, decoupe])
	ref_laize, ref_depl = _format_reference(doc)

	return {
		"machine_impression": doc.machine_prevue,
		"machine_decoupe": doc.get("machine_decoupe"),
		"pont": flt(doc.get("pont")) or (flt(support.pont_mini) if support else 0) or PONT_DEFAUT,
		"trait_commun_autorise": cint(doc.get("trait_commun_autorise") if doc.get("trait_commun_autorise") is not None else 1),
		"sens_fibre": doc.get("sens_fibre") or "Libre",
		"quantite": cint(doc.quantite),
		"fichier_trace": _chemin_trace(doc, throw=False),
		"support_technique": support.name if support else None,
		"grammage": flt(support.grammage) if support else 0.0,
		"prix_tonne": flt(support.prix_tonne) if support else 0.0,
		"formats_stock": [[flt(f.laize), flt(f.depl)] for f in support.formats_feuilles] if support else [],
		"bornes": bornes,
		"format_reference_laize": ref_laize or bornes["laize_max"],
		"format_reference_depl": ref_depl or bornes["depl_max"],
	}


def _chemin_trace(etude, throw=True):
	"""Chemin disque du PDF de tracé (Étude ou Tracé lié)."""
	url = etude.fichier_trace
	if not url and etude.trace:
		url = frappe.db.get_value("Trace", etude.trace, "fichier_trace")
	if not url:
		if throw:
			frappe.throw("Aucun fichier de tracé : renseigner un Tracé porteur du PDF de découpe.")
		return None
	name = frappe.db.get_value("File", {"file_url": url}, "name")
	if not name:
		if throw:
			frappe.throw(f"Fichier introuvable dans la bibliothèque : {url}")
		return None
	chemin = frappe.get_doc("File", name).get_full_path()
	if not os.path.exists(chemin):
		if throw:
			frappe.throw(f"Fichier absent du disque : {url}")
		return None
	return chemin


# ---------------------------------------------------------------------------
# Lancement du calcul
# ---------------------------------------------------------------------------
@frappe.whitelist()
def lancer_calcul(
	etude,
	machine_impression=None,
	machine_decoupe=None,
	pont=None,
	trait_commun_autorise=1,
	sens_fibre="Libre",
	quantite=None,
	format_reference_laize=None,
	format_reference_depl=None,
):
	"""Enregistre les paramètres saisis puis met le calcul en file (queue `long`)."""
	doc = frappe.get_doc("Etude Faisabilite", etude)
	doc.check_permission("write")
	_chemin_trace(doc)  # échoue tôt et clairement si le PDF manque

	valeurs = {
		"machine_decoupe": machine_decoupe or None,
		"pont": flt(pont) or PONT_DEFAUT,
		"trait_commun_autorise": cint(trait_commun_autorise),
		"sens_fibre": sens_fibre or "Libre",
		"statut_calcul": "En cours",
		"log_calcul": "Calcul en file d'attente…",
	}
	if machine_impression and machine_impression != doc.machine_prevue:
		valeurs["machine_prevue"] = machine_impression
	doc.db_set(valeurs, update_modified=False)

	frappe.enqueue(
		"aurescrm.imposition.api.executer_calcul",
		queue="long",
		timeout=900,
		enqueue_after_commit=True,  # le job doit voir les paramètres qu'on vient d'écrire
		job_id=f"imposition-calcul:{etude}"[:100],
		etude=etude,
		quantite=cint(quantite) or cint(doc.quantite),
		format_reference_laize=flt(format_reference_laize),
		format_reference_depl=flt(format_reference_depl),
		utilisateur=frappe.session.user,
	)
	return {"statut_calcul": "En cours"}


def executer_calcul(
	etude, quantite=0, format_reference_laize=0, format_reference_depl=0, utilisateur=None
):
	"""Job de fond : lit le tracé, calcule les dispositions, remplit la table de scénarios."""
	journal = []
	try:
		resultat = _calculer(
			etude,
			quantite=quantite,
			format_reference_laize=format_reference_laize,
			format_reference_depl=format_reference_depl,
			journal=journal,
		)
		_ecrire_resultat(etude, resultat, journal)
		statut = "Terminé"
	except Exception as exc:  # noqa: BLE001 — le message doit remonter à l'ingénieur
		journal.append(f"ÉCHEC : {exc}")
		frappe.db.rollback()
		frappe.log_error(message=frappe.get_traceback(), title=f"Imposition — calcul {etude}")
		frappe.db.set_value(
			"Etude Faisabilite",
			etude,
			{"statut_calcul": "Échec", "log_calcul": "\n".join(journal)},
			update_modified=False,
		)
		statut = "Échec"
	frappe.db.commit()
	frappe.publish_realtime(
		"imposition_calcul_termine",
		{"etude": etude, "statut_calcul": statut},
		user=utilisateur,
		after_commit=True,
	)


def _dimensions_trace(trace):
	"""Développé saisi dans le Tracé, extrait du champ libre `dimensions`.

	Le champ est libre : il porte tantôt le développé (deux cotes), tantôt les
	dimensions de la boîte finie (trois cotes, ex. « 72 x 46,5 x 107 »). Seul le
	cas à deux cotes est comparable au développé calculé — sinon on ne recoupe pas
	plutôt que de rejeter à tort un tracé correct.
	"""
	if not trace:
		return None
	brut = cstr(frappe.db.get_value("Trace", trace, "dimensions"))
	nombres = re.findall(r"\d+(?:[.,]\d+)?", brut.replace(",", "."))
	if len(nombres) != 2:
		return None
	return sorted(float(n) for n in nombres)


def _calculer(etude, quantite, format_reference_laize, format_reference_depl, journal):
	doc = frappe.get_doc("Etude Faisabilite", etude)
	chemin = _chemin_trace(doc)

	# Garde-fou n°3 : une couleur hors convention signale un tracé incomplet.
	for couleur, nb in couleurs_inattendues(chemin):
		journal.append(
			f"AVERTISSEMENT : {nb} chemin(s) en couleur {couleur} hors convention "
			"(noir = coupe, rouge = rainage, bleu = cotation) — vérifier qu'aucune découpe ne manque."
		)

	segments_coupe, segments_rainage = lire_trace(chemin)
	journal.append(
		f"Tracé lu : {len(segments_coupe)} segments de coupe, {len(segments_rainage)} de rainage."
	)
	poly = silhouette(segments_coupe, segments_rainage)
	mesures = metriques_developpe(poly)
	journal.append(
		f"Développé {mesures['developpe_l']} x {mesures['developpe_d']} mm — "
		f"surface utile {mesures['surface_utile']} cm² — remplissage bbox {mesures['remplissage_bbox']} %."
	)

	# Garde-fou n°1 : recoupement avec les dimensions saisies dans le Tracé.
	saisies = _dimensions_trace(doc.trace)
	if saisies:
		calcules = sorted([mesures["developpe_l"], mesures["developpe_d"]])
		ecarts = [abs(a - b) for a, b in zip(calcules, saisies)]
		if max(ecarts) > TOLERANCE_DEVELOPPE:
			raise ValueError(
				f"Développé calculé {calcules[0]:.1f} x {calcules[1]:.1f} mm incohérent avec les "
				f"dimensions du Tracé {saisies[0]:.1f} x {saisies[1]:.1f} mm "
				f"(écart {max(ecarts):.1f} mm > {TOLERANCE_DEVELOPPE} mm). Aucun scénario proposé."
			)
		journal.append(f"Recoupement avec le Tracé : écart max {max(ecarts):.2f} mm — OK.")
	else:
		journal.append(
			"Recoupement du développé non effectué : le champ Dimensions du Tracé ne porte pas "
			"deux cotes exploitables (développé)."
		)

	support = _support_technique_de_l_article(doc.article)
	impression = _bornes_machine(doc.machine_prevue)
	decoupe = _bornes_machine(doc.get("machine_decoupe"))
	if not impression and not decoupe:
		raise ValueError("Aucune machine renseignée : impossible de borner les formats de feuille.")
	bornes = _intersection_bornes([impression, decoupe])
	if not bornes["laize_max"] or not bornes["depl_max"]:
		raise ValueError(
			"Format maxi absent sur la (les) machine(s) sélectionnée(s) — "
			"renseigner format max laize et format max développement."
		)
	journal.append(
		"Bornes machine retenues (intersection impression/découpe) : "
		f"laize {bornes['laize_min']:.0f}–{bornes['laize_max']:.0f} mm, "
		f"déplacement {bornes['depl_min']:.0f}–{bornes['depl_max']:.0f} mm, "
		f"pince {bornes['pince']}, marge arrière {bornes['marge_arriere']}, lisière {bornes['lisiere']}."
	)

	grammage = flt(support.grammage) if support else 0.0
	if support and grammage:
		for machine in (impression, decoupe):
			if not machine:
				continue
			if flt(machine.grammage_min) and grammage < flt(machine.grammage_min):
				journal.append(
					f"AVERTISSEMENT : grammage {grammage:.0f} g/m² sous le mini de {machine.nom}."
				)
			if flt(machine.grammage_max) and grammage > flt(machine.grammage_max):
				journal.append(
					f"AVERTISSEMENT : grammage {grammage:.0f} g/m² au-dessus du maxi de {machine.nom}."
				)

	params = Parametres(
		laize_min=bornes["laize_min"],
		laize_max=bornes["laize_max"],
		depl_min=bornes["depl_min"],
		depl_max=bornes["depl_max"],
		pince=bornes["pince"],
		marge_arriere=bornes["marge_arriere"],
		lisiere=bornes["lisiere"],
		pont=flt(doc.get("pont")) or PONT_DEFAUT,
		trait_commun=bool(cint(doc.get("trait_commun_autorise"))),
		sens_fibre=doc.get("sens_fibre") or "Libre",
		quantite=cint(quantite) or cint(doc.quantite),
		grammage=grammage,
		prix_tonne=flt(support.prix_tonne) if support else 0.0,
		formats_stock=tuple(
			(flt(f.laize), flt(f.depl)) for f in (support.formats_feuilles if support else [])
		),
	)

	dispos = dispositions(poly, params)
	journal.append(f"{len(dispos)} disposition(s) admissible(s).")
	if not dispos:
		# Garde-fou n°5 : dire quelle contrainte bloque, pas un tableau vide.
		raise ValueError("Aucune disposition admissible — " + contrainte_bloquante(poly, params))

	lignes = []
	for libelle, d in trois_scenarios(dispos, params).items():
		if d:
			lignes.append(_ligne(libelle, d, params, mesures["surface_utile_mm2"]))

	# Quatrième ligne systématique et non négociable : la RÉFÉRENCE.
	laize_ref = flt(format_reference_laize) or bornes["laize_max"]
	depl_ref = flt(format_reference_depl) or bornes["depl_max"]
	reference = evaluer_format(poly, params, laize_ref, depl_ref)
	if reference:
		ligne = _ligne(
			f"{LIBELLE_REFERENCE} — {laize_ref:.0f} x {depl_ref:.0f}",
			reference,
			params,
			mesures["surface_utile_mm2"],
		)
		lignes.append(ligne)
	else:
		journal.append(
			f"RÉFÉRENCE {laize_ref:.0f} x {depl_ref:.0f} mm : aucune pose ne tient sur ce format."
		)

	journal.append(_journal_trait_commun(poly, params))

	return {"mesures": mesures, "lignes": lignes}


def _journal_trait_commun(poly, params: Parametres):
	"""Diagnostic du trait commun, dans les termes du dossier papier de l'ingénieur."""
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


def _ligne(libelle, d, params: Parametres, surface_utile_mm2):
	chiffrage = chiffrer(d, params, surface_utile_mm2)
	return {
		"libelle": libelle,
		"laize": d.laize,
		"depl": d.depl,
		"nb_poses": d.poses,
		"n_col": d.n_col,
		"n_rang": d.n_rang,
		"pas_laize": d.pas_laize,
		"pas_depl": d.pas_depl,
		"rotation": d.rotation,
		"trait_commun_laize": cint(d.trait_commun_laize),
		"trait_commun_depl": cint(d.trait_commun_depl),
		"surface_par_pose": round(d.surface_par_pose / 100.0, 1),  # mm² -> cm²
		"taux_chutes": chiffrage.get("taux_chutes", 0),
		"nb_feuilles": chiffrage.get("nb_feuilles", 0),
		"tonnage": chiffrage.get("tonnage", 0),
		"cout_matiere": chiffrage.get("cout_matiere", 0),
		"reste_laize": d.reste_laize,
		"reste_depl": d.reste_depl,
		"format_en_stock": cint(format_en_stock(d, params)),
		"alerte": " ; ".join(alertes(d, params)),
		"retenu": 0,
	}


def _ecrire_resultat(etude, resultat, journal):
	doc = frappe.get_doc("Etude Faisabilite", etude)
	doc.set("scenarios", [])
	for ligne in resultat["lignes"]:
		doc.append("scenarios", ligne)
	mesures = resultat["mesures"]
	doc.developpe_calcule_l = mesures["developpe_l"]
	doc.developpe_calcule_d = mesures["developpe_d"]
	doc.surface_utile = mesures["surface_utile"]
	doc.remplissage_bbox = mesures["remplissage_bbox"]
	doc.statut_calcul = "Terminé"
	doc.log_calcul = "\n".join(journal)
	doc.flags.ignore_version = True
	doc.save()


# ---------------------------------------------------------------------------
# Création de l'Imposition sur choix de l'ingénieur
# ---------------------------------------------------------------------------
@frappe.whitelist()
def creer_imposition(etude):
	"""Crée une NOUVELLE Imposition à partir du scénario coché et génère son PDF 1:1.

	Ne modifie jamais une Imposition existante : le moteur crée toujours un nouvel
	enregistrement.
	"""
	doc = frappe.get_doc("Etude Faisabilite", etude)
	doc.check_permission("write")

	retenus = [s for s in doc.scenarios if cint(s.retenu)]
	if len(retenus) != 1:
		frappe.throw("Cocher exactement un scénario « Retenu » avant de créer l'Imposition.")
	scenario = retenus[0]

	chemin = _chemin_trace(doc)
	segments_coupe, segments_rainage = lire_trace(chemin)
	poly = silhouette(segments_coupe, segments_rainage)

	bornes = _intersection_bornes(
		[_bornes_machine(doc.machine_prevue), _bornes_machine(doc.get("machine_decoupe"))]
	)
	params = Parametres(
		pince=bornes["pince"],
		marge_arriere=bornes["marge_arriere"],
		lisiere=bornes["lisiere"],
		pont=flt(doc.get("pont")) or PONT_DEFAUT,
	)

	disposition = Disposition(
		libelle=scenario.libelle,
		laize=flt(scenario.laize),
		depl=flt(scenario.depl),
		n_col=cint(scenario.n_col),
		n_rang=cint(scenario.n_rang),
		pas_laize=flt(scenario.pas_laize),
		pas_depl=flt(scenario.pas_depl),
		rotation=cint(scenario.rotation),
		trait_commun_laize=bool(cint(scenario.trait_commun_laize)),
		trait_commun_depl=bool(cint(scenario.trait_commun_depl)),
	)

	imposition = frappe.get_doc(
		{
			"doctype": "Imposition",
			"client": doc.client,
			"article": doc.article,
			"trace": doc.trace,
			"procede": doc.procede,
			"nbr_poses": disposition.poses,
			"taux_chutes": flt(scenario.taux_chutes),
			"format_imp": f"{disposition.laize} x {disposition.depl}",
			"format_laize": disposition.laize,
			"format_developpement": disposition.depl,
			"n_col": disposition.n_col,
			"n_rang": disposition.n_rang,
			"rotation": disposition.rotation,
			"pas_laize": disposition.pas_laize,
			"pas_depl": disposition.pas_depl,
			"pont": params.pont,
			"trait_commun_laize": cint(scenario.trait_commun_laize),
			"trait_commun_depl": cint(scenario.trait_commun_depl),
			"surface_par_pose": flt(scenario.surface_par_pose),
			"machine_impression": doc.machine_prevue,
			"machine_decoupe": doc.get("machine_decoupe"),
			"origine_calcul": "Moteur v1",
			"scenario_retenu": scenario.libelle,
		}
	)
	imposition.insert()

	titre = f"{doc.item_name or doc.article} — {scenario.libelle}"
	with tempfile.TemporaryDirectory() as repertoire:
		chemin_pdf = os.path.join(repertoire, f"imposition-{imposition.name}.pdf")
		generer_pdf(chemin_pdf, segments_coupe, segments_rainage, poly, disposition, params, titre)
		with open(chemin_pdf, "rb") as f:
			contenu = f.read()

	fichier = frappe.get_doc(
		{
			"doctype": "File",
			"file_name": f"imposition-{imposition.name}.pdf",
			"attached_to_doctype": "Imposition",
			"attached_to_name": imposition.name,
			"attached_to_field": "fichier_imp",
			"is_private": 1,
			"content": contenu,
		}
	).insert()
	imposition.db_set("fichier_imp", fichier.file_url)

	# Traçabilité du choix : qui, quand, quel scénario, et ce qui a été écarté.
	ecartes = [s.libelle for s in doc.scenarios if not cint(s.retenu)]
	doc.add_comment(
		"Comment",
		text=(
			f"Imposition <b>{imposition.name}</b> créée depuis le moteur v1 — scénario retenu "
			f"« {scenario.libelle} » ({disposition.poses} poses sur {disposition.laize} x "
			f"{disposition.depl} mm, {flt(scenario.taux_chutes)} % de chutes). "
			f"Scénarios écartés : {', '.join(ecartes) if ecartes else 'aucun'}."
		),
	)
	doc.db_set(
		{"imposition": imposition.name, "fichier_imp": fichier.file_url}, update_modified=False
	)
	doc.reload()
	doc.set_nbr_feuilles()
	doc.db_set("nbr_feuilles", doc.nbr_feuilles, update_modified=False)
	doc.db_set("taux_chutes", flt(scenario.taux_chutes), update_modified=False)

	return {"imposition": imposition.name, "fichier_imp": fichier.file_url}
