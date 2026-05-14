// Copyright (c) 2026, Medigo and contributors
// Interface calquée sur Demande Faisabilité (boutons en tête, cartes HTML, badges).

function escape_html(value) {
    return frappe.utils.escape_html(value || "");
}

/** Badges alignés sur demande_faisabilite.js (traductions + couleurs ERPNext). */
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
        "On Hold": "En attente"
    };

    const config = {
        Nouveau: { color: "rgba(17, 138, 178, 0.1)", textColor: "#118ab2" },
        Confirmée: { color: "rgba(74, 144, 226, 0.1)", textColor: "#4a90e2" },
        "En étude": { color: "rgba(244, 162, 97, 0.1)", textColor: "#f4a261" },
        "Étude partiellement finalisée": { color: "rgba(255, 159, 28, 0.12)", textColor: "#ff9f1c" },
        "Étude finalisée": { color: "rgba(131, 56, 236, 0.1)", textColor: "#8338ec" },
        "En Cours": { color: "rgba(244, 162, 97, 0.1)", textColor: "#f4a261" },
        Réalisable: { color: "rgba(42, 157, 143, 0.1)", textColor: "#2a9d8f" },
        "Non Réalisable": { color: "rgba(230, 57, 70, 0.1)", textColor: "#e63946" },
        Programmée: { color: "rgba(17, 138, 178, 0.1)", textColor: "#118ab2" },
        Brouillon: { color: "rgba(108, 117, 125, 0.1)", textColor: "#6c757d" },
        Soumis: { color: "rgba(0, 123, 255, 0.1)", textColor: "#007bff" },
        Annulé: { color: "rgba(230, 57, 70, 0.1)", textColor: "#e63946" },
        Commandé: { color: "rgba(40, 167, 69, 0.1)", textColor: "#28a745" },
        Terminé: { color: "rgba(40, 167, 69, 0.1)", textColor: "#28a745" },
        Fermé: { color: "rgba(40, 167, 69, 0.1)", textColor: "#28a745" },
        Ouvert: { color: "rgba(0, 123, 255, 0.1)", textColor: "#007bff" },
        Perdu: { color: "rgba(231, 111, 81, 0.1)", textColor: "#e76f51" },
        "À livrer et facturer": { color: "rgba(255, 193, 7, 0.1)", textColor: "#856404" },
        "À facturer": { color: "rgba(255, 193, 7, 0.1)", textColor: "#856404" },
        "À livrer": { color: "rgba(255, 193, 7, 0.1)", textColor: "#856404" },
        "En attente": { color: "rgba(108, 117, 125, 0.1)", textColor: "#6c757d" },
        "Devis établi": { color: "rgba(42, 157, 143, 0.1)", textColor: "#2a9d8f" },
        "Validé client": { color: "rgba(40, 167, 69, 0.1)", textColor: "#28a745" },
        "Refusé client": { color: "rgba(230, 57, 70, 0.1)", textColor: "#e63946" },
        "Non réalisable": { color: "rgba(230, 57, 70, 0.1)", textColor: "#e63946" }
    };

    const displayStatus = statusTranslations[status] || status;
    const style = config[displayStatus] || { color: "rgba(102, 102, 102, 0.1)", textColor: "#666" };

    return (
        "<span style='background-color: " +
        style.color +
        "; font-size: 11px; color: " +
        style.textColor +
        "; border-radius: 4px; padding: 2px 4px; margin-right: 4px;'>" +
        escape_html(displayStatus) +
        "</span>"
    );
}

