// Copyright (c) 2024, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on('Visite Commerciale', {
    refresh: function(frm) {
        // Initialiser la variable pour suivre l'affichage des erreurs de GPS
        if (frm.gps_error_shown === undefined) {
            frm.gps_error_shown = false;
        }

        // Récupérer les coordonnées GPS du client à partir du champ 'custom_gps' dans le Doctype Customer
        if (frm.doc.client) {  // Assurez-vous qu'il y a un client associé
            frappe.db.get_value('Customer', frm.doc.client, 'custom_gps').then(r => {
                let gpsCoords = r.message.custom_gps;
                if (gpsCoords) {
                    // Si les coordonnées GPS du client existent, afficher la carte
                    updateCustomerMap(frm, gpsCoords);
                } else {
                    frappe.msgprint(__('Aucune coordonnée GPS trouvée pour ce client.'));
                }
            });
        }

        // Vérifier si l'état du workflow est "En Cours" et que le champ gps_visite est vide
        if (frm.doc.status === "En Cours" && !frm.doc.gps_visite) {
            // Utiliser la géolocalisation si elle est disponible
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    ({ coords: { latitude, longitude } }) => {
                        const gpsCoords = `${latitude}, ${longitude}`;

                        // Mettre à jour le champ 'gps_visite' et enregistrer automatiquement le document
                        frm.set_value('gps_visite', gpsCoords).then(() => frm.save());

                        // Mettre à jour la carte pour la visite commerciale
                        updateMap(frm, gpsCoords);
                    },
                    () => {
                        // Afficher un seul message d'erreur lorsque la géolocalisation échoue
                        if (!frm.gps_error_shown) {
                            frappe.msgprint(__('Erreur lors de la récupération de la localisation.'));
                            frm.gps_error_shown = true;
                        }
                    }
                );
            } else {
                // Afficher un seul message d'erreur si la géolocalisation n'est pas prise en charge
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

// Fonction pour afficher la carte du client basée sur les coordonnées du champ custom_gps du Doctype Customer
function updateCustomerMap(frm, gpsCoords) {
    const [latitude, longitude] = gpsCoords.split(", ");
    const mapUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBhtddbDMEu4OoBJAxlfYADptjTspOqflw&q=${latitude},${longitude}&zoom=15`;

    // Mettre à jour la carte dans le champ 'carte_client'
    $(frm.fields_dict['carte_client'].wrapper).html(`<iframe width="100%" height="300" frameborder="0" style="border:0" src="${mapUrl}" allowfullscreen></iframe>`);
}

// Fonction pour afficher la carte de la visite commerciale
function updateMap(frm, gpsCoords) {
    const [latitude, longitude] = gpsCoords.split(", ");
    const mapUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBhtddbDMEu4OoBJAxlfYADptjTspOqflw&q=${latitude},${longitude}&zoom=15`;

    // Mettre à jour la carte dans le champ 'carte'
    $(frm.fields_dict['carte'].wrapper).html(`<iframe width="100%" height="300" frameborder="0" style="border:0" src="${mapUrl}" allowfullscreen></iframe>`);
}
