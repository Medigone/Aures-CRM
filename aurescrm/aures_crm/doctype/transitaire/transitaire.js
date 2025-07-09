// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on('Transitaire', {
	refresh: function(frm) {
		// Afficher les boutons en fonction du statut actuel
		if (frm.doc.status !== 'Actif') {
			frm.add_custom_button(__('Activer'), function() {
				frm.set_value('status', 'Actif');
				frm.save();
			}, __('Statut'));
		}
		
		if (frm.doc.status !== 'Inactif') {
			frm.add_custom_button(__('Désactiver'), function() {
				frm.set_value('status', 'Inactif');
				frm.save();
			}, __('Statut'));
		}
		
		if (frm.doc.status !== 'Bloqué') {
			frm.add_custom_button(__('Bloquer'), function() {
				frm.set_value('status', 'Bloqué');
				frm.save();
			}, __('Statut'));
		}
	}
});