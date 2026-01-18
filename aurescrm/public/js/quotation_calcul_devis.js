// Copyright (c) 2026, Aures Emballages and contributors
// For license information, please see license.txt

// Script pour ajouter le bouton "Générer Calculs Devis" dans Quotation

frappe.ui.form.on("Quotation", {
    refresh: function(frm) {
        // Afficher le bouton si le devis est sauvegardé (pas nouveau) et a des articles
        if (!frm.is_new() && frm.doc.items && frm.doc.items.length > 0) {
            frm.add_custom_button(__("Générer Calculs Devis"), function() {
                generate_calcul_devis(frm);
            }, __("Actions"));
        }
    }
});

function generate_calcul_devis(frm) {
    frappe.confirm(
        __("Voulez-vous générer un Calcul Devis pour chaque article de ce devis ?<br><br>Les articles déjà calculés seront ignorés."),
        function() {
            // Oui
            frappe.call({
                method: "aurescrm.aures_crm.doctype.calcul_devis.calcul_devis.generate_calcul_devis_for_quotation",
                args: {
                    quotation_name: frm.doc.name
                },
                freeze: true,
                freeze_message: __("Génération des Calculs Devis en cours..."),
                callback: function(r) {
                    if (r.message) {
                        if (r.message.created > 0) {
                            frappe.msgprint({
                                title: __("Calculs Devis Générés"),
                                message: r.message.message,
                                indicator: "green"
                            });
                            
                            // Rafraîchir le formulaire pour mettre à jour les liens du dashboard
                            frm.reload_doc();
                        } else if (r.message.skipped > 0) {
                            frappe.msgprint({
                                title: __("Aucun nouveau Calcul Devis"),
                                message: __("Tous les articles ont déjà un Calcul Devis associé."),
                                indicator: "orange"
                            });
                        }
                    }
                }
            });
        },
        function() {
            // Non - ne rien faire
        }
    );
}
