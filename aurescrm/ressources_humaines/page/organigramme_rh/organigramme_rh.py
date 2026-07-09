# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import frappe


@frappe.whitelist()
def get_organigramme_data(site=None, departement=None, inclure_pre_integres=0):
	"""Retourner les employés à afficher dans l'organigramme.

	L'arbre est construit côté client à partir de responsable_hierarchique.
	Par défaut seuls les employés Actifs apparaissent.
	"""
	frappe.has_permission("Employe", "read", throw=True)

	statuts = ["Actif"]
	if frappe.utils.cint(inclure_pre_integres):
		statuts.append("Pré-intégré")

	filters = {"statut": ("in", statuts)}
	if site:
		filters["site"] = site
	if departement:
		filters["departement"] = departement

	return frappe.get_all(
		"Employe",
		filters=filters,
		fields=[
			"name",
			"nom_complet",
			"photo",
			"statut",
			"poste",
			"departement",
			"site",
			"responsable_hierarchique",
		],
		order_by="nom_complet asc",
		limit_page_length=0,
	)
