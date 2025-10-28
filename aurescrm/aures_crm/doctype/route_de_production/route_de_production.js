// Copyright (c) 2025, AURES Technologies and contributors
// For license information, please see license.txt

frappe.ui.form.on('Route de Production', {
	refresh: function(frm) {
		// Afficher un message si la route est inactive
		if (!frm.doc.is_active) {
			frm.dashboard.set_headline_alert(
				'Cette route est inactive et ne sera pas utilisée pour les nouveaux ordres',
				'orange'
			);
		}
	},
	
	onload: function(frm) {
		// Trier les étapes par ordre lors du chargement
		if (frm.doc.etapes) {
			frm.doc.etapes.sort((a, b) => a.ordre - b.ordre);
			frm.refresh_field('etapes');
		}
	}
});

frappe.ui.form.on('Etape Route', {
	ordre: function(frm, cdt, cdn) {
		// Vérifier les doublons d'ordre
		let row = locals[cdt][cdn];
		let ordres = frm.doc.etapes.map(e => e.ordre);
		let duplicates = ordres.filter((item, index) => ordres.indexOf(item) !== index);
		
		if (duplicates.includes(row.ordre)) {
			frappe.msgprint(__('Le numéro d\'ordre {0} est déjà utilisé', [row.ordre]));
		}
	}
});

