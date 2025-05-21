// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on("BAT", {
	refresh(frm) {
		// Bouton 'Valider'
		if (!frm.doc.__islocal && frm.doc.status === 'Nouveau') {
			frm.add_custom_button(__('Valider'), function() {
				let currentUser = frappe.session.user;
				
				frm.set_value('status', 'Validé');
				frm.set_value('valide_par', currentUser);
				
				frm.save().then(() => {
					frappe.show_alert({
						message: __('BAT validé avec succès'),
						indicator: 'green'
					});
				});
			}).addClass("btn-primary").css({"background-color": "#52b69a", "border-color": "#52b69a"});
		}

		// Bouton 'Obsolète'
		if (!frm.doc.__islocal && frm.doc.status === 'Validé') {
			frm.add_custom_button(__('Obsolète'), function() {
				frm.set_value('status', 'Obsolète');
				
				frm.save().then(() => {
					frappe.show_alert({
						message: __('BAT marqué comme obsolète'),
						indicator: 'red'
					});
				});
			}).addClass("btn-primary").css({"background-color": "#dc3545", "border-color": "#dc3545"});
		}
	}
});
