# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Mise en place du module Ressources Humaines : rôles et données de base.

Appelé depuis install.py (after_install) et depuis les patches
(create_rh_roles en pre_model_sync, seed_rh_referentiels en post_model_sync).
Toutes les fonctions sont idempotentes.
"""

import frappe

RH_ROLES = ("RH Manager", "RH User", "RH Viewer", "Direction")

TYPES_CONTRAT = ("CDI", "CDD", "Stage", "Apprentissage", "Temporaire", "Prestataire", "Autre")

DEPARTEMENTS = (
	"Direction Générale",
	"Commercial",
	"Back-Office",
	"Prépresse",
	"Production",
	"Qualité",
	"Maintenance",
	"Finance",
	"Administration",
	"Ressources Humaines",
)


def create_rh_roles():
	"""Créer les rôles custom du module RH s'ils n'existent pas."""
	for role_name in RH_ROLES:
		if frappe.db.exists("Role", role_name):
			continue
		frappe.get_doc(
			{
				"doctype": "Role",
				"role_name": role_name,
				"desk_access": 1,
				"is_custom": 1,
			}
		).insert(ignore_permissions=True)


def seed_rh_referentiels():
	"""Insérer les valeurs de base des référentiels RH (types de contrat, départements, site)."""
	if not frappe.db.exists("DocType", "Type Contrat RH"):
		# Les DocTypes RH ne sont pas encore synchronisés sur ce site.
		return

	for type_contrat in TYPES_CONTRAT:
		if not frappe.db.exists("Type Contrat RH", type_contrat):
			frappe.get_doc(
				{"doctype": "Type Contrat RH", "type_contrat": type_contrat, "actif": 1}
			).insert(ignore_permissions=True)

	for departement in DEPARTEMENTS:
		if not frappe.db.exists("Departement RH", departement):
			frappe.get_doc(
				{"doctype": "Departement RH", "nom_departement": departement, "actif": 1}
			).insert(ignore_permissions=True)

	if not frappe.db.count("Site RH"):
		frappe.get_doc(
			{
				"doctype": "Site RH",
				"nom_site": "Siège / Usine principale",
				"type_site": "Usine",
				"actif": 1,
			}
		).insert(ignore_permissions=True)


def setup_rh_module():
	"""Point d'entrée complet (rôles + données de base)."""
	create_rh_roles()
	seed_rh_referentiels()
