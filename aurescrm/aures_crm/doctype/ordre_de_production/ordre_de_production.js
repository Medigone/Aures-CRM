// Copyright (c) 2025, AURES Technologies and contributors
// For license information, please see license.txt

frappe.ui.form.on('Ordre de Production', {
	refresh: function(frm) {
		// Actualiser le dashboard HTML
		actualiser_dashboard(frm);
		
		// Bouton "Générer Opérations" si pas encore généré
		if (frm.doc.docstatus === 0 && frm.doc.route_production) {
			verifier_operations_existantes(frm);
		}
		
		// Bouton "Voir Opérations"
		if (frm.doc.name) {
			frm.add_custom_button(__('Voir Opérations'), function() {
				frappe.set_route('List', 'Operation Production', {
					'ordre_production': frm.doc.name
				});
			}, __('Actions'));
		}
		
		// Alertes visuelles
		afficher_alertes(frm);
		
		// Auto-refresh toutes les 30 secondes si en production
		if (frm.doc.status === 'En Production' && !frm.is_dirty()) {
			setTimeout(function() {
				frm.reload_doc();
			}, 30000);
		}
	},
	
	route_production: function(frm) {
		// Proposition de génération des opérations
		if (frm.doc.route_production && frm.doc.name) {
			verifier_operations_existantes(frm);
		}
	},
	
	onload: function(frm) {
		// Filtres personnalisés
		frm.set_query('etude_technique', function() {
			return {
				filters: {
					'docstatus': 1,
					'ordre_production': ['is', 'not set']
				}
			};
		});
		
		frm.set_query('route_production', function() {
			return {
				filters: {
					'is_active': 1
				}
			};
		});
	}
});

// Fonctions utilitaires

function verifier_operations_existantes(frm) {
	frappe.call({
		method: 'frappe.client.get_count',
		args: {
			doctype: 'Operation Production',
			filters: {
				'ordre_production': frm.doc.name
			}
		},
		callback: function(r) {
			if (r.message === 0) {
				// Aucune opération, afficher le bouton
				frm.add_custom_button(__('Générer Opérations'), function() {
					generer_operations(frm);
				}).css({'background-color': '#28a745', 'color': 'white'});
			}
		}
	});
}

function generer_operations(frm) {
	frappe.confirm(
		__('Générer les opérations depuis la route de production ?'),
		function() {
			frappe.call({
				method: 'generer_operations_depuis_route',
				doc: frm.doc,
				callback: function(r) {
					if (!r.exc) {
						frm.reload_doc();
					}
				}
			});
		}
	);
}

function actualiser_dashboard(frm) {
	if (frm.doc.name) {
		frappe.call({
			method: 'get_dashboard_html',
			doc: frm.doc,
			callback: function(r) {
				if (r.message) {
					frm.set_df_property('dashboard_operations', 'options', r.message);
					frm.refresh_field('dashboard_operations');
				}
			}
		});
	}
}

function afficher_alertes(frm) {
	// Récupérer les statistiques des opérations
	if (frm.doc.name) {
		frappe.call({
			method: 'frappe.client.get_list',
			args: {
				doctype: 'Operation Production',
				filters: {
					'ordre_production': frm.doc.name
				},
				fields: ['name', 'statut', 'est_en_retard']
			},
			callback: function(r) {
				if (r.message) {
					let ops_bloquees = r.message.filter(op => op.statut === 'Bloquée').length;
					let ops_en_retard = r.message.filter(op => op.est_en_retard).length;
					
					if (ops_bloquees > 0) {
						frm.dashboard.add_indicator(
							__('🚨 {0} opération(s) bloquée(s)', [ops_bloquees]),
							'red'
						);
					}
					
					if (ops_en_retard > 0) {
						frm.dashboard.add_indicator(
							__('⚠️ {0} opération(s) en retard', [ops_en_retard]),
							'orange'
						);
					}
					
					// Priorité
					if (frm.doc.priorite === 'Très Urgente') {
						frm.dashboard.add_indicator(__('PRIORITÉ TRÈS URGENTE'), 'red');
					} else if (frm.doc.priorite === 'Urgente') {
						frm.dashboard.add_indicator(__('PRIORITÉ URGENTE'), 'orange');
					}
				}
			}
		});
	}
}
