// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Ticket Commercial", {
    refresh: function(frm) {
        // Actions personnalisées au rafraîchissement du formulaire
        if (frm.doc.status === "Terminé" || frm.doc.status === "Annulé") {
            frm.set_read_only(true);
        }
    },

    customer: function(frm) {
        // Auto-remplir le nom du client si disponible
        if (frm.doc.customer) {
            frappe.db.get_value("Customer", frm.doc.customer, "customer_name")
                .then(r => {
                    if (r.message) {
                        frm.set_value("customer_name", r.message.customer_name);
                    }
                });
        }
    },

    commercial: function(frm) {
        // Auto-remplir le nom du commercial si disponible
        if (frm.doc.commercial) {
            frappe.db.get_value("User", frm.doc.commercial, "full_name")
                .then(r => {
                    if (r.message) {
                        frm.set_value("nom_commercial", r.message.full_name);
                    }
                });
        } else {
            frm.set_value("nom_commercial", "");
        }
    },

    request_type: function(frm) {
        // Personnaliser selon le type de demande
        if (frm.doc.request_type === "Réclamation commerciale") {
            frappe.msgprint({
                message: __("Assurez-vous de documenter la réclamation en détail dans la description."),
                indicator: "orange",
                title: __("Réclamation")
            });
        }
    }
});
