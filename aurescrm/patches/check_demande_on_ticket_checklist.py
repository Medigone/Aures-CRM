# Copyright (c) 2026, Aures Emballages and contributors
# For license information, please see license.txt

"""Coche « Demande de faisabilité » sur les bons de commande ouverts qui ont déjà une demande active. Idempotent."""

import frappe


def execute():
	tickets = frappe.get_all(
		"Ticket Commercial",
		filters={"request_type": "Bon de commande", "status": ["not in", ["Terminé", "Annulé"]], "checklist_bc_demande_faisabilite": 0},
		pluck="name",
	)
	for name in tickets:
		if frappe.db.exists("Demande Faisabilite", {"ticket_commercial": name, "status": ["!=", "Annulée"]}):
			frappe.db.set_value("Ticket Commercial", name, "checklist_bc_demande_faisabilite", 1, update_modified=False)
