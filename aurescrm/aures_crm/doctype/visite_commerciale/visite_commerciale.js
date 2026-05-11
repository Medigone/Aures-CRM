// Copyright (c) 2024, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on('Visite Commerciale', {
	refresh: function (frm) {
		// Référence créance filtrée sur le client
		frm.set_query('creance_client', function () {
			if (!frm.doc.client) {
				return { filters: { name: ['=', '__no_client__'] } };
			}
			return { filters: { client: frm.doc.client } };
		});

		// Ajouter un bouton "Créer" avec un menu déroulant sous 'Créer'
		frm.add_custom_button(__('Réclamation Client'), function () {
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
		frm.add_custom_button(__('Article'), function () {
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

		// Brouillon uniquement : après workflow « Terminer », le doc est soumis ;
		// tout set_value ici remettrait le formulaire en « non sauvegardé ».
		if (
			frm.doc.type_visite === 'Recouvrement' &&
			frm.doc.client &&
			frm.doc.docstatus === 0 &&
			(frm.is_new() || !frm.doc.creance_client)
		) {
			try_auto_select_creance(frm, { fill_montant: !frm.doc.montant_reclame });
		}
	},

	client: function (frm) {
		if (frm.doc.docstatus !== 0) {
			return;
		}
		if (frm.doc.type_visite === 'Recouvrement') {
			try_auto_select_creance(frm, { fill_montant: true });
		}
	},

	type_visite: function (frm) {
		if (frm.doc.docstatus !== 0) {
			return;
		}
		if (frm.doc.type_visite !== 'Recouvrement') {
			return;
		}
		try_auto_select_creance(frm, { fill_montant: true });
	},

	creance_client: function (frm) {
		if (frm.doc.type_visite !== 'Recouvrement') {
			return;
		}
		load_creance_solde(frm, true);
	},

	montant_reclame: function (frm) {
		recalculate_montant_restant_visite(frm);
	},

	montant_encaisse: function (frm) {
		if (frm.doc.docstatus !== 0) {
			return;
		}
		const enc = frm.doc.montant_encaisse || 0;
		if (!enc || enc <= 0) {
			frm.set_value('type_paiement', '');
			frm.set_value('numero_document_paiement', '');
			frm.set_value('photo_document_paiement', '');
		}
		recalculate_montant_restant_visite(frm);
	},

	type_paiement: function (frm) {
		if (frm.doc.docstatus !== 0) {
			return;
		}
		if (frm.doc.type_paiement === 'Espèce' || !frm.doc.type_paiement) {
			frm.set_value('numero_document_paiement', '');
			frm.set_value('photo_document_paiement', '');
		}
	}
});

function try_auto_select_creance(frm, opts) {
	opts = opts || {};
	if (frm.doc.docstatus !== 0 || !frm.doc.client || frm.doc.type_visite !== 'Recouvrement') {
		return;
	}
	const fill_montant = opts.fill_montant !== false;
	frappe.db.get_list('Creance Client', {
		filters: { client: frm.doc.client },
		fields: ['name'],
		limit: 1
	}).then(rows => {
		if (rows && rows.length > 0) {
			const next = rows[0].name;
			if (frm.doc.creance_client === next) {
				load_creance_solde(frm, fill_montant);
				return;
			}
			frm.set_value('creance_client', next).then(() => {
				load_creance_solde(frm, fill_montant);
			});
		} else {
			frappe.run_serially([
				() => frm.set_value('creance_client', ''),
				() => frm.set_value('solde_creance_avant_visite', ''),
				() => frm.set_value('montant_reclame', '')
			]);
		}
	});
}

function load_creance_solde(frm, set_default_reclame) {
	if (frm.doc.docstatus !== 0 || !frm.doc.creance_client) {
		return;
	}
	frappe.db.get_value('Creance Client', frm.doc.creance_client, 'solde_restant')
		.then(r => {
			const solde = r.message.solde_restant || 0;
			frm.set_value('solde_creance_avant_visite', solde);
			if (set_default_reclame && !frm.doc.montant_reclame) {
				frm.set_value('montant_reclame', solde);
			}
			recalculate_montant_restant_visite(frm);
		});
}

function recalculate_montant_restant_visite(frm) {
	if (frm.doc.docstatus !== 0) {
		return;
	}
	const reclame = frm.doc.montant_reclame || 0;
	const enc = frm.doc.montant_encaisse || 0;
	const rest = reclame - enc;
	frm.set_value('montant_restant', rest > 0 ? rest : 0);
}

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
