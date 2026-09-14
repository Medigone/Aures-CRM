# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""API Frappe de l'atelier d'imposition : couche mince sur `Calcul Imposition`."""

from __future__ import annotations

import json
import os
import tempfile
import time
import zipfile

import frappe
from frappe.utils import cint, flt
from frappe.utils.background_jobs import is_job_enqueued

from aurescrm.imposition.generateur_cf2 import generer_cff2, nom_fichier_cff2
from aurescrm.imposition.generateur_pdf import generer_pdf, generer_pdf_pages
from aurescrm.imposition.lecture_trace import lire_trace, silhouette
from aurescrm.imposition.optimiseur import Disposition, Parametres
from aurescrm.imposition.service import (
	PONT_DEFAUT,
	EntreeCalcul,
	appliquer_saisie_sur_params,
	bornes_machine,
	calculer,
	chemin_pdf,
	dimensions_trace,
	est_pdf,
	fichier_est_celui_du_trace,
	formats_connus,
	intersection_bornes,
	preparer,
	simuler_format,
	simuler_grille as evaluer_grille_simulee,
	support_technique_article,
)


def _droits():
	return {
		"lire": frappe.has_permission("Calcul Imposition", "read"),
		"ecrire": frappe.has_permission("Calcul Imposition", "write"),
		"creer": frappe.has_permission("Calcul Imposition", "create"),
		"creer_imposition": frappe.has_permission("Imposition", "create"),
	}


def _formats_stock(support):
	if not support:
		return ()
	return tuple((flt(f.laize), flt(f.depl)) for f in (support.formats_feuilles or []))


def _rattacher_pdf(url, calcul_name):
	if not url:
		return
	name = frappe.db.get_value("File", {"file_url": url}, "name")
	if not name:
		return
	f = frappe.get_doc("File", name)
	if f.attached_to_name == calcul_name:
		return
	if not f.attached_to_name:
		f.db_set(
			{
				"attached_to_doctype": "Calcul Imposition",
				"attached_to_name": calcul_name,
				"attached_to_field": "fichier_trace",
				"is_private": 1,
			}
		)


MAX_PDF_OCTETS = 40 * 1024 * 1024


def _valider_pdf(chemin):
	if os.path.getsize(chemin) > MAX_PDF_OCTETS:
		frappe.throw("PDF trop volumineux (limite 40 Mo).")
	try:
		import pymupdf

		with pymupdf.open(chemin) as doc:
			if doc.page_count < 1:
				raise ValueError("aucune page")
	except Exception:
		frappe.throw("PDF illisible ou non vectoriel.")


def _saisie_ingenieur(doc):
	"""Lisière / pince / marge du document. 0 = non saisi, sauf si simulation libre."""
	ignorer = bool(cint(doc.get("ignorer_contraintes_machine")))

	def val(champ):
		v = doc.get(champ)
		if v in (None, ""):
			return None
		v = flt(v)
		if v == 0 and not ignorer:
			return None
		return v

	return {
		"lisiere_saisie": val("lisiere"),
		"pince_saisie": val("pince"),
		"marge_arriere_saisie": val("marge_arriere"),
		"ignorer_contraintes_machine": ignorer,
	}


def _params_avec_saisie(
	doc,
	params,
	lisiere=None,
	pince=None,
	marge_arriere=None,
	ignorer_contraintes_machine=None,
):
	saisie = _saisie_ingenieur(doc)
	lisiere_f = lisiere if lisiere is not None else saisie["lisiere_saisie"]
	pince_f = pince if pince is not None else saisie["pince_saisie"]
	marge_f = marge_arriere if marge_arriere is not None else saisie["marge_arriere_saisie"]
	ignorer = (
		cint(ignorer_contraintes_machine)
		if ignorer_contraintes_machine is not None
		else saisie["ignorer_contraintes_machine"]
	)
	appliquer_saisie_sur_params(
		params, lisiere=lisiere_f, pince=pince_f, marge_arriere=marge_f, ignorer=ignorer
	)
	if frappe.has_permission("Calcul Imposition", "write"):
		maj = {}
		if lisiere is not None:
			maj["lisiere"] = flt(lisiere)
		if pince is not None:
			maj["pince"] = flt(pince)
		if marge_arriere is not None:
			maj["marge_arriere"] = flt(marge_arriere)
		if ignorer_contraintes_machine is not None:
			maj["ignorer_contraintes_machine"] = cint(ignorer_contraintes_machine)
		if maj:
			frappe.db.set_value("Calcul Imposition", doc.name, maj, update_modified=False)
	return params


