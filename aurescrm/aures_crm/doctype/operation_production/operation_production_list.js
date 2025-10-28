// Copyright (c) 2025, Aures and contributors
// For license information, please see license.txt

frappe.listview_settings['Operation Production'] = {
	add_fields: ["statut", "est_en_retard", "operateur_assigne", "workstation", "priorite"],
	
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
	},
	
	onload: function(listview) {
		// Bouton "Mes Opérations Assignées"
		listview.page.add_menu_item(__("Mes Opérations Assignées"), function() {
			frappe.set_route('List', 'Operation Production', {
				'operateur_assigne': frappe.session.user,
				'statut': ['!=', 'Terminée']
			});
		});
		
		// Bouton "Opérations En Cours"
		listview.page.add_menu_item(__("Opérations En Cours"), function() {
			frappe.set_route('List', 'Operation Production', {
				'statut': 'En cours'
			});
		});
		
		// Bouton "Opérations En Retard"
		listview.page.add_menu_item(__("Opérations En Retard"), function() {
			frappe.set_route('List', 'Operation Production', {
				'est_en_retard': 1
			});
		});
		
		// Bouton "Opérations Bloquées" (urgent)
		listview.page.add_menu_item(__("Opérations Bloquées"), function() {
			frappe.set_route('List', 'Operation Production', {
				'statut': 'Bloquée'
			});
		}).css({'color': 'red', 'font-weight': 'bold'});
		
		// Bouton "Opérations Prioritaires"
		listview.page.add_menu_item(__("Opérations Prioritaires"), function() {
			frappe.set_route('List', 'Operation Production', {
				'priorite': ['in', ['Urgente', 'Très Urgente']],
				'statut': ['!=', 'Terminée']
			});
		});
		
		// Auto-refresh toutes les 30 secondes
		setInterval(function() {
			if (listview.list_view_settings && !listview.list_view_settings.disable_auto_refresh) {
				listview.refresh();
			}
		}, 30000);
	},
	
	// Formatters pour les colonnes
	formatters: {
		operateur_assigne: function(value) {
			return value ? `<span class="text-muted">${value}</span>` : '<span class="text-muted">Non assigné</span>';
		},
		workstation: function(value) {
			return value ? `<span class="badge badge-info">${value}</span>` : '';
		}
	}
};

