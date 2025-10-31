// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on('Accueil Client', {
	refresh: function(frm) {
		// Affichage conditionnel selon le statut
		if (frm.doc.status === "Planifiée") {
			// Focus sur la préparation
			frappe.model.set_value(frm.doctype, frm.doc.name, 'status', 'Planifiée');
		}
	},
	
	client: function(frm) {
		// Fetch automatique des informations client si nécessaire
		if (frm.doc.client) {
			frappe.db.get_value('Customer', frm.doc.client, ['customer_group', 'custom_status'])
				.then(r => {
					if (r.message) {
						// Les informations client peuvent être utilisées si nécessaire
						// Par exemple pour pré-remplir certains champs
					}
				});
		}
	},
	
	date_visite_prevue: function(frm) {
		// Validation : la date prévue ne peut pas être dans le passé lors de la création
		if (frm.is_new() && frm.doc.date_visite_prevue) {
			let today = frappe.datetime.get_today();
			if (frm.doc.date_visite_prevue < today) {
				frappe.msgprint(__('La date prévue ne peut pas être dans le passé.'));
				frappe.model.set_value(frm.doctype, frm.doc.name, 'date_visite_prevue', '');
			}
		}
	},
	
	utilisateur_receveur: function(frm) {
		// Fetch automatique du nom receveur
		if (frm.doc.utilisateur_receveur) {
			frappe.db.get_value('User', frm.doc.utilisateur_receveur, 'full_name')
				.then(r => {
					if (r.message && r.message.full_name) {
						frappe.model.set_value(frm.doctype, frm.doc.name, 'nom_receveur', r.message.full_name);
					}
				});
		}
	}
});