function render_articles_html(frm) {
    const rows = frm.doc.articles || [];
    const n = rows.length;

    let html =
        "<div style='display: flex; flex-direction: column; gap: 20px; padding-bottom: 10px; min-width: 280px;'>";
    if (frm.doc.status === "Nouveau") {
        html +=
            "<button id='deb-add-article' type='button' class='btn btn-primary btn-sm' style='align-self:flex-start;background-color:#0d9488;border-color:#0f766e;color:#fff'>" +
            __("+ Article") +
            "</button>";
    }

    html += "<div style='flex: 1; min-width: 280px; display: flex; flex-direction: column;'>";
    html += "<div style='border: 0.5px solid #d1d8dd; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden;'>";
    html +=
        '<div style="padding: 10px 20px; border-bottom: 0.5px solid #d1d8dd; background-color: #f8f9fa;">' +
        '<div style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">' +
        '<span style="font-size: 14px; font-weight: 600; color: #1a1a1a;">' +
        __("Articles essai blanc") +
        "</span>" +
        '<span style="background: rgba(74, 144, 226, 0.1); padding: 2px 8px; border-radius: 12px; font-size: 11px; color: #4a90e2;">' +
        n +
        " " +
        (n > 1 ? __("lignes") : __("ligne")) +
        "</span></div></div>";

    html += "<div style='padding: 20px; background-color: #ffffff;'>";

    if (frm.doc.status === "Confirmée" && !frm.is_new()) {
        html +=
            "<p style='font-size: 11px; color: #6c757d; margin: 0 0 14px 0;'>" +
            __(
                "Le statut du dossier suit les études : démarrez et finalisez chaque étude de faisabilité depuis sa fiche (workflow)."
            ) +
            "</p>";
    }

    if (!rows.length) {
        html += "<p style='font-size: 11px; margin: 0;'>" + __("Aucun article ajouté.") + "</p>";
    } else {
        rows.forEach((row) => {
            html += "<div style='margin-bottom: 12px; padding-bottom: 12px; border-bottom: 0.5px solid #eef0f2;'>";
            html += "<div style='display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; flex-wrap: wrap;'>";
            html += "<div>";
            html +=
                "<div style='font-weight: 600; font-size: 12px; color: #333;'>" +
                escape_html(row.article) +
                (row.designation_article ? " — " + escape_html(row.designation_article) : "") +
                "</div>";
            html +=
                "<div style='font-size: 11px; color: #6c757d; margin-top: 4px;'>" +
                __("Quantité") +
                ": " +
                escape_html(row.quantite) +
                " · " +
                __("Livraison") +
                ": " +
                escape_html(row.date_livraison) +
                " · " +
                __("Procédé") +
                ": " +
                escape_html(row.procede_article || "—") +
                "</div>";
            html +=
                "<div style='margin-top: 6px;'>" +
                get_status_badge(row.statut_validation_client || "En attente") +
                "</div>";
            html += "</div>";
            html += "<div style='display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; align-items:center;'>";
            if (frm.doc.status === "Nouveau") {
                html +=
                    "<button type='button' class='btn btn-danger btn-xs deb-remove-article' data-row='" +
                    escape_html(row.name) +
                    "'>" +
                    __("Retirer") +
                    "</button>";
            }
            if (
                ["Prêt pour livraison", "Partiellement validé client", "Validé client"].includes(frm.doc.status)
            ) {
                html +=
                    "<button type='button' class='btn btn-primary btn-xs deb-validate-article' data-row='" +
                    escape_html(row.name) +
                    "'>" +
                    __("OK client") +
                    "</button>";
                html +=
                    "<button type='button' class='btn btn-secondary btn-xs deb-refuse-article' data-row='" +
                    escape_html(row.name) +
                    "'>" +
                    __("Refus") +
                    "</button>";
            }
            html += "</div></div></div>";
        });
    }

    html += "</div></div></div></div>";
    frm.get_field("html_articles").$wrapper.html(html);
    bind_article_actions(frm);
}

function bind_article_actions(frm) {
    const wrapper = frm.get_field("html_articles").$wrapper;
    wrapper.find("#deb-add-article").off("click").on("click", () => prompt_add_article(frm));
    wrapper.find(".deb-remove-article").on("click", function() {
        remove_article(frm, this.dataset.row);
    });
    wrapper.find(".deb-validate-article").on("click", function() {
        set_article_validation(frm, this.dataset.row, "Validé client");
    });
    wrapper.find(".deb-refuse-article").on("click", function() {
        set_article_validation(frm, this.dataset.row, "Refusé client");
    });
}

function prompt_add_article(frm) {
    if (frm.is_new()) {
        frappe.msgprint(__("Enregistrez le dossier avant d'ajouter des articles."));
        return;
    }
    if (frm.doc.status !== "Nouveau") {
        frappe.msgprint(__("Les articles ne peuvent être ajoutés qu'au statut Nouveau."));
        return;
    }
    frappe.prompt(
        [
            {
                fieldname: "article",
                fieldtype: "Link",
                label: __("Article"),
                options: "Item",
                reqd: 1,
                get_query: function() {
                    const filters = {
                        custom_essai_blanc: 1,
                        custom_sous_article: 0,
                        custom_article_parent: ["is", "not set"]
                    };
                    if (frm.doc.client) {
                        filters.custom_client = frm.doc.client;
                    }
                    return { filters };
                }
            },
            {
                fieldname: "quantite",
                fieldtype: "Int",
                label: __("Quantité"),
                reqd: 1
            },
            {
                fieldname: "date_livraison",
                fieldtype: "Date",
                label: __("Date de livraison"),
                default: frm.doc.date_livraison,
                reqd: 1
            }
        ],
        function(values) {
            frappe.call({
                method: "aurescrm.aures_crm.doctype.dossier_essai_blanc.dossier_essai_blanc.add_article",
                args: {
                    docname: frm.doc.name,
                    article: values.article,
                    quantite: values.quantite,
                    date_livraison: values.date_livraison
                },
                callback: function() {
                    frm.reload_doc();
                }
            });
        },
        __("Ajouter un article"),
        __("Ajouter")
    );
}

