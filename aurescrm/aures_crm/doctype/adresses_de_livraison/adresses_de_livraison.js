// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Adresses de livraison", {
// 	refresh(frm) {

// 	},
// });
frappe.ui.form.on('Adresses de livraison', {
    refresh(frm) {
        // Bouton "Récupérer GPS Principal" dans le groupe "Localisation"
        frm.add_custom_button(__('Récupérer GPS'), function() {
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(function(position) {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    const gpsCoords = `${lat}, ${lon}`;
                    
                    // Mettre à jour le champ 'gps' et enregistrer le document
                    frm.set_value('gps', gpsCoords);
                    frm.save();
                    frappe.msgprint(`Coordonnées GPS récupérées et enregistrées : ${gpsCoords}`);
                }, function(error) {
                    frappe.msgprint(`Erreur lors de la récupération des coordonnées GPS : ${error.message}`);
                }, {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                });
            } else {
                frappe.msgprint("La géolocalisation n'est pas prise en charge par ce navigateur.");
            }
        }, __('Localisation'));

        // Bouton "Naviguer" dans le groupe "Localisation"
        frm.add_custom_button(__('Itinéraire'), function() {
            // Vérifier si le champ 'gps' est renseigné
            if (frm.doc.gps) {
                // Extrait les coordonnées GPS
                const coords = frm.doc.gps.split(',');
                if (coords.length >= 2) {
                    const lat = coords[0].trim();
                    const lon = coords[1].trim();
                    // Ouvre Google Maps en mode navigation vers la position
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
                    window.open(url, '_blank');
                } else {
                    frappe.msgprint("Les coordonnées GPS semblent incorrectes.");
                }
            } else {
                frappe.msgprint("Aucune coordonnée GPS enregistrée. Veuillez récupérer le GPS d'abord.");
            }
        }, __('Localisation'));

        // Bouton pour définir l'adresse comme principale (hors groupe)
        frm.add_custom_button(__('Principale'), function() {
            frm.set_value('adresse_principale', 1);
            frm.save();
            frappe.msgprint("Adresse définie comme principale.");
        });
    }
});
