// Copyright (c) 2026, Medigo and contributors
// For license information, please see license.txt

frappe.query_reports["Registre des Employes"] = {
	filters: [
		{
			fieldname: "statut",
			label: __("Statut"),
			fieldtype: "Select",
			options: "\nPré-intégré\nActif\nInactif\nSorti",
		},
		{
			fieldname: "departement",
			label: __("Département"),
			fieldtype: "Link",
			options: "Departement RH",
		},
		{
			fieldname: "poste",
			label: __("Poste"),
			fieldtype: "Link",
			options: "Poste RH",
		},
		{
			fieldname: "site",
			label: __("Site"),
			fieldtype: "Link",
			options: "Site RH",
		},
		{
			fieldname: "type_contrat",
			label: __("Type de contrat"),
			fieldtype: "Link",
			options: "Type Contrat RH",
		},
	],
};
