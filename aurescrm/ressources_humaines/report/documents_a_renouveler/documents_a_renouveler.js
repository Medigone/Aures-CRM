// Copyright (c) 2026, Medigo and contributors
// For license information, please see license.txt

frappe.query_reports["Documents a Renouveler"] = {
	filters: [
		{
			fieldname: "echeance",
			label: __("Échéance"),
			fieldtype: "Select",
			options: [
				"Expirés",
				"Expirant dans 30 jours",
				"Expirant dans 60 jours",
				"Expirant dans 90 jours",
			].join("\n"),
			default: "Expirant dans 90 jours",
			reqd: 1,
		},
	],
};
