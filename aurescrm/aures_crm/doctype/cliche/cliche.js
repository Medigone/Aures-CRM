// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on('Cliche', {
    refresh: function(frm) {
        // Bouton Activer Version
        if (!frm.is_new() && frm.doc.status === "Réalisé" && !frm.doc.version_active) {
            frm.add_custom_button("Activer Version", function() {
                frappe.confirm(
                    'Ceci va activer cette version du cliché et désactiver les autres versions pour cet article, êtes-vous sûr de vouloir continuer ?',
                    function() {
                        frm.call('activate_version').then(() => {
                            frappe.msgprint("La version du cliché a été activée.");
                            frm.reload_doc();
                        });
                    }
                );
            });
        }

        // Bouton Nouvelle Version
        if (!frm.is_new() && frm.doc.version_active) {
            frm.add_custom_button("Nouvelle Version", function() {
                frappe.confirm(
                    'Créer une nouvelle version de ce cliché ?',
                    function() {
                        frappe.prompt(
                            [
                                {
                                    fieldname: 'desc_changements',
                                    fieldtype: 'Small Text',
                                    label: 'Description des changements',
                                    reqd: 1
                                }
                            ],
                            function(data) {
                                frm.call('create_new_version', { desc_changements: data.desc_changements }).then(r => {
                                    frappe.msgprint(
                                        `Nouvelle version créée : ${r.message}`,
                                        function() {
                                            frappe.set_route('Form', 'Cliche', r.message);
                                        }
                                    );
                                });
                            },
                            'Nouvelle Version',
                            'Créer'
                        );
                    }
                );
            });
        }
    }
});
