# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe


def propagate_niveau_urgence(doc, method=None):
	"""Lors d'un changement de niveau d'urgence sur le ticket, propage U0–U3 vers tout le cycle lié."""
	old = doc.get_doc_before_save()
	if not old or (old.get("niveau_urgence") == doc.get("niveau_urgence")):
		return

	nouveau = doc.get("niveau_urgence")
	if not nouveau:
		return

	demandes = frappe.get_all(
		"Demande Faisabilite", filters={"ticket_commercial": doc.name}, pluck="name"
	)

	for dem in demandes:
		frappe.db.set_value("Demande Faisabilite", dem, "niveau_urgence", nouveau)

		for dt in ("Etude Faisabilite", "Etude Faisabilite Flexo"):
			for name in frappe.get_all(dt, filters={"demande_faisabilite": dem}, pluck="name"):
				frappe.db.set_value(dt, name, "niveau_urgence", nouveau)

		for d in frappe.get_all(
			"Quotation",
			filters={"custom_demande_faisabilité": dem},
			pluck="name",
		):
			frappe.db.set_value("Quotation", d, "custom_niveau_urgence", nouveau)

		for c in frappe.get_all(
			"Sales Order",
			filters={"custom_demande_de_faisabilité": dem},
			pluck="name",
		):
			frappe.db.set_value("Sales Order", c, "custom_niveau_urgence", nouveau)

		for et in frappe.get_all(
			"Etude Technique", filters={"demande_faisabilite": dem}, pluck="name"
		):
			frappe.db.set_value("Etude Technique", et, "niveau_urgence", nouveau)
