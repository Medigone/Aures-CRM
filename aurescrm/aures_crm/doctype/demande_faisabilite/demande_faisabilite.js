// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt
frappe.ui.form.on('Demande Faisabilite', {
    refresh: function(frm) {
        load_etude_links(frm);
        frm.clear_custom_buttons(); // Clear existing buttons first

        // --- Bouton "Ajouter un article" ---
        // (Keep existing logic for adding the button)
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
                        label: 'Date de livraison souhaitée',
                        reqd: 1,
                        // Set default value from header field
                        default: frm.doc.date_livraison
                    },
                    {
                        fieldname: 'est_creation',
                        fieldtype: 'Check',
                        label: 'Est une nouvelle création',
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
                        frm.save();
                    }
                },
                'Ajouter un article',
                'Ajouter'
                );
            });
        }

        // --- Bouton "Confirmer" ---
        if (frm.doc.status === "Brouillon") {
            // frm.clear_custom_buttons(); // Already cleared above
            frm.add_custom_button("Confirmer", function() {
                frappe.confirm(
                    "Voulez-vous vraiment confirmer cette demande et générer une Étude de Faisabilité pour chaque article ?",
                    function() {
                        frappe.call({
                            method: "aurescrm.aures_crm.doctype.demande_faisabilite.demande_faisabilite.generate_etude_faisabilite",
                            args: { docname: frm.doc.name },
                            callback: function(r) {
                                if (r.message) {
                                    frappe.msgprint("La demande a été confirmée et les études de faisabilité générées.");
                                    frm.reload_doc();
                                }
                            },
                            error: function(r) {
                                frappe.msgprint({
                                    title: __("Erreur"),
                                    message: __("Une erreur est survenue lors de la génération des études de faisabilité."),
                                    indicator: "red"
                                });
                                console.error("Erreur generate_etude_faisabilite:", r);
                            }
                        });
                    }
                );
            });
        }

        // --- Bouton "Annuler" ---
        if (frm.doc.status === "Partiellement Finalisée" || frm.doc.status === "Finalisée") {
            // frm.clear_custom_buttons(); // Already cleared above
            frm.add_custom_button("Annuler", function() {
                frappe.confirm(
                    "Attention, cette action va annuler cette demande de Faisabilité. Voulez-vous vraiment continuer ?",
                    function() {
                        frappe.call({
                            // Mise à jour du chemin
                            method: "aurescrm.aures_crm.doctype.demande_faisabilite.demande_faisabilite.cancel_etudes_faisabilite",
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
                    }
                );
            }).addClass("btn-danger");
        }

        // --- Bouton "Devis" ---
        if (frm.doc.status === "Finalisée" || frm.doc.status === "Devis Établis" || frm.doc.status === "Partiellement Finalisée") {
            // frm.clear_custom_buttons(); // Already cleared above
            frm.add_custom_button('Devis', function() {
                frappe.call({
                    // Mise à jour du chemin
                    method: "aurescrm.aures_crm.doctype.demande_faisabilite.demande_faisabilite.get_articles_for_quotation",
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
                                doc.custom_retirage = frm.doc.is_reprint;

                                // Set the custom delivery date from the first feasible item
                                // Ensure the field name 'custom_date_de_livraison' matches your Quotation field
                                if (r.message[0].date_livraison) {
                                    doc.custom_date_de_livraison = r.message[0].date_livraison;
                                }

                                r.message.forEach(row => {
                                    let item = frappe.model.add_child(doc, "Quotation Item", "items");
                                    item.item_code = row.article;
                                    item.item_name = row.item_name;
                                    item.uom = row.uom;
                                    item.qty = row.quantite;
                                    // Note: We are setting one delivery date at the header level of the Quotation.
                                    // If you need different dates per item in the Quotation,
                                    // you'd need a custom date field in 'Quotation Item' and set item.custom_item_delivery_date = row.date_livraison;
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

        // --- NOUVEAU : Bouton "Retirage" ---
        // Ajout du console.log pour déboguer
        console.log("Statut actuel pour bouton Retirage:", frm.doc.status);
        if (frm.doc.status === "Commandé") {
            // frm.clear_custom_buttons(); // Already cleared above
            frm.add_custom_button("Retirage", function() {
                frappe.confirm(
                    "Voulez-vous vraiment créer un retirage pour cette demande ? Une nouvelle demande sera créée.",
                    function() {
                        // Prompt for the new delivery date
                        frappe.prompt([
                            {
                                fieldname: 'new_date_livraison',
                                fieldtype: 'Date',
                                label: 'Nouvelle date de livraison souhaitée',
                                reqd: 1,
                                default: frappe.datetime.add_days(frappe.datetime.now_date(), 7) // Default to 7 days from now
                            }
                        ],
                        function(values) {
                            // Call the server-side function to duplicate
                            frappe.call({
                                // Mise à jour du chemin
                                method: "aurescrm.aures_crm.doctype.demande_faisabilite.demande_faisabilite.duplicate_demande_for_reprint", // Assurez-vous que ce chemin est correct
                                args: {
                                    docname: frm.doc.name,
                                    new_date_livraison: values.new_date_livraison
                                },
                                callback: function(r) {
                                    if (r.message && r.message.new_docname) {
                                        frappe.msgprint({
                                            title: __("Succès"),
                                            message: __("La demande de retirage {0} a été créée.", [r.message.new_docname]),
                                            indicator: "green"
                                        });
                                        frappe.set_route("Form", "Demande Faisabilite", r.message.new_docname);
                                    } else {
                                         frappe.msgprint({
                                            title: __("Erreur"),
                                            message: __("La création du retirage a échoué. Détails : {0}", [r.message || "Erreur inconnue"]),
                                            indicator: "red"
                                        });
                                    }
                                },
                                error: function(r) {
                                     frappe.msgprint({
                                        title: __("Erreur Serveur"),
                                        message: __("Une erreur s'est produite lors de la communication avec le serveur."),
                                        indicator: "red"
                                    });
                                }
                            });
                        },
                        'Date de livraison pour le retirage', // Prompt title
                        'Créer Retirage' // Button label
                        );
                    }
                );
            }).addClass("btn-secondary"); // Use a different style if needed
        }

        // --- NOUVEAU : Bouton "Fermer" ---
        if (["Finalisée", "Devis Établis"].includes(frm.doc.status)) {
            frm.add_custom_button("Fermer", function() {
                frappe.confirm(
                    "Voulez-vous vraiment fermer cette demande de faisabilité ? Les préparateurs de devis ne pourront plus la traiter.",
                    function() {
                        frappe.call({
                            method: "frappe.client.set_value",
                            args: {
                                doctype: "Demande Faisabilite",
                                name: frm.doc.name,
                                fieldname: "status",
                                value: "Fermée"
                            },
                            callback: function(r) {
                                if (r.message) {
                                    frappe.msgprint({
                                        title: __("Succès"),
                                        message: __("La demande a été fermée."),
                                        indicator: "green"
                                    });
                                    frm.reload_doc();
                                }
                            }
                        });
                    }
                );
            }).addClass("btn-warning");
        }

    }, // End of refresh function

    // Add handler for header date change to update default for prompt
    date_livraison: function(frm) {
        // This function could potentially update defaults if the prompt logic was more complex,
        // but setting 'default: frm.doc.date_livraison' in the prompt itself is usually sufficient.
        // You can add logic here if needed in the future.
    }
});

function load_etude_links(frm) {
    // Remove the separate frappe.db.get_list call for Etudes

    // Call a single backend function that returns both Etudes and Sales Documents
    frappe.call({
        // IMPORTANT: Ensure this method name points to your *updated* backend function
        // that returns both etudes and sales_documents.
        // Mise à jour du chemin
        method: "aurescrm.aures_crm.doctype.demande_faisabilite.demande_faisabilite.get_linked_documents_for_demande", // Example updated method name
        args: {
            demande_name: frm.doc.name
        },
        callback: function(res) {
            // Expecting response like: { etudes: [...], sales_documents: [...] }
            if (res.message) {
                var etudes = res.message.etudes || [];
                var sales_documents = res.message.sales_documents || [];

                // --- Start generating HTML ---
                var html = "<div style='display: flex; flex-direction: column; gap: 20px; padding-bottom: 10px; min-width: 280px;'>";
                html += "<style>@media (min-width: 768px) { .df-container { flex-direction: row !important; } }</style>";
                html += "<div class='df-container' style='display: flex; flex-direction: column; gap: 20px; align-items: stretch;'>";

                // --- Études section ---
                // (HTML generation logic for etudes remains the same, using the 'etudes' variable)
                html += "<div style='flex: 1; min-width: 280px; display: flex; flex-direction: column;'>";
                html += "<div style='border: 0.5px solid #d1d8dd; border-radius: 8px; height: 100%; display: flex; flex-direction: column; overflow: hidden;'>";
                html += '<div style="padding: 10px 20px; border-bottom: 0.5px solid #d1d8dd; background-color: #f8f9fa;">' +
                        '<div style="display: flex; align-items: center;">' +
                        '<span style="font-size: 14px; font-weight: 600; color: #1a1a1a;">Liste Études de Faisabilité</span>' +
                        '<span style="margin-left: 8px; background: rgba(74, 144, 226, 0.1); padding: 2px 8px; border-radius: 12px; font-size: 11px; color: #4a90e2;">' +
                        etudes.length + ' étude' + (etudes.length > 1 ? 's' : '') + '</span></div>' +
                        '</div>';
                html += "<div style='padding: 20px; background-color: #ffffff; flex-grow: 1;'>";
                if (etudes.length > 0) {
                    etudes.forEach(function(rec) {
                        var badge = get_status_badge(rec.status);
                        html += "<div style='margin-bottom: 5px; display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 8px;'>";
                        html += "<span style='margin-right: 4px;'>•</span>";
                        html += "<div style='display: flex; flex-direction: column;'>";
                        html += "<div style='display: flex; align-items: baseline; gap: 8px;'>";
                        var itemName = rec.item_name || rec.article_name || (rec.article && rec.article.item_name) || ''; // Use a default value if item_name is missing
                        html += "<a href='#' onclick=\"frappe.set_route('Form','Etude Faisabilite','" + rec.name + "'); return false;\" style='font-size: 12px; color: inherit; text-decoration: none; word-break: break-all;'>" + rec.name + (itemName ? " - " + itemName : "") + "</a>";
                        html += "<span>" + badge + "</span>";
                        html += "</div>";
                        html += "</div>";
                        html += "</div>";
                    });
                } else {
                    html += "<p style='font-size: 11px;'>Aucune étude de faisabilité liée.</p>";
                }
                html += "</div></div></div>"; // Close content, card container, and flex item

                // --- Sales Documents Section ---
                // (HTML generation logic for sales_documents remains the same, using the 'sales_documents' variable)
                html += "<div style='flex: 1; min-width: 280px; display: flex; flex-direction: column;'>";
                html += "<div style='border: 0.5px solid #d1d8dd; border-radius: 8px; height: 100%; display: flex; flex-direction: column; overflow: hidden;'>";
                html += '<div style="padding: 10px 20px; border-bottom: 0.5px solid #d1d8dd; background-color: #f8f9fa;">' +
                        '<div style="display: flex; align-items: center;">' +
                        '<span style="font-size: 14px; font-weight: 600; color: #1a1a1a;">Documents de vente</span></div></div>';
                html += "<div style='padding: 20px; background-color: #ffffff; flex-grow: 1;'>";
                if (sales_documents.length > 0) {
                    sales_documents.forEach(function(doc) {
                        var badge = get_status_badge(doc.status);
                        var doc_type_label = "";
                        if (doc.doctype === "Quotation") {
                            doc_type_label = "Devis : ";
                        } else if (doc.doctype === "Sales Order") {
                            doc_type_label = "Commande : ";
                        }
                        html += "<div style='margin-bottom: 10px; display: flex; align-items: flex-start;'>";
                        html += "<span style='margin-right: 8px; line-height: 1.5;'>•</span>";
                        html += "<div style='display: flex; flex-direction: column; align-items: flex-start;'>";
                        html += "<strong style='font-size: 12px; color: #333;'>" + doc_type_label + "</strong>";
                        html += "<div style='display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 8px; margin-top: 2px;'>";
                        html += "<a href='#' onclick=\"frappe.set_route('Form','" + doc.doctype + "','" + doc.name + "'); return false;\" style='font-size: 12px; color: inherit; text-decoration: none; word-break: break-all;'>" + doc.name + "</a>";
                        html += "<span>" + badge + "</span>";
                        html += "</div>"; // Close inner flex div (ID and badge)
                        html += "</div>"; // Close inner div (vertical layout)
                        html += "</div>"; // Close outer flex div (bullet and content)
                    });
                } else {
                    html += "<p style='font-size: 11px;'>Aucun document de vente lié.</p>";
                }
                html += "</div></div></div>"; // Close content, card container, and flex item

                html += "</div>"; // Close df-container
                html += "</div>"; // Close outer div

                frm.get_field("liens").$wrapper.html(html);
            } else {
                // Handle potential error case where res.message is empty or undefined
                frm.get_field("liens").$wrapper.html("<p style='font-size: 11px; padding: 20px;'>Erreur lors du chargement des liens.</p>");
            }
        }
    });
    // Removed the .then() part from the original get_list call
}

// --- get_status_badge function (remains unchanged) ---
function get_status_badge(status) {
    // Mapping des traductions pour les statuts (Add Sales Order specific ones if necessary)
    const statusTranslations = {
        "Draft": "Brouillon",
        "Submitted": "Soumis",
        "Cancelled": "Annulé",
        "Open": "Ouvert", // Quotation
        "Lost": "Perdu", // Quotation
        "Ordered": "Commandé", // Quotation
        // Add Sales Order specific statuses if they differ and need translation
        "To Deliver and Bill": "À livrer et facturer",
        "To Bill": "À facturer",
        "To Deliver": "À livrer",
        "Completed": "Terminé",
        "Closed": "Fermé",
        "On Hold": "En attente"
    };

    var config = {
        // Études
        "Nouveau": { color: "rgba(17, 138, 178, 0.1)", textColor: "#118ab2" },
        "En étude": { color: "rgba(244, 162, 97, 0.1)", textColor: "#f4a261" },
        "Réalisable": { color: "rgba(42, 157, 143, 0.1)", textColor: "#2a9d8f" },
        "Non Réalisable": { color: "rgba(230, 57, 70, 0.1)", textColor: "#e63946" },
        "Programmée": { color: "rgba(17, 138, 178, 0.1)", textColor: "#118ab2" },
        // Devis & Commandes (Shared statuses)
        "Brouillon": { color: "rgba(108, 117, 125, 0.1)", textColor: "#6c757d" }, // Grey for Draft
        "Soumis": { color: "rgba(0, 123, 255, 0.1)", textColor: "#007bff" }, // Blue for Submitted/Open/Active states
        "Annulé": { color: "rgba(230, 57, 70, 0.1)", textColor: "#e63946" }, // Red for Cancelled
        "Commandé": { color: "rgba(40, 167, 69, 0.1)", textColor: "#28a745" }, // Green for Ordered/Completed
        "Terminé": { color: "rgba(40, 167, 69, 0.1)", textColor: "#28a745" }, // Green
        "Fermé": { color: "rgba(40, 167, 69, 0.1)", textColor: "#28a745" }, // Green
        // Specific statuses
        "Ouvert": { color: "rgba(0, 123, 255, 0.1)", textColor: "#007bff" }, // Blue
        "Perdu": { color: "rgba(231, 111, 81, 0.1)", textColor: "#e76f51" }, // Orange/Red for Lost
        // Changed textColor for better readability on yellow background
        "À livrer et facturer": { color: "rgba(255, 193, 7, 0.1)", textColor: "#856404" }, // Darker text
        "À facturer": { color: "rgba(255, 193, 7, 0.1)", textColor: "#856404" }, // Darker text
        "À livrer": { color: "rgba(255, 193, 7, 0.1)", textColor: "#856404" }, // Darker text
        "En attente": { color: "rgba(108, 117, 125, 0.1)", textColor: "#6c757d" } // Grey for On Hold
    };

    // Traduire le statut si une traduction existe, sinon utiliser le statut brut
    const displayStatus = statusTranslations[status] || status;
    // Utiliser le statut traduit (ou brut si pas de traduction) pour chercher la config de couleur
    var style = config[displayStatus] || { color: "rgba(102, 102, 102, 0.1)", textColor: "#666" }; // Default grey

    return "<span style='background-color: " + style.color + "; font-size: 11px; color: " + style.textColor + "; border-radius: 4px; padding: 2px 4px; margin-right: 4px;'>" +
           displayStatus + "</span>";
}
