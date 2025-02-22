// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Etude Faisabilite", {
// 	refresh(frm) {

// 	},
// });
frappe.ui.form.on('Etude Faisabilite', {
    refresh: function(frm) {
        // Appliquer le filtre au chargement
        frm.fields_dict.article.get_query = function(doc) {
            return {
                filters: {
                    'custom_client': doc.client  // Filtrer les articles liés au client sélectionné
                }
            };
        };
    },

    client: function(frm) {
        // Appliquer le filtre dès que le champ client change
        frm.fields_dict.article.get_query = function(doc) {
            return {
                filters: {
                    'custom_client': doc.client  // Filtrer les articles liés au client sélectionné
                }
            };
        };
    }
});
