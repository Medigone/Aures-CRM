# Copyright (c) 2026, Medigo and contributors
# License: MIT
"""Seed employés fictifs pour tester l'organigramme RH."""

from __future__ import annotations

import frappe
from frappe.utils import add_days, today


POSTES = [
	("Directeur Commercial", "Commercial", "Direction"),
	("Commercial Senior", "Commercial", "Agent"),
	("Commercial Junior", "Commercial", "Agent"),
	("Responsable Production", "Production", "Responsable"),
	("Superviseur Production", "Production", "Superviseur"),
	("Opérateur Offset", "Production", "Opérateur"),
	("Responsable Prépresse", "Prépresse", "Responsable"),
	("Technicien Prépresse", "Prépresse", "Technicien"),
	("Responsable RH", "Ressources Humaines", "Responsable"),
	("Chargé RH", "Ressources Humaines", "Agent"),
	("Responsable Finance", "Finance", "Responsable"),
	("Comptable", "Finance", "Agent"),
	("Responsable Qualité", "Qualité", "Responsable"),
	("Contrôleur Qualité", "Qualité", "Technicien"),
	("Responsable Maintenance", "Maintenance", "Responsable"),
	("Technicien Maintenance", "Maintenance", "Technicien"),
	("Responsable Back-Office", "Back-Office", "Responsable"),
	("Assistant Back-Office", "Back-Office", "Support"),
	("Responsable Administration", "Administration", "Responsable"),
]

FEMMES = {
	"Sara",
	"Nadia",
	"Lina",
	"Rania",
	"Amina",
	"Karima",
	"Ines",
	"Yasmine",
	"Meriem",
	"Djamila",
	"Imane",
	"Houda",
}


def ensure_postes() -> list[str]:
	created = []
	for intitule, dept, niveau in POSTES:
		if frappe.db.exists("Poste RH", intitule):
			continue
		frappe.get_doc(
			{
				"doctype": "Poste RH",
				"intitule_poste": intitule,
				"departement_par_defaut": dept,
				"niveau": niveau,
				"actif": 1,
			}
		).insert(ignore_permissions=True)
		created.append(intitule)
	return created


def link_departments_to_dg() -> None:
	for dept in [
		"Commercial",
		"Production",
		"Prépresse",
		"Ressources Humaines",
		"Finance",
		"Qualité",
		"Maintenance",
		"Back-Office",
		"Administration",
	]:
		if frappe.db.exists("Departement RH", dept):
			frappe.db.set_value("Departement RH", dept, "departement_parent", "Direction Générale")


