# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe import _


def execute(filters=None):
	columns = [
		{
			"fieldname": "departement",
			"label": _("Département"),
			"fieldtype": "Link",
			"options": "Departement RH",
			"width": 250,
		},
		{
			"fieldname": "nombre_employes",
			"label": _("Nombre d'employés actifs"),
			"fieldtype": "Int",
			"width": 200,
		},
	]

	data = frappe.get_all(
		"Employe",
		filters={"statut": "Actif"},
		fields=["departement", "count(name) as nombre_employes"],
		group_by="departement",
		order_by="nombre_employes desc",
	)
	for row in data:
		if not row.departement:
			row.departement = _("(Sans département)")

	chart = {
		"data": {
			"labels": [row.departement for row in data],
			"datasets": [{"values": [row.nombre_employes for row in data]}],
		},
		"type": "bar",
	}

	return columns, data, None, chart
