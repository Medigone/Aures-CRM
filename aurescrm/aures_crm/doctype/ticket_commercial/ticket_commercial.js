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
        setup_rapprochement_devis_query(frm);
        render_rapprochement_bc_html(frm);
    },

    customer: function(frm) {
        // Auto-remplir le nom du client si disponible
        frm._bc_extended_search = 0;
        if (frm.doc.customer) {
            frappe.db.get_value("Customer", frm.doc.customer, "customer_name")
                .then(r => {
                    if (r.message) {
                        frm.set_value("customer_name", r.message.customer_name);
                    }
                });
        }
        render_rapprochement_bc_html(frm);
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
        render_rapprochement_bc_html(frm);
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
    Expired: "Expiré",
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
        Confirmée: { bg: "rgba(13, 110, 253, 0.12)", fg: "#0d6efd" },
        "En Cours": { bg: "rgba(244, 162, 97, 0.14)", fg: "#d97706" },
        "Partiellement Finalisée": { bg: "rgba(108, 117, 125, 0.12)", fg: "#495057" },
        Finalisée: { bg: "rgba(42, 157, 143, 0.14)", fg: "#2a9d8f" },
        "Devis Établis": { bg: "rgba(0, 123, 255, 0.12)", fg: "#007bff" },
        Commandé: { bg: "rgba(40, 167, 69, 0.14)", fg: "#28a745" },
        Fermée: { bg: "rgba(108, 117, 125, 0.12)", fg: "#475569" },
        Annulée: { bg: "rgba(230, 57, 70, 0.12)", fg: "#e63946" },
        Soumis: { bg: "rgba(0, 123, 255, 0.1)", fg: "#007bff" },
        Annulé: { bg: "rgba(230, 57, 70, 0.1)", fg: "#e63946" },
        Ouvert: { bg: "rgba(0, 123, 255, 0.1)", fg: "#007bff" },
        Expiré: { bg: "rgba(220, 53, 69, 0.12)", fg: "#c0392b" },
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
        ERPNext_VENTE_STATUS_TO_FR[s] != null ? label_vente_status_pour_affichage(s) : __(s);
    return (
        "<span style=\"display:inline-block;flex-shrink:0;padding:0 5px;border-radius:8px;font-size:9px;font-weight:600;line-height:1.35;white-space:nowrap;" +
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
                        html +=
                            "<span style=\"display:inline-block;margin-left:8px;vertical-align:middle;\">" +
                            cycle_status_badge(st) +
                            "</span>";
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

const RAPPROCHEMENT_BC_REQUEST_TYPE = "Bon de commande";

const BC_COMMAND_STATUS_LABELS = {
    "Entièrement commandé": __("Entièrement commandé"),
    "Partiellement commandé": __("Partiellement commandé"),
    "Non commandé": __("Non commandé"),
};

function format_bc_candidate_total(tot) {
    if (!tot || tot.grand_total == null || tot.grand_total === undefined || tot.grand_total === "") {
        return "—";
    }
    try {
        return format_currency(tot.grand_total, tot.currency);
    } catch (ignore) {
        return (
            frappe.utils.escape_html(String(tot.grand_total)) +
            " " +
            frappe.utils.escape_html(String(tot.currency || ""))
        );
    }
}

function bc_linked_document_line(label, doctypeClass, doctype, name, status) {
    const nameEsc = frappe.utils.escape_html(name);
    const labelEsc = frappe.utils.escape_html(label);
    const colors = {
        df: { bg: "#eff6ff", border: "#bfdbfe" },
        so: { bg: "#f0fdf4", border: "#bbf7d0" },
    };
    const c = colors[doctype] || { bg: "#fff", border: "#e2e8f0" };
    return (
        '<div style="display:flex;flex-direction:column;gap:4px;padding:7px 9px;border:1px solid ' +
        c.border +
        ";border-radius:7px;background:" +
        c.bg +
        ';">' +
        '<span class="text-muted" style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">' +
        labelEsc +
        "</span>" +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;">' +
        '<a href="#" class="' +
        doctypeClass +
        '" data-' +
        doctype +
        '="' +
        nameEsc +
        '" style="font-size:12px;font-weight:600;min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
        nameEsc +
        "</a>" +
        '<div style="flex-shrink:0;">' +
        cycle_status_badge(status || "") +
        "</div></div></div>"
    );
}

function bc_card_actions_panel_html(q, dfName, allowActions) {
    const qEsc = frappe.utils.escape_html(q.name);
    const dfEsc = frappe.utils.escape_html(dfName || "");
    let html =
        '<div class="bc-rapp-actions-panel" data-q="' +
        qEsc +
        '" style="display:none;position:absolute;right:0;top:calc(100% + 4px);z-index:20;min-width:180px;padding:6px;border:1px solid #d1d8dd;border-radius:8px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,0.14);">' +
        '<button type="button" class="btn btn-default btn-xs bc-rapp-items" data-q="' +
        qEsc +
        '" style="display:block;width:100%;text-align:left;margin-bottom:5px;">' +
        frappe.utils.escape_html(__("Voir les articles")) +
        "</button>";
    if (allowActions) {
        html +=
            '<button type="button" class="btn btn-default btn-xs bc-rapp-order" data-q="' +
            qEsc +
            '" data-docstatus="' +
            String(q.docstatus) +
            '" style="display:block;width:100%;text-align:left;margin-bottom:5px;">' +
            frappe.utils.escape_html(__("Créer commande")) +
            "</button>" +
            '<button type="button" class="btn btn-primary btn-xs bc-rapp-pick" data-q="' +
            qEsc +
            '" data-df="' +
            dfEsc +
            '" style="display:block;width:100%;text-align:left;">' +
            frappe.utils.escape_html(__("Retenir ce devis")) +
            "</button>";
    } else {
        html +=
            '<span class="text-muted small" style="display:block;padding:4px 6px;">' +
            frappe.utils.escape_html(__("Actions d'écriture indisponibles.")) +
            "</span>";
    }
    html += "</div>";
    return html;
}

function bc_quotation_block_html(q, dfName, allowActions) {
    const qEsc = frappe.utils.escape_html(q.name);
    let html =
        '<div style="margin-bottom:10px;padding:8px 9px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;">';
    html +=
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">' +
        '<div style="min-width:0;flex:1;">' +
        '<span class="text-muted" style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">' +
        frappe.utils.escape_html(__("Devis")) +
        "</span>" +
        '<div style="display:flex;align-items:center;gap:6px;flex-wrap:nowrap;margin-top:4px;min-width:0;width:100%;">' +
        '<a href="#" class="bc-rapp-open-q" data-q="' +
        qEsc +
        '" style="font-size:12px;font-weight:700;flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
        qEsc +
        "</a>" +
        cycle_status_badge(q.status || "") +
        "</div></div>" +
        '<div style="position:relative;flex-shrink:0;">' +
        '<button type="button" class="btn btn-xs bc-rapp-toggle-actions" data-q="' +
        qEsc +
        '" style="background:#334155;color:#fff;border-color:#334155;font-weight:500;font-size:11px;line-height:1.2;padding:3px 8px;min-height:0;box-shadow:0 1px 2px rgba(15,23,42,0.12);">' +
        frappe.utils.escape_html(__("Actions")) +
        "</button>" +
        bc_card_actions_panel_html(q, dfName, allowActions) +
        "</div></div>";

    const sos = q.sales_orders || [];
    if (sos.length) {
        html += '<div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">';
        sos.forEach(function(so) {
            html += bc_linked_document_line(
                __("Commande"),
                "bc-rapp-open-so",
                "so",
                so.name,
                so.status || ""
            );
        });
        html += "</div>";
    }

    html += "</div>";
    return html;
}

function bc_df_quotations_section_html(c, allowActions) {
    const quotes = c.quotations || [];
    if (!quotes.length) {
        return (
            '<div class="text-muted small" style="padding:7px 9px;border:1px dashed #d1d8dd;border-radius:7px;background:#fff;">' +
            frappe.utils.escape_html(__("Aucun devis commandable lié à cette demande.")) +
            "</div>"
        );
    }
    let html = '<div style="display:flex;flex-direction:column;gap:4px;">';
    quotes.forEach(function(q) {
        html += bc_quotation_block_html(q, c.name, allowActions);
    });
    html += "</div>";
    return html;
}

function bc_df_candidate_card_html(c, allowActions) {
    const dfEsc = frappe.utils.escape_html(c.name);
    const quotes = c.quotations || [];
    const dateStr = c.date_creation ? frappe.datetime.str_to_user(c.date_creation) : "—";
    const typeStr = c.demande_type ? String(c.demande_type) : "—";

    let commandSummary = "";
    if (!quotes.length) {
        commandSummary = "—";
    } else if (quotes.length === 1) {
        const ca = quotes[0].command_analysis || {};
        const commandStatus = BC_COMMAND_STATUS_LABELS[ca.custom_status] || ca.custom_status || "";
        const draftHint =
            ca.has_draft_orders && ca.draft_orders_count
                ? " · " + __("Brouillon(s) : {0}", [String(ca.draft_orders_count)])
                : "";
        commandSummary = commandStatus + draftHint;
    } else {
        commandSummary = __("Devis commandables : {0}", [String(quotes.length)]);
    }

    let html =
        '<div class="bc-rapp-card" data-df="' +
        dfEsc +
        '" style="border:1px solid #d1d8dd;border-radius:10px;background:#f8fafc;box-shadow:0 1px 3px rgba(15,23,42,0.06);overflow:visible;min-width:0;height:100%;display:flex;flex-direction:column;">';
    html +=
        '<div style="padding:10px 12px;background:#f1f5f9;border-bottom:1px solid #e2e8f0;border-radius:10px 10px 0 0;overflow:visible;">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">' +
        '<div style="min-width:0;flex:1;">' +
        '<div style="display:flex;align-items:center;gap:6px;flex-wrap:nowrap;min-width:0;width:100%;">' +
        '<a href="#" class="bc-rapp-open-df" data-df="' +
        dfEsc +
        '" style="font-size:14px;font-weight:700;flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
        dfEsc +
        "</a>" +
        cycle_status_badge(c.demande_status || "") +
        "</div>" +
        '<div class="text-muted" style="margin-top:10px;font-size:11.5px;display:flex;flex-direction:column;gap:7px;">' +
        '<div style="min-height:18px;"><strong>' +
        frappe.utils.escape_html(__("Date création")) +
        ":</strong>&nbsp;" +
        frappe.utils.escape_html(dateStr) +
        "</div>" +
        '<div style="min-height:18px;"><strong>' +
        frappe.utils.escape_html(__("Type")) +
        ":</strong>&nbsp;" +
        frappe.utils.escape_html(typeStr) +
        "</div>" +
        '<div style="line-height:1.35;min-height:calc(1.35em * 2);"><strong>' +
        frappe.utils.escape_html(__("État commande")) +
        ":</strong>&nbsp;" +
        frappe.utils.escape_html(commandSummary) +
        "</div>" +
        "</div></div>" +
        '<div style="flex-shrink:0;">' +
        '<button type="button" class="btn btn-xs bc-rapp-df-items" data-df="' +
        dfEsc +
        '" style="background:#334155;color:#fff;border-color:#334155;font-weight:500;font-size:11px;line-height:1.2;padding:3px 8px;min-height:0;box-shadow:0 1px 2px rgba(15,23,42,0.12);">' +
        frappe.utils.escape_html(__("Articles")) +
        "</button>" +
        "</div></div></div>";
    html +=
        '<div style="padding:10px 12px;background:#f8fafc;border-radius:0 0 10px 10px;flex:1;">' +
        bc_df_quotations_section_html(c, allowActions) +
        "</div></div>";
    return html;
}

function bc_assistant_demande_fa_button_disabled(frm, readOnlyForm) {
    if (readOnlyForm) {
        return true;
    }
    if (!frappe.model.can_create("Demande Faisabilite")) {
        return true;
    }
    if (["Terminé", "Annulé"].includes(frm.doc.status || "")) {
        return true;
    }
    if ((frm.doc.status || "") !== "En Cours") {
        return true;
    }
    return false;
}

function bc_assistant_open_new_demande_faisabilite(frm) {
    if (frm.is_new() || !frm.doc.name) {
        frappe.msgprint(__("Enregistrez le ticket avant de créer une demande de faisabilité."));
        return;
    }
    if (!frm.doc.customer) {
        frappe.msgprint(__("Veuillez sélectionner un client avant de créer une demande de faisabilité."));
        return;
    }
    if (["Terminé", "Annulé"].includes(frm.doc.status)) {
        frappe.msgprint(__("Impossible de créer une demande sur un ticket terminé ou annulé."));
        return;
    }
    if (frm.doc.status !== "En Cours") {
        frappe.msgprint(
            __(
                "Le ticket doit être « En cours » pour créer une demande de faisabilité depuis l'assistant (démarrage par le back-office)."
            )
        );
        return;
    }
    if (!frappe.model.can_create("Demande Faisabilite")) {
        frappe.msgprint(__("Vous n'avez pas la permission de créer une demande de faisabilité."));
        return;
    }
    const ticketName = frm.doc.name;
    frappe.call({
        method: "aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial.get_primary_open_demande_for_ticket",
        args: { ticket_name: ticketName },
        callback: function(r) {
            if (!frm.doc || frm.doc.name !== ticketName) {
                return;
            }
            if (r.message && r.message.name) {
                frappe.msgprint({
                    title: __("Demande déjà ouverte"),
                    indicator: "orange",
                    message: __(
                        "Une demande de faisabilité encore ouverte est déjà liée à ce ticket : {0}.",
                        [r.message.name]
                    ),
                });
                return;
            }
            open_new_doc_in_new_tab("Demande Faisabilite", {
                client: frm.doc.customer,
                date_livraison:
                    frm.doc.echeance || frappe.datetime.add_days(frappe.datetime.now_date(), 7),
                type: "Premier Tirage",
                ticket_commercial: frm.doc.name,
                niveau_urgence: frm.doc.niveau_urgence,
            });
        },
    });
}

function is_rapprochement_bc_ticket(frm) {
    return frm.doc.request_type === RAPPROCHEMENT_BC_REQUEST_TYPE;
}

function setup_rapprochement_devis_query(frm) {
    if (!frm.fields_dict || !frm.fields_dict.devis_rapproche) {
        return;
    }
    frm.set_query("devis_rapproche", function() {
        if (!frm.doc.customer) {
            return { filters: { name: "__no_such_quotation__" } };
        }
        return {
            filters: {
                party_name: frm.doc.customer,
                docstatus: ["!=", 2],
            },
        };
    });
}

function render_rapprochement_bc_html(frm) {
    const field = frm.get_field("rapprochement_bc_html");
    if (!field || !field.$wrapper) {
        return;
    }

    if (!is_rapprochement_bc_ticket(frm)) {
        field.$wrapper.empty();
        frm.toggle_display("rapprochement_bc_html", false);
        return;
    }
    frm.toggle_display("rapprochement_bc_html", true);

    if (frm.is_new()) {
        field.$wrapper.html(
            "<p class=\"text-muted small\" style=\"padding:8px 0;\">" +
                frappe.utils.escape_html(
                    __(
                        "Enregistrez le ticket pour afficher l'assistant de rapprochement des demandes de faisabilité avec le bon de commande client."
                    )
                ) +
                "</p>"
        );
        return;
    }

    if (!frm.doc.customer) {
        field.$wrapper.html(
            "<p class=\"text-muted small\" style=\"padding:8px 0;\">" +
                frappe.utils.escape_html(__("Sélectionnez un client pour afficher les demandes de faisabilité.")) +
                "</p>"
        );
        return;
    }

    const ticketName = frm.doc.name;
    const extended = frm._bc_extended_search ? 1 : 0;
    field.$wrapper.html(
        "<p class=\"text-muted small\" style=\"padding:8px 0;\">" + __("Chargement…") + "</p>"
    );

    frappe.call({
        method: "aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial.get_quotation_candidates_for_ticket_bc",
        args: {
            ticket_name: ticketName,
            months_limit: 18,
            extended_search: extended,
        },
        callback: function(res) {
            if (!frm.doc || frm.doc.name !== ticketName) {
                return;
            }
            if (res.exc) {
                field.$wrapper.html(
                    "<p class=\"text-danger small\">" +
                        __("Impossible de charger l'assistant de rapprochement.") +
                        "</p>"
                );
                return;
            }

            const payload = res.message || {};
            const candidates = payload.candidates || [];
            frm._bc_demande_items = {};
            frm._bc_quote_items = {};
            frm._bc_quote_totals = {};
            frm._bc_last_candidates_map = {};
            candidates.forEach(function(c) {
                frm._bc_demande_items[c.name] = c.items || [];
                (c.quotations || []).forEach(function(q) {
                    frm._bc_quote_items[q.name] = q.items || [];
                    frm._bc_quote_totals[q.name] = {
                        grand_total: q.grand_total,
                        currency: q.currency,
                    };
                });
                frm._bc_last_candidates_map[c.name] = c;
            });

            const canWrite = frappe.model.can_write("Ticket Commercial");
            const readOnlyForm = frm.is_read_only && frm.is_read_only();
            frm._bc_allow_row_mutations = canWrite && !readOnlyForm;
            const dfBtnDis = bc_assistant_demande_fa_button_disabled(frm, readOnlyForm);

            if (!candidates.length) {
                frm._bc_last_candidates_map = {};
                let emptyMsg = extended
                    ? __("Aucune demande de faisabilité trouvée pour ce client sur la période élargie.")
                    : __("Aucune demande de faisabilité sur la période récente pour ce client.");
                let html =
                    "<div style=\"border:0.5px solid #d1d8dd;border-radius:8px;padding:12px;background:#fff;\">";
                html += "<p class=\"text-muted small\" style=\"margin:0;\">" + frappe.utils.escape_html(emptyMsg) + "</p>";
                if (!extended) {
                    html +=
                        "<button type=\"button\" class=\"btn btn-default btn-xs bc-rapp-expand\" style=\"margin-top:10px;\">" +
                        frappe.utils.escape_html(__("Étendre la recherche (sans limite de date)")) +
                        "</button>";
                }
                html +=
                    "<div style=\"margin-top:14px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;\">" +
                    "<button type=\"button\" class=\"btn btn-default btn-xs bc-rapp-create-df\" title=\"" +
                    frappe.utils.escape_html(__("Mêmes règles que « Créer → Demande de faisabilité »")) +
                    "\" " +
                    disabled_attr(dfBtnDis) +
                    ">" +
                    frappe.utils.escape_html(__("Créer demande FA")) +
                    "</button>" +
                    "<button type=\"button\" class=\"btn btn-primary btn-xs bc-rapp-quick\" data-decision=\"" +
                    frappe.utils.escape_html("Nouvelle demande de faisabilité") +
                    "\" " +
                    disabled_attr(!canWrite || readOnlyForm) +
                    ">" +
                    frappe.utils.escape_html(__("Décision : nouvelle demande FA")) +
                    "</button>" +
                    "<button type=\"button\" class=\"btn btn-default btn-xs bc-rapp-quick\" data-decision=\"" +
                    frappe.utils.escape_html("Aucun candidat pertinent") +
                    "\" " +
                    disabled_attr(!canWrite || readOnlyForm) +
                    ">" +
                    frappe.utils.escape_html(__("Décision : aucun candidat")) +
                    "</button>" +
                    "</div></div>";
                field.$wrapper.html(html);
                bind_rapprochement_bc_wrapper(frm, field, canWrite && !readOnlyForm);
                return;
            }

            const extNote = payload.no_date_filter
                ? __("Recherche élargie sur tout l'historique (limite 200 demandes).")
                : __("Fenêtre récente : {0} mois.").replace("{0}", String(payload.months_window || ""));

            let html =
                "<div style=\"border:0.5px solid #d1d8dd;border-radius:8px;overflow:visible;background:#fff;\">";
            html +=
                "<div style=\"padding:8px 12px;border-bottom:0.5px solid #d1d8dd;background:#f8f9fa;display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:center;\">";
            html +=
                "<span style=\"font-size:13px;font-weight:600;color:#1a1a1a;\">" +
                __("Assistant rapprochement BC") +
                "</span>";
            html += "<span class=\"text-muted small\">" + frappe.utils.escape_html(extNote.trim()) + "</span>";
            html += "</div>";

            html += "<div style=\"padding:12px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;background:#fff;overflow:visible;\">";
            candidates.forEach(function(c) {
                html += bc_df_candidate_card_html(c, canWrite && !readOnlyForm);
            });
            html += "</div>";

            html += "<div style=\"padding:8px 12px;border-top:0.5px solid #d1d8dd;background:#fcfcfc;display:flex;flex-wrap:wrap;gap:8px;\">";
            if (!payload.no_date_filter) {
                html +=
                    "<button type=\"button\" class=\"btn btn-default btn-xs bc-rapp-expand\">" +
                    __("Étendre la recherche (sans limite de date)") +
                    "</button>";
            }
            html +=
                "<button type=\"button\" class=\"btn btn-default btn-xs bc-rapp-create-df\" title=\"" +
                frappe.utils.escape_html(__("Mêmes règles que « Créer → Demande de faisabilité »")) +
                "\" " +
                disabled_attr(dfBtnDis) +
                ">" +
                frappe.utils.escape_html(__("Créer demande FA")) +
                "</button>";
            html +=
                "<button type=\"button\" class=\"btn btn-default btn-xs bc-rapp-quick\" data-decision=\"" +
                frappe.utils.escape_html("Nouvelle demande de faisabilité") +
                "\" " +
                disabled_attr(!canWrite || readOnlyForm) +
                ">" +
                __("Décision : nouvelle demande FA") +
                "</button>";
            html +=
                "<button type=\"button\" class=\"btn btn-default btn-xs bc-rapp-quick\" data-decision=\"" +
                frappe.utils.escape_html("Aucun candidat pertinent") +
                "\" " +
                disabled_attr(!canWrite || readOnlyForm) +
                ">" +
                __("Décision : aucun candidat") +
                "</button>";
            html += "</div></div>";

            field.$wrapper.html(html);
            bind_rapprochement_bc_wrapper(frm, field, canWrite && !readOnlyForm);
        },
        error: function() {
            field.$wrapper.html(
                "<p class=\"text-danger small\">" + __("Impossible de charger l'assistant de rapprochement.") + "</p>"
            );
        },
    });
}

function disabled_attr(disabled) {
    return disabled ? "disabled" : "";
}

function bind_rapprochement_bc_wrapper(frm, field, allowMutations) {
    const $w = field.$wrapper;
    $w.off("click", ".bc-rapp-expand");
    $w.on("click", ".bc-rapp-expand", function(e) {
        e.preventDefault();
        frm._bc_extended_search = 1;
        render_rapprochement_bc_html(frm);
    });

    $w.off("click", ".bc-rapp-open-q");
    $w.on("click", ".bc-rapp-open-q", function(e) {
        e.preventDefault();
        const q = $(this).data("q");
        if (q) {
            frappe.set_route("Form", "Quotation", q);
        }
    });

    $w.off("click", ".bc-rapp-open-df");
    $w.on("click", ".bc-rapp-open-df", function(e) {
        e.preventDefault();
        const df = $(this).data("df");
        if (df) {
            frappe.set_route("Form", "Demande Faisabilite", df);
        }
    });

    $w.off("click", ".bc-rapp-toggle-actions");
    $w.on("click", ".bc-rapp-toggle-actions", function(e) {
        e.preventDefault();
        e.stopPropagation();
        const q = $(this).attr("data-q") || $(this).data("q");
        const $card = $(this).closest(".bc-rapp-card");
        const $panel = $card.find('.bc-rapp-actions-panel[data-q="' + q + '"]');
        const willOpen = !$panel.is(":visible");
        $w.find(".bc-rapp-actions-panel").not($panel).hide();
        if (willOpen) {
            $panel.show();
        } else {
            $panel.hide();
        }
    });

    $w.off("click", ".bc-rapp-actions-panel");
    $w.on("click", ".bc-rapp-actions-panel", function(e) {
        e.stopPropagation();
    });

    $(document)
        .off("click.bc_rapp_actions")
        .on("click.bc_rapp_actions", function(e) {
            if ($(e.target).closest(".bc-rapp-actions-panel, .bc-rapp-toggle-actions").length) {
                return;
            }
            $w.find(".bc-rapp-actions-panel").hide();
        });

    $w.off("click", ".bc-rapp-open-so");
    $w.on("click", ".bc-rapp-open-so", function(e) {
        e.preventDefault();
        const so = $(this).attr("data-so") || $(this).data("so");
        if (so) {
            frappe.set_route("Form", "Sales Order", String(so));
        }
    });

    $w.off("click", ".bc-rapp-create-df");
    $w.on("click", ".bc-rapp-create-df", function(e) {
        e.preventDefault();
        bc_assistant_open_new_demande_faisabilite(frm);
    });

    $w.off("click", ".bc-rapp-items");
    $w.on("click", ".bc-rapp-items", function(e) {
        e.preventDefault();
        const q = $(this).attr("data-q") || $(this).data("q");
        $w.find(".bc-rapp-actions-panel").hide();
        open_rapprochement_items_dialog(frm, q);
    });

    $w.off("click", ".bc-rapp-df-items");
    $w.on("click", ".bc-rapp-df-items", function(e) {
        e.preventDefault();
        const df = $(this).attr("data-df") || $(this).data("df");
        $w.find(".bc-rapp-actions-panel").hide();
        open_rapprochement_demande_items_dialog(frm, df);
    });

    if (!allowMutations) {
        return;
    }

    $w.off("click", ".bc-rapp-order");
    $w.on("click", ".bc-rapp-order", function(e) {
        e.preventDefault();
        const q = $(this).attr("data-q") || $(this).data("q");
        const ds = parseInt($(this).attr("data-docstatus"), 10) || 0;
        $w.find(".bc-rapp-actions-panel").hide();
        create_sales_order_from_rapprochement_quote(frm, q, ds);
    });

    $w.off("click", ".bc-rapp-pick");
    $w.on("click", ".bc-rapp-pick", function(e) {
        e.preventDefault();
        const q = $(this).attr("data-q") || $(this).data("q");
        const df = $(this).attr("data-df") || $(this).data("df") || "";
        $w.find(".bc-rapp-actions-panel").hide();
        save_rapprochement_decision(frm, {
            decision_rapprochement: "Devis retenu pour commande",
            devis_rapproche: q,
            demande_faisabilite_rapprochee: df || null,
            commentaire_rapprochement: null,
        });
    });

    $w.off("click", ".bc-rapp-quick");
    $w.on("click", ".bc-rapp-quick", function(e) {
        e.preventDefault();
        const dec = $(this).data("decision");
        frappe.prompt(
            {
                fieldname: "memo",
                fieldtype: "Small Text",
                label: __("Commentaire (optionnel)"),
            },
            function(values) {
                save_rapprochement_decision(frm, {
                    decision_rapprochement: dec,
                    devis_rapproche: null,
                    demande_faisabilite_rapprochee: null,
                    commentaire_rapprochement: values.memo || null,
                });
            },
            __("Confirmation"),
            __("Enregistrer")
        );
    });
}

function open_rapprochement_items_dialog(frm, quotationName) {
    if (!quotationName) {
        return;
    }
    const items = ((frm._bc_quote_items || {})[quotationName]) || [];
    let rows =
        "<table class=\"table table-bordered\"><thead><tr><th>" +
        __("Article") +
        "</th><th>" +
        __("Désignation") +
        "</th><th>" +
        __("Qté") +
        "</th><th>" +
        __("UM") +
        "</th></tr></thead><tbody>";
    items.forEach(function(it) {
        rows +=
            "<tr><td>" +
            frappe.utils.escape_html(it.item_code || "") +
            "</td><td>" +
            frappe.utils.escape_html(it.item_name || "") +
            "</td><td>" +
            frappe.utils.escape_html(String(it.qty != null ? it.qty : "")) +
            "</td><td>" +
            frappe.utils.escape_html(it.uom || "") +
            "</td></tr>";
    });
    rows += "</tbody></table>";
    if (!items.length) {
        rows = "<p class=\"text-muted\">" + __("Aucune ligne article sur ce devis.") + "</p>";
    }

    const totMeta = ((frm._bc_quote_totals || {})[quotationName]) || null;
    let footerHtml = "";
    if (
        totMeta &&
        totMeta.grand_total != null &&
        totMeta.grand_total !== "" &&
        !(typeof totMeta.grand_total === "number" && isNaN(totMeta.grand_total))
    ) {
        footerHtml =
            '<div style="margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0;text-align:right;font-size:13px;">' +
            "<strong>" +
            frappe.utils.escape_html(__("Total du devis")) +
            "</strong> · " +
            format_bc_candidate_total(totMeta) +
            "</div>";
    }

    const d = new frappe.ui.Dialog({
        title: __("Articles — {0}", [quotationName]),
        fields: [
            {
                fieldname: "html_items",
                fieldtype: "HTML",
            },
        ],
        primary_action_label: __("Fermer"),
        primary_action: function() {
            d.hide();
        },
    });
    d.fields_dict.html_items.$wrapper.html(rows + footerHtml);
    d.show();
}

function open_rapprochement_demande_items_dialog(frm, demandeName) {
    if (!demandeName) {
        return;
    }
    const items = ((frm._bc_demande_items || {})[demandeName]) || [];
    let rows =
        '<div style="overflow-x:auto;"><table class="table table-bordered" style="font-size:12px;white-space:nowrap;table-layout:auto;"><thead><tr><th style="white-space:nowrap;padding:6px 8px;">' +
        __("Article") +
        '</th><th style="white-space:nowrap;padding:6px 8px;">' +
        __("Désignation") +
        '</th><th style="white-space:nowrap;padding:6px 8px;">' +
        __("Qté") +
        '</th><th style="white-space:nowrap;padding:6px 8px;">' +
        __("Date livraison") +
        '</th><th style="white-space:nowrap;padding:6px 8px;">' +
        __("Procédé") +
        '</th><th style="white-space:nowrap;padding:6px 8px;">' +
        __("Création") +
        '</th><th style="white-space:nowrap;padding:6px 8px;">' +
        __("Essai Blanc") +
        "</th></tr></thead><tbody>";
    items.forEach(function(it) {
        rows +=
            '<tr><td style="white-space:nowrap;padding:6px 8px;">' +
            frappe.utils.escape_html(it.article || "") +
            '</td><td style="white-space:nowrap;padding:6px 8px;">' +
            frappe.utils.escape_html(it.designation_article || "") +
            '</td><td style="white-space:nowrap;padding:6px 8px;">' +
            frappe.utils.escape_html(String(it.quantite != null ? it.quantite : "")) +
            '</td><td style="white-space:nowrap;padding:6px 8px;">' +
            frappe.utils.escape_html(it.date_livraison ? frappe.datetime.str_to_user(it.date_livraison) : "") +
            '</td><td style="white-space:nowrap;padding:6px 8px;">' +
            frappe.utils.escape_html(it.procede_article || "") +
            '</td><td style="white-space:nowrap;padding:6px 8px;">' +
            frappe.utils.escape_html(it.est_creation ? __("Oui") : __("Non")) +
            '</td><td style="white-space:nowrap;padding:6px 8px;">' +
            frappe.utils.escape_html(it.essai_blanc ? __("Oui") : __("Non")) +
            "</td></tr>";
    });
    rows += "</tbody></table></div>";
    if (!items.length) {
        rows = "<p class=\"text-muted\">" + __("Aucune ligne article sur cette demande de faisabilité.") + "</p>";
    }

    const d = new frappe.ui.Dialog({
        title: __("Articles demande FA — {0}", [demandeName]),
        fields: [
            {
                fieldname: "html_items",
                fieldtype: "HTML",
            },
        ],
        primary_action_label: __("Fermer"),
        primary_action: function() {
            d.hide();
        },
    });
    d.fields_dict.html_items.$wrapper.html(rows);
    d.show();
}

function create_sales_order_from_rapprochement_quote(frm, quotationName, docstatus) {
    if (!quotationName) {
        return;
    }
    if (docstatus !== 1) {
        frappe.msgprint({
            indicator: "orange",
            title: __("Devis"),
            message: __("Validez d'abord le devis avant de créer une commande client."),
        });
        return;
    }
    frappe.confirm(
        __("Créer une commande client brouillon à partir du devis {0} ?", [quotationName]),
        function() {
            frappe.call({
                method: "aurescrm.quotation.make_sales_order_draft",
                args: { source_name: quotationName },
                freeze: true,
                freeze_message: __("Création de la commande…"),
                callback: function(r) {
                    if (r.exc) {
                        return;
                    }
                    const soName = r.message;
                    frappe.show_alert({ message: __("Commande créée"), indicator: "green" });
                    if (soName) {
                        frappe.set_route("Form", "Sales Order", soName);
                    }
                    render_rapprochement_bc_html(frm);
                },
            });
        }
    );
}

function save_rapprochement_decision(frm, args) {
    frappe.call({
        method: "aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial.save_ticket_rapprochement_decision",
        args: {
            ticket_name: frm.doc.name,
            decision_rapprochement: args.decision_rapprochement,
            devis_rapproche: args.devis_rapproche || null,
            demande_faisabilite_rapprochee: args.demande_faisabilite_rapprochee || null,
            commentaire_rapprochement: args.commentaire_rapprochement || null,
        },
        freeze: true,
        freeze_message: __("Enregistrement…"),
        callback: function(r) {
            if (r.exc) {
                return;
            }
            frappe.show_alert({
                message: __("Décision de rapprochement enregistrée."),
                indicator: "green",
            });
            frm.reload_doc();
        },
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