function remove_article(frm, row_name) {
    frappe.confirm(__("Supprimer cet article du dossier ?"), function() {
        frappe.call({
            method: "aurescrm.aures_crm.doctype.dossier_essai_blanc.dossier_essai_blanc.remove_article",
            args: { docname: frm.doc.name, row_name: row_name },
            callback: function() {
                frm.reload_doc();
            }
        });
    });
}

function generate_etudes(frm) {
    frappe.confirm(
        __(
            "Confirmer le dossier et créer les études de faisabilité liées ? Le flux (démarrage, finalisation) se poursuit dans chaque étude."
        ),
        function() {
            frappe.call({
                method: "aurescrm.aures_crm.doctype.dossier_essai_blanc.dossier_essai_blanc.generate_etudes_dossier",
                args: { docname: frm.doc.name },
                freeze: true,
                freeze_message: __("Génération des études en cours..."),
                callback: function() {
                    frm.reload_doc();
                }
            });
        }
    );
}

function set_article_validation(frm, row_name, validation_status) {
    frappe.prompt(
        [
            {
                fieldname: "commentaire",
                fieldtype: "Small Text",
                label: __("Commentaire")
            }
        ],
        function(values) {
            frappe.call({
                method: "aurescrm.aures_crm.doctype.dossier_essai_blanc.dossier_essai_blanc.set_article_validation",
                args: {
                    docname: frm.doc.name,
                    row_name: row_name,
                    validation_status: validation_status,
                    commentaire: values.commentaire
                },
                callback: function() {
                    frm.reload_doc();
                }
            });
        },
        validation_status,
        __("Confirmer")
    );
}

