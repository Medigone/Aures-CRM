# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Reprend les calculs d'imposition déjà faits sur l'Étude vers Calcul Imposition.

Idempotent : sort si le DocType manque, si la colonne n'existe plus, ou si un
Calcul Imposition est déjà lié. Re-parente les lignes Scenario Imposition
plutôt que de les recopier. Aucun recalcul en masse.
"""

import frappe


def execute():
	if not frappe.db.exists("DocType", "Calcul Imposition"):
		return
	frappe.reload_doc("aures_crm", "doctype", "calcul_imposition")
	frappe.reload_doc("aures_crm", "doctype", "etude_faisabilite")

	colonnes = {c["Field"] for c in frappe.db.sql("SHOW COLUMNS FROM `tabEtude Faisabilite`", as_dict=True)}
	if "statut_calcul" not in colonnes:
		return

	etudes = frappe.db.sql(
		"""
		SELECT name, statut_calcul, developpe_calcule_l, developpe_calcule_d,
			surface_utile, remplissage_bbox, log_calcul, article, client, `trace`,
			machine_prevue, machine_decoupe, pont, trait_commun_autorise, sens_fibre,
			quantite, fichier_trace, imposition
		FROM `tabEtude Faisabilite`
		WHERE IFNULL(statut_calcul, '') IN ('Terminé', 'Échec', 'En cours')
		""",
		as_dict=True,
	)

	for ef in etudes:
		deja = frappe.db.get_value("Calcul Imposition", {"etude_faisabilite": ef.name}, "name")
		if deja:
			if frappe.db.has_column("Etude Faisabilite", "calcul_imposition"):
				frappe.db.set_value(
					"Etude Faisabilite", ef.name, "calcul_imposition", deja, update_modified=False
				)
			continue

		url = ef.fichier_trace
		if ef.trace:
			url_trace = frappe.db.get_value("Trace", ef.trace, "fichier_trace")
			if url_trace and str(url_trace).lower().endswith(".pdf"):
				url = url_trace
		if not url:
			continue

		doc = frappe.get_doc(
			{
				"doctype": "Calcul Imposition",
				"fichier_trace": url,
				"trace": ef.trace,
				"article": ef.article,
				"client": ef.client,
				"etude_faisabilite": ef.name,
				"machine_impression": ef.machine_prevue,
				"machine_decoupe": ef.machine_decoupe,
				"pont": ef.pont or 2.5,
				"trait_commun_autorise": ef.trait_commun_autorise,
				"sens_fibre": ef.sens_fibre or "Libre",
				"quantite": ef.quantite,
				"statut_calcul": ef.statut_calcul,
				"developpe_l": ef.developpe_calcule_l,
				"developpe_d": ef.developpe_calcule_d,
				"surface_utile": ef.surface_utile,
				"remplissage_bbox": ef.remplissage_bbox,
				"log_calcul": ef.log_calcul,
				"imposition_creee": ef.imposition,
			}
		)
		doc.flags.ignore_validate = True
		doc.flags.ignore_mandatory = True
		doc.insert()

		frappe.db.sql(
			"""
			UPDATE `tabScenario Imposition`
			SET parent=%s, parenttype='Calcul Imposition', parentfield='scenarios'
			WHERE parent=%s AND parenttype='Etude Faisabilite'
			""",
			(doc.name, ef.name),
		)
		if frappe.db.has_column("Etude Faisabilite", "calcul_imposition"):
			frappe.db.set_value(
				"Etude Faisabilite", ef.name, "calcul_imposition", doc.name, update_modified=False
			)
