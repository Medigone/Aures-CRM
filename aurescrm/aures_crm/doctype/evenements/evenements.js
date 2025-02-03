// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Evenements", {
// 	refresh(frm) {

// 	},
// });
frappe.views.calendar["Evenements"] = {
    // mapping des champs
    field_map: {
        "start": "date_debut",    // champ de début
        "end": "date_fin",       // champ de fin
        "id": "name",            // identifiant unique
        "title": "title"        // titre à afficher
    }
};