function load_linked_documents(frm) {
    if (frm.is_new() || frm.doc.status === "Nouveau") {
        frm.get_field("liens").$wrapper.empty();
        return;
    }
    frappe.call({
        method: "aurescrm.aures_crm.doctype.dossier_essai_blanc.dossier_essai_blanc.get_linked_documents_for_dossier",
        args: { dossier_name: frm.doc.name },
        callback: function(res) {
            if (!res.message) {
                frm.get_field("liens").$wrapper.html(
                    "<p style='font-size: 11px; padding: 20px;'>" + __("Erreur lors du chargement des liens.") + "</p>"
                );
                return;
            }
            const etudes = res.message.etudes || [];
            const sales_documents = res.message.sales_documents || [];

            let html =
                "<div style='display: flex; flex-direction: column; gap: 20px; padding-bottom: 10px; min-width: 280px;'>";
            html += "<style>@media (min-width: 768px) { .deb-df-container { flex-direction: row !important; } }</style>";
            html +=
                "<div class='deb-df-container' style='display: flex; flex-direction: column; gap: 20px; align-items: stretch;'>";

            html += "<div style='flex: 1; min-width: 280px; display: flex; flex-direction: column;'>";
            html +=
                "<div style='border: 0.5px solid #d1d8dd; border-radius: 8px; height: 100%; display: flex; flex-direction: column; overflow: hidden;'>";
            html +=
                '<div style="padding: 10px 20px; border-bottom: 0.5px solid #d1d8dd; background-color: #f8f9fa;">' +
                '<div style="display: flex; align-items: center;">' +
                '<span style="font-size: 14px; font-weight: 600; color: #1a1a1a;">' +
                __("Liste Études de Faisabilité") +
                "</span>" +
                '<span style="margin-left: 8px; background: rgba(74, 144, 226, 0.1); padding: 2px 8px; border-radius: 12px; font-size: 11px; color: #4a90e2;">' +
                etudes.length +
                " " +
                (etudes.length > 1 ? __("études") : __("étude")) +
                "</span></div></div>";
            html += "<div style='padding: 20px; background-color: #ffffff; flex-grow: 1;'>";
            if (etudes.length) {
                etudes.forEach(function(rec) {
                    const badge = get_status_badge(rec.status);
                    const itemName = rec.item_name || "";
                    const doctype = rec.doctype || "Etude Faisabilite";
                    html += "<div style='margin-bottom: 5px; display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 8px;'>";
                    html += "<span style='margin-right: 4px;'>•</span>";
                    html += "<div style='display: flex; flex-direction: column;'>";
                    html += "<div style='display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;'>";
                    html +=
                        "<a href='#' onclick=\"frappe.set_route('Form','" +
                        escape_html(doctype) +
                        "','" +
                        escape_html(rec.name) +
                        "'); return false;\" style='font-size: 12px; color: inherit; text-decoration: none; word-break: break-all;'>" +
                        escape_html(rec.name) +
                        (itemName ? " — " + escape_html(itemName) : "") +
                        "</a>";
                    html += "<span>" + badge + "</span>";
                    html += "</div></div></div>";
                });
            } else {
                html += "<p style='font-size: 11px; margin: 0;'>" + __("Aucune étude de faisabilité liée.") + "</p>";
            }
            html += "</div></div></div>";

            html += "<div style='flex: 1; min-width: 280px; display: flex; flex-direction: column;'>";
            html +=
                "<div style='border: 0.5px solid #d1d8dd; border-radius: 8px; height: 100%; display: flex; flex-direction: column; overflow: hidden;'>";
            html +=
                '<div style="padding: 10px 20px; border-bottom: 0.5px solid #d1d8dd; background-color: #f8f9fa;">' +
                '<div style="display: flex; align-items: center;">' +
                '<span style="font-size: 14px; font-weight: 600; color: #1a1a1a;">' +
                __("Documents de vente") +
                "</span></div></div>";
            html += "<div style='padding: 20px; background-color: #ffffff; flex-grow: 1;'>";
            if (sales_documents.length) {
                sales_documents.forEach(function(doc) {
                    const badge = get_status_badge(doc.status);
                    let doc_type_label = "";
                    if (doc.doctype === "Quotation") {
                        doc_type_label = __("Devis : ");
                    } else if (doc.doctype === "Sales Order") {
                        doc_type_label = __("Commande : ");
                    }
                    html += "<div style='margin-bottom: 10px; display: flex; align-items: flex-start;'>";
                    html += "<span style='margin-right: 8px; line-height: 1.5;'>•</span>";
                    html += "<div style='display: flex; flex-direction: column; align-items: flex-start;'>";
                    html += "<strong style='font-size: 12px; color: #333;'>" + escape_html(doc_type_label) + "</strong>";
                    html +=
                        "<div style='display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 8px; margin-top: 2px;'>";
                    html +=
                        "<a href='#' onclick=\"frappe.set_route('Form','" +
                        escape_html(doc.doctype) +
                        "','" +
                        escape_html(doc.name) +
                        "'); return false;\" style='font-size: 12px; color: inherit; text-decoration: none; word-break: break-all;'>" +
                        escape_html(doc.name) +
                        "</a>";
                    html += "<span>" + badge + "</span>";
                    html += "</div></div></div>";
                });
            } else {
                html += "<p style='font-size: 11px; margin: 0;'>" + __("Aucun document de vente lié.") + "</p>";
            }
            html += "</div></div></div>";

            html += "</div></div>";
            frm.get_field("liens").$wrapper.html(html);
        }
    });
}

