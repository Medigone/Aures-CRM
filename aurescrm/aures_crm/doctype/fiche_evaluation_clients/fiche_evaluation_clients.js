// Copyright (c) 2024, Medigo and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Fiche Evaluation Clients", {
// 	refresh(frm) {

// 	},
// });
frappe.listview_settings['Fiche Evaluation Clients'] = {
    get_indicator: function(doc) {
        if (doc.status === "Action") {
            return [__("Action"), "red", "status,=,Action"];
        } else if (doc.status === "Amélioration") {
            return [__("Amélioration"), "yellow", "status,=,Amélioration"];
        } else if (doc.status === "Inaction") {
            return [__("Inaction"), "green", "status,=,Inaction"];
        }
    }
};