def _entree_depuis_doc(doc, quantite=None):
	support = None
	if doc.support_technique:
		support = frappe.get_doc("Support Technique", doc.support_technique)
	elif doc.article:
		support = support_technique_article(doc.article)
	impression = bornes_machine(doc.machine_impression)
	decoupe = bornes_machine(doc.machine_decoupe)
	bornes = intersection_bornes([impression, decoupe])
	formats = [
		{
			"laize": flt(f.laize),
			"depl": flt(f.depl),
			"origine": f.origine or "Format étudié",
			"libelle": f.libelle,
			"bobine": cint(f.get("bobine")),
		}
		for f in (doc.formats_etudies or [])
	]
	url_trace = frappe.db.get_value("Trace", doc.trace, "fichier_trace") if doc.trace else None
	cotes = (
		dimensions_trace(doc.trace)
		if fichier_est_celui_du_trace(doc.fichier_trace, url_trace)
		else None
	)
	return EntreeCalcul(
		chemin=chemin_pdf(doc.fichier_trace),
		pont=flt(doc.pont) or PONT_DEFAUT,
		trait_commun=bool(cint(doc.trait_commun_autorise)),
		sens_fibre=doc.sens_fibre or "Libre",
		quantite=cint(quantite if quantite is not None else doc.quantite),
		grammage=flt(support.grammage) if support else 0.0,
		prix_tonne=0.0,
		formats_stock=_formats_stock(support),
		bornes=bornes,
		formats_etudies=formats,
		inclure_sur_mesure=bool(cint(doc.inclure_sur_mesure)),
		format_reference=None,
		dimensions_saisies=cotes,
		mode="atelier",
		**_saisie_ingenieur(doc),
	)


# ---------------------------------------------------------------------------
# Compatibilité Étude de Faisabilité (dialogue historique)
# ---------------------------------------------------------------------------


@frappe.whitelist()
def get_parametres_defaut(etude):
	doc = frappe.get_doc("Etude Faisabilite", etude)
	doc.check_permission("read")
	support = support_technique_article(doc.article)
	impression = bornes_machine(doc.machine_prevue)
	decoupe = bornes_machine(doc.get("machine_decoupe"))
	bornes = intersection_bornes([impression, decoupe])
	proposes = formats_connus(article=doc.article, trace=doc.trace, bornes=bornes, support=support)
	ref = next((p for p in proposes if p["origine"] == "Imposition existante"), None)
	if not ref and bornes.get("laize_max"):
		ref = {"laize": bornes["laize_max"], "depl": bornes["depl_max"]}
	url = None
	if doc.trace:
		url = frappe.db.get_value("Trace", doc.trace, "fichier_trace")
	if not est_pdf(url):
		url = doc.get("fichier_trace") if est_pdf(doc.get("fichier_trace")) else None
	return {
		"machine_impression": doc.machine_prevue,
		"machine_decoupe": doc.get("machine_decoupe"),
		"pont": flt(doc.get("pont")) or (flt(support.pont_mini) if support else 0) or PONT_DEFAUT,
		"trait_commun_autorise": cint(
			doc.get("trait_commun_autorise") if doc.get("trait_commun_autorise") is not None else 1
		),
		"sens_fibre": doc.get("sens_fibre") or "Libre",
		"quantite": cint(doc.quantite),
		"fichier_trace": url,
		"support_technique": support.name if support else None,
		"grammage": flt(support.grammage) if support else 0.0,
		"prix_tonne": flt(support.prix_tonne) if support else 0.0,
		"formats_stock": [[flt(f.laize), flt(f.depl)] for f in support.formats_feuilles] if support else [],
		"bornes": bornes,
		"format_reference_laize": (ref or {}).get("laize") or bornes["laize_max"],
		"format_reference_depl": (ref or {}).get("depl") or bornes["depl_max"],
	}


