// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt
frappe.ui.form.on('Demande Faisabilite', {
    refresh: function(frm) {
        // Charger la liste des Etude Faisabilite dans le champ "liens"
        load_etude_links(frm);
        // --- Bouton "Ajouter un article" ---
        if (!frm.get_field('html').$wrapper.find('#add-article-btn').length) {
            frm.get_field('html').$wrapper.append(
                '<button id="add-article-btn" class="btn btn-primary" style="margin-top: 10px;">Ajouter un article</button>'
            );
            frm.get_field('html').$wrapper.find('#add-article-btn').click(function() {
                frappe.prompt([
                    {
                        fieldname: 'article',
                        fieldtype: 'Link',
                        label: 'Article',
                        options: 'Item',
                        reqd: 1,
                        get_query: function() {
                            return {
                                filters: { custom_client: frm.doc.client }
                            };
                        }
                    },
                    {
                        fieldname: 'quantite',
                        fieldtype: 'Int',
                        label: 'Quantité',
                        reqd: 1
                    },
                    {
                        fieldname: 'date_livraison',
                        fieldtype: 'Date',
                        label: 'Date de livraison',
                        reqd: 1
                    },
                    {
                        fieldname: 'est_creation',
                        fieldtype: 'Check',
                        label: 'Création',
                        default: 0
                    }
                ],
                function(values) {
                    var already_exists = false;
                    frm.doc.liste_articles.forEach(function(row) {
                        if (row.article === values.article) {
                            already_exists = true;
                        }
                    });
                    if (already_exists) {
                        frappe.msgprint("Cet article existe déjà dans la liste.");
                    } else {
                        var row = frm.add_child('liste_articles');
                        row.article = values.article;
                        row.quantite = values.quantite;
                        row.date_livraison = values.date_livraison;
                        row.est_creation = values.est_creation;
                        frm.refresh_field('liste_articles');
                        frm.save()
                    }
                },
                'Ajouter un article',
                'Ajouter'
                );
            });
        }
        // --- Bouton "Confirmer" ---
        if (frm.doc.status === "Brouillon") {
            frm.clear_custom_buttons();
            frm.add_custom_button("Confirmer", function() {
                frappe.confirm(
                    "Voulez-vous vraiment confirmer cette demande et générer une Étude de Faisabilité pour chaque article ?",
                    function() {
                        frappe.call({
                            method: "aurescrm.faisabilite_hook.generate_etude_faisabilite",
                            args: { docname: frm.doc.name },
                            callback: function(r) {
                                if (r.message) {
                                    frappe.msgprint("La demande a été confirmée et les études de faisabilité générées.");
                                    frm.reload_doc();
                                }
                            }
                        });
                    },
                    function() {
                        // Rien si l'utilisateur annule
                    }
                );
            });
        }
        // --- Bouton "Annuler" ---
        if (frm.doc.status === "Partiellement Finalisée" || frm.doc.status === "Finalisée") {
            frm.clear_custom_buttons();
            frm.add_custom_button("Annuler", function() {
                frappe.confirm(
                    "Attention, cette action va annuler cette demande de Faisabilité. Voulez-vous vraiment continuer ?",
                    function() {
                        frappe.call({
                            method: "aurescrm.faisabilite_hook.cancel_etudes_faisabilite",
                            args: { docname: frm.doc.name },
                            callback: function(r) {
                                if (r.message && r.message.status === "ok") {
                                    frappe.msgprint("Demande de Faisabilité annulée.");
                                    frm.reload_doc();
                                } else if (r.message && r.message.status === "blocked") {
                                    frappe.msgprint({
                                        title: "Études bloquantes",
                                        message: "Impossible d'annuler la demande. Les études suivantes doivent être annulées ou supprimées au préalable :<br><b>• " +
                                            r.message.blocked_etudes.join(", ") + "</b>",
                                        indicator: "orange"
                                    });
                                }
                            }
                        });
                    },
                    function() {
                        // Rien si l'utilisateur annule
                    }
                );
            }).addClass("btn-danger");
        }
        if (frm.doc.status === "Finalisée") {
            frm.add_custom_button('Devis', function() {
                frappe.call({
                    method: "aurescrm.faisabilite_hook.get_articles_for_quotation",
                    args: {
                        docname: frm.doc.name
                    },
                    callback: function(r) {
                        if (r.message && r.message.length > 0) {
                            frappe.model.with_doctype("Quotation", function() {
                                let doc = frappe.model.get_new_doc("Quotation");
                                doc.quotation_to = 'Customer';
                                doc.party_name = frm.doc.client;
                                doc.custom_id_client = frm.doc.client;
                                doc.company = frappe.defaults.get_default("company");
                                doc.custom_demande_faisabilité = frm.doc.name;
        
                                r.message.forEach(row => {
                                    let item = frappe.model.add_child(doc, "Quotation Item", "items");
                                    item.item_code = row.article;
                                    item.item_name = row.item_name;
                                    item.uom = row.uom;
                                    item.qty = row.quantite;
                                });
        
                                frappe.set_route("Form", "Quotation", doc.name);
                            });
                        } else {
                            frappe.msgprint("Aucun article réalisable trouvé dans les études associées.");
                        }
                    }
                });
            }, "Créer");
        }        
    }
});

/**
 * Extraction du message d'erreur à partir de la réponse d'erreur
 * @param {Object} err - L'objet d'erreur retourné par Frappe
 * @returns {string} - Le message d'erreur extrait
 */
function getErrorMessage(err) {
    if (err && err.exc) {
        var exceptionMessage = err.exc.split('\n').pop().trim();
        return exceptionMessage;
    }
    if (err && err.message) {
        if (typeof err.message === 'string') {
            return err.message;
        } else if (typeof err.message === 'object') {
            try {
                var errorMessage = JSON.parse(err.message);
                if (errorMessage && errorMessage.message) {
                    return errorMessage.message;
                }
            } catch (e) {
                console.error("Erreur lors de la relecture du message d'erreur:", e);
            }
        }
    }
    return "Une erreur est survenue lors de l'opération.";
}

function load_etude_links(frm) {
    frappe.db.get_list("Etude Faisabilite", {
        filters: { demande_faisabilite: frm.doc.name },
        fields: ["name", "status"],
        limit_page_length: 100
    }).then(function(records) {
        var html = "";
        if (records && records.length > 0) {
            html += "<div>";
            html += '<h3 style="font-size: 12px; font-weight: bold; margin-bottom: 12px;">Liste Études de Faisabilité</h3>';
            records.forEach(function(rec) {
                var badge = get_status_badge(rec.status);
                html += "<div style='margin-bottom: 5px;'>";
                html += badge + " " + "<a href='#' onclick=\"frappe.set_route('Form','Etude Faisabilite','" + rec.name + "'); return false;\" style='font-weight: bold; font-size: 11px; text-decoration: none; color: inherit;'>" + rec.name + "</a>";
                html += "</div>";
            });
            html += "</div>";
        } else {
            html = "<p>Aucune étude de faisabilité liée.</p>";
        }
        frm.get_field("liens").$wrapper.html(html);
    });
}

function get_status_badge(status) {
    var config = {
        "Nouveau": { color: "#118ab2" },
        "En étude": { color: "#f4a261" },
        "Réalisable": { color: "#2a9d8f" },
        "Non Réalisable": { color: "#e63946" },
        "Programmée": { color: "#118ab2" }
    };
    var clr = config[status] ? config[status].color : "#999999";
    return "<span style='background-color: " + clr + "; font-size: 11px; color: #fff; border-radius: 4px; padding: 2px 4px; margin-right: 4px;'>" +
           status + "</span>";
}
