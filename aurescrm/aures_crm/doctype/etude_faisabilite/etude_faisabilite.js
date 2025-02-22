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
            frm.add_custom_button('Créer Nomenclature', function() {
                // Vérifier si un article est sélectionné
                if (!frm.doc.article) {
                    frappe.msgprint(__('Veuillez sélectionner un article avant de créer une nomenclature.'));
                    return;
                }

                // Ouvrir le formulaire de création d'un BOM avec uniquement l'article pré-rempli
                frappe.new_doc('BOM', {
                    item: frm.doc.article,  // Pré-remplissage de l'article uniquement
                    quantity: 1,  // Quantité par défaut
                    is_active: 1,  // Activer le BOM
                    is_default: 1,  // Définir comme BOM par défaut
                    company: frappe.defaults.get_default("company")  // Entreprise actuelle
                });

            }, "Actions");
        }
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
    },

    status: function(frm) {
        // Rafraîchir le formulaire pour afficher ou masquer le bouton selon le statut
        frm.refresh();
    }
});
