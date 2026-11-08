# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import cint, flt

from aurescrm.imposition.api import _droits
from aurescrm.imposition.service import (
	PONT_DEFAUT,
	formats_connus,
	support_technique_article,
)


@frappe.whitelist()
def get_contexte(
	article=None,
	trace=None,
	etude=None,
	calcul=None,
	machine_impression=None,
	machine_decoupe=None,
):
	"""Pré-remplissage de l'atelier : article → Support Technique → formats feuilles.

	Les arguments machine_* sont ignorés (compatibilité des anciens appels).
	"""
	if not frappe.has_permission("Calcul Imposition", "read"):
		frappe.throw("Permission insuffisante pour ouvrir l'atelier d'imposition.")

	ctx = {
		"article": article,
		"client": None,
		"trace": trace,
		"fichier_trace": None,
		"etude": etude,
		"calcul": calcul,
		"pont": PONT_DEFAUT,
		"trait_commun_autorise": 1,
		"sens_fibre": "Libre",
		"motifs_emboites": "Décalé autorisé",
		"quantite": None,
		"support_technique": None,
		"grammage": 0,
		"pont_mini": PONT_DEFAUT,
		"formats_proposes": [],
		"bornes": {},
		"droits": _droits(),
		"lisiere": None,
		"pince": None,
		"marge_arriere": None,
	}

	if calcul and frappe.db.exists("Calcul Imposition", calcul):
		doc = frappe.get_doc("Calcul Imposition", calcul)
		doc.check_permission("read")
		ctx.update(
			{
				"article": doc.article,
				"client": doc.client,
				"trace": doc.trace,
				"fichier_trace": doc.fichier_trace,
				"etude": doc.etude_faisabilite,
				"pont": doc.pont,
				"trait_commun_autorise": cint(doc.trait_commun_autorise),
				"sens_fibre": doc.sens_fibre,
				"motifs_emboites": doc.get("motifs_emboites") or "Décalé autorisé",
				"quantite": doc.quantite,
				"support_technique": doc.support_technique,
				"lisiere": flt(doc.lisiere) or None,
				"pince": flt(doc.pince) or None,
				"marge_arriere": flt(doc.marge_arriere) or None,
			}
		)
		article = doc.article
		trace = doc.trace
		etude = doc.etude_faisabilite

	if etude and frappe.db.exists("Etude Faisabilite", etude):
		ef = frappe.get_doc("Etude Faisabilite", etude)
		ef.check_permission("read")
		ctx["article"] = ctx["article"] or ef.article
		ctx["client"] = ctx["client"] or ef.client
		ctx["trace"] = ctx["trace"] or ef.trace
		ctx["quantite"] = ctx["quantite"] or cint(ef.quantite)
		ctx["pont"] = flt(ef.get("pont")) or ctx["pont"]
		if ef.get("sens_fibre"):
			ctx["sens_fibre"] = ef.sens_fibre
		if ef.get("trait_commun_autorise") is not None:
			ctx["trait_commun_autorise"] = cint(ef.trait_commun_autorise)
		article = ctx["article"]
		trace = ctx["trace"]

	if trace and not ctx["fichier_trace"]:
		ctx["fichier_trace"] = frappe.db.get_value("Trace", trace, "fichier_trace")
		if not ctx["article"]:
			ctx["article"] = frappe.db.get_value("Trace", trace, "article")
			article = ctx["article"]

	if article:
		ctx["client"] = ctx["client"] or frappe.db.get_value("Item", article, "custom_client")
		support = support_technique_article(article)
		if support:
			ctx["support_technique"] = support.name
			ctx["grammage"] = flt(support.grammage)
			ctx["pont_mini"] = flt(support.pont_mini) or PONT_DEFAUT
			if not flt(ctx["pont"]):
				ctx["pont"] = ctx["pont_mini"]

	support = None
	if ctx["support_technique"]:
		support = frappe.get_doc("Support Technique", ctx["support_technique"])
	ctx["formats_proposes"] = formats_connus(support=support, stock_seul=True)
	return ctx


@frappe.whitelist()
def get_historique(article=None, trace=None, limit=20):
	if not frappe.has_permission("Calcul Imposition", "read"):
		frappe.throw("Permission insuffisante.")
	filtres = {}
	if article:
		filtres["article"] = article
	if trace:
		filtres["trace"] = trace
	return frappe.get_all(
		"Calcul Imposition",
		filters=filtres,
		fields=[
			"name",
			"creation",
			"article",
			"trace",
			"client",
			"statut_calcul",
			"quantite",
			"pont",
			"developpe_l",
			"developpe_d",
			"imposition_creee",
			"scenario_retenu",
		],
		order_by="creation desc",
		limit=cint(limit) or 20,
	)
