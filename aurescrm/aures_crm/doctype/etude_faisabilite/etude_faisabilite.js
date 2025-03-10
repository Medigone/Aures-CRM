// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on('Etude Faisabilite', {
    refresh: function(frm) {
        // Appliquer le filtre pour n'afficher que les articles liés au client
        frm.fields_dict.article.get_query = function(doc) {
            return {
                filters: {
                    'custom_client': doc.client  // Filtrer les articles liés au client sélectionné
                }
            };
        };

        // Vérifier si le statut est "Réalisable" et si un article est sélectionné
        if (frm.doc.status === "Réalisable" && frm.doc.article) {
            // Bouton pour créer une Nomenclature
            frm.add_custom_button('Nomenclature', function() {
                if (!frm.doc.article) {
                    frappe.msgprint(__('Veuillez sélectionner un article avant de créer une nomenclature.'));
                    return;
                }

                frappe.new_doc('BOM', {
                    item: frm.doc.article,
                    quantity: 1,
                    is_active: 1,
                    is_default: 1,
                    company: frappe.defaults.get_default("company")
                });

            }, "Créer");

            // Bouton pour créer un Devis
            frm.add_custom_button('Devis', function() {
                if (!frm.doc.client || !frm.doc.article) {
                    frappe.msgprint(__('Veuillez sélectionner un client et un article avant de créer un devis.'));
                    return;
                }

                frappe.new_doc('Quotation', {
                    party_name: frm.doc.client,
                    custom_id_client: frm.doc.client,
                    quotation_to: 'Customer',
                    items: [{
                        item_code: frm.doc.article,
                        qty: 1
                    }],
                    company: frappe.defaults.get_default("company")
                });

            }, "Créer");
        }
    },

    client: function(frm) {
        // Appliquer le filtre dès que le champ client change
        frm.fields_dict.article.get_query = function(doc) {
            return {
                filters: {
                    'custom_client': doc.client
                }
            };
        };
    },

    status: function(frm) {
        // Rafraîchir le formulaire pour afficher ou masquer les boutons selon le statut
        frm.refresh();
    }
});
