// Copyright (c) 2024, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on('Visite Commerciale', {
    refresh: function(frm) {
        // Ajouter un bouton "Créer" avec un menu déroulant sous 'Créer'
        frm.add_custom_button(__('Réclamation Client'), function() {
            if (!frm.doc.client) {
                frappe.msgprint(__('Veuillez sélectionner un client avant de créer une réclamation.'));
                return;
            }
            frappe.new_doc('Reclamations Clients', {
                client: frm.doc.client,
                visite: frm.doc.name // Remplir automatiquement le champ 'visite' avec l'ID de la visite commerciale
            });
        }, __('Créer'));

        // Ajouter un bouton "Article" sous "Créer" pour créer un nouvel article
        frm.add_custom_button(__('Article'), function() {
            if (!frm.doc.client) {
                frappe.msgprint(__('Veuillez sélectionner un client avant de créer un article.'));
                return;
            }
            frappe.new_doc('Item', {
                custom_client: frm.doc.client
            });
        }, __('Créer'));

        // Initialiser la variable pour suivre l'affichage des erreurs de GPS
        if (frm.gps_error_shown === undefined) {
            frm.gps_error_shown = false;
        }

        // Récupérer les coordonnées GPS du client à partir du champ 'custom_gps' dans le Doctype Customer
        if (frm.doc.client) {  
            frappe.db.get_value('Customer', frm.doc.client, 'custom_gps').then(r => {
                let gpsCoords = r.message.custom_gps;
                if (gpsCoords) {
                    updateCustomerMap(frm, gpsCoords);
                } else {
                    frappe.msgprint(__('Aucune coordonnée GPS trouvée pour ce client.'));
                }
            });
        }

        // Vérifier si l'état du workflow est "En Cours" et que le champ gps_visite est vide
        if (frm.doc.status === "En Cours" && !frm.doc.gps_visite) {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    ({ coords: { latitude, longitude } }) => {
                        const gpsCoords = `${latitude}, ${longitude}`;
                        frm.set_value('gps_visite', gpsCoords).then(() => frm.save());
                        updateMap(frm, gpsCoords);
                    },
                    () => {
                        if (!frm.gps_error_shown) {
                            frappe.msgprint(__('Erreur lors de la récupération de la localisation.'));
                            frm.gps_error_shown = true;
                        }
                    }
                );
            } else {
                if (!frm.gps_error_shown) {
                    frappe.msgprint(__('La géolocalisation n\'est pas prise en charge par votre navigateur.'));
                    frm.gps_error_shown = true;
                }
            }
        }

        // Afficher la carte si les coordonnées GPS pour la visite sont déjà disponibles
        if (frm.doc.gps_visite) {
            updateMap(frm, frm.doc.gps_visite);
        }
    }
});

function updateCustomerMap(frm, gpsCoords) {
    const [latitude, longitude] = gpsCoords.split(", ");
    const mapUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBhtddbDMEu4OoBJAxlfYADptjTspOqflw&q=${latitude},${longitude}&zoom=15`;
    $(frm.fields_dict['carte_client'].wrapper).html(`<iframe width="100%" height="300" frameborder="0" style="border:0" src="${mapUrl}" allowfullscreen></iframe>`);
}

function updateMap(frm, gpsCoords) {
    const [latitude, longitude] = gpsCoords.split(", ");
    const mapUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBhtddbDMEu4OoBJAxlfYADptjTspOqflw&q=${latitude},${longitude}&zoom=15`;
    $(frm.fields_dict['carte'].wrapper).html(`<iframe width="100%" height="300" frameborder="0" style="border:0" src="${mapUrl}" allowfullscreen></iframe>`);
}

// Configuration du calendrier pour "Visite Commerciale"
frappe.views.calendar["Visite Commerciale"] = {
    field_map: {
        "start": "date",    // Date prévue de la visite
        "end": "date",      // Même champ pour les visites ponctuelles
        "id": "name",              // Identifiant unique
        "title": "nom_client"      // Utiliser le nom du client (customer_name)
    },
    get_events_method: "aurescrm.aures_crm.doctype.visite_commerciale.visite_commerciale.get_events"
};