def _lancer_calcul_etude(
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
	"""Ancien dialogue EF : crée un Calcul Imposition et enfile le job atelier."""
	doc = frappe.get_doc("Etude Faisabilite", etude)
	doc.check_permission("write")
	url = frappe.db.get_value("Trace", doc.trace, "fichier_trace") if doc.trace else None
	if not est_pdf(url):
		url = doc.get("fichier_trace")
	support = support_technique_article(doc.article)
	bornes = intersection_bornes(
		[
			bornes_machine(machine_impression or doc.machine_prevue),
			bornes_machine(machine_decoupe or doc.get("machine_decoupe")),
		]
	)
	proposes = formats_connus(
		article=doc.article, trace=doc.trace, bornes=bornes, support=support
	)
	formats = [p for p in proposes if p.get("coche_par_defaut")] or proposes
	return lancer_calcul(
		fichier_trace=url,
		formats=formats,
		pont=pont or doc.get("pont"),
		machine_impression=machine_impression or doc.machine_prevue,
		machine_decoupe=machine_decoupe or doc.get("machine_decoupe"),
		trait_commun_autorise=trait_commun_autorise,
		sens_fibre=sens_fibre or doc.get("sens_fibre") or "Libre",
		quantite=quantite or doc.quantite,
		article=doc.article,
		client=doc.client,
		trace=doc.trace,
		etude=etude,
		inclure_sur_mesure=1,
	)


# ---------------------------------------------------------------------------
# Atelier
# ---------------------------------------------------------------------------


def _assurer_calcul_doc(
	fichier_trace=None,
	formats=None,
	pont=None,
	machine_impression=None,
	machine_decoupe=None,
	trait_commun_autorise=1,
	sens_fibre="Libre",
	quantite=None,
	article=None,
	client=None,
	trace=None,
	etude=None,
	calcul=None,
	support_technique=None,
	inclure_sur_mesure=0,
	lisiere=None,
	pince=None,
	marge_arriere=None,
	ignorer_contraintes_machine=None,
):
	if not fichier_trace and trace:
		fichier_trace = frappe.db.get_value("Trace", trace, "fichier_trace")
	chemin = chemin_pdf(fichier_trace)
	_valider_pdf(chemin)

	if calcul:
		doc = frappe.get_doc("Calcul Imposition", calcul)
		doc.check_permission("write")
		if doc.statut_calcul == "En cours":
			frappe.throw("Un calcul est déjà en cours sur ce document.")
	else:
		if not frappe.has_permission("Calcul Imposition", "create"):
			frappe.throw("Permission insuffisante pour lancer un calcul d'imposition.")
		doc = frappe.new_doc("Calcul Imposition")

	doc.fichier_trace = fichier_trace
	doc.trace = trace
	doc.article = article
	doc.client = client
	doc.etude_faisabilite = etude
	doc.support_technique = support_technique
	doc.machine_impression = machine_impression
	doc.machine_decoupe = machine_decoupe
	doc.pont = flt(pont) or PONT_DEFAUT
	doc.trait_commun_autorise = cint(trait_commun_autorise)
	doc.sens_fibre = sens_fibre or "Libre"
	doc.quantite = cint(quantite)
	doc.inclure_sur_mesure = cint(inclure_sur_mesure)
	if lisiere is not None:
		doc.lisiere = flt(lisiere)
	if pince is not None:
		doc.pince = flt(pince)
	if marge_arriere is not None:
		doc.marge_arriere = flt(marge_arriere)
	if ignorer_contraintes_machine is not None:
		doc.ignorer_contraintes_machine = cint(ignorer_contraintes_machine)
	if formats is not None:
		doc.set("formats_etudies", [])
		for fmt in formats:
			doc.append(
				"formats_etudies",
				{
					"laize": flt(fmt.get("laize")),
					"depl": flt(fmt.get("depl")),
					"origine": fmt.get("origine") or "Manuel",
					"libelle": fmt.get("libelle"),
					"bobine": cint(fmt.get("bobine")),
				},
			)
	if calcul:
		doc.save()
	else:
		doc.insert()
	_rattacher_pdf(fichier_trace, doc.name)
	return doc


@frappe.whitelist()
def preparer_trace(
	fichier_trace=None,
	pont=None,
	machine_impression=None,
	machine_decoupe=None,
	trait_commun_autorise=1,
	sens_fibre="Libre",
	quantite=None,
	article=None,
	client=None,
	trace=None,
	etude=None,
	calcul=None,
	support_technique=None,
	lisiere=None,
	pince=None,
	marge_arriere=None,
	ignorer_contraintes_machine=None,
):
	"""Parse le PDF et alimente le cache : la simulation n'attend plus « Calculer »."""
	debut = time.monotonic()
	doc = _assurer_calcul_doc(
		fichier_trace=fichier_trace,
		pont=pont,
		machine_impression=machine_impression,
		machine_decoupe=machine_decoupe,
		trait_commun_autorise=trait_commun_autorise,
		sens_fibre=sens_fibre,
		quantite=quantite,
		article=article,
		client=client,
		trace=trace,
		etude=etude,
		calcul=calcul,
		support_technique=support_technique,
		inclure_sur_mesure=0,
		lisiere=lisiere,
		pince=pince,
		marge_arriere=marge_arriere,
		ignorer_contraintes_machine=ignorer_contraintes_machine,
	)
	journal = []
	try:
		resultat = preparer(_entree_depuis_doc(doc), journal)
		doc.ecrire_preparation(resultat, journal, duree=time.monotonic() - debut)
	except Exception:
		frappe.log_error(title=f"Imposition — préparation {doc.name}")
		raise
	return get_calcul(doc.name)


@frappe.whitelist()
def lancer_calcul(
	fichier_trace=None,
	formats=None,
	pont=None,
	machine_impression=None,
	machine_decoupe=None,
	trait_commun_autorise=1,
	sens_fibre="Libre",
	quantite=None,
	article=None,
	client=None,
	trace=None,
	etude=None,
	calcul=None,
	support_technique=None,
	inclure_sur_mesure=1,
	format_reference_laize=None,
	format_reference_depl=None,
	lisiere=None,
	pince=None,
	marge_arriere=None,
	ignorer_contraintes_machine=None,
):
	"""Crée (ou réutilise) un Calcul Imposition et enfile le job.

	Appel historique depuis l'EF : `etude` sans `fichier_trace` → ancien flux.
	"""
	if etude and not fichier_trace and not calcul:
		return _lancer_calcul_etude(
			etude,
			machine_impression=machine_impression,
			machine_decoupe=machine_decoupe,
			pont=pont,
			trait_commun_autorise=trait_commun_autorise,
			sens_fibre=sens_fibre,
			quantite=quantite,
			format_reference_laize=format_reference_laize,
			format_reference_depl=format_reference_depl,
		)

	if not frappe.has_permission("Calcul Imposition", "create"):
		frappe.throw("Permission insuffisante pour lancer un calcul d'imposition.")

	if isinstance(formats, str):
		formats = json.loads(formats or "[]")
	formats = formats or []
	if not formats and not cint(inclure_sur_mesure):
		frappe.throw("Aucun format coché — rien à évaluer.")

	doc = _assurer_calcul_doc(
		fichier_trace=fichier_trace,
		formats=formats,
		pont=pont,
		machine_impression=machine_impression,
		machine_decoupe=machine_decoupe,
		trait_commun_autorise=trait_commun_autorise,
		sens_fibre=sens_fibre,
		quantite=quantite,
		article=article,
		client=client,
		trace=trace,
		etude=etude,
		calcul=calcul,
		support_technique=support_technique,
		inclure_sur_mesure=inclure_sur_mesure,
		lisiere=lisiere,
		pince=pince,
		marge_arriere=marge_arriere,
		ignorer_contraintes_machine=ignorer_contraintes_machine,
	)
	doc.statut_calcul = "En cours"
	doc.log_calcul = "Calcul en file d'attente…"
	doc.save()

	job_id = f"imposition:{doc.name}"
	if is_job_enqueued(job_id):
		return {"calcul": doc.name, "statut_calcul": "En cours"}

	frappe.enqueue(
		"aurescrm.imposition.api.executer_calcul",
		queue="long",
		timeout=900,
		enqueue_after_commit=True,
		job_id=job_id,
		deduplicate=True,
		calcul=doc.name,
		utilisateur=frappe.session.user,
	)
	return {"calcul": doc.name, "statut_calcul": "En cours"}


def executer_calcul(calcul, utilisateur=None):
	journal = []
	debut = time.monotonic()
	etude = frappe.db.get_value("Calcul Imposition", calcul, "etude_faisabilite")
	try:
		doc = frappe.get_doc("Calcul Imposition", calcul)
		etude = doc.etude_faisabilite
		entree = _entree_depuis_doc(doc)
		resultat = calculer(entree, journal)
		doc.ecrire_resultat(resultat, journal, duree=time.monotonic() - debut)
		statut = "Terminé"
	except Exception as exc:  # noqa: BLE001
		journal.append(f"ÉCHEC : {exc}")
		frappe.db.rollback()
		frappe.log_error(message=frappe.get_traceback(), title=f"Imposition — calcul {calcul}")
		frappe.db.set_value(
			"Calcul Imposition",
			calcul,
			{"statut_calcul": "Échec", "log_calcul": "\n".join(journal)},
			update_modified=False,
		)
		statut = "Échec"
	frappe.db.commit()
	frappe.publish_realtime(
		"imposition_calcul_termine",
		{"calcul": calcul, "etude": etude, "statut_calcul": statut},
		user=utilisateur,
		after_commit=True,
	)


@frappe.whitelist()
def get_calcul(calcul):
	doc = frappe.get_doc("Calcul Imposition", calcul)
	doc.check_permission("read")
	cache_disponible = bool(doc.variantes_json and doc.bornes_json)
	silhouette = None
	if doc.silhouette_svg:
		try:
			silhouette = json.loads(doc.silhouette_svg)
		except (TypeError, ValueError):
			silhouette = None
	variantes = []
	if doc.variantes_json:
		try:
			variantes = json.loads(doc.variantes_json)
		except (TypeError, ValueError):
			variantes = []
	bornes = None
	if doc.bornes_json:
		try:
			bornes = json.loads(doc.bornes_json)
		except (TypeError, ValueError):
			bornes = None
	return {
		"name": doc.name,
		"fichier_trace": doc.fichier_trace,
		"trace": doc.trace,
		"article": doc.article,
		"client": doc.client,
		"etude_faisabilite": doc.etude_faisabilite,
		"support_technique": doc.support_technique,
		"machine_impression": doc.machine_impression,
		"machine_decoupe": doc.machine_decoupe,
		"pont": doc.pont,
		"trait_commun_autorise": cint(doc.trait_commun_autorise),
		"sens_fibre": doc.sens_fibre,
		"lisiere": flt(doc.lisiere),
		"pince": flt(doc.pince),
		"marge_arriere": flt(doc.marge_arriere),
		"ignorer_contraintes_machine": cint(doc.ignorer_contraintes_machine),
		"quantite": doc.quantite,
		"inclure_sur_mesure": cint(doc.inclure_sur_mesure),
		"formats_etudies": [
			{
				"laize": f.laize,
				"depl": f.depl,
				"origine": f.origine,
				"libelle": f.libelle,
				"bobine": cint(f.get("bobine")),
			}
			for f in (doc.formats_etudies or [])
		],
		"statut_calcul": doc.statut_calcul,
		"developpe_l": doc.developpe_l,
		"developpe_d": doc.developpe_d,
		"surface_utile": doc.surface_utile,
		"surface_utile_mm2": doc.surface_utile_mm2,
		"remplissage_bbox": doc.remplissage_bbox,
		"duree_calcul": doc.duree_calcul,
		"scenarios": [s.as_dict() for s in (doc.scenarios or [])],
		"scenario_retenu": doc.scenario_retenu,
		"imposition_creee": doc.imposition_creee,
		"log_calcul": doc.log_calcul,
		"variantes": variantes,
		"bornes": bornes,
		"silhouette": silhouette,
		"cache_disponible": cache_disponible,
		"empreinte_trace": doc.empreinte_trace,
	}


@frappe.whitelist()
def simuler(
	calcul,
	laize,
	depl,
	quantite=None,
	lisiere=None,
	pince=None,
	marge_arriere=None,
	ignorer_contraintes_machine=None,
):
	doc = frappe.get_doc("Calcul Imposition", calcul)
	doc.check_permission("read")
	vars_ = doc.charge_variantes()
	params = doc.charge_parametres(quantite=quantite)
	if not vars_ or not params:
		return {"scenario": None, "message": "Relancer le calcul pour activer la simulation."}
	_params_avec_saisie(
		doc,
		params,
		lisiere=lisiere,
		pince=pince,
		marge_arriere=marge_arriere,
		ignorer_contraintes_machine=ignorer_contraintes_machine,
	)
	ligne = simuler_format(
		vars_,
		params,
		flt(laize),
		flt(depl),
		flt(doc.surface_utile_mm2),
		libelle=f"{flt(laize):.0f} × {flt(depl):.0f}",
	)
	if not ligne:
		return {"scenario": None, "message": "Aucune pose ne tient sur ce format."}
	return {"scenario": ligne}


@frappe.whitelist()
def simuler_grille(
	calcul,
	rotation,
	n_col,
	n_rang,
	quantite=None,
	lisiere=None,
	pince=None,
	marge_arriere=None,
	ignorer_contraintes_machine=None,
):
	doc = frappe.get_doc("Calcul Imposition", calcul)
	doc.check_permission("read")
	vars_ = doc.charge_variantes()
	params = doc.charge_parametres(quantite=quantite)
	if not vars_ or not params:
		return {"scenario": None, "message": "Relancer le calcul pour activer la simulation."}
	_params_avec_saisie(
		doc,
		params,
		lisiere=lisiere,
		pince=pince,
		marge_arriere=marge_arriere,
		ignorer_contraintes_machine=ignorer_contraintes_machine,
	)
	ligne = evaluer_grille_simulee(
		vars_, params, cint(rotation), cint(n_col), cint(n_rang), flt(doc.surface_utile_mm2)
	)
	if not ligne:
		return {"scenario": None, "message": "Grille impossible pour cette rotation."}
	return {"scenario": ligne}


@frappe.whitelist()
def enregistrer_scenario(calcul, scenario):
	doc = frappe.get_doc("Calcul Imposition", calcul)
	doc.check_permission("write")
	if isinstance(scenario, str):
		scenario = json.loads(scenario)
	cle = (
		round(flt(scenario.get("laize")), 1),
		round(flt(scenario.get("depl")), 1),
		cint(scenario.get("rotation")),
		cint(scenario.get("n_col")),
		cint(scenario.get("n_rang")),
	)
	for s in doc.scenarios or []:
		if (
			round(flt(s.laize), 1),
			round(flt(s.depl), 1),
			cint(s.rotation),
			cint(s.n_col),
			cint(s.n_rang),
		) == cle:
			return {"idx": s.idx}
	doc.append("scenarios", scenario)
	doc.save()
	return {"idx": doc.scenarios[-1].idx}


def _avertissement_ideale(article, client, trace, taux):
	if not article:
		return None
	existant = frappe.get_all(
		"Imposition",
		filters={"article": article, "defaut": 1},
		fields=["name", "taux_chutes", "client", "trace"],
		limit=5,
	)
	if not existant:
		return "Cette Imposition deviendra l'Idéale et sera reprise par les prochains Calculs Devis."
	for row in existant:
		if row.client == client and row.trace == trace:
			if flt(taux) < flt(row.taux_chutes):
				return (
					f"Cette Imposition deviendra l'Idéale ({flt(taux):.1f} % < {flt(row.taux_chutes):.1f} %) "
					"et sera reprise par les prochains Calculs Devis."
				)
	return None


@frappe.whitelist()
def creer_imposition(calcul=None, scenario_idx=None, etude=None):
	if etude and not calcul:
		calcul = frappe.db.get_value("Etude Faisabilite", etude, "calcul_imposition")
		if not calcul:
			frappe.throw(
				"Aucun calcul d'imposition lié à cette étude. Ouvrir l'atelier d'imposition."
			)

	doc = frappe.get_doc("Calcul Imposition", calcul)
	doc.check_permission("write")
	if not frappe.has_permission("Imposition", "create"):
		frappe.throw("Permission insuffisante pour créer une Imposition.")
	if not doc.article or not doc.client:
		frappe.throw("Article et client requis pour créer l'Imposition.")
	idx = cint(scenario_idx)
	scenario = next((s for s in doc.scenarios if cint(s.idx) == idx), None)
	if not scenario:
		frappe.throw("Scénario introuvable.")

	for s in doc.scenarios:
		s.retenu = 1 if cint(s.idx) == idx else 0
	doc.scenario_retenu = scenario.libelle

	chemin = chemin_pdf(doc.fichier_trace)
	segments_coupe, segments_rainage = lire_trace(chemin)
	poly = silhouette(segments_coupe, segments_rainage)
	params = doc.charge_parametres() or Parametres(pont=flt(doc.pont) or PONT_DEFAUT)
	saisie = _saisie_ingenieur(doc)
	appliquer_saisie_sur_params(
		params,
		lisiere=saisie["lisiere_saisie"],
		pince=saisie["pince_saisie"],
		marge_arriere=saisie["marge_arriere_saisie"],
		ignorer=saisie["ignorer_contraintes_machine"],
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

	procede = None
	if doc.etude_faisabilite:
		procede = frappe.db.get_value("Etude Faisabilite", doc.etude_faisabilite, "procede")
	elif doc.article:
		procede = frappe.db.get_value("Item", doc.article, "custom_procédé") or frappe.db.get_value(
			"Item", doc.article, "custom_procede"
		)

	titre = f"{doc.article} — {scenario.libelle}"
	with tempfile.TemporaryDirectory() as repertoire:
		chemin_pdf_imp = os.path.join(repertoire, "imposition.pdf")
		generer_pdf(
			chemin_pdf_imp, segments_coupe, segments_rainage, poly, disposition, params, titre
		)
		with open(chemin_pdf_imp, "rb") as f:
			contenu = f.read()

	avertissement = _avertissement_ideale(doc.article, doc.client, doc.trace, scenario.taux_chutes)

	imposition = frappe.get_doc(
		{
			"doctype": "Imposition",
			"client": doc.client,
			"article": doc.article,
			"trace": doc.trace,
			"procede": procede,
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
			"machine_impression": doc.machine_impression,
			"machine_decoupe": doc.machine_decoupe,
			"origine_calcul": "Moteur v1",
			"scenario_retenu": scenario.libelle,
			"calcul_imposition": doc.name,
		}
	)
	imposition.insert()

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

	doc.imposition_creee = imposition.name
	doc.save()

	_remonter_etude(doc, imposition, fichier.file_url, scenario)

	return {
		"imposition": imposition.name,
		"fichier_imp": fichier.file_url,
		"defaut": cint(frappe.db.get_value("Imposition", imposition.name, "defaut")),
		"remplace_ideale": bool(avertissement),
		"avertissement_ideale": avertissement,
	}


def _disposition_depuis_scenario(scenario):
	return Disposition(
		libelle=scenario.get("libelle") or "",
		laize=flt(scenario.get("laize")),
		depl=flt(scenario.get("depl")),
		n_col=cint(scenario.get("n_col")),
		n_rang=cint(scenario.get("n_rang")),
		pas_laize=flt(scenario.get("pas_laize")),
		pas_depl=flt(scenario.get("pas_depl")),
		rotation=cint(scenario.get("rotation")),
		trait_commun_laize=bool(cint(scenario.get("trait_commun_laize"))),
		trait_commun_depl=bool(cint(scenario.get("trait_commun_depl"))),
	)


def _attacher_export(doc, nom, contenu):
	fichier = frappe.get_doc(
		{
			"doctype": "File",
			"file_name": nom,
			"attached_to_doctype": "Calcul Imposition",
			"attached_to_name": doc.name,
			"is_private": 1,
			"content": contenu,
		}
	).insert()
	return {"file_url": fichier.file_url, "file_name": fichier.file_name}


@frappe.whitelist()
def exporter_simulations(calcul, scenarios=None, format="pdf", format_export=None):
	"""PDF preuve (1:1) ou CFF2 ArtiosCAD pour les pastilles cochées."""
	doc = frappe.get_doc("Calcul Imposition", calcul)
	doc.check_permission("read")
	fmt = (format_export or format or "pdf").strip().lower()
	if fmt not in ("pdf", "cff2"):
		frappe.throw("Format d'export inconnu (pdf ou cff2).")
	if isinstance(scenarios, str):
		scenarios = json.loads(scenarios or "[]")
	scenarios = scenarios or []
	if not scenarios:
		frappe.throw("Cochez au moins une simulation.")

	chemin = chemin_pdf(doc.fichier_trace)
	segments_coupe, segments_rainage = lire_trace(chemin)
	poly = silhouette(segments_coupe, segments_rainage)
	params = doc.charge_parametres() or Parametres(pont=flt(doc.pont) or PONT_DEFAUT)
	pages = []
	for s in scenarios:
		d = _disposition_depuis_scenario(s)
		if d.n_col < 1 or d.n_rang < 1 or not d.laize or not d.depl:
			frappe.throw("Simulation incomplète : laize, déplacement et grille requis.")
		titre = s.get("libelle") or f"{d.laize:.0f} × {d.depl:.0f}"
		pages.append((d, titre))

	prefixe = f"simulations-{doc.name}"
	try:
		with tempfile.TemporaryDirectory() as repertoire:
			if fmt == "pdf":
				nom = f"{prefixe}.pdf"
				sortie = os.path.join(repertoire, nom)
				generer_pdf_pages(
					sortie, segments_coupe, segments_rainage, poly, pages, params
				)
			elif len(pages) == 1:
				d, _titre = pages[0]
				nom = nom_fichier_cff2(d)
				sortie = os.path.join(repertoire, nom)
				generer_cff2(sortie, segments_coupe, segments_rainage, poly, d, params)
			else:
				nom = f"{prefixe}-cff2.zip"
				sortie = os.path.join(repertoire, nom)
				vus = {}
				with zipfile.ZipFile(sortie, "w", zipfile.ZIP_DEFLATED) as archive:
					for i, (d, _titre) in enumerate(pages, start=1):
						cf_nom = nom_fichier_cff2(d)
						if cf_nom in vus:
							cf_nom = nom_fichier_cff2(d, index=i)
						vus[cf_nom] = True
						chemin_cf = os.path.join(repertoire, cf_nom)
						generer_cff2(
							chemin_cf, segments_coupe, segments_rainage, poly, d, params
						)
						archive.write(chemin_cf, cf_nom)
			with open(sortie, "rb") as f:
				contenu = f.read()
	except ValueError as e:
		frappe.throw(str(e))
	return _attacher_export(doc, nom, contenu)


def _remonter_etude(calcul_doc, imposition, fichier_url, scenario):
	etude = calcul_doc.etude_faisabilite
	if not etude:
		return
	statut = frappe.db.get_value("Etude Faisabilite", etude, "docstatus")
	if cint(statut) == 2:
		frappe.throw("L'Étude de faisabilité est annulée : impossible d'y remonter l'Imposition.")
	ef = frappe.get_doc("Etude Faisabilite", etude)
	ef.add_comment(
		"Comment",
		text=(
			f"Imposition <b>{imposition.name}</b> créée depuis l'atelier — scénario "
			f"« {scenario.libelle} » ({imposition.nbr_poses} poses sur "
			f"{imposition.format_laize} x {imposition.format_developpement} mm, "
			f"{flt(scenario.taux_chutes)} % de chutes)."
		),
	)
	valeurs = {
		"imposition": imposition.name,
		"fichier_imp": fichier_url,
		"taux_chutes": flt(scenario.taux_chutes),
		"calcul_imposition": calcul_doc.name,
		"developpe_calcule_l": calcul_doc.developpe_l,
		"developpe_calcule_d": calcul_doc.developpe_d,
		"surface_utile": calcul_doc.surface_utile,
		"remplissage_bbox": calcul_doc.remplissage_bbox,
	}
	ef.db_set(valeurs, update_modified=False)
	ef.reload()
	if hasattr(ef, "set_nbr_feuilles"):
		ef.set_nbr_feuilles()
		ef.db_set("nbr_feuilles", ef.nbr_feuilles, update_modified=False)