def seed_employees() -> dict:
	dg = frappe.db.get_value("Employe", {"matricule": "0001"}, "name") or "EMP-2026-00002"
	site = "Offset"
	contrat = "CDI"
	date_entree = add_days(today(), -400)

	# (matricule, nom, prenom, poste, dept, manager_key)
	# manager_key = EMP-... or matricule
	employees = [
		("F100", "BENALI", "Sara", "Directeur Commercial", "Commercial", dg),
		("F110", "KACI", "Yacine", "Responsable Production", "Production", dg),
		("F120", "MANSOURI", "Nadia", "Responsable Prépresse", "Prépresse", dg),
		("F130", "CHERIET", "Lina", "Responsable RH", "Ressources Humaines", dg),
		("F140", "BOUAZIZ", "Omar", "Responsable Finance", "Finance", dg),
		("F150", "HAMIDI", "Rania", "Responsable Qualité", "Qualité", dg),
		("F160", "ZERROUKI", "Mehdi", "Responsable Maintenance", "Maintenance", dg),
		("F170", "SAADI", "Amina", "Responsable Back-Office", "Back-Office", dg),
		("F180", "TOUATI", "Farid", "Responsable Administration", "Administration", dg),
		("F101", "DJELLOUL", "Karima", "Commercial Senior", "Commercial", "F100"),
		("F102", "BRAHIMI", "Sofiane", "Commercial Junior", "Commercial", "F100"),
		("F103", "MESSAOUDI", "Ines", "Commercial Junior", "Commercial", "F100"),
		("F111", "BELKACEM", "Hassan", "Superviseur Production", "Production", "F110"),
		("F112", "AMRANI", "Walid", "Opérateur Offset", "Production", "F111"),
		("F113", "NOURI", "Samir", "Opérateur Offset", "Production", "F111"),
		("F114", "GACEM", "Bilal", "Opérateur Offset", "Production", "F111"),
		("F121", "LAIB", "Yasmine", "Technicien Prépresse", "Prépresse", "F120"),
		("F122", "BENYAHIA", "Anis", "Technicien Prépresse", "Prépresse", "F120"),
		("F131", "OUADAH", "Meriem", "Chargé RH", "Ressources Humaines", "F130"),
		("F141", "CHERIF", "Djamila", "Comptable", "Finance", "F140"),
		("F142", "ABDELLI", "Nabil", "Comptable", "Finance", "F140"),
		("F151", "BOUCHERIT", "Imane", "Contrôleur Qualité", "Qualité", "F150"),
		("F161", "REZGUI", "Tarek", "Technicien Maintenance", "Maintenance", "F160"),
		("F162", "HADJ", "Khaled", "Technicien Maintenance", "Maintenance", "F160"),
		("F171", "SLIMANE", "Houda", "Assistant Back-Office", "Back-Office", "F170"),
	]

	by_matricule: dict[str, str] = {}
	for row in frappe.get_all("Employe", fields=["name", "matricule"]):
		if row.matricule:
			by_matricule[row.matricule] = row.name

	created = []
	pending_manager = []

	for matricule, nom, prenom, poste, dept, manager in employees:
		existing = frappe.db.get_value("Employe", {"matricule": matricule}, "name")
		if existing:
			by_matricule[matricule] = existing
			# ensure manager is set
			if manager in by_matricule:
				frappe.db.set_value("Employe", existing, "responsable_hierarchique", by_matricule[manager])
			elif str(manager).startswith("EMP-"):
				frappe.db.set_value("Employe", existing, "responsable_hierarchique", manager)
			continue

		if manager in by_matricule:
			resp = by_matricule[manager]
		elif str(manager).startswith("EMP-"):
			resp = manager
		else:
			resp = None

		doc = frappe.get_doc(
			{
				"doctype": "Employe",
				"matricule": matricule,
				"nom": nom,
				"prenom": prenom,
				"statut": "Actif",
				"date_entree": date_entree,
				"departement": dept,
				"poste": poste,
				"site": site,
				"type_contrat": contrat,
				"responsable_hierarchique": resp,
				"sexe": "Femme" if prenom in FEMMES else "Homme",
			}
		)
		doc.insert(ignore_permissions=True)
		by_matricule[matricule] = doc.name
		created.append(
			{
				"name": doc.name,
				"label": f"{prenom} {nom}",
				"departement": dept,
				"poste": poste,
			}
		)
		if resp is None:
			pending_manager.append((doc.name, manager))

	for name, manager_key in pending_manager:
		resp = by_matricule.get(manager_key)
		if resp:
			frappe.db.set_value("Employe", name, "responsable_hierarchique", resp)

	dept_resp = {
		"Direction Générale": dg,
		"Commercial": by_matricule.get("F100"),
		"Production": by_matricule.get("F110"),
		"Prépresse": by_matricule.get("F120"),
		"Ressources Humaines": by_matricule.get("F130"),
		"Finance": by_matricule.get("F140"),
		"Qualité": by_matricule.get("F150"),
		"Maintenance": by_matricule.get("F160"),
		"Back-Office": by_matricule.get("F170"),
		"Administration": by_matricule.get("F180"),
	}
	for dept, emp in dept_resp.items():
		if emp and frappe.db.exists("Departement RH", dept):
			frappe.db.set_value("Departement RH", dept, "responsable_departement", emp)

	return {"created": created, "total_active": frappe.db.count("Employe", {"statut": "Actif"})}


def execute():
	created_postes = ensure_postes()
	link_departments_to_dg()
	result = seed_employees()
	frappe.db.commit()
	return {
		"postes_created": created_postes,
		"employees_created": result["created"],
		"employees_created_count": len(result["created"]),
		"total_active": result["total_active"],
	}
