// Copyright (c) 2026, Medigo and contributors
// Interface calquée sur Demande Faisabilité (boutons en tête, cartes HTML, badges).
// Style cartes / espacements inspirés Frappe UI, rendu Desk (HTML + Bootstrap).

/** Tokens visuels partagés (bordures neutres, ombre légère, hiérarchie lisible). */
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

/** Filtres Link Item pour les lignes articles (exclut les articles déjà sur d'autres lignes). */
function deb_article_link_filters(frm, cdn) {
    const filters = {
        custom_essai_blanc: 1,
        custom_sous_article: 0,
        custom_article_parent: ["is", "not set"],
    };
    if (frm.doc.client) {
        filters.custom_client = frm.doc.client;
    }
    const existing = (frm.doc.articles || [])
        .filter((r) => r.article && (!cdn || r.name !== cdn))
        .map((r) => r.article);
    if (existing.length) {
        filters.name = ["not in", existing];
    }
    return filters;
}

function deb_code_pharma_prompt_labels() {
    return {
        sans: __("Sans Code pharma"),
        avec: __("Avec Code pharma"),
    };
}

function prompt_deb_add_article(frm) {
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
                    return { filters: deb_article_link_filters(frm) };
                },
            },
            {
                fieldname: "quantite",
                fieldtype: "Int",
                label: __("Quantité"),
                reqd: 1,
            },
            {
                fieldname: "date_livraison",
                fieldtype: "Date",
                label: __("Date de livraison"),
                default: frm.doc.date_livraison,
                reqd: 1,
            },
            (function() {
                const pharma = deb_code_pharma_prompt_labels();
                return {
                    fieldname: "code_pharma",
                    fieldtype: "Select",
                    label: __("Code pharma"),
                    options: pharma.sans + "\n" + pharma.avec,
                    default: pharma.sans,
                    reqd: 1,
                };
            })(),
        ],
        function(values) {
            if ((frm.doc.articles || []).some((r) => r.article === values.article)) {
                frappe.msgprint(__("Cet article est déjà présent dans le dossier."));
                return;
            }
            frappe.db.get_value(
                "Item",
                values.article,
                [
                    "item_name",
                    "custom_sous_article",
                    "custom_article_parent",
                    "custom_essai_blanc",
                    "custom_client",
                    "custom_procédé",
                ],
                function(message) {
                    if (!message || !Object.keys(message).length) {
                        frappe.msgprint(__("Article introuvable."));
                        return;
                    }
                    if (!cint(message.custom_essai_blanc)) {
                        frappe.msgprint(__("Cet article n'est pas coché Essai Blanc."));
                        return;
                    }
                    if (
                        message.custom_client &&
                        frm.doc.client &&
                        message.custom_client !== frm.doc.client
                    ) {
                        frappe.msgprint(__("Cet article n'appartient pas au client du dossier."));
                        return;
                    }
                    if (cint(message.custom_sous_article) || message.custom_article_parent) {
                        frappe.msgprint(
                            __("Sélectionnez l'article parent (article composé), pas un sous-article.")
                        );
                        return;
                    }
                    const pharma = deb_code_pharma_prompt_labels();
                    const row = frm.add_child("articles");
                    row.article = values.article;
                    row.designation_article = message.item_name || "";
                    row.quantite = cint(values.quantite);
                    row.date_livraison = values.date_livraison;
                    row.procede_article = message.custom_procédé || "";
                    row.avec_code_pharma = values.code_pharma === pharma.avec ? 1 : 0;
                    row.essai_blanc = 1;
                    row.statut_validation_client = "En attente";
                    frm.refresh_field("articles");
                    frm.save();
                }
            );
        },
        __("Ajouter un article"),
        __("Ajouter")
    );
}

function setup_deb_articles_grid_tools(frm) {
    if (frm.doc.status !== "Nouveau") {
        return;
    }
    const grid_field = frm.get_field("articles");
    if (grid_field && grid_field.grid) {
        grid_field.grid.wrapper.find(".grid-add-row").hide();
    }
    const html_f = frm.get_field("html_article_add");
    if (!html_f || !html_f.$wrapper) {
        return;
    }
    html_f.$wrapper.empty();
    const $btn = $(
        '<button type="button" id="deb-add-article-btn" class="btn btn-primary btn-sm" style="margin-bottom:10px;">' +
            __("+ Article") +
            "</button>"
    );
    html_f.$wrapper.append($btn);
    $btn.on("click", function() {
        prompt_deb_add_article(frm);
    });
}

