frappe.ui.form.on('Etude Faisabilite', {
    refresh: function(frm) {
        // === Filtres dynamiques ===
        set_filters(frm);

        // === BOUTONS DANS LE STATUT "En étude" SEULEMENT ===
        if (frm.doc.status === "En étude") {

            // === CRÉATION TRACE ===
            if (!frm.doc.trace && !frm.doc.imposition) {
                frm.add_custom_button('Tracé', async function () {
                    if (!frm.doc.client || !frm.doc.article) {
                        frappe.msgprint(__('Veuillez remplir les champs Client et Article avant de créer une Trace.'));
                        return;
                    }

                    // Désactive la sauvegarde pendant l'opération
                    frm.disable_save();
                    
                    let r = await frappe.call({
                        method: "frappe.client.insert",
                        args: {
                            doc: {
                                doctype: "Trace",
                                client: frm.doc.client,
                                article: frm.doc.article,
                                etude_faisabilite: frm.doc.name
                            }
                        },
                        freeze: true,
                        freeze_message: __("Création de la Trace en cours...")
                    });
                    
                    // Réactive la sauvegarde
                    frm.enable_save();

                    if (r.message) {
                        frm.set_value("trace", r.message.name);
                        frappe.msgprint(__('Le document Trace a été créé avec succès.'));
                        frm.save();
                    }
                }, 'Créer');
            }

            // === CRÉATION IMPOSITION ===
            if (frm.doc.trace && !frm.doc.imposition) {
                frm.add_custom_button('Imposition', function () {
                    if (!frm.doc.client || !frm.doc.article) {
                        frappe.msgprint(__('Veuillez remplir les champs Client et Article avant de créer une Imposition.'));
                        return;
                    }

                    frappe.call({
                        method: "frappe.client.insert",
                        args: {
                            doc: {
                                doctype: "Imposition",
                                client: frm.doc.client,
                                article: frm.doc.article,
                                trace: frm.doc.trace
                            }
                        },
                        callback: function (r) {
                            if (r.message) {
                                frm.set_value("imposition", r.message.name);
                                frappe.msgprint(__('Le document Imposition a été créé avec succès.'));
                                frm.save();
                            }
                        },
                        freeze: true,
                        freeze_message: __("Création de l’Imposition en cours…")
                    });
                }, 'Créer');
            }
        }

        // === NOMENCLATURE et DEVIS ===
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
        set_filters(frm);
    },

    article: function(frm) {
        set_filters(frm);
    },

    trace: function(frm) {
        set_filters(frm);
    },

    status: function(frm) {
        frm.refresh();
    }
});

// Fonction centralisée pour appliquer les filtres
function set_filters(frm) {
    // Filtrer les articles selon le client
    frm.fields_dict.article.get_query = function(doc) {
        return {
            filters: {
                'custom_client': doc.client
            }
        };
    };

    // Filtrer les traces selon l’article sélectionné
    frm.fields_dict.trace.get_query = function(doc) {
        return {
            filters: {
                article: doc.article
            }
        };
    };

    // Filtrer les impositions selon l’article et la trace sélectionnés
    frm.fields_dict.imposition.get_query = function(doc) {
        return {
            filters: {
                article: doc.article,
                trace: doc.trace
            }
        };
    };
}
