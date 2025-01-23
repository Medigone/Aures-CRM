// Copyright (c) 2024, Medigo and contributors
// For license information, please see license.txt

// Script Client dans "Rendez Vous Client"
frappe.ui.form.on('Rendez Vous Client', {
    refresh: function(frm) {
        // Ajout du bouton "Visite Commerciale"
        frm.add_custom_button(__('Visite Commerciale'), function() {
            frappe.call({
                method: 'aurescrm.aures_crm.doctype.rendez_vous_client.rendez_vous_client.creer_visite_commerciale',  // Chemin complet
                args: {
                    client: frm.doc.client,
                    commercial: frm.doc.commercial,    // Transmettez l'ID du champ 'commercial'
                    date_heure: frm.doc.date_heure     // Transmettez la valeur du champ 'date_heure'
                },
                callback: function(r) {
                    if (r.message) {
                        frappe.msgprint(__('Une nouvelle visite commerciale a été créée.'));
                        frappe.set_route('Form', 'Visite Commerciale', r.message);
                    }
                }
            });
        }, __("Créer"));
    }
});

// Configuration du calendrier pour "Rendez Vous Client"
frappe.views.calendar["Rendez Vous Client"] = {
    field_map: {
        "start": "date_heure", // Remplace "date_rdv" par le nom exact de ton champ de début
        "end": "date_heure", // Utilise un champ de fin s'il y en a un, sinon garde le même
        "title": "raison_sociale" // Remplace "client" par le champ que tu veux voir comme titre dans le calendrier
    }
};
