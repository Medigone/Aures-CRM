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
        render_suivi_cycle_html(frm);
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
        render_suivi_cycle_html(frm);
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

    // Demande de faisabilité : visible seulement si le back-office a démarré le ticket
    const can_create_linked_docs = frm.doc.status === "En Cours";

    // Demande de faisabilité : n'apparaît que s'il n'existe déjà aucune demande « ouverte »
    // (hors Annulée / Fermée), cf. get_primary_open_demande_for_ticket
    if (can_create_linked_docs && frappe.model.can_create("Demande Faisabilite") && !frm.is_new() && frm.doc.name) {
        const ticket_name = frm.doc.name;
        frappe.call({
            method: "aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial.get_primary_open_demande_for_ticket",
            args: { ticket_name: ticket_name },
            callback: function(r) {
                if (!frm || !frm.doc || frm.doc.name !== ticket_name) {
                    return;
                }
                if (r.message && r.message.name) {
                    return;
                }
                frm.add_custom_button(
                    __("Demande de faisabilité"),
                    function() {
                        if (!frm.doc.customer) {
                            frappe.msgprint(
                                __(
                                    "Veuillez sélectionner un client avant de créer une demande de faisabilité."
                                )
                            );
                            return;
                        }
                        if (frm.is_new() || !frm.doc.name) {
                            frappe.msgprint(
                                __(
                                    "Enregistrez le ticket avant de créer une demande de faisabilité."
                                )
                            );
                            return;
                        }
                        open_new_doc_in_new_tab("Demande Faisabilite", {
                            client: frm.doc.customer,
                            date_livraison:
                                frm.doc.echeance ||
                                frappe.datetime.add_days(frappe.datetime.now_date(), 7),
                            type: "Premier Tirage",
                            ticket_commercial: frm.doc.name,
                            niveau_urgence: frm.doc.niveau_urgence
                        });
                    },
                    __("Créer")
                );
            }
        });
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
    if (statut_demande === "En attente") {
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
    const statutUrgence = frm.doc.statut_demande_urgence || "";
    if (statutUrgence !== "En attente" && statutUrgence !== "Validée") {
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
            const estValidee = (frm.doc.statut_demande_urgence || "") === "Validée";
            const msgAnnulation = estValidee
                ? __(
                      "L'urgence validée sera annulée et le ticket repassera au niveau U0 (aucune urgence). " +
                          "L'historique restera visible dans la chronologie du ticket. Continuer ?"
                  )
                : __(
                      "La demande d'urgence sera supprimée et le ticket repassera au niveau U0 (aucune urgence). Continuer ?"
                  );
            frappe.confirm(
                msgAnnulation,
                function() {
                    frappe.call({
                        method: "aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial.cancel_urgence_request",
                        args: { docname: frm.doc.name },
                        freeze: true,
                        freeze_message: __("Annulation..."),
                        callback: function(r) {
                            if (!r.exc) {
                                frappe.show_alert({
                                    message: estValidee
                                        ? __("Urgence annulée — ticket repassé en U0.")
                                        : __("Demande d'urgence annulée — ticket en U0."),
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

function default_niveau_demande_urgence_sans_u0(frm) {
    const candidat = frm.doc.niveau_urgence_demande || frm.doc.niveau_urgence;
    if (["U1", "U2", "U3"].includes(candidat)) {
        return candidat;
    }
    return "U1";
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
                options: "U1\nU2\nU3",
                default: default_niveau_demande_urgence_sans_u0(frm),
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

    if (statut === "Aucune" && niveau === "U0") {
        field.$wrapper.empty();
        frm.toggle_display("html_urgence", false);
        return;
    }

    frm.toggle_display("html_urgence", true);

    const descr = frm.doc.descr_urgence || "";
    const validee_par = frm.doc.urgence_validee_par || "";
    const validee_le = frm.doc.urgence_validee_le || "";
    const commentaire = frm.doc.commentaire_validation_urgence || "";

    const NIVEAUX = {
        U0: { label: __("Aucune urgence"), bg: "#dcfce7", fg: "#166534" },
        U1: { label: __("Faible"), bg: "#fef9c3", fg: "#854d0e" },
        U2: { label: __("Modérée"), bg: "#ffedd5", fg: "#9a3412" },
        U3: { label: __("Critique"), bg: "#fee2e2", fg: "#991b1b" }
    };
    const STATUTS = {
        "En attente": { bg: "#fefce8", fg: "#854d0e", border: "#fde047", accent: "#f59e0b" },
        "Validée": { bg: "#f0fdf4", fg: "#166534", border: "#86efac", icon: "✓", accent: "#10b981" },
        "Refusée": { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5", icon: "✕", accent: "#ef4444" }
    };

    const nC = NIVEAUX[niveau] || NIVEAUX.U0;
    const sC = STATUTS[statut] || {
        bg: "#f1f5f9",
        fg: "#475569",
        border: "#cbd5e1",
        icon: "",
        accent: "#94a3b8"
    };

    const stroke = sC.fg;
    let statutIconHtml = "";
    if (statut === "En attente") {
        statutIconHtml = `<span style="display:inline-flex;align-items:center;justify-content:center;width:10px;height:10px;line-height:1;flex-shrink:0"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display:block"><path d="M12 6L12 12L18 12" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>`;
    } else if (sC.icon) {
        statutIconHtml = `<span style="display:inline-flex;align-items:center;justify-content:center;width:10px;height:10px;line-height:1;flex-shrink:0;font-size:10px">${frappe.utils.escape_html(sC.icon)}</span>`;
    }

    const level_chip = (code, nObj) => `
        <span style="display:inline-flex;align-items:center;gap:4px;
            padding:2px 8px;border-radius:4px;
            background:${nObj.bg};color:${nObj.fg};
            font-size:11.5px;font-weight:700;letter-spacing:0.02em;">
            ${frappe.utils.escape_html(code)}
            <span style="font-weight:400;opacity:0.75;">&nbsp;${frappe.utils.escape_html(nObj.label)}</span>
        </span>`;

    const date_str = validee_le ? frappe.datetime.str_to_user(validee_le) : "";

    let motif_block = "";
    if (descr && (statut === "En attente" || statut === "Refusée")) {
        motif_block = `
            <div style="margin-top:9px;padding:7px 9px;background:#f8fafc;
                border-radius:5px;font-size:12px;color:#475569;">
                <span style="font-weight:600;color:#94a3b8;font-size:10.5px;
                    text-transform:uppercase;letter-spacing:0.05em;margin-right:5px;">
                    ${__("Motif")} :
                </span>
                ${descr}
            </div>`;
    }

    let decision_block = "";
    if ((statut === "Validée" || statut === "Refusée") && validee_par) {
        decision_block = `
            <div style="margin-top:9px;font-size:11.5px;color:#64748b;">
                <span style="font-weight:600;">${frappe.utils.escape_html(statut === "Validée" ? __("Validée") : __("Refusée"))} ${__("par")}</span>
                ${frappe.utils.escape_html(validee_par)}
                ${date_str ? `<span style="color:#94a3b8;margin-left:5px;">· ${frappe.utils.escape_html(date_str)}</span>` : ""}
            </div>`;
        if (commentaire) {
            decision_block += `
                <div style="margin-top:6px;padding:7px 9px;
                    background:${statut === "Validée" ? "#f0fdf4" : "#fff5f5"};
                    border-radius:5px;font-size:12px;color:#475569;
                    border-left:2px solid ${sC.accent};">
                    ${frappe.utils.escape_html(commentaire)}
                </div>`;
        }
    }

    const html = `
        <div style="display:flex;border:1px solid #e2e8f0;border-radius:8px;
            overflow:hidden;background:#fff;margin:0;
            box-shadow:0 1px 4px rgba(15,23,42,0.06);">
            <div style="width:4px;flex-shrink:0;background:${sC.accent};"></div>
            <div style="flex:1;padding:11px 13px 12px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                    <span style="font-size:12px;font-weight:700;color:#334155;
                        text-transform:uppercase;letter-spacing:0.06em;">
                        ${__("Urgence Dossier")}
                    </span>
                    <span style="font-size:10px;font-weight:600;color:${sC.fg};
                        background:${sC.bg};border:1px solid ${sC.border};
                        padding:1px 6px;border-radius:3px;line-height:1.4;
                        display:inline-flex;align-items:center;gap:4px;">
                        ${statutIconHtml}${frappe.utils.escape_html(statut)}
                    </span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <div style="display:flex;flex-direction:column;gap:3px;">
                        <span style="font-size:10px;color:#94a3b8;font-weight:600;
                            text-transform:uppercase;letter-spacing:0.05em;">${__("Actuel")}</span>
                        ${level_chip(niveau, nC)}
                    </div>
                    ${niveau_demande && NIVEAUX[niveau_demande] && niveau_demande !== niveau ? `
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#cbd5e1"
                            stroke-width="1.5" stroke-linecap="round" style="margin-top:14px;">
                            <path d="M3 7h8M7 3l4 4-4 4"/>
                        </svg>
                        <div style="display:flex;flex-direction:column;gap:3px;">
                            <span style="font-size:10px;color:#94a3b8;font-weight:600;
                                text-transform:uppercase;letter-spacing:0.05em;">${__("Demandé")}</span>
                            ${level_chip(niveau_demande, NIVEAUX[niveau_demande])}
                        </div>
                    ` : ""}
                </div>
                ${motif_block}
                ${decision_block}
            </div>
        </div>`;

    field.$wrapper.html(html);
    field.$wrapper.css({ "margin-top": "10px", "margin-bottom": "10px" });
}

/**
 * Correspondance statuts ERPNext (Quotation / Sales Order) -> clés de libellé FR
 * (aligné sur la logique de demande_faisabilite.js — get_status_badge)
 */
const ERPNext_VENTE_STATUS_TO_FR = {
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

/** Libellé français pour le suivi (devis / commande) ; laisse inchangé si déjà en français ou inconnu. */
function label_vente_status_pour_affichage(status) {
    if (status == null || status === "") {
        return "";
    }
    const frKey = ERPNext_VENTE_STATUS_TO_FR[status];
    if (frKey) {
        return __(frKey);
    }
    return status;
}

function cycle_status_badge(status) {
    const s = status || "";
    const styleByFrKey = {
        Nouveau: { bg: "rgba(17, 138, 178, 0.1)", fg: "#118ab2" },
        "En étude": { bg: "rgba(244, 162, 97, 0.1)", fg: "#f4a261" },
        Programmée: { bg: "rgba(17, 138, 178, 0.1)", fg: "#118ab2" },
        Réalisable: { bg: "rgba(42, 157, 143, 0.1)", fg: "#2a9d8f" },
        "Non Réalisable": { bg: "rgba(230, 57, 70, 0.1)", fg: "#e63946" },
        Brouillon: { bg: "rgba(108, 117, 125, 0.1)", fg: "#6c757d" },
        Soumis: { bg: "rgba(0, 123, 255, 0.1)", fg: "#007bff" },
        Annulé: { bg: "rgba(230, 57, 70, 0.1)", fg: "#e63946" },
        Ouvert: { bg: "rgba(0, 123, 255, 0.1)", fg: "#007bff" },
        Perdu: { bg: "rgba(231, 111, 81, 0.1)", fg: "#e76f51" },
        Commandé: { bg: "rgba(40, 167, 69, 0.1)", fg: "#28a745" },
        Terminé: { bg: "rgba(40, 167, 69, 0.1)", fg: "#28a745" },
        Fermé: { bg: "rgba(40, 167, 69, 0.1)", fg: "#28a745" },
        "À livrer et facturer": { bg: "rgba(255, 193, 7, 0.15)", fg: "#856404" },
        "À facturer": { bg: "rgba(255, 193, 7, 0.15)", fg: "#856404" },
        "À livrer": { bg: "rgba(255, 193, 7, 0.15)", fg: "#856404" },
        "En attente": { bg: "rgba(108, 117, 125, 0.1)", fg: "#6c757d" },
        // Secours : libellé anglais si jamais affiché sans traduction
        Open: { bg: "rgba(0, 123, 255, 0.1)", fg: "#007bff" },
        Ordered: { bg: "rgba(40, 167, 69, 0.1)", fg: "#28a745" },
        Draft: { bg: "rgba(108, 117, 125, 0.1)", fg: "#6c757d" },
        "To Deliver and Bill": { bg: "rgba(255, 193, 7, 0.15)", fg: "#856404" }
    };
    const frKeyForStyle = ERPNext_VENTE_STATUS_TO_FR[s] || s;
    const c = styleByFrKey[frKeyForStyle] || styleByFrKey[s] || {
        bg: "rgba(71, 85, 105, 0.1)",
        fg: "#475569"
    };
    const displayText =
        ERPNext_VENTE_STATUS_TO_FR[s] != null ? label_vente_status_pour_affichage(s) : s;
    return (
        "<span style=\"display:inline-block;padding:1px 7px;border-radius:10px;font-size:10px;font-weight:600;" +
        "background:" +
        c.bg +
        ";color:" +
        c.fg +
        ";\">" +
        frappe.utils.escape_html(displayText) +
        "</span>"
    );
}

/** Types de ticket pour lesquels le bloc « Suivi du cycle » est affiché (aligné sur le DocType + depends_on) */
const SUIVI_CYCLE_REQUEST_TYPES = [
    "Demande de devis",
    "Bon de commande",
    "Essai Blanc"
];

function is_suivi_cycle_request_type(frm) {
    return SUIVI_CYCLE_REQUEST_TYPES.includes(frm.doc.request_type);
}

function render_suivi_cycle_html(frm) {
    const field = frm.get_field("suivi_cycle_html");
    if (!field || !field.$wrapper) {
        return;
    }
    if (!is_suivi_cycle_request_type(frm)) {
        field.$wrapper.empty();
        return;
    }
    if (frm.is_new()) {
        field.$wrapper.html(
            "<p class=\"text-muted small\" style=\"padding:8px 0;\">" +
                frappe.utils.escape_html(
                    __("Enregistrez le ticket pour afficher le suivi des demandes, devis et commandes.")
                ) +
                "</p>"
        );
        return;
    }

    field.$wrapper.html(
        "<p class=\"text-muted small\" style=\"padding:8px 0;\">" + __("Chargement…") + "</p>"
    );

    frappe.call({
        method: "aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial.get_cycle_documents",
        args: { ticket_name: frm.doc.name },
        callback: function(res) {
            const demandes = (res.message && res.message.demandes) || [];
            if (!demandes.length) {
                field.$wrapper.html(
                    "<p class=\"text-muted small\" style=\"padding:8px 0;\">" +
                        frappe.utils.escape_html(
                            __(
                                "Aucune demande de faisabilité liée. Utilisez Créer → Demande de faisabilité pour démarrer le cycle."
                            )
                        ) +
                        "</p>"
                );
                return;
            }

            let html = "<div style=\"display:flex;flex-direction:column;gap:14px;\">";
            demandes.forEach(function(d) {
                const demName = frappe.utils.escape_html(d.name);
                const demType = d.type ? " · " + frappe.utils.escape_html(d.type) : "";
                const demStat = d.status || "";
                html += "<div style=\"border:0.5px solid #d1d8dd;border-radius:8px;overflow:hidden;background:#fff;\">";
                html +=
                    "<div style=\"padding:8px 12px;border-bottom:0.5px solid #d1d8dd;background:#f8f9fa;font-size:12px;font-weight:600;\">";
                html +=
                    "<a href=\"#\" onclick=\"frappe.set_route('Form','Demande Faisabilite','" +
                    d.name +
                    "');return false;\">" +
                    demName +
                    "</a>" +
                    demType +
                    " &nbsp; ";
                html += cycle_status_badge(demStat);
                html += "</div>";

                html += "<div style=\"padding:10px 12px;display:flex;flex-direction:column;gap:10px;\">";
                // Études
                html += "<div><div style=\"font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;margin-bottom:4px;\">" + __("Études de faisabilité") + "</div>";
                const etudes = d.etudes || [];
                if (!etudes.length) {
                    html += "<p style=\"font-size:11px;color:#94a3b8;margin:0;\">" + __("Aucune étude.") + "</p>";
                } else {
                    etudes.forEach(function(e) {
                        const dt = e.doctype || "Etude Faisabilite";
                        const st = e.status || "";
                        html += "<div style=\"font-size:12px;margin-bottom:4px;\">";
                        html +=
                            "<a href=\"#\" onclick=\"frappe.set_route('Form','" +
                            dt +
                            "','" +
                            e.name +
                            "');return false;\">" +
                            frappe.utils.escape_html(e.name) +
                            "</a> ";
                        html += cycle_status_badge(st);
                        html += "</div>";
                    });
                }
                html += "</div>";

                // Documents de vente
                html += "<div><div style=\"font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;margin-bottom:4px;\">" + __("Devis & commandes") + "</div>";
                const sales = d.sales_documents || [];
                if (!sales.length) {
                    html += "<p style=\"font-size:11px;color:#94a3b8;margin:0;\">" + __("Aucun devis ni commande liés.") + "</p>";
                } else {
                    sales.forEach(function(doc) {
                        const st = doc.status || "";
                        html += "<div style=\"font-size:12px;margin-bottom:6px;\">";
                        if (doc.doctype === "Quotation") {
                            html += "<strong>" + __("Devis") + ":</strong> ";
                            html +=
                                "<a href=\"#\" onclick=\"frappe.set_route('Form','Quotation','" +
                                doc.name +
                                "');return false;\">" +
                                frappe.utils.escape_html(doc.name) +
                                "</a> ";
                        } else if (doc.doctype === "Sales Order") {
                            html += "<strong>" + __("Commande") + ":</strong> ";
                            html +=
                                "<a href=\"#\" onclick=\"frappe.set_route('Form','Sales Order','" +
                                doc.name +
                                "');return false;\">" +
                                frappe.utils.escape_html(doc.name) +
                                "</a> ";
                            {
                                const bcNum = doc.bon_de_commande_client;
                                const bcDate = doc.delivery_date;
                                if (bcNum || bcDate) {
                                    const parts = [];
                                    if (bcNum) {
                                        parts.push(
                                            "N\u00ba BC: " + frappe.utils.escape_html(bcNum)
                                        );
                                    }
                                    if (bcDate) {
                                        parts.push(
                                            __("Livraison") +
                                                " : " +
                                                frappe.datetime.str_to_user(bcDate)
                                        );
                                    }
                                    html +=
                                        "<span style=\"font-size:11px;color:#64748b;margin-left:4px;\">" +
                                        parts.join(" \u00b7 ") +
                                        "</span>";
                                }
                            }
                        }
                        html += cycle_status_badge(st);
                        html += "</div>";
                    });
                }
                html += "</div>";

                html += "</div></div>";
            });
            html += "</div>";
            field.$wrapper.html(html);
        },
        error: function() {
            field.$wrapper.html(
                "<p class=\"text-danger small\">" + __("Impossible de charger le suivi du cycle.") + "</p>"
            );
        }
    });
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
