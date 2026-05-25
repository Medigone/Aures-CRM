// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

// Style cartes / liens : tokens alignés sur Dossier Essai Blanc (Desk, esprit Frappe UI).

const DEB = {
    radius: "8px",
    border: "1px solid #e2e8f0",
    shadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
    headerBg: "#f8fafc",
    headerBorder: "#e2e8f0",
    divider: "#f1f5f9",
    text: "#334155",
    textMuted: "#64748b",
    textTitle: "#0f172a",
    link: "#2490ef",
    gapSection: "16px",
    gapBlock: "12px",
};

function escape_html(value) {
    return frappe.utils.escape_html(value || "");
}

function deb_inject_layout_styles() {
    return (
        "<style>" +
        ".deb-df-container{display:flex;flex-direction:column;gap:" +
        DEB.gapSection +
        ";align-items:stretch}" +
        "@media (min-width:768px){.deb-df-container{flex-direction:row!important}}" +
        ".deb-list-line{padding:8px 0;display:flex;align-items:baseline;flex-wrap:wrap;gap:6px 10px}" +
        "</style>"
    );
}

function deb_section_root_open() {
    return (
        "<div style=\"display:flex;flex-direction:column;gap:" +
        DEB.gapSection +
        ";padding-bottom:8px;min-width:280px;\">"
    );
}

function deb_card_shell_open() {
    return (
        "<div style=\"border:" +
        DEB.border +
        ";border-radius:" +
        DEB.radius +
        ";box-shadow:" +
        DEB.shadow +
        ";display:flex;flex-direction:column;overflow:hidden;background:#fff;\">"
    );
}

function deb_card_header(title_translated, count_label) {
    let right = "";
    if (count_label != null && count_label !== "") {
        right = deb_count_pill(count_label);
    }
    return (
        "<div style=\"padding:12px 16px;border-bottom:1px solid " +
        DEB.headerBorder +
        ";background:" +
        DEB.headerBg +
        ";\">" +
        "<div style=\"display:flex;align-items:center;flex-wrap:wrap;gap:8px;\">" +
        "<span style=\"font-size:13px;font-weight:600;color:" +
        DEB.textTitle +
        ";letter-spacing:0.01em;\">" +
        title_translated +
        "</span>" +
        right +
        "</div></div>"
    );
}

function deb_count_pill(label) {
    return (
        "<span style=\"display:inline-flex;align-items:center;padding:3px 10px;border-radius:9999px;" +
        "font-size:11px;font-weight:600;line-height:1.35;background:rgba(36,144,239,0.12);color:#0369a1;\">" +
        escape_html(label) +
        "</span>"
    );
}

function deb_card_body_open(grow) {
    return "<div style=\"padding:16px;background:#fff;" + (grow ? "flex-grow:1;" : "") + "\">";
}

function deb_doc_link_anchor(doctype, name, label_html) {
    const on =
        "frappe.set_route('Form','" +
        escape_html(doctype) +
        "','" +
        escape_html(name) +
        "'); return false;";
    return (
        "<a href=\"#\" onclick=\"" +
        on +
        "\" style=\"font-size:12px;font-weight:500;color:" +
        DEB.link +
        ";text-decoration:none;word-break:break-word;\">" +
        label_html +
        "</a>"
    );
}

