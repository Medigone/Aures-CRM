frappe.ui.form.on("Reclamations Clients", {
    refresh: function(frm) {
        // Supprime les boutons personnalisés existants
        frm.clear_custom_buttons();
        
        // Si le document est en statut "Nouveau"
        if (frm.doc.status === "Nouveau") {
            // Bouton pour démarrer le traitement : passe le document à "En Traitement"
            frm.add_custom_button("Debut traitement", function() {
                frappe.call({
                    method: "frappe.client.set_value",
                    args: {
                        doctype: frm.doc.doctype,
                        name: frm.doc.name,
                        fieldname: "status",
                        value: "En Traitement"
                    },
                    callback: function() {
                        frm.reload_doc();
                    }
                });
            }, __("Actions"));
            
            // Bouton pour annuler
            frm.add_custom_button("Annuler", function() {
                frappe.call({
                    method: "frappe.client.set_value",
                    args: {
                        doctype: frm.doc.doctype,
                        name: frm.doc.name,
                        fieldname: "status",
                        value: "Annulé"
                    },
                    callback: function() {
                        frm.reload_doc();
                    }
                });
            }, __("Actions"));
        
        // Si le document est en "En Traitement" ou "En Retard"
        } else if (frm.doc.status === "En Traitement" || frm.doc.status === "En Retard") {
            // Bouton pour marquer comme "Traité"
            frm.add_custom_button("Traité", function() {
                frappe.call({
                    method: "frappe.client.set_value",
                    args: {
                        doctype: frm.doc.doctype,
                        name: frm.doc.name,
                        fieldname: "status",
                        value: "Traité"
                    },
                    callback: function() {
                        frm.reload_doc();
                    }
                });
            }, __("Actions"));
            
            // Bouton pour marquer comme "Non Traité"
            frm.add_custom_button("Non Traité", function() {
                frappe.call({
                    method: "frappe.client.set_value",
                    args: {
                        doctype: frm.doc.doctype,
                        name: frm.doc.name,
                        fieldname: "status",
                        value: "Non Traité"
                    },
                    callback: function() {
                        frm.reload_doc();
                    }
                });
            }, __("Actions"));
            
            // Bouton pour annuler
            frm.add_custom_button("Annuler", function() {
                frappe.call({
                    method: "frappe.client.set_value",
                    args: {
                        doctype: frm.doc.doctype,
                        name: frm.doc.name,
                        fieldname: "status",
                        value: "Annulé"
                    },
                    callback: function() {
                        frm.reload_doc();
                    }
                });
            }, __("Actions"));
        }
    }
});
