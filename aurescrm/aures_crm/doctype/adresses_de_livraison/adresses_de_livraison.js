// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on('Adresses de livraison', {
    refresh(frm) {
        // ----------------------------
        // Boutons personnalisés
        // ----------------------------
        // Bouton "Récupérer GPS" dans le groupe "Localisation"
        frm.add_custom_button(__('Récupérer GPS'), function() {
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(function(position) {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    const gpsCoords = `${lat}, ${lon}`;
                    
                    // Mettre à jour le champ 'gps' et enregistrer le document
                    frm.set_value('gps', gpsCoords);
                    frm.save().then(() => {
                        frappe.msgprint(`Coordonnées GPS récupérées et enregistrées : ${gpsCoords}`);
                    }).catch(err => {
                        console.error("Erreur GPS:", err);
                        frappe.msgprint("Erreur lors de la sauvegarde après récupération du GPS.");
                    });
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

        // Bouton "Itinéraire" dans le groupe "Localisation"
        frm.add_custom_button(__('Itinéraire'), function() {
            if (frm.doc.gps) {
                const coords = frm.doc.gps.split(',');
                if (coords.length >= 2) {
                    const lat = coords[0].trim();
                    const lon = coords[1].trim();
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
                    window.open(url, '_blank');
                } else {
                    frappe.msgprint("Les coordonnées GPS semblent incorrectes.");
                }
            } else {
                frappe.msgprint("Aucune coordonnée GPS enregistrée. Veuillez récupérer le GPS d'abord.");
            }
        }, __('Localisation'));

        // Bouton "Principale" (hors groupe) avec confirmation
        frm.add_custom_button(__('Principale'), function() {
            // Vérifier que le client est renseigné
            if (!frm.doc.client) {
                frappe.msgprint("Veuillez d'abord renseigner le client.");
                return;
            }
            console.log("Docstatus avant action Principale :", frm.doc.docstatus);
            // Rechercher les autres adresses principales pour ce client
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "Adresses de livraison",
                    filters: {
                        client: frm.doc.client,
                        adresse_principale: 1,
                        name: ["!=", frm.doc.name]
                    },
                    fields: ["name"]
                },
                callback: function(response) {
                    if (response.message && response.message.length > 0) {
                        // Il existe déjà une adresse principale, on demande confirmation
                        let d = new frappe.ui.Dialog({
                            title: 'Confirmation de remplacement',
                            fields: [
                                {
                                    label: "Une autre adresse principale existe déjà pour ce client.<br>Voulez-vous la remplacer par celle-ci ?",
                                    fieldname: 'confirm',
                                    fieldtype: 'Check',
                                    default: 0,
                                    reqd: 1
                                }
                            ],
                            primary_action_label: 'Confirmer',
                            primary_action: function(values) {
                                if (values.confirm) {
                                    // Remplacer les adresses principales existantes
                                    response.message.forEach(function(doc) {
                                        frappe.call({
                                            method: "frappe.client.set_value",
                                            args: {
                                                doctype: "Adresses de livraison",
                                                name: doc.name,
                                                fieldname: "adresse_principale",
                                                value: 0
                                            }
                                        });
                                    });
                                    // Fermer le dialogue avant de sauvegarder
                                    d.hide();
                                    frm.set_value('adresse_principale', 1);
                                    frm.save().then(() => {
                                        frappe.msgprint("Adresse définie comme principale.");
                                    }).catch((err) => {
                                        console.error("Erreur lors de la sauvegarde :", err);
                                        frappe.msgprint("Erreur lors de la sauvegarde : " + err);
                                    });
                                } else {
                                    d.hide();
                                    frappe.msgprint("Veuillez cocher la case pour confirmer le remplacement.");
                                }
                            }
                        });
                        d.show();
                    } else {
                        frm.set_value('adresse_principale', 1);
                        frm.save().then(() => {
                            frappe.msgprint("Adresse définie comme principale.");
                        }).catch((err) => {
                            console.error("Erreur lors de la sauvegarde :", err);
                            frappe.msgprint("Erreur lors de la sauvegarde : " + err);
                        });
                    }
                }
            });
        });

        // ----------------------------
        // Affichage de la carte avec Leaflet
        // ----------------------------
        if (frm.doc.gps) {
            let parts = frm.doc.gps.split(',');
            if (parts.length >= 2) {
                let lat = parseFloat(parts[0].trim());
                let lon = parseFloat(parts[1].trim());
                // Créer le HTML pour le conteneur de la carte avec bordure fine et bords arrondis à 20px
                let map_html = `<div id="leaflet-map" style="width: 100%; height: 300px; border: 1px solid #ccc; border-radius: 20px;"></div>`;
                frm.set_df_property('carte', 'options', map_html);

                // Initialiser la carte après un léger délai pour être sûr que le HTML est injecté
                setTimeout(function() {
                    if (typeof L !== 'undefined') {
                        if (frm.leaflet_map) {
                            frm.leaflet_map.remove();
                        }
                        frm.leaflet_map = L.map('leaflet-map').setView([lat, lon], 13);
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            attribution: '&copy; OpenStreetMap contributors'
                        }).addTo(frm.leaflet_map);
                        L.marker([lat, lon]).addTo(frm.leaflet_map);
                    } else {
                        frappe.msgprint("Leaflet n'est pas chargé.");
                    }
                }, 100);
            } else {
                frm.set_df_property('carte', 'options', "<p>Les coordonnées GPS ne sont pas correctes.</p>");
            }
        } else {
            frm.set_df_property('carte', 'options', "<p>GPS non renseigné.</p>");
        }
    }
});

