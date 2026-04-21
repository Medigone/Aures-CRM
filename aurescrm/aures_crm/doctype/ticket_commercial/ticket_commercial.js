// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Ticket Commercial", {
    refresh: function(frm) {
        frm.clear_custom_buttons();

        // Actions personnalisées au rafraîchissement du formulaire
        if (frm.doc.status === "Terminé" || frm.doc.status === "Annulé") {
            frm.set_read_only(true);
        }

        add_assign_buttons(frm);
        add_create_buttons(frm);
        add_demande_urgence_button(frm);
        add_annuler_demande_urgence_button(frm);
        add_admin_urgence_validation_buttons(frm);
        style_urgence_group_secondary(frm);
        render_urgence_html(frm);
    },

    customer: function(frm) {
        // Auto-remplir le nom du client si disponible
        if (frm.doc.customer) {
            frappe.db.get_value("Customer", frm.doc.customer, "customer_name")
                .then(r => {
                    if (r.message) {
                        frm.set_value("customer_name", r.message.customer_name);
                    }
                });
        }
    },

    commercial: function(frm) {
        // Auto-remplir le nom du commercial si disponible
        if (frm.doc.commercial) {
            frappe.db.get_value("User", frm.doc.commercial, "full_name")
                .then(r => {
                    if (r.message) {
                        frm.set_value("nom_commercial", r.message.full_name);
                    }
                });
        } else {
            frm.set_value("nom_commercial", "");
        }
    },

    request_type: function(frm) {
        // Personnaliser selon le type de demande
        if (frm.doc.request_type === "Réclamation commerciale") {
            frappe.msgprint({
                message: __("Assurez-vous de documenter la réclamation en détail dans la description."),
                indicator: "orange",
                title: __("Réclamation")
            });
        }
    },

    assigne_a: function(frm) {
        if (frm.doc.assigne_a) {
            frappe.db.get_value("User", frm.doc.assigne_a, "full_name")
                .then(r => {
                    if (r.message && r.message.full_name) {
                        frm.set_value("assigne_a_nom", r.message.full_name);
                    } else {
                        frm.set_value("assigne_a_nom", frm.doc.assigne_a);
                    }
                });
        } else {
            frm.set_value("assigne_a_nom", "");
        }
    }
});

function add_assign_buttons(frm) {
    if (frm.doc.__islocal) {
        return;
    }

    if (["Terminé", "Annulé"].includes(frm.doc.status)) {
        return;
    }

    if (!frappe.user.has_role("Administrateur Ventes")) {
        return;
    }

    frm.add_custom_button(__("À moi"), function() {
        update_assigne_a(frm, frappe.session.user);
    }, __("Attribuer"));

    frm.add_custom_button(__("Attribuer à..."), function() {
        let dialog = new frappe.ui.Dialog({
            title: __("Sélectionner un utilisateur Back Office"),
            fields: [
                {
                    label: __("Utilisateur"),
                    fieldname: "selected_user",
                    fieldtype: "Link",
                    options: "User",
                    reqd: 1,
                    get_query: function() {
                        return {
                            query: "aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial.get_admin_ventes_users"
                        };
                    }
                }
            ],
            primary_action_label: __("Sélectionner"),
            primary_action(values) {
                if (values.selected_user) {
                    update_assigne_a(frm, values.selected_user);
                }
                dialog.hide();
            }
        });
        dialog.show();
    }, __("Attribuer"));
}

