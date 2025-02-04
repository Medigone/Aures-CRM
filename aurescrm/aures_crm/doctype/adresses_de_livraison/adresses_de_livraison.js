// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Adresses de livraison", {
// 	refresh(frm) {

// 	},
// });
frappe.ui.form.on('Adresses de livraison', {
    refresh(frm) {
        // Bouton "Récupérer GPS" dans le groupe "Localisation"
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
                                    // Définir cette adresse comme principale et sauvegarder
                                    frm.set_value('adresse_principale', 1);
                                    frm.save();
                                    frappe.msgprint("Adresse définie comme principale.");
                                    d.hide();
                                } else {
                                    d.hide();
                                    frappe.msgprint("Veuillez cocher la case pour confirmer le remplacement.");
                                }
                            }
                        });
                        d.show();
                    } else {
                        // Aucune autre adresse principale trouvée, on définit directement
                        frm.set_value('adresse_principale', 1);
                        frm.save();
                        frappe.msgprint("Adresse définie comme principale.");
                    }
                }
            });
        });
    }
});