frappe.ui.form.on("Dossier Essai Blanc", {
    refresh(frm) {
        frm.set_query("article", "articles", function() {
            const filters = {
                custom_essai_blanc: 1,
                custom_sous_article: 0,
                custom_article_parent: ["is", "not set"]
            };
            if (frm.doc.client) {
                filters.custom_client = frm.doc.client;
            }
            return { filters };
        });

        frm.clear_custom_buttons();

        if (frm.doc.status === "Nouveau" && !frm.is_new()) {
            frm.add_custom_button(__("Confirmer"), function() {
                if (frm.doc.status !== "Nouveau") {
                    frappe.msgprint({
                        title: __("Erreur"),
                        message: __(
                            "Ce dossier n'est plus au statut « Nouveau » et ne peut pas être confirmé ainsi."
                        ),
                        indicator: "red"
                    });
                    return;
                }
                generate_etudes(frm);
            })
                .removeClass("btn-default")
                .addClass("btn-primary")
                .css({
                    "background-color": "#52b69a",
                    "border-color": "#449874",
                    color: "#fff"
                });
        }

        if (
            !frm.is_new() &&
            !["Annulé", "Clôturé"].includes(frm.doc.status)
        ) {
            frm.add_custom_button(__("Annuler"), function() {
                frappe.confirm(
                    "<b>Attention !</b><br><br>" +
                        __("Cette action va :") +
                        "<br>• " +
                        __("Passer le dossier au statut <b>Annulé</b>") +
                        "<br>• " +
                        __("<b>Supprimer ou annuler</b> les commandes et devis liés (s'il en existe)") +
                        "<br>• " +
                        __(
                            "<b>Supprimer ou annuler</b> toutes les études de faisabilité encore actives liées à ce dossier"
                        ) +
                        "<br><br>" +
                        __("Cette action est irréversible. Continuer ?"),
                    function() {
                        frappe.call({
                            method:
                                "aurescrm.aures_crm.doctype.dossier_essai_blanc.dossier_essai_blanc.cancel_dossier_essai_blanc_etudes",
                            args: { docname: frm.doc.name },
                            freeze: true,
                            freeze_message: __("Annulation en cours..."),
                            callback: function(r) {
                                if (r.message && r.message.status === "ok") {
                                    let msg = __("Dossier essai blanc annulé.");
                                    if ((r.message.quotation_deleted || 0) > 0) {
                                        msg +=
                                            "<br>" +
                                            r.message.quotation_deleted +
                                            " " +
                                            __("devis supprimé(s).");
                                    }
                                    if ((r.message.quotation_cancelled || 0) > 0) {
                                        msg +=
                                            "<br>" +
                                            r.message.quotation_cancelled +
                                            " " +
                                            __("devis annulé(s).");
                                    }
                                    if ((r.message.deleted_count || 0) > 0) {
                                        msg +=
                                            "<br>" +
                                            r.message.deleted_count +
                                            " " +
                                            __("étude(s) supprimée(s).");
                                    }
                                    if (r.message.cancelled_count > 0) {
                                        msg +=
                                            "<br>" +
                                            r.message.cancelled_count +
                                            " " +
                                            __("étude(s) annulée(s).");
                                    }
                                    if ((r.message.sales_order_deleted || 0) > 0) {
                                        msg +=
                                            "<br>" +
                                            r.message.sales_order_deleted +
                                            " " +
                                            __("commande(s) supprimée(s).");
                                    }
                                    if ((r.message.sales_order_cancelled || 0) > 0) {
                                        msg +=
                                            "<br>" +
                                            r.message.sales_order_cancelled +
                                            " " +
                                            __("commande(s) annulée(s).");
                                    }
                                    frappe.msgprint({
                                        title: __("Succès"),
                                        message: msg,
                                        indicator: "green"
                                    });
                                    frm.reload_doc();
                                }
                            }
                        });
                    }
                );
            })
                .removeClass("btn-default")
                .addClass("btn-danger");
        }

        render_articles_html(frm);
        load_linked_documents(frm);

        if (["Étude finalisée", "Étude partiellement finalisée", "Devis établi"].includes(frm.doc.status) && !frm.is_new()) {
            frm.add_custom_button(__("Devis"), function() {
                frappe.confirm(__("Créer un devis avec les articles réalisables ?"), function() {
                    frappe.call({
                        method: "aurescrm.aures_crm.doctype.dossier_essai_blanc.dossier_essai_blanc.create_quotation_with_calculs",
                        args: { docname: frm.doc.name },
                        freeze: true,
                        freeze_message: __("Création du devis..."),
                        callback: function(r) {
                            if (r.message && r.message.quotation_name) {
                                frappe.set_route("Form", "Quotation", r.message.quotation_name);
                            } else {
                                frm.reload_doc();
                            }
                        }
                    });
                });
            }, __("Créer"));
        }

        const fluxLabels = {
            "Commandé": __("Prod à lancer"),
            "Production à lancer": __("En prod."),
            "En production": __("Prêt livr.")
        };
        if (fluxLabels[frm.doc.status] && !frm.is_new()) {
            frm.add_custom_button(fluxLabels[frm.doc.status], function() {
                frappe.call({
                    method:
                        "aurescrm.aures_crm.doctype.dossier_essai_blanc.dossier_essai_blanc.advance_dossier_essai_blanc_step",
                    args: { docname: frm.doc.name },
                    freeze: true,
                    freeze_message: __("Mise à jour du dossier..."),
                    callback: function(r) {
                        if (r.message && r.message.status) {
                            frappe.show_alert({
                                message: __("Statut du dossier : {0}", [r.message.status]),
                                indicator: "green"
                            });
                        }
                        frm.reload_doc();
                    }
                });
            })
                .removeClass("btn-default")
                .addClass("btn-primary")
                .css({
                    "background-color": "#7dccb3",
                    "border-color": "#52b69a",
                    color: "#fff"
                });
        }
    }
});
