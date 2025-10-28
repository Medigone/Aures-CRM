// Copyright (c) 2025, Aures and contributors
// For license information, please see license.txt

frappe.ui.form.on('Operation Production', {
	refresh(frm) {
		// Ajouter des boutons contextuels selon le statut
		add_contextual_buttons(frm);
		
		// Bouton "Signaler Problème" toujours visible
		frm.add_custom_button(__('Signaler un Problème'), function() {
			show_problem_dialog(frm);
		}, __('Actions'));
		
		// Afficher alertes visuelles
		show_visual_alerts(frm);
		
		// Démarrer timer si opération en cours
		if (frm.doc.statut === 'En cours' && frm.doc.date_heure_debut_reelle) {
			start_timer(frm);
		}
	}
});

function add_contextual_buttons(frm) {
	// Bouton Démarrer (si Assignée ou En attente)
	if (['Assignée', 'En attente'].includes(frm.doc.statut)) {
		frm.add_custom_button(__('Démarrer'), function() {
			frappe.call({
				method: 'demarrer',
				doc: frm.doc,
				callback: function(r) {
					if (!r.exc) {
						frm.reload_doc();
					}
				}
			});
		}).css({'background-color': '#007bff', 'color': 'white'});
	}
	
	// Bouton Terminer (si En cours)
	if (frm.doc.statut === 'En cours') {
		frm.add_custom_button(__('Terminer'), function() {
			show_complete_dialog(frm);
		}).css({'background-color': '#28a745', 'color': 'white'});
		
		frm.add_custom_button(__('Mettre en Pause'), function() {
			show_pause_dialog(frm);
		}, __('Actions'));
	}
	
	// Bouton Reprendre (si En pause)
	if (frm.doc.statut === 'En pause') {
		frm.add_custom_button(__('Reprendre'), function() {
			frappe.call({
				method: 'reprendre',
				doc: frm.doc,
				callback: function(r) {
					if (!r.exc) {
						frm.reload_doc();
					}
				}
			});
		}).css({'background-color': '#007bff', 'color': 'white'});
	}
}

function show_complete_dialog(frm) {
	let d = new frappe.ui.Dialog({
		title: __('Terminer l\'Opération'),
		fields: [
			{
				fieldname: 'quantite_ok',
				fieldtype: 'Int',
				label: __('Quantité OK'),
				reqd: 1,
				default: frm.doc.quantite_prevue || 0
			},
			{
				fieldname: 'quantite_rebutee',
				fieldtype: 'Int',
				label: __('Quantité Rebutée'),
				default: 0
			},
			{
				fieldname: 'observations',
				fieldtype: 'Small Text',
				label: __('Observations')
			}
		],
		primary_action_label: __('Terminer'),
		primary_action(values) {
			frappe.call({
				method: 'terminer',
				doc: frm.doc,
				args: {
					quantite_ok: values.quantite_ok,
					quantite_rebutee: values.quantite_rebutee,
					observations: values.observations
				},
				callback: function(r) {
					if (!r.exc) {
						d.hide();
						frm.reload_doc();
					}
				}
			});
		}
	});
	
	d.show();
}

function show_pause_dialog(frm) {
	let d = new frappe.ui.Dialog({
		title: __('Mettre en Pause'),
		fields: [
			{
				fieldname: 'raison',
				fieldtype: 'Small Text',
				label: __('Raison de la pause'),
				reqd: 1
			}
		],
		primary_action_label: __('Confirmer'),
		primary_action(values) {
			frappe.call({
				method: 'mettre_en_pause',
				doc: frm.doc,
				args: {
					raison: values.raison
				},
				callback: function(r) {
					if (!r.exc) {
						d.hide();
						frm.reload_doc();
					}
				}
			});
		}
	});
	
	d.show();
}

function show_problem_dialog(frm) {
	let d = new frappe.ui.Dialog({
		title: __('Signaler un Problème'),
		fields: [
			{
				fieldname: 'type_probleme',
				fieldtype: 'Select',
				label: __('Type de Problème'),
				options: [
					'Panne machine',
					'Manque matière',
					'Qualité',
					'Autre'
				],
				reqd: 1
			},
			{
				fieldname: 'description',
				fieldtype: 'Small Text',
				label: __('Description'),
				reqd: 1
			}
		],
		primary_action_label: __('Signaler et Bloquer'),
		primary_action(values) {
			frappe.call({
				method: 'bloquer',
				doc: frm.doc,
				args: {
					type_probleme: values.type_probleme,
					description: values.description
				},
				callback: function(r) {
					if (!r.exc) {
						d.hide();
						frm.reload_doc();
					}
				}
			});
		}
	});
	
	d.show();
}

