// Copyright (c) 2026, Aures Emballages and contributors
// For license information, please see license.txt

frappe.listview_settings["Bareme Cout Fixe"] = {
	add_fields: ["status", "is_active"],
	get_indicator: function (doc) {
		if (doc.status === "Actif" || cint(doc.is_active)) {
			return [__("Actif"), "green", "status,=,Actif"];
		}
		return [__("Inactif"), "red", "status,=,Inactif"];
	},
};