function deb_inject_layout_styles() {
    return (
        "<style>" +
        ".deb-df-container{display:flex;flex-direction:column;gap:" +
        DEB.gapSection +
        ";align-items:stretch}" +
        "@media (min-width:768px){.deb-df-container{flex-direction:row!important}}" +
        ".deb-article-row{padding:" +
        DEB.gapBlock +
        " 0;border-bottom:1px solid " +
        DEB.divider +
        "}" +
        ".deb-article-row:last-child{border-bottom:none}" +
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

/** Badges (traductions + couleurs métier), forme pilule type Frappe UI. */
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

/** Pastilles infos article : quantité ; badge « Avec Code pharma » seulement si coché. */
function deb_article_meta_badges(row) {
    const qtyText = __("Quantité") + " : " + escape_html(String(row.quantite != null ? row.quantite : ""));
    const chips = [{ bg: "rgba(59, 130, 246, 0.14)", fg: "#1e40af", text: qtyText }];
    if (cint(row.avec_code_pharma)) {
        chips.push({
            bg: "rgba(22, 163, 74, 0.16)",
            fg: "#15803d",
            text: __("Avec Code pharma"),
        });
    }
    let out = "";
    chips.forEach((c) => {
        out +=
            "<span style=\"display:inline-flex;align-items:center;background-color:" +
            c.bg +
            ";font-size:11px;font-weight:600;color:" +
            c.fg +
            ";border-radius:9999px;padding:3px 10px;line-height:1.35;white-space:nowrap;max-width:100%;box-sizing:border-box;\">" +
            c.text +
            "</span>";
    });
    return out;
}

function render_articles_html(frm) {
    if (frm.doc.status === "Nouveau") {
        const hf = frm.get_field("html_articles");
        if (hf && hf.$wrapper) {
            hf.$wrapper.empty();
        }
        return;
    }
    const rows = frm.doc.articles || [];
    const n = rows.length;
    const countLabel = n + " " + (n > 1 ? __("lignes") : __("ligne"));

    let html = deb_inject_layout_styles();
    html += deb_section_root_open();

    html += "<div style=\"flex:1;min-width:280px;display:flex;flex-direction:column;\">";
    html += deb_card_shell_open();
    html += deb_card_header(__("Articles essai blanc"), countLabel);
    html += deb_card_body_open(false);

    if (!rows.length) {
        html += "<p class=\"text-muted small\" style=\"margin:0;\">" + __("Aucun article ajouté.") + "</p>";
    } else {
        rows.forEach((row) => {
            html += "<div class=\"deb-article-row\">";
            html +=
                "<div style=\"display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;\">";
            html += "<div style=\"min-width:0;\">";
            html +=
                "<div style=\"display:flex;align-items:center;flex-wrap:wrap;gap:8px;line-height:1.4;\">" +
                "<span style=\"font-weight:600;font-size:13px;color:" +
                DEB.text +
                ";\">" +
                escape_html(row.article) +
                (row.designation_article ? " — " + escape_html(row.designation_article) : "") +
                "</span>" +
                get_status_badge(row.statut_validation_client || "En attente") +
                "</div>";
            html +=
                "<div style=\"display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:8px;\">" +
                deb_article_meta_badges(row) +
                "</div>";
            html += "</div>";
            html +=
                "<div style=\"display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;align-items:center;\">";
            if (
                ["Prêt pour livraison", "Partiellement validé client"].includes(frm.doc.status)
            ) {
                html +=
                    "<button type=\"button\" class=\"btn btn-primary btn-xs deb-validate-article\" data-row=\"" +
                    escape_html(row.name) +
                    "\">" +
                    __("OK client") +
                    "</button>";
                html +=
                    "<button type=\"button\" class=\"btn btn-default btn-xs deb-refuse-article\" data-row=\"" +
                    escape_html(row.name) +
                    "\">" +
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
    wrapper.find(".deb-validate-article").off("click").on("click", function() {
        prompt_ok_client_article(frm, this.dataset.row);
    });
    wrapper.find(".deb-refuse-article").off("click").on("click", function() {
        set_article_validation(frm, this.dataset.row, "Refusé client");
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
                },
            });
        }
    );
}

function prompt_ok_client_article(frm, row_name) {
    const rows = frm.doc.articles || [];
    const row = rows.find((r) => r.name === row_name);
    if (!row || !row.article) {
        frappe.msgprint(__("Article introuvable pour cette ligne."));
        return;
    }
    frappe.call({
        method: "aurescrm.aures_crm.doctype.dossier_essai_blanc.dossier_essai_blanc.get_item_support_grammage_for_prompt",
        args: { item_code: row.article },
        callback: function(res) {
            const d = res.message || {};
            frappe.prompt(
                [
                    {
                        fieldname: "custom_support",
                        fieldtype: "Select",
                        label: __("Papier"),
                        options: d.support_options || "",
                        default: d.custom_support || "",
                        reqd: 1,
                    },
                    {
                        fieldname: "custom_grammage",
                        fieldtype: "Select",
                        label: __("Grammage"),
                        options: d.grammage_options || "",
                        default: d.custom_grammage || "",
                        reqd: 1,
                    },
                ],
                function(values) {
                    frappe.call({
                        method:
                            "aurescrm.aures_crm.doctype.dossier_essai_blanc.dossier_essai_blanc.set_article_validation",
                        args: {
                            docname: frm.doc.name,
                            row_name: row_name,
                            validation_status: "Validé client",
                            custom_support: values.custom_support,
                            custom_grammage: values.custom_grammage,
                        },
                        callback: function() {
                            frm.reload_doc();
                        },
                    });
                },
                __("Validé client"),
                __("Confirmer")
            );
        },
    });
}

function set_article_validation(frm, row_name, validation_status) {
    frappe.prompt(
        [
            {
                fieldname: "commentaire",
                fieldtype: "Small Text",
                label: __("Commentaire"),
            },
        ],
        function(values) {
            frappe.call({
                method: "aurescrm.aures_crm.doctype.dossier_essai_blanc.dossier_essai_blanc.set_article_validation",
                args: {
                    docname: frm.doc.name,
                    row_name: row_name,
                    validation_status: validation_status,
                    commentaire: values.commentaire,
                },
                callback: function() {
                    frm.reload_doc();
                },
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
                    "<p class=\"text-muted small\" style=\"padding:16px;margin:0;\">" +
                        __("Erreur lors du chargement des liens.") +
                        "</p>"
                );
                return;
            }
            const etudes = res.message.etudes || [];
            const sales_documents = res.message.sales_documents || [];
            const salesCountLabel =
                sales_documents.length +
                " " +
                (sales_documents.length > 1 ? __("documents") : __("document"));

            let html = deb_inject_layout_styles();
            html += deb_section_root_open();
            html += "<div class=\"deb-df-container\">";

            html += "<div style=\"flex:1;min-width:280px;display:flex;flex-direction:column;\">";
            html += deb_card_shell_open();
            const etudeCountLabel =
                etudes.length + " " + (etudes.length > 1 ? __("études") : __("étude"));
            html += deb_card_header(__("Liste Études de Faisabilité"), etudeCountLabel);
            html += deb_card_body_open(true);
            if (etudes.length) {
                etudes.forEach(function(rec) {
                    const badge = get_status_badge(rec.status);
                    const itemName = rec.item_name || "";
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

frappe.ui.form.on("Dossier Essai Blanc", {
    articles_add(frm, cdt, cdn) {
        if (frm.doc.date_livraison) {
            frappe.model.set_value(cdt, cdn, "date_livraison", frm.doc.date_livraison);
        }
    },
    refresh(frm) {
        frm.set_query("article", "articles", function(doc, cdt, cdn) {
            return { filters: deb_article_link_filters(frm, cdn) };
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
                        indicator: "red",
                    });
                    return;
                }
                if (frm.is_dirty()) {
                    frappe.msgprint({
                        title: __("Enregistrement requis"),
                        message: __(
                            "Enregistrez le dossier pour prendre en compte les articles du tableau avant de confirmer."
                        ),
                        indicator: "orange",
                    });
                    return;
                }
                generate_etudes(frm);
            })
                .removeClass("btn-default")
                .addClass("btn-primary");
        }

        if (!frm.is_new() && !["Annulé", "Clôturé"].includes(frm.doc.status)) {
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
                                        indicator: "green",
                                    });
                                    frm.reload_doc();
                                }
                            },
                        });
                    }
                );
            })
                .removeClass("btn-default")
                .addClass("btn-danger");
        }

        render_articles_html(frm);
        setup_deb_articles_grid_tools(frm);
        load_linked_documents(frm);

        if (
            ["Étude finalisée", "Étude partiellement finalisée", "Devis établi"].includes(frm.doc.status) &&
            !frm.is_new()
        ) {
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
                        },
                    });
                });
            }, __("Créer"));
        }

        const fluxLabels = {
            Commandé: __("Prod à lancer"),
            "Production à lancer": __("En prod."),
            "En production": __("Prêt livr."),
        };
        const fluxNextStatusLabels = {
            Commandé: __("Production à lancer"),
            "Production à lancer": __("En production"),
            "En production": __("Prêt pour livraison"),
        };
        if (fluxLabels[frm.doc.status] && !frm.is_new()) {
            frm.add_custom_button(fluxLabels[frm.doc.status], function() {
                const nextLabel = fluxNextStatusLabels[frm.doc.status];
                frappe.confirm(__("Confirmer le passage du dossier au statut « {0} » ?", [nextLabel]), function() {
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
                                    indicator: "green",
                                });
                            }
                            frm.reload_doc();
                        },
                    });
                });
            })
                .removeClass("btn-default")
                .addClass("btn-primary");
        }
    },
});
