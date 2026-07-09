# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe import _

REQUIRED_FIELDS = {
	"date_entree": "Date d'entrée",
	"departement": "Département",
	"poste": "Poste",
	"site": "Site",
	"type_contrat": "Type de contrat",
}


def execute(filters=None):
	columns = [
		{
			"fieldname": "name",
			"label": _("Employé"),
			"fieldtype": "Link",
			"options": "Employe",
			"width": 140,
		},
		{
			"fieldname": "nom_complet",
			"label": _("Nom complet"),
			"fieldtype": "Data",
			"width": 200,
		},
		{
			"fieldname": "statut",
			"label": _("Statut"),
			"fieldtype": "Data",
			"width": 100,
		},
		{
			"fieldname": "champs_manquants",
			"label": _("Champs manquants"),
			"fieldtype": "Data",
			"width": 400,
		},
	]

	employes = frappe.get_all(
		"Employe",
		filters={"statut": "Actif"},
		fields=["name", "nom_complet", "statut"] + list(REQUIRED_FIELDS),
		order_by="nom_complet asc",
	)

	data = []
	for emp in employes:
		missing = [label for field, label in REQUIRED_FIELDS.items() if not emp.get(field)]
		if missing:
			data.append(
				{
					"name": emp.name,
					"nom_complet": emp.nom_complet,
					"statut": emp.statut,
					"champs_manquants": ", ".join(missing),
				}
			)

	return columns, data