/** Badges statuts (études, devis, commandes) — pilules, aligné Dossier Essai Blanc. */
function get_status_badge(status) {
    const statusTranslations = {
        Draft: "Brouillon",
        Submitted: "Soumis",
        Cancelled: "Annulé",
        Open: "Ouvert",
        Lost: "Perdu",
        Ordered: "Commandé",
        "To Deliver and Bill": "À livrer et facturer",
        "To Bill": "À facturer",
        "To Deliver": "À livrer",
        Completed: "Terminé",
        Closed: "Fermé",
        "On Hold": "En attente",
    };

    const config = {
        Nouveau: { color: "rgba(17, 138, 178, 0.12)", textColor: "#0e7490" },
        Confirmée: { color: "rgba(59, 130, 246, 0.12)", textColor: "#1d4ed8" },
        "En étude": { color: "rgba(244, 162, 97, 0.15)", textColor: "#c2410c" },
        "Étude partiellement finalisée": { color: "rgba(255, 159, 28, 0.15)", textColor: "#b45309" },
        "Étude finalisée": { color: "rgba(131, 56, 236, 0.12)", textColor: "#6d28d9" },
        "En Cours": { color: "rgba(244, 162, 97, 0.15)", textColor: "#c2410c" },
        Réalisable: { color: "rgba(42, 157, 143, 0.15)", textColor: "#0f766e" },
        "Non Réalisable": { color: "rgba(230, 57, 70, 0.12)", textColor: "#b91c1c" },
        Programmée: { color: "rgba(17, 138, 178, 0.12)", textColor: "#0e7490" },
        Brouillon: { color: "rgba(100, 116, 139, 0.12)", textColor: "#475569" },
        Soumis: { color: "rgba(37, 99, 235, 0.12)", textColor: "#1d4ed8" },
        Annulé: { color: "rgba(230, 57, 70, 0.12)", textColor: "#b91c1c" },
        Commandé: { color: "rgba(22, 163, 74, 0.12)", textColor: "#15803d" },
        Terminé: { color: "rgba(22, 163, 74, 0.12)", textColor: "#15803d" },
        Fermé: { color: "rgba(22, 163, 74, 0.12)", textColor: "#15803d" },
        Ouvert: { color: "rgba(37, 99, 235, 0.12)", textColor: "#1d4ed8" },
        Perdu: { color: "rgba(231, 111, 81, 0.12)", textColor: "#c2410c" },
        "À livrer et facturer": { color: "rgba(234, 179, 8, 0.2)", textColor: "#a16207" },
        "À facturer": { color: "rgba(234, 179, 8, 0.2)", textColor: "#a16207" },
        "À livrer": { color: "rgba(234, 179, 8, 0.2)", textColor: "#a16207" },
        "En attente": { color: "rgba(100, 116, 139, 0.12)", textColor: "#475569" },
        "Devis établi": { color: "rgba(42, 157, 143, 0.15)", textColor: "#0f766e" },
        "Validé client": { color: "rgba(22, 163, 74, 0.12)", textColor: "#15803d" },
        "Refusé client": { color: "rgba(230, 57, 70, 0.12)", textColor: "#b91c1c" },
        "Non réalisable": { color: "rgba(230, 57, 70, 0.12)", textColor: "#b91c1c" },
    };

    const displayStatus = statusTranslations[status] || status;
    const style = config[displayStatus] || { color: "rgba(100, 116, 139, 0.12)", textColor: "#475569" };

    return (
        "<span style=\"display:inline-flex;align-items:center;background-color:" +
        style.color +
        ";font-size:11px;font-weight:600;color:" +
        style.textColor +
        ";border-radius:9999px;padding:3px 10px;line-height:1.35;white-space:nowrap;max-width:100%;\">" +
        escape_html(displayStatus) +
        "</span>"
    );
}

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

function normalize_qty(value) {
    return Number(value || 0);
}

function has_article_qty_duplicate(rows, article, quantite) {
    const target_qty = normalize_qty(quantite);
    return (rows || []).some(function(row) {
        return row.article === article && normalize_qty(row.quantite) === target_qty;
    });
}

function find_duplicate_article_qty(rows) {
    const seen = new Set();
    for (const row of rows || []) {
        if (!row.article) {
            continue;
        }
        const key = `${row.article}::${normalize_qty(row.quantite)}`;
        if (seen.has(key)) {
            return { article: row.article, quantite: normalize_qty(row.quantite) };
        }
        seen.add(key);
    }
    return null;
}

/** Item éligibles dans liste_articles : article parent seulement (pas les sous-articles d'un article composé). */
function get_liste_articles_item_query(frm) {
    const filters = {
        custom_sous_article: 0,
        custom_article_parent: ["is", "not set"],
    };
    if (frm.doc.client) {
        filters.custom_client = frm.doc.client;
    }
    if (frm._expected_procede) {
        filters.custom_procédé = frm._expected_procede;
    }
    return { filters };
}

function load_expected_procede(frm, callback) {
    if (!frm.doc.ticket_commercial) {
        frm._expected_procede = null;
        update_procede_ui(frm);
        if (callback) {
            callback();
        }
        return;
    }

    frappe.call({
        method:
            "aurescrm.aures_crm.doctype.demande_faisabilite.demande_faisabilite.get_expected_procede_from_ticket",
        args: { ticket_name: frm.doc.ticket_commercial },
        callback: function(r) {
            frm._expected_procede = r.message || null;
            update_procede_ui(frm);
            if (callback) {
                callback();
            }
        },
    });
}

function update_procede_ui(frm) {
    const html_field = frm.get_field("html");
    if (!html_field || !html_field.$wrapper) {
        return;
    }

    const $wrapper = html_field.$wrapper;
    let $info = $wrapper.find("#expected-procede-info");
    if (!$info.length) {
        $wrapper.prepend(
            '<p id="expected-procede-info" class="text-muted small" style="margin-bottom:8px;"></p>'
        );
        $info = $wrapper.find("#expected-procede-info");
    }

    const $btn = $wrapper.find("#add-article-btn");
    if (frm.doc.ticket_commercial) {
        if (frm._expected_procede) {
            $info.text(__("Procédé attendu : {0}", [frm._expected_procede]));
            $btn.prop("disabled", false);
        } else {
            $info.text(
                __("Impossible de déterminer le procédé attendu (ticket sans site valide).")
            );
            $btn.prop("disabled", true);
        }
    } else {
        $info.text(
            __(
                "Sans ticket lié : tous les articles doivent être du même procédé (Flexo ou Offset)."
            )
        );
        $btn.prop("disabled", false);
    }
}

