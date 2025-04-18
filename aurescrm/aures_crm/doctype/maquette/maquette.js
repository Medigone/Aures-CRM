frappe.ui.form.on('Maquette', {
    onload: function(frm) {
        if (frm.is_new() || frm.doc.status !== 'Référencée') {
            frm.set_value('nom_reference_par', '');
        }
    },

    refresh: function(frm) {
        if (!frm.is_new() && frm.doc.status === "En attente") {
            frm.add_custom_button("Référencée", function() {
                frappe.confirm(
                    'Confirmez-vous que le fichier source de la maquette a été renommé avec cet ID dans le serveur des maquettes ?',
                    function() {
                        frm.call('set_status_referenced').then(() => {
                            frappe.msgprint("La maquette a été marquée comme référencée dans le serveur");
                            frm.reload_doc();
                        });
                    }
                );
            });
        }
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