function show_visual_alerts(frm) {
	// Badge rouge si en retard
	if (frm.doc.est_en_retard) {
		frm.dashboard.add_indicator(__('EN RETARD de {0}h', [frm.doc.heures_retard.toFixed(1)]), 'red');
	}
	
	// Badge orange si proche du retard (< 2h)
	if (!frm.doc.est_en_retard && frm.doc.statut !== 'Terminée' && frm.doc.date_heure_prevue_fin) {
		let now = new Date();
		let prevue_fin = new Date(frm.doc.date_heure_prevue_fin);
		let heures_restantes = (prevue_fin - now) / (1000 * 60 * 60);
		
		if (heures_restantes > 0 && heures_restantes < 2) {
			frm.dashboard.add_indicator(__('Échéance dans {0}h', [heures_restantes.toFixed(1)]), 'orange');
		}
	}
	
	// Badge rouge clignotant si bloquée
	if (frm.doc.statut === 'Bloquée') {
		frm.dashboard.add_indicator(__('BLOQUÉE'), 'red');
	}
	
	// Afficher la priorité
	if (frm.doc.priorite === 'Très Urgente') {
		frm.dashboard.add_indicator(__('PRIORITÉ TRÈS URGENTE'), 'red');
	} else if (frm.doc.priorite === 'Urgente') {
		frm.dashboard.add_indicator(__('PRIORITÉ URGENTE'), 'orange');
	}
}

function start_timer(frm) {
	// Afficher le temps écoulé en temps réel
	if (!frm.doc.date_heure_debut_reelle) return;
	
	function update_timer() {
		let debut = new Date(frm.doc.date_heure_debut_reelle);
		let now = new Date();
		let diff_ms = now - debut;
		let heures = Math.floor(diff_ms / (1000 * 60 * 60));
		let minutes = Math.floor((diff_ms % (1000 * 60 * 60)) / (1000 * 60));
		
		let timer_text = frappe.format('{0}h {1}min', [heures, minutes]);
		
		// Mettre à jour l'indicateur
		if (!frm._timer_indicator) {
			frm._timer_indicator = true;
			frm.dashboard.add_indicator(__('Temps écoulé: {0}', [timer_text]), 'blue');
		}
	}
	
	// Mettre à jour toutes les minutes
	update_timer();
	setInterval(update_timer, 60000);
}

// Filtres pour la liste
frappe.listview_settings['Operation Production'] = {
	onload: function(listview) {
		// Ajouter des filtres rapides
		listview.page.add_menu_item(__("Mes Opérations Assignées"), function() {
			frappe.set_route('List', 'Operation Production', {
				'operateur_assigne': frappe.session.user,
				'statut': ['!=', 'Terminée']
			});
		});
		
		listview.page.add_menu_item(__("Opérations En Cours"), function() {
			frappe.set_route('List', 'Operation Production', {
				'statut': 'En cours'
			});
		});
		
		listview.page.add_menu_item(__("Opérations En Retard"), function() {
			frappe.set_route('List', 'Operation Production', {
				'est_en_retard': 1
			});
		});
		
		listview.page.add_menu_item(__("Opérations Bloquées"), function() {
			frappe.set_route('List', 'Operation Production', {
				'statut': 'Bloquée'
			});
		});
	},
	
	get_indicator: function(doc) {
		// Indicateurs de couleur dans la liste
		if (doc.statut === 'Terminée') {
			return [__('Terminée'), 'green', 'statut,=,Terminée'];
		} else if (doc.statut === 'Bloquée') {
			return [__('Bloquée'), 'red', 'statut,=,Bloquée'];
		} else if (doc.est_en_retard) {
			return [__('En Retard'), 'red', 'est_en_retard,=,1'];
		} else if (doc.statut === 'En cours') {
			return [__('En cours'), 'blue', 'statut,=,En cours'];
		} else if (doc.statut === 'En pause') {
			return [__('En pause'), 'orange', 'statut,=,En pause'];
		} else if (doc.statut === 'Assignée') {
			return [__('Assignée'), 'cyan', 'statut,=,Assignée'];
		} else {
			return [__('En attente'), 'gray', 'statut,=,En attente'];
		}
	}
};

