// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

/**
 * Nettoie automatiquement les lignes vides du tableau liste_articles
 * Une ligne est considérée comme vide si le champ 'article' est vide
 */
function clean_empty_rows_js(frm) {
    if (!frm.doc.liste_articles || frm.doc.liste_articles.length === 0) {
        return;
    }
    
    let has_empty_rows = false;
    let valid_rows = [];
    
    // Filtrer les lignes qui ont un article
    frm.doc.liste_articles.forEach(function(row) {
        if (row.article && row.article.trim() !== '') {
            valid_rows.push(row);
        } else {
            has_empty_rows = true;
        }
    });
    
    // Si des lignes vides ont été trouvées, nettoyer le tableau
    if (has_empty_rows) {
        frm.clear_table('liste_articles');
        valid_rows.forEach(function(row) {
            let new_row = frm.add_child('liste_articles');
            Object.assign(new_row, row);
        });
        frm.refresh_field('liste_articles');
        // Sauvegarder uniquement si le document existe déjà
        if (!frm.is_new()) {
            frm.save();
        }
    }
}

frappe.ui.form.on('Demande Faisabilite', {
    refresh: function(frm) {
        // // Masquer les champs is_reprint et essai_blanc car ils sont gérés automatiquement
        // frm.get_field('is_reprint').$wrapper.hide();
        // frm.get_field('essai_blanc').$wrapper.hide();
        
        // Nettoyer automatiquement les lignes vides du tableau
        clean_empty_rows_js(frm);
        
        // Cacher le bouton 'add row' par défaut
        frm.get_field('liste_articles').grid.wrapper.find('.grid-add-row').hide();
        load_etude_links(frm);
        frm.clear_custom_buttons(); // Clear existing buttons first
        
        // --- Bouton "Générer numéro de bon de commande" ---
        setup_bouton_generer(frm);

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
        // Vérifier que la demande est dans le statut initial "Brouillon" et que le document existe
        if (frm.doc.status === "Brouillon" && !frm.is_new()) {
            frm.add_custom_button("Confirmer", function() {
                // Validation supplémentaire côté client
                if (frm.doc.status !== "Brouillon") {
                    frappe.msgprint({
                        title: __("Erreur"),
                        message: __("Cette demande n'est plus dans le statut initial 'Brouillon' et ne peut pas être confirmée."),
                        indicator: "red"
                    });
                    return;
                }
                
                frappe.confirm(
                    "Voulez-vous vraiment confirmer cette demande et générer une Étude de Faisabilité pour chaque article ?",
                    function() {
                        frappe.call({
                            method: "aurescrm.aures_crm.doctype.demande_faisabilite.demande_faisabilite.generate_etude_faisabilite",
                            args: { docname: frm.doc.name },
                            freeze: true,
                            freeze_message: __("Génération des études en cours..."),
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
            }).addClass("btn-primary").css({"background-color": "#52b69a", "border-color": "#52b69a"});
        }

        // --- Bouton "Annuler" ---
        if (["Confirmée", "En Cours", "Partiellement Finalisée", "Finalisée"].includes(frm.doc.status)) {
            // frm.clear_custom_buttons(); // Already cleared above
            frm.add_custom_button("Annuler", function() {
                frappe.confirm(
                    "<b>Attention !</b><br><br>Cette action va :<br>• Annuler cette demande de Faisabilité<br>• <b>Supprimer toutes les études de faisabilité liées</b> (non finalisées)<br><br>Cette action est irréversible. Voulez-vous vraiment continuer ?",
                    function() {
                        frappe.call({
                            // Mise à jour du chemin
                            method: "aurescrm.aures_crm.doctype.demande_faisabilite.demande_faisabilite.cancel_etudes_faisabilite",
                            args: { docname: frm.doc.name },
                            callback: function(r) {
                                if (r.message && r.message.status === "ok") {
                                    var msg = "Demande de Faisabilité annulée.";
                                    if (r.message.deleted_count > 0) {
                                        msg += "<br>" + r.message.deleted_count + " étude(s) supprimée(s).";
                                    }
                                    if (r.message.cancelled_count > 0) {
                                        msg += "<br>" + r.message.cancelled_count + " étude(s) annulée(s).";
                                    }
                                    frappe.msgprint({
                                        title: __("Succès"),
                                        message: msg,
                                        indicator: "green"
                                    });
                                    frm.reload_doc();
                                } else if (r.message && r.message.status === "blocked") {
                                    frappe.msgprint({
                                        title: "Études bloquantes",
                                        message: "Impossible d'annuler la demande. Les études suivantes doivent être annulées ou supprimées au préalable :<br><b>• " +
                                            r.message.blocked_etudes.join("<br>• ") + "</b>",
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
            frm.add_custom_button('Devis', function() {
                frappe.confirm(
                    __("Voulez-vous créer un Devis avec les Calculs Devis associés ?"),
                    function() {
                        frappe.call({
                            method: "aurescrm.aures_crm.doctype.demande_faisabilite.demande_faisabilite.create_quotation_with_calculs",
                            args: {
                                docname: frm.doc.name
                            },
                            freeze: true,
                            freeze_message: __("Création du Devis et des Calculs Devis..."),
                            callback: function(r) {
                                if (r.message && r.message.quotation_name) {
                                    frappe.msgprint({
                                        title: __("Succès"),
                                        message: r.message.message,
                                        indicator: "green"
                                    });
                                    // Rediriger vers le Devis créé
                                    frappe.set_route("Form", "Quotation", r.message.quotation_name);
                                }
                            }
                        });
                    }
                );
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

    // Nouvelle fonction pour gérer le changement du champ type
    type: function(frm) {
        if (frm.doc.type === "Retirage") {
            frm.set_value("is_reprint", 1);
            frm.set_value("essai_blanc", 0);
        } else if (frm.doc.type === "Premier Tirage") {
            frm.set_value("is_reprint", 0);
            frm.set_value("essai_blanc", 0);
        } else if (frm.doc.type === "Essai Blanc") {
            frm.set_value("essai_blanc", 1);
            frm.set_value("is_reprint", 0);
        }
        // Mettre à jour le bouton générer quand le type change
        setup_bouton_generer(frm);
    },

    // Fonction pour gérer le changement du champ is_reprint (au cas où)
    is_reprint: function(frm) {
        if (frm.doc.is_reprint === 1 && frm.doc.type !== "Retirage") {
            frm.set_value("type", "Retirage");
        } else if (frm.doc.is_reprint === 0 && frm.doc.type !== "Premier Tirage" && frm.doc.type !== "Essai Blanc") {
            frm.set_value("type", "Premier Tirage");
        }
    },

    // Fonction pour gérer le changement du champ essai_blanc (au cas où)
    essai_blanc: function(frm) {
        if (frm.doc.essai_blanc === 1 && frm.doc.type !== "Essai Blanc") {
            frm.set_value("type", "Essai Blanc");
        } else if (frm.doc.essai_blanc === 0 && frm.doc.type === "Essai Blanc") {
            frm.set_value("type", "Premier Tirage");
        }
    },

    // Add handler for header date change to update default for prompt
    date_livraison: function(frm) {
        // This function could potentially update defaults if the prompt logic was more complex,
        // but setting 'default: frm.doc.date_livraison' in the prompt itself is usually sufficient.
        // You can add logic here if needed in the future.
    },
    
    // Handler pour vérifier les doublons de bon de commande en temps réel
    n_bon_commande: function(frm) {
        if (frm.doc.type === "Retirage" && frm.doc.n_bon_commande) {
            check_bon_commande_duplicate(frm);
        }
    },
    
    // Handler pour mettre à jour le bouton générer quand le client change
    client: function(frm) {
        setup_bouton_generer(frm);
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
                        // Ouvre le bon formulaire selon le doctype
                        var doctype = rec.doctype || 'Etude Faisabilite';
                        html += "<a href='#' onclick=\"frappe.set_route('Form','" + doctype + "','" + rec.name + "'); return false;\" style='font-size: 12px; color: inherit; text-decoration: none; word-break: break-all;'>" + rec.name + (itemName ? " - " + itemName : "") + "</a>";
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

// Fonction pour configurer le bouton de génération automatique du numéro de bon de commande
function setup_bouton_generer(frm) {
    // Vider le contenu du champ HTML bouton_generer
    var bouton_wrapper = frm.get_field('bouton_generer').$wrapper;
    bouton_wrapper.empty();
    
    // Afficher le bouton uniquement si type == "Retirage" et client est sélectionné
    if (frm.doc.type === "Retirage" && frm.doc.client) {
        var button_html = '<button id="generate-bon-commande-btn" class="btn btn-sm btn-secondary" style="margin-top: 5px;">Générer automatiquement</button>';
        bouton_wrapper.html(button_html);
        
        // Attacher l'événement click au bouton
        bouton_wrapper.find('#generate-bon-commande-btn').off('click').on('click', function() {
            generate_bon_commande_format(frm);
        });
    }
}

// Fonction pour générer le format automatique "ID Client - DD-MM-YY"
function generate_bon_commande_format(frm) {
    if (!frm.doc.client) {
        frappe.msgprint({
            title: __("Erreur"),
            message: __("Veuillez sélectionner un client avant de générer le numéro de bon de commande."),
            indicator: "red"
        });
        return;
    }
    
    // Obtenir la date du jour au format DD-MM-YY
    var today = frappe.datetime.now_date();
    var date_parts = today.split('-');
    var formatted_date = date_parts[2] + '-' + date_parts[1] + '-' + date_parts[0].substring(2);
    
    // Générer le format : ID Client - DD-MM-YY
    var bon_commande = frm.doc.client + ' - ' + formatted_date;
    
    // Mettre à jour le champ n_bon_commande
    frm.set_value('n_bon_commande', bon_commande);
    
    // Déclencher la vérification de doublon après génération
    setTimeout(function() {
        check_bon_commande_duplicate(frm);
    }, 100);
}

// Fonction pour vérifier les doublons de bon de commande en temps réel
function check_bon_commande_duplicate(frm) {
    if (!frm.doc.n_bon_commande || frm.doc.type !== "Retirage") {
        return;
    }
    
    frappe.call({
        method: "aurescrm.aures_crm.doctype.demande_faisabilite.demande_faisabilite.check_bon_commande_exists",
        args: {
            n_bon_commande: frm.doc.n_bon_commande,
            current_name: frm.doc.name || null
        },
        callback: function(r) {
            if (r.message && r.message.exists) {
                frappe.msgprint({
                    title: __("Attention"),
                    message: __("Un numéro de bon de commande client '{0}' existe déjà pour une autre demande de retirage (Demande : {1}). Veuillez utiliser un numéro différent.", [
                        frm.doc.n_bon_commande,
                        r.message.demande_name
                    ]),
                    indicator: "orange"
                });
            }
        }
    });
}
