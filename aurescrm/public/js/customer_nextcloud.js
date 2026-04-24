/**
 * Nextcloud — boutons sur la fiche Client (dépôt de maquettes, lien GED)
 */
frappe.ui.form.on("Customer", {
    refresh: function (frm) {
        if (frm.is_new()) {
            return;
        }
        if (!frappe.model.can_read("Customer")) {
            return;
        }
        if (frappe.model.can_write("Customer")) {
            frm.add_custom_button(
                __("Demander un fichier au client"),
                function () {
                    aurescrm_nextcloud.open_upload_request_dialog(frm);
                },
                __("Cloud")
            );
        }
        if (frm.doc.nextcloud_folder_url) {
            frm.add_custom_button(
                __("Ouvrir dans Nextcloud"),
                function () {
                    window.open(frm.doc.nextcloud_folder_url, "_blank", "noopener,noreferrer");
                },
                __("Cloud")
            );
        }
    },
});

const aurescrm_nextcloud = {
    open_upload_request_dialog: function (frm) {
        const d = new frappe.ui.Dialog({
            title: __("Demander un fichier au client"),
            fields: [
                {
                    fieldname: "requested_file",
                    fieldtype: "Data",
                    label: __("Fichier demandé"),
                    description: __(
                        "Ex. : maquette étui pharmacie, produit X (libellé visible côté client Nextcloud)"
                    ),
                    reqd: 1,
                },
                {
                    fieldname: "description",
                    fieldtype: "Small Text",
                    label: __("Instructions pour le client"),
                },
                {
                    fieldname: "recipient_email",
                    fieldtype: "Data",
                    label: __("Email destinataire"),
                    options: "Email",
                    reqd: 1,
                },
            ],
            primary_action_label: __("Générer et envoyer"),
            primary_action: function () {
                const v = d.get_values();
                if (!v) {
                    return;
                }
                frappe.call({
                    method: "aurescrm.utils.nextcloud.generate_customer_upload_link",
                    args: {
                        customer: frm.doc.name,
                        requested_file: v.requested_file,
                        description: v.description || "",
                        recipient_email: v.recipient_email,
                    },
                    freeze: true,
                    freeze_message: __("Génération du lien..."),
                    callback: function (r) {
                        d.hide();
                        if (!r.message) {
                            return;
                        }
                        const m = r.message;
                        const btnId = "nc-pwd-" + frappe.utils.get_random(10);
                        const html =
                            "<p><strong>" +
                            __("E-mail envoyé à :") +
                            " " +
                            frappe.utils.escape_html(m.email_sent_to) +
                            "</strong></p>" +
                            "<p class='text-muted small'>" +
                            __("Expiration :") +
                            " " +
                            frappe.utils.escape_html(m.expiration || "") +
                            "</p>" +
                            "<p><strong>" +
                            __("Mot de passe du lien (à transmettre sur un autre canal) :") +
                            " </strong></p>" +
                            "<p><code class='h4' id='" +
                            btnId +
                            "-code'>" +
                            frappe.utils.escape_html(m.password) +
                            "</code> " +
                            "<button class='btn btn-default btn-sm' type='button' id='" +
                            btnId +
                            "-btn'>" +
                            __("Copier") +
                            "</button></p>" +
                            "<p class='text-warning small'>" +
                            "⚠️ " +
                            __(
                                "Transmettez ce mot de passe au client de préférence par WhatsApp (canal distinct de l’e-mail)."
                            ) +
                            "</p>" +
                            "<p><a href='" +
                            frappe.utils.escape_html(m.upload_url) +
                            "' target='_blank' rel='noopener noreferrer'>" +
                            __("Ouvrir le dépôt (lien public)") +
                            "</a></p>" +
                            (m.nextcloud_folder_url
                                ? "<p><a href='" +
                                  frappe.utils.escape_html(m.nextcloud_folder_url) +
                                  "' target='_blank' rel='noopener noreferrer'>" +
                                  __("Dossier Nextcloud (interface)") +
                                  "</a></p>"
                                : "");
                        frappe.msgprint({ title: __("Lien généré"), message: html, wide: true });
                        setTimeout(function () {
                            const b = document.getElementById(btnId + "-btn");
                            if (b) {
                                b.addEventListener("click", function () {
                                    if (navigator.clipboard && navigator.clipboard.writeText) {
                                        navigator.clipboard.writeText(m.password).then(
                                            function () {
                                                frappe.show_alert({
                                                    message: __("Mot de passe copié."),
                                                    indicator: "green",
                                                });
                                            },
                                            function () {
                                                frappe.show_alert({
                                                    message: __("La copie a échoué. Sélectionnez le mot de passe manuellement."),
                                                    indicator: "red",
                                                });
                                            }
                                        );
                                    }
                                });
                            }
                        }, 200);
                        if (m.nextcloud_folder_url) {
                            frappe.model.set_value(
                                frm.doctype,
                                frm.doc.name,
                                "nextcloud_folder_url",
                                m.nextcloud_folder_url
                            );
                        }
                        frm.reload_doc();
                    },
                });
            },
        });
        d.show();
        frappe.call({
            method: "aurescrm.utils.nextcloud.get_contact_email_for_customer",
            args: { customer: frm.doc.name },
            callback: function (r) {
                if (r && r.message) {
                    d.set_value("recipient_email", r.message);
                }
            },
        });
    },
};
