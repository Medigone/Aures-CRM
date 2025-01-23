// Copyright (c) 2024, Medigo and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Appel Telephonique", {
// 	refresh(frm) {

// 	},
// });
frappe.ui.form.on('Appel Telephonique', {
	before_save: function(frm) {
        if (!frm.doc.utilisateur) {  // Vérifie si le champ utilisateur est vide
            frm.set_value('utilisateur', frm.doc.owner);  // Définit l'utilisateur avec le propriétaire initial (créateur)
        }
    }
});