frappe.ui.form.on('Maquette', {
    refresh: function(frm) {
        // Bouton Référencée
        if (!frm.is_new() && frm.doc.status === "A référencer") {
            frm.add_custom_button("Référencée", function() {
                frappe.confirm(
                    'Confirmez-vous que le fichier source de la maquette a été renommé avec cet ID dans le serveur des maquettes ?',
                    function() {
                        frm.call('set_status_referenced').then(() => {
                            frappe.msgprint(`Maquette ${frm.doc.name} a été marquée comme référencée dans le serveur.`);
                            frm.reload_doc();
                        });
                    }
                );
            });
        }

        // Bouton Activer
        if (!frm.is_new() && ["Référencée", "Obsolète"].includes(frm.doc.status)) {
            frm.add_custom_button("Activer", function() {
                frappe.confirm(
                    'Ceci va mettre cette version comme version Activée pour cet article, êtes-vous sûr de vouloir continuer ?',
                    function() {
                        frm.call('activate_version').then(() => {
                            frappe.msgprint("La maquette a été activée.");
                            frm.reload_doc();
                        });
                    }
                );
            });
        }

        // Nouveau bouton Nouvelle Version
        if (!frm.is_new() && frm.doc.status === "Version Activée") {
            frm.add_custom_button("Nouvelle Version", function() {
                frappe.confirm(
                    'Créer une nouvelle version de cette maquette ?',
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
                                            frappe.set_route('Form', 'Maquette', r.message);
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

        // Rafraîchir champs de référence
        frm.refresh_field('nom_reference_par');
        frm.refresh_field('reference_par');
    },

    setup: function(frm) {
        frm.set_query('article', function() {
            return {
                filters: {
                    'custom_client': frm.doc.client
                }
            };
        });
    }
});
