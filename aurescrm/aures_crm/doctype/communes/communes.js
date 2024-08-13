// Copyright (c) 2024, Medigo and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Communes", {
// 	refresh(frm) {

// 	},
// });
frappe.ui.form.on('Communes', {
    commune: function(frm) {
        updateNomCompletCommune(frm);
    },

    wilaya: function(frm) {
        updateNomCompletCommune(frm);
    }
});

function updateNomCompletCommune(frm) {
    let commune = frm.doc.commune;
    let wilaya = frm.doc.wilaya;

    if (commune && wilaya) {
        let nom_complet_commune = commune + " - " + wilaya;
        frm.set_value('nom_complet_commune', nom_complet_commune);
    }
}

