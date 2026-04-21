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

function add_demande_urgence_button(frm) {
    if (["Terminé", "Annulé"].includes(frm.doc.status)) {
        return;
    }
    // Après soumission, la fiche est en général non modifiable sans amendement
    if (frm.doc.docstatus === 1) {
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
                fieldname: "niveau_urgence_demande",
                fieldtype: "Select",
                label: __("Niveau d'urgence demandé"),
                options: "U0\nU1\nU2\nU3",
                default: frm.doc.niveau_urgence || "U0",
                reqd: 1
            },
            {
                fieldname: "descr_urgence_saisie",
                fieldtype: "Small Text",
                label: __("Description pour validation"),
                reqd: 1,
                description: __(
                    "Motif de la demande. Le niveau choisi pourra être confirmé ou ajusté après validation par le back-office."
                )
            }
        ],
        function(values) {
            const html = plain_text_to_text_editor_html(values.descr_urgence_saisie);
            if (!html) {
                frappe.msgprint(__("La description ne peut pas être vide."));
                return;
            }

            const niveau = values.niveau_urgence_demande;

            const done_new = function() {
                frappe.show_alert({
                    message: __(
                        "Urgence mise à jour — enregistrez le ticket pour conserver le niveau et la description en base."
                    ),
                    indicator: "orange"
                });
            };

            const done_saved = function() {
                frappe.show_alert({
                    message: __("Demande d'urgence enregistrée (niveau et description)."),
                    indicator: "green"
                });
            };

            const after_both_set = function() {
                frm.refresh_field("niveau_urgence");
                frm.refresh_field("descr_urgence");
                if (frm.is_new()) {
                    done_new();
                    return;
                }
                frm.save().then(done_saved).catch(function() {
                    frappe.show_alert({
                        message: __(
                            "Les valeurs ont été appliquées au formulaire mais la sauvegarde a échoué."
                        ),
                        indicator: "red"
                    });
                });
            };

            const set_descr = function() {
                const ret = frm.set_value("descr_urgence", html);
                if (ret && typeof ret.then === "function") {
                    ret.then(after_both_set);
                } else {
                    after_both_set();
                }
            };

            const ret_niveau = frm.set_value("niveau_urgence", niveau);
            if (ret_niveau && typeof ret_niveau.then === "function") {
                ret_niveau.then(set_descr);
            } else {
                set_descr();
            }
        },
        __("Demande d'urgence"),
        __("Enregistrer")
    );
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
