// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on('Meeting Interne', {
	refresh: function(frm) {
		// Ajouter des boutons personnalisés
		if (!frm.is_new()) {
			// Bouton Envoyer Rappel Maintenant
			if (frm.doc.envoyer_rappel && !frm.doc.rappel_envoye) {
				frm.add_custom_button(__('Envoyer Rappel Maintenant'), function() {
					send_reminder_now(frm);
				}, __('Actions'));
			}
			
			// Bouton Exporter PDF
			frm.add_custom_button(__('Exporter Compte-Rendu PDF'), function() {
				export_pdf(frm);
			}, __('Actions'));
		}
		
		// Filtrer les participants pour n'afficher que les utilisateurs actifs
		frm.set_query('user_id', 'participants', function() {
			return {
				filters: {
					'enabled': 1
				}
			};
		});
		
		// Filtrer l'organisateur
		frm.set_query('organisateur', function() {
			return {
				filters: {
					'enabled': 1
				}
			};
		});
	},
	
	date_heure: function(frm) {
		// Mettre à jour le champ date_meeting automatiquement
		if (frm.doc.date_heure) {
			let date_obj = frappe.datetime.str_to_obj(frm.doc.date_heure);
			frm.set_value('date_meeting', frappe.datetime.obj_to_str(date_obj));
		}
	},
	
	recurrent: function(frm) {
		// Afficher/masquer les champs de récurrence
		frm.refresh_field('frequence_recurrence');
		frm.refresh_field('jour_semaine');
		frm.refresh_field('jour_mois');
		frm.refresh_field('date_fin_recurrence');
	},
	
	frequence_recurrence: function(frm) {
		// Rafraîchir les champs conditionnels
		frm.refresh_field('jour_semaine');
		frm.refresh_field('jour_mois');
	},
	
	organisateur: function(frm) {
		// Auto-ajouter l'organisateur aux participants s'il n'y est pas
		if (frm.doc.organisateur) {
			let organisateur_exists = false;
			
			if (frm.doc.participants) {
				for (let i = 0; i < frm.doc.participants.length; i++) {
					if (frm.doc.participants[i].user_id === frm.doc.organisateur) {
						organisateur_exists = true;
						// Mettre à jour le rôle et la présence
						frappe.model.set_value(
							frm.doc.participants[i].doctype,
							frm.doc.participants[i].name,
							'role_meeting',
							'Organisateur'
						);
						frappe.model.set_value(
							frm.doc.participants[i].doctype,
							frm.doc.participants[i].name,
							'present',
							1
						);
						break;
					}
				}
			}
			
			if (!organisateur_exists) {
				let row = frm.add_child('participants');
				row.user_id = frm.doc.organisateur;
				row.role_meeting = 'Organisateur';
				row.present = 1;
				frm.refresh_field('participants');
			}
		}
	},
	
	envoyer_rappel: function(frm) {
		// Rafraîchir les champs de rappel
		frm.refresh_field('delai_rappel');
	}
});

// Event sur la table participants
frappe.ui.form.on('Participants Meeting', {
	present: function(frm) {
		// Recalculer le taux de présence en temps réel
		calculate_presence_rate(frm);
	},
	participants_remove: function(frm) {
		calculate_presence_rate(frm);
	}
});

// Fonctions utilitaires

function calculate_presence_rate(frm) {
	if (!frm.doc.participants || frm.doc.participants.length === 0) {
		frm.set_value('taux_presence', 0);
		return;
	}
	
	let total = frm.doc.participants.length;
	let present = 0;
	
	frm.doc.participants.forEach(function(participant) {
		if (participant.present) {
			present++;
		}
	});
	
	let rate = (present / total) * 100;
	frm.set_value('taux_presence', rate);
}

function send_reminder_now(frm) {
	frappe.confirm(
		__('Êtes-vous sûr de vouloir envoyer le rappel maintenant à tous les participants ?'),
		function() {
			frappe.call({
				method: 'aurescrm.aures_crm.doctype.meeting_interne.meeting_interne.send_reminder_now',
				args: {
					meeting_name: frm.doc.name
				},
				callback: function(r) {
					if (r.message && r.message.success) {
						frappe.show_alert({
							message: r.message.message,
							indicator: 'green'
						}, 5);
						frm.reload_doc();
					}
				}
			});
		}
	);
}

function export_pdf(frm) {
	// Ouvrir le print format dans une nouvelle fenêtre
	let print_format = 'Compte Rendu Meeting';
	let url = frappe.urllib.get_full_url(
		'/api/method/frappe.utils.print_format.download_pdf?'
		+ 'doctype=' + encodeURIComponent('Meeting Interne')
		+ '&name=' + encodeURIComponent(frm.doc.name)
		+ '&format=' + encodeURIComponent(print_format)
		+ '&no_letterhead=0'
	);
	
	window.open(url);
}

