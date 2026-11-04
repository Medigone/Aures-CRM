# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class GenerationSuiviCreance(Document):
	pass


@frappe.whitelist()
def generer_suivis_creances():
	"""Crée un Suivi Creance par client impayé s'il n'existe pas encore (dossier unique)."""
	clients_avec_impayes = frappe.db.sql(
		"""
		SELECT DISTINCT customer
		FROM `tabSales Invoice`
		WHERE docstatus = 1
		AND outstanding_amount > 0
		""",
		as_dict=1,
	)

	nb_suivis_crees = 0
	nb_existants = 0

	for client in clients_avec_impayes:
		existing = frappe.db.get_value("Suivi Creance", {"id_client": client.customer}, "name")
		if existing:
			nb_existants += 1
			# Réactiver un dossier obsolète plutôt que d'en créer un nouveau
			status = frappe.db.get_value("Suivi Creance", existing, "status")
			if status == "Obsolète":
				frappe.db.set_value("Suivi Creance", existing, "status", "Nouveau")
			continue

		nouveau_suivi = frappe.get_doc(
			{
				"doctype": "Suivi Creance",
				"id_client": client.customer,
			}
		)
		nouveau_suivi.insert()
		nb_suivis_crees += 1

	frappe.db.commit()
	return {"created": nb_suivis_crees, "existing": nb_existants}