function validate_article_procede_for_demande(frm, item_procede, article_code) {
    const procede = (item_procede || "").trim();
    if (!procede) {
        frappe.msgprint(
            __("L'article {0} n'a pas de procédé renseigné (custom_procédé).", [article_code])
        );
        return false;
    }

    if (frm._expected_procede && procede !== frm._expected_procede) {
        frappe.msgprint(
            __(
                "L'article {0} est en {1} ; seuls les articles {2} sont autorisés pour ce ticket.",
                [article_code, procede, frm._expected_procede]
            )
        );
        return false;
    }

    return true;
}

function validate_homogeneous_procede_on_client(frm) {
    if (frm.doc.ticket_commercial || !frm.doc.liste_articles || !frm.doc.liste_articles.length) {
        return true;
    }

    const procedes = new Set();
    for (const row of frm.doc.liste_articles) {
        if (!row.article) {
            continue;
        }
        const procede = (row.procede_article || "").trim();
        if (!procede) {
            frappe.msgprint(
                __("L'article {0} n'a pas de procédé renseigné (custom_procédé).", [row.article])
            );
            return false;
        }
        procedes.add(procede);
    }

    if (procedes.size > 1) {
        frappe.msgprint(
            __("Tous les articles d'une demande doivent être du même procédé (Flexo ou Offset).")
        );
        return false;
    }

    return true;
}

frappe.ui.form.on("Articles Demande Faisabilite", {
    article(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        if (!row.article) {
            frappe.model.set_value(cdt, cdn, "designation_article", "");
            return;
        }
        frappe.db.get_value("Item", row.article, "item_name", (message) => {
            if (message && message.item_name) {
                frappe.model.set_value(cdt, cdn, "designation_article", message.item_name || "");
            }
        });
    },
});

frappe.ui.form.on('Demande Faisabilite', {
    refresh: function(frm) {
        load_expected_procede(frm);

        // Filtrer les sous-articles dans la table enfant liste_articles
        frm.set_query("article", "liste_articles", function() {
            return get_liste_articles_item_query(frm);
        });

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
                '<button id="add-article-btn" type="button" class="btn btn-primary btn-sm" style="margin-top:10px;">' +
                    __("Ajouter un article") +
                    "</button>"
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
                            return get_liste_articles_item_query(frm);
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
                    },
                    {
                        fieldname: 'essai_blanc',
                        fieldtype: 'Check',
                        label: 'Essai Blanc',
                        default: frm.doc.type === "Essai Blanc" ? 1 : 0
                    }
                ],
                function(values) {
                    var already_exists = has_article_qty_duplicate(
                        frm.doc.liste_articles,
                        values.article,
                        values.quantite
                    );
                    if (already_exists) {
                        frappe.msgprint("Cet article existe déjà avec la même quantité.");
                    } else {
                        frappe.db.get_value(
                            "Item",
                            values.article,
                            [
                                "item_name",
                                "custom_sous_article",
                                "custom_article_parent",
                                "custom_procédé",
                            ],
                            function(message) {
                                if (
                                    cint(message && message.custom_sous_article) ||
                                    (message && message.custom_article_parent)
                                ) {
                                    frappe.msgprint(
                                        __("Sélectionnez l'article parent (article composé), pas un sous-article.")
                                    );
                                    return;
                                }
                                if (
                                    !validate_article_procede_for_demande(
                                        frm,
                                        message && message.custom_procédé,
                                        values.article
                                    )
                                ) {
                                    return;
                                }
                                var row = frm.add_child('liste_articles');
                                row.article = values.article;
                                row.designation_article = (message && message.item_name) ? message.item_name : "";
                                row.quantite = values.quantite;
                                row.date_livraison = values.date_livraison;
                                row.est_creation = values.est_creation;
                                row.essai_blanc = values.essai_blanc;
                                frm.refresh_field('liste_articles');
                                frm.save();
                            }
                        );
                    }
                },
                'Ajouter un article',
                'Ajouter'
                );
            });
        }

        update_procede_ui(frm);

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
            }).removeClass("btn-default").addClass("btn-primary");
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

        // --- Bouton "Retirage" ---
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
            if (frm.doc.liste_articles && frm.doc.liste_articles.length) {
                frm.doc.liste_articles.forEach(function(row) {
                    row.essai_blanc = 1;
                });
                frm.refresh_field('liste_articles');
            }
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
    },

    ticket_commercial: function(frm) {
        load_expected_procede(frm);
    },

    validate: function(frm) {
        const duplicate = find_duplicate_article_qty(frm.doc.liste_articles);
        if (duplicate) {
            frappe.msgprint(
                __("Doublon détecté : l'article {0} existe déjà avec la même quantité ({1}).", [
                    duplicate.article,
                    duplicate.quantite
                ])
            );
            frappe.validated = false;
            return;
        }

        if (frm._expected_procede && frm.doc.liste_articles) {
            for (const row of frm.doc.liste_articles) {
                if (!row.article) {
                    continue;
                }
                const procede = (row.procede_article || "").trim();
                if (procede && procede !== frm._expected_procede) {
                    frappe.msgprint(
                        __(
                            "L'article {0} est en {1} ; seuls les articles {2} sont autorisés pour ce ticket.",
                            [row.article, procede, frm._expected_procede]
                        )
                    );
                    frappe.validated = false;
                    return;
                }
            }
        }

        if (!validate_homogeneous_procede_on_client(frm)) {
            frappe.validated = false;
        }
    }
});

