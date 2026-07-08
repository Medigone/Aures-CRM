import frappe


def execute():
	"""Remappe l'ancien statut (Brouillon/Ouvert/En cours/Clôturé) vers la nouvelle machine à états
	(Ouvert / Programmation en cours / Programmation complète / Planification validée / Clôturé)."""
	from aurescrm.aures_crm.doctype.dossier_fabrication.dossier_fabrication import (
		_compute_programmation_status,
	)

	for row in frappe.get_all(
		"Dossier Fabrication",
		fields=["name", "status", "planification_validee"],
	):
		if row.status == "Clôturé":
			continue

		if row.planification_validee:
			new_status = "Planification validée"
		else:
			doc = frappe.get_doc("Dossier Fabrication", row.name)
			new_status = _compute_programmation_status(doc)

		if new_status != row.status:
			frappe.db.set_value("Dossier Fabrication", row.name, "status", new_status, update_modified=False)
