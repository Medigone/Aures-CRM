// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on('Visite Entrepot', {
	refresh: function(frm) {
		// Filtrer le visiteur pour n'afficher que les utilisateurs actifs
		frm.set_query('visiteur', function() {
			return {
				filters: {
					'enabled': 1
				}
			};
		});
		
		// Définir le visiteur par défaut à l'utilisateur actuel si nouveau document
		if (frm.is_new() && !frm.doc.visiteur) {
			frm.set_value('visiteur', frappe.user.name);
		}
	},
	
	date_visite: function(frm) {
		// Validation côté client : ne pas permettre une date future pour un statut "Terminé"
		if (frm.doc.status === "Terminé" && frm.doc.date_visite) {
			let date_visite = frappe.datetime.str_to_obj(frm.doc.date_visite);
			let aujourdhui = frappe.datetime.get_today();
			
			if (frappe.datetime.obj_to_str(date_visite) > aujourdhui) {
				frappe.msgprint({
					message: __('La date de visite ne peut pas être dans le futur pour une visite terminée.'),
					indicator: 'orange',
					title: __('Date Invalide')
				});
			}
		}
	},
	
	status: function(frm) {
		// Rafraîchir le champ date_visite pour déclencher la validation si nécessaire
		if (frm.doc.date_visite) {
			frm.trigger('date_visite');
		}
	}
});

