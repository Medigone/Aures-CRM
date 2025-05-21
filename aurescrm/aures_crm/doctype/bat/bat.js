// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on("BAT", {
	refresh(frm) {
		// Bouton 'Valider'
		if (!frm.doc.__islocal && frm.doc.status === 'Nouveau') {
			frm.add_custom_button(__('Valider'), function() {
				if (!frm.doc.fichier_valide) {
					frappe.msgprint({
						title: __('Document requis'),
						message: __('Veuillez joindre le document validé par le client avant de valider le BAT'),
						indicator: 'red'
					});
					return;
				}

				let currentUser = frappe.session.user;
				
				frm.set_value('status', 'Validé');
				frm.set_value('valide_par', currentUser);
				
				frm.save().then(() => {
					frappe.show_alert({
						message: __('BAT validé avec succès'),
						indicator: 'green'
					});
				});
			}).addClass("btn-primary").css({"background-color": "#e76f51", "border-color": "#e76f51"});
		}

		// Bouton 'Obsolète'
		if (!frm.doc.__islocal && (frm.doc.status === 'Validé' || frm.doc.status === 'Échantillon Validé')) {
			frm.add_custom_button(__('Obsolète'), function() {
				frappe.confirm(
					__('Voulez-vous vraiment marquer ce BAT comme obsolète ?'),
					function() {
						// Action si l'utilisateur confirme
						let currentUser = frappe.session.user;
						
						Promise.all([
							frm.set_value('status', 'Obsolète'),
							frm.set_value('obsolete_par', currentUser)
						]).then(() => {
							return frm.save();
						}).then(() => {
							frappe.show_alert({
								message: __('BAT marqué comme obsolète'),
								indicator: 'red'
							});
						});
					},
					function() {
						// Action si l'utilisateur annule
						frappe.show_alert({
							message: __('Opération annulée'),
							indicator: 'orange'
						});
					}
				);
			}).addClass("btn-primary").css({"background-color": "#dc3545", "border-color": "#dc3545"});
		}

		// Bouton 'Échantillon Validé'
		if (!frm.doc.__islocal && frm.doc.status === 'Validé') {
			frm.add_custom_button(__('Échantillon Validé'), function() {
				frappe.confirm(
					__('Voulez-vous valider l\'échantillon pour ce BAT ?'),
					function() {
						// Action si l'utilisateur confirme
						let currentUser = frappe.session.user;
						
						Promise.all([
							frm.set_value('status', 'Échantillon Validé'),
							frm.set_value('echantillon_par', currentUser)
						]).then(() => {
							return frm.save();
						}).then(() => {
							frappe.show_alert({
								message: __('Échantillon validé avec succès'),
								indicator: 'green'
							});
						});
					},
					function() {
						// Action si l'utilisateur annule
						frappe.show_alert({
							message: __('Opération annulée'),
							indicator: 'orange'
						});
					}
				);
			}).addClass("btn-primary").css({"background-color": "#52b69a", "border-color": "#52b69a"});
		}
	}
});