function load_etude_links(frm) {
    frappe.call({
        method: "aurescrm.aures_crm.doctype.demande_faisabilite.demande_faisabilite.get_linked_documents_for_demande",
        args: {
            demande_name: frm.doc.name,
        },
        callback: function(res) {
            if (!res.message) {
                frm.get_field("liens").$wrapper.html(
                    "<p class=\"text-muted small\" style=\"padding:16px;margin:0;\">" +
                        __("Erreur lors du chargement des liens.") +
                        "</p>"
                );
                return;
            }
            const etudes = res.message.etudes || [];
            const sales_documents = res.message.sales_documents || [];
            const etudeCountLabel =
                etudes.length + " " + (etudes.length > 1 ? __("études") : __("étude"));
            const salesCountLabel =
                sales_documents.length +
                " " +
                (sales_documents.length > 1 ? __("documents") : __("document"));

            let html = deb_inject_layout_styles();
            html += deb_section_root_open();
            html += "<div class=\"deb-df-container\">";

            html += "<div style=\"flex:1;min-width:280px;display:flex;flex-direction:column;\">";
            html += deb_card_shell_open();
            html += deb_card_header(__("Liste Études de Faisabilité"), etudeCountLabel);
            html += deb_card_body_open(true);
            if (etudes.length) {
                etudes.forEach(function(rec) {
                    const badge = get_status_badge(rec.status);
                    const itemName =
                        rec.item_name || rec.article_name || (rec.article && rec.article.item_name) || "";
                    const doctype = rec.doctype || "Etude Faisabilite";
                    const linkLabel =
                        escape_html(rec.name) + (itemName ? " — " + escape_html(itemName) : "");
                    html += "<div class=\"deb-list-line\">";
                    html += deb_doc_link_anchor(doctype, rec.name, linkLabel);
                    html += "<span>" + badge + "</span>";
                    html += "</div>";
                });
            } else {
                html += "<p class=\"text-muted small\" style=\"margin:0;\">" + __("Aucune étude de faisabilité liée.") + "</p>";
            }
            html += "</div></div></div>";

            html += "<div style=\"flex:1;min-width:280px;display:flex;flex-direction:column;\">";
            html += deb_card_shell_open();
            html += deb_card_header(__("Documents de vente"), salesCountLabel);
            html += deb_card_body_open(true);
            if (sales_documents.length) {
                sales_documents.forEach(function(doc) {
                    const badge = get_status_badge(doc.status);
                    let doc_type_label = "";
                    if (doc.doctype === "Quotation") {
                        doc_type_label = __("Devis : ");
                    } else if (doc.doctype === "Sales Order") {
                        doc_type_label = __("Commande : ");
                    }
                    html += "<div class=\"deb-list-line\" style=\"flex-direction:column;align-items:flex-start;\">";
                    html +=
                        "<span style=\"font-size:11px;font-weight:600;color:" +
                        DEB.textMuted +
                        ";text-transform:uppercase;letter-spacing:0.04em;\">" +
                        escape_html(doc_type_label) +
                        "</span>";
                    html += "<div style=\"display:flex;align-items:baseline;flex-wrap:wrap;gap:6px 10px;\">";
                    html += deb_doc_link_anchor(doc.doctype, doc.name, escape_html(doc.name));
                    html += "<span>" + badge + "</span>";
                    html += "</div></div>";
                });
            } else {
                html += "<p class=\"text-muted small\" style=\"margin:0;\">" + __("Aucun document de vente lié.") + "</p>";
            }
            html += "</div></div></div>";

            html += "</div></div>";
            frm.get_field("liens").$wrapper.html(html);
        },
    });
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
            client: frm.doc.client || null,
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
