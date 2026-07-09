# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe import _

FILTER_FIELDS = ("statut", "departement", "poste", "site", "type_contrat")


def execute(filters=None):
	return get_columns(), get_data(filters)


def get_columns():
	return [
		{
			"fieldname": "matricule",
			"label": _("Matricule"),
			"fieldtype": "Data",
			"width": 110,
		},
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
			"fieldname": "date_entree",
			"label": _("Date d'entrée"),
			"fieldtype": "Date",
			"width": 110,
		},
		{
			"fieldname": "departement",
			"label": _("Département"),
			"fieldtype": "Link",
			"options": "Departement RH",
			"width": 150,
		},
		{
			"fieldname": "poste",
			"label": _("Poste"),
			"fieldtype": "Link",
			"options": "Poste RH",
			"width": 150,
		},
		{
			"fieldname": "site",
			"label": _("Site"),
			"fieldtype": "Link",
			"options": "Site RH",
			"width": 140,
		},
		{
			"fieldname": "type_contrat",
			"label": _("Type de contrat"),
			"fieldtype": "Link",
			"options": "Type Contrat RH",
			"width": 120,
		},
		{
			"fieldname": "responsable_hierarchique",
			"label": _("Responsable hiérarchique"),
			"fieldtype": "Link",
			"options": "Employe",
			"width": 160,
		},
		{
			"fieldname": "telephone",
			"label": _("Téléphone"),
			"fieldtype": "Data",
			"width": 120,
		},
	]


def get_data(filters):
	filters = filters or {}
	conditions = {
		field: filters.get(field) for field in FILTER_FIELDS if filters.get(field)
	}
	return frappe.get_all(
		"Employe",
		filters=conditions,
		fields=[
			"name",
			"matricule",
			"nom_complet",
			"statut",
			"date_entree",
			"departement",
			"poste",
			"site",
			"type_contrat",
			"responsable_hierarchique",
			"telephone",
		],
		order_by="nom_complet asc",
	)