function open_new_doc_in_new_tab(doctype, defaults) {
    const prev_route_options = frappe.route_options;
    frappe.route_options = { ...defaults };
    localStorage["route_options"] = JSON.stringify(frappe.route_options);

    const new_name = frappe.model.get_new_name(doctype);
    const converted = frappe.router.convert_from_standard_route(["Form", doctype, new_name]);
    const sub_path = frappe.router.make_url(converted);

    frappe.route_options = prev_route_options;

    // Lien <a target="_blank"> : le navigateur ouvre en général un onglet ;
    // window.open sans contexte « navigation » peut être traité comme popup (fenêtre).
    const a = document.createElement("a");
    a.href = sub_path;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function add_create_buttons(frm) {
    if (["Terminé", "Annulé"].includes(frm.doc.status)) {
        return;
    }

    if (frappe.model.can_create("Demande Faisabilite")) {
        frm.add_custom_button(__("Demande de faisabilité"), function() {
            if (!frm.doc.customer) {
                frappe.msgprint(__("Veuillez sélectionner un client avant de créer une demande de faisabilité."));
                return;
            }

            open_new_doc_in_new_tab("Demande Faisabilite", {
                client: frm.doc.customer,
                date_livraison: frm.doc.echeance || frappe.datetime.add_days(frappe.datetime.now_date(), 7),
                type: "Premier Tirage"
            });
        }, __("Créer"));
    }

    if (frappe.model.can_create("Item")) {
        frm.add_custom_button(__("Article"), function() {
            if (!frm.doc.customer) {
                frappe.msgprint(__("Veuillez sélectionner un client avant de créer un article."));
                return;
            }

            open_new_doc_in_new_tab("Item", {
                custom_client: frm.doc.customer
            });
        }, __("Créer"));
    }
}

function style_urgence_group_secondary(frm) {
    const group_urgence = __("Urgence");
    const $group = frm.page.get_inner_group_button(group_urgence);
    if ($group.length) {
        $group.find("> button").removeClass("btn-default btn-danger").addClass("btn-secondary");
    }
}

function add_demande_urgence_button(frm) {
    if (frm.is_new()) {
        return;
    }
    if (["Terminé", "Annulé"].includes(frm.doc.status)) {
        return;
    }
    if (frm.doc.docstatus === 1) {
        return;
    }
    const statut_demande = frm.doc.statut_demande_urgence || "Aucune";
    if (statut_demande === "En attente" || statut_demande === "Validée") {
        return;
    }

    frm.add_custom_button(
        __("Demande d'urgence"),
        function() {
            open_demande_urgence_prompt(frm);
        },
        __("Urgence")
    );
}

function add_annuler_demande_urgence_button(frm) {
    if (frm.is_new()) {
        return;
    }
    if (["Terminé", "Annulé"].includes(frm.doc.status)) {
        return;
    }
    if (frm.doc.docstatus === 1) {
        return;
    }
    if ((frm.doc.statut_demande_urgence || "") !== "En attente") {
        return;
    }
    const is_commercial = (frm.doc.commercial || "") === frappe.session.user;
    const is_administrator = frappe.session.user === "Administrator";
    if (!is_commercial && !is_administrator) {
        return;
    }

    frm.add_custom_button(
        __("Annuler la demande"),
        function() {
            frappe.confirm(
                __(
                    "La demande d'urgence sera supprimée et le ticket repassera au niveau U0 (aucune urgence). Continuer ?"
                ),
                function() {
                    frappe.call({
                        method: "aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial.cancel_urgence_request",
                        args: { docname: frm.doc.name },
                        freeze: true,
                        freeze_message: __("Annulation..."),
                        callback: function(r) {
                            if (!r.exc) {
                                frappe.show_alert({
                                    message: __("Demande d'urgence annulée — ticket en U0."),
                                    indicator: "green"
                                });
                                frm.reload_doc();
                            }
                        }
                    });
                }
            );
        },
        __("Urgence")
    );
}

function add_admin_urgence_validation_buttons(frm) {
    if (!frappe.user.has_role("Administrateur Ventes")) {
        return;
    }
    if (frm.is_new()) {
        return;
    }
    if (frm.doc.docstatus === 1) {
        return;
    }
    if (["Terminé", "Annulé"].includes(frm.doc.status)) {
        return;
    }
    if ((frm.doc.statut_demande_urgence || "") !== "En attente") {
        return;
    }

    frm.add_custom_button(
        __("Valider l'urgence"),
        function() {
            open_valider_urgence_prompt(frm);
        },
        __("Urgence")
    );

    frm.add_custom_button(
        __("Refuser l'urgence"),
        function() {
            open_refuser_urgence_prompt(frm);
        },
        __("Urgence")
    );
}

function plain_text_to_text_editor_html(text) {
    const t = (text || "").trim();
    if (!t) {
        return "";
    }
    return t
        .split("\n")
        .map((line) => `<p>${frappe.utils.escape_html(line) || "<br>"}</p>`)
        .join("");
}

function open_demande_urgence_prompt(frm) {
    frappe.prompt(
        [
            {
                fieldname: "niveau_demande_saisi",
                fieldtype: "Select",
                label: __("Niveau d'urgence demandé"),
                options: "U0\nU1\nU2\nU3",
                default: frm.doc.niveau_urgence_demande || frm.doc.niveau_urgence || "U0",
                reqd: 1
            },
            {
                fieldname: "descr_urgence_saisie",
                fieldtype: "Small Text",
                label: __("Description pour validation"),
                reqd: 1,
                description: __(
                    "Motif de la demande. Le niveau validé sur le ticket sera défini par un Administrateur Ventes."
                )
            }
        ],
        function(values) {
            const html = plain_text_to_text_editor_html(values.descr_urgence_saisie);
            if (!html) {
                frappe.msgprint(__("La description ne peut pas être vide."));
                return;
            }

            frappe.call({
                method: "aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial.submit_urgence_request",
                args: {
                    docname: frm.doc.name,
                    niveau_demande: values.niveau_demande_saisi,
                    descr_urgence_html: html
                },
                freeze: true,
                freeze_message: __("Enregistrement de la demande..."),
                callback: function(r) {
                    if (!r.exc) {
                        frappe.show_alert({
                            message: __("Demande d'urgence enregistrée — en attente de validation."),
                            indicator: "green"
                        });
                        frm.reload_doc();
                    }
                }
            });
        },
        __("Demande d'urgence"),
        __("Enregistrer")
    );
}

function open_valider_urgence_prompt(frm) {
    frappe.prompt(
        [
            {
                fieldname: "niveau_valide",
                fieldtype: "Select",
                label: __("Niveau d'urgence validé"),
                options: "U0\nU1\nU2\nU3",
                default: frm.doc.niveau_urgence_demande || frm.doc.niveau_urgence || "U0",
                reqd: 1
            },
            {
                fieldname: "commentaire_validation",
                fieldtype: "Small Text",
                label: __("Commentaire (optionnel)")
            }
        ],
        function(values) {
            frappe.call({
                method: "aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial.process_urgence_decision",
                args: {
                    docname: frm.doc.name,
                    action: "validate",
                    niveau_valide: values.niveau_valide,
                    commentaire: values.commentaire_validation || ""
                },
                freeze: true,
                freeze_message: __("Validation..."),
                callback: function(r) {
                    if (!r.exc) {
                        frappe.show_alert({
                            message: __("Demande d'urgence validée."),
                            indicator: "green"
                        });
                        frm.reload_doc();
                    }
                }
            });
        },
        __("Valider l'urgence"),
        __("Valider")
    );
}

function open_refuser_urgence_prompt(frm) {
    frappe.prompt(
        [
            {
                fieldname: "commentaire_refus",
                fieldtype: "Small Text",
                label: __("Motif du refus"),
                reqd: 1
            }
        ],
        function(values) {
            frappe.call({
                method: "aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial.process_urgence_decision",
                args: {
                    docname: frm.doc.name,
                    action: "refuse",
                    commentaire: values.commentaire_refus || ""
                },
                freeze: true,
                freeze_message: __("Traitement..."),
                callback: function(r) {
                    if (!r.exc) {
                        frappe.show_alert({
                            message: __("Demande d'urgence refusée."),
                            indicator: "orange"
                        });
                        frm.reload_doc();
                    }
                }
            });
        },
        __("Refuser l'urgence"),
        __("Refuser")
    );
}

function render_urgence_html(frm) {
    const field = frm.get_field("html_urgence");
    if (!field || !field.$wrapper) {
        return;
    }

    if (frm.is_new()) {
        field.$wrapper.empty();
        frm.toggle_display("html_urgence", false);
        return;
    }

    const niveau = frm.doc.niveau_urgence || "U0";
    const niveau_demande = frm.doc.niveau_urgence_demande || "";
    const statut = frm.doc.statut_demande_urgence || "Aucune";

    /* Pas d'urgence active : niveau U0 et aucune demande en cours / historisée */
    if ((statut || "Aucune") === "Aucune" && (niveau || "U0") === "U0") {
        field.$wrapper.empty();
        frm.toggle_display("html_urgence", false);
        return;
    }

    frm.toggle_display("html_urgence", true);
    const descr = frm.doc.descr_urgence || "";
    const validee_par = frm.doc.urgence_validee_par || "";
    const validee_le = frm.doc.urgence_validee_le || "";
    const commentaire = frm.doc.commentaire_validation_urgence || "";

    // Palette par niveau (U0 vert → U1 jaune → U2 orange → U3 rouge)
    const niveau_colors = {
        U0: { bg: "#d1fae5", fg: "#065f46", label: __("Aucune urgence") },
        U1: { bg: "#fef08a", fg: "#854d0e", label: __("Faible") },
        U2: { bg: "#fed7aa", fg: "#c2410c", label: __("Modérée") },
        U3: { bg: "#fecaca", fg: "#b91c1c", label: __("Critique") }
    };
    // Statuts : tons alignés sur la même logique visuelle
    const statut_colors = {
        "Aucune":     { bg: "#f1f5f9", fg: "#475569", icon: "○" },
        "En attente": { bg: "#fef9c3", fg: "#854d0e", icon: "⏳" },
        "Validée":    { bg: "#d1fae5", fg: "#065f46", icon: "✓" },
        "Refusée":    { bg: "#fecaca", fg: "#b91c1c", icon: "✕" }
    };

    const nC = niveau_colors[niveau] || niveau_colors.U0;
    const sC = statut_colors[statut] || statut_colors["Aucune"];

    const badge = (text, bg, fg) => `
        <span style="
            display:inline-flex;align-items:center;gap:4px;
            padding:4px 11px;border-radius:9999px;
            background:${bg};color:${fg};
            font-size:12px;font-weight:600;line-height:1;
            letter-spacing:0.01em;
            white-space:nowrap;">${frappe.utils.escape_html(text)}</span>`;

    const row = (label, value) => `
        <div style="display:flex;gap:8px;padding:4px 0;font-size:12px;">
            <span style="color:#6c757d;min-width:130px;">${frappe.utils.escape_html(label)}</span>
            <span style="color:#212529;">${value}</span>
        </div>`;

    /** Libellé + valeur sur une même ligne ; largeur fixe du libellé pour aligner les badges. */
    const niveau_ligne = (label_text, value_html, opts = {}) => {
        const mt = opts.first ? "14px" : "10px";
        return `
        <div style="display:flex;align-items:center;gap:8px;margin-top:${mt};min-height:28px;">
            <span style="flex:0 0 11.75rem;min-width:11.75rem;max-width:11.75rem;font-size:12px;font-weight:600;color:#64748b;white-space:nowrap;">
                ${frappe.utils.escape_html(label_text)} :
            </span>
            <div style="display:flex;align-items:center;min-width:0;">${value_html}</div>
        </div>`;
    };

    const actuel_html = badge(niveau + " — " + nC.label, nC.bg, nC.fg);

    let demande_html = "";
    if (niveau_demande) {
        const ndC = niveau_colors[niveau_demande] || niveau_colors.U0;
        demande_html = badge(niveau_demande + " — " + ndC.label, ndC.bg, ndC.fg);
    } else {
        demande_html = `<span style="font-size:12px;color:#94a3b8;">${frappe.utils.escape_html(__("Aucune"))}</span>`;
    }

    let descr_block = "";
    if (descr && (statut === "En attente" || statut === "Refusée")) {
        descr_block = `
            <div style="margin-top:8px;padding:8px 10px;background:#f8fafc;
                        border-left:3px solid #cbd5e1;border-radius:8px;
                        font-size:12px;color:#475569;">
                <div style="color:#6c757d;font-weight:600;margin-bottom:3px;">
                    ${__("Motif")}
                </div>
                <div>${descr}</div>
            </div>`;
    }

    let decision_block = "";
    if ((statut === "Validée" || statut === "Refusée") && validee_par) {
        const date_str = validee_le ? frappe.datetime.str_to_user(validee_le) : "";
        decision_block += row(
            statut === "Validée" ? __("Validée par") : __("Refusée par"),
            `<span>${frappe.utils.escape_html(validee_par)}</span>` +
            (date_str ? ` <span style="color:#6c757d;">— ${frappe.utils.escape_html(date_str)}</span>` : "")
        );
        if (commentaire) {
            decision_block += `
                <div style="margin-top:6px;padding:8px 10px;background:#f8fafc;
                            border-left:3px solid ${statut === "Validée" ? "#059669" : "#dc2626"};
                            border-radius:8px;font-size:12px;color:#475569;">
                    <div style="color:#6c757d;font-weight:600;margin-bottom:3px;">
                        ${__("Commentaire")}
                    </div>
                    <div>${frappe.utils.escape_html(commentaire)}</div>
                </div>`;
        }
    }

    const show_statut_demande = (statut || "Aucune") !== "Aucune";
    const statut_badge_html = show_statut_demande
        ? badge(sC.icon + " " + statut, sC.bg, sC.fg)
        : "";

    const html = `
        <div style="border:1px solid #e2e8f0;border-radius:10px;
                    padding:12px 14px;background:#ffffff;box-shadow:0 1px 2px rgba(15,23,42,0.04);">
            <div style="display:flex;align-items:center;flex-wrap:wrap;gap:10px;">
                <span style="font-size:14px;font-weight:600;color:#0f172a;letter-spacing:-0.01em;">
                    ${frappe.utils.escape_html(__("Urgence Dossier"))}
                </span>
                ${statut_badge_html}
            </div>
            ${niveau_ligne(__("Niveau actuel"), actuel_html, { first: true })}
            ${niveau_ligne(__("Niveau demandé"), demande_html)}
            ${descr_block}
            ${decision_block ? `<div style="margin-top:12px;">${decision_block}</div>` : ""}
        </div>`;

    field.$wrapper.html(html);
}

function update_assigne_a(frm, assigne_user) {
    frappe.call({
        method: "aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial.update_assigne_a",
        args: {
            docname: frm.doc.name,
            assigne_user: assigne_user
        },
        callback: function(r) {
            if (r.message && r.message.status === "success") {
                let userFullName = r.message.full_name || assigne_user;
                frm.set_value("assigne_a", assigne_user);
                frm.set_value("assigne_a_nom", userFullName);
                frm.refresh_field("assigne_a");
                frm.refresh_field("assigne_a_nom");
                frappe.show_alert({ message: __("Utilisateur assigné : ") + userFullName, indicator: "green" });
                frm.reload_doc();
            } else {
                let error_msg = r.message ? r.message.message : __("Erreur inconnue");
                frappe.show_alert({ message: __("Erreur lors de la mise à jour : ") + error_msg, indicator: "red" });
                console.error("Erreur update_assigne_a (callback):", r);
            }
        },
        error: function(r) {
            frappe.show_alert({ message: __("Erreur de communication serveur"), indicator: "red" });
            console.error("Erreur update_assigne_a (error):", r);
        }
    });
}
