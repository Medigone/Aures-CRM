// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on("BAT", {
	refresh(frm) {
		// Bouton 'BAT-E Validé'
		if (!frm.doc.__islocal && frm.doc.status === 'Nouveau') {
			frm.add_custom_button(__('BAT-E Validé'), function() {
				if (!frm.doc.fichier_valide) {
					frappe.msgprint({
						title: __('Document requis'),
						message: __('Veuillez joindre le document validé par le client avant de valider le BAT'),
						indicator: 'red'
					});
					return;
				}

				let currentUser = frappe.session.user;
				
				frm.set_value('status', 'BAT-E Validé');
				frm.set_value('valide_par', currentUser);
				
				frm.save().then(() => {
					frappe.show_alert({
						message: __('BAT-E validé avec succès'),
						indicator: 'green'
					});
				});
			}).addClass("btn-primary").css({"background-color": "#e76f51", "border-color": "#e76f51"});
		}

		// Bouton 'BAT-P Validé'
		if (!frm.doc.__islocal && frm.doc.status === 'BAT-E Validé') {
			frm.add_custom_button(__("BAT-P Validé"), function() {
				// Vérifier s'il existe déjà un BAT validé
				frappe.db.get_list('BAT', {
					filters: {
						'article': frm.doc.article,
						'status': 'BAT-P Validé',
						'name': ['!=', frm.doc.name]
					}
				}).then(bats => {
					if (bats && bats.length > 0) {
						frappe.msgprint({
							title: __("BAT déjà validé"),
							message: __("Un BAT est déjà validé pour cet article. Veuillez d'abord marquer l'ancien BAT comme obsolète."),
							indicator: 'red'
						});
						return;
					}

					// Continuer avec la validation si aucun BAT validé n'existe
					frappe.confirm(
						__("Voulez-vous valider le BAT-P ?"),
						function() {
							// Action si l'utilisateur confirme
							let currentUser = frappe.session.user;
							
							frm.set_value('status', 'BAT-P Validé')
								.then(() => frm.set_value('echantillon_par', currentUser))
								.then(() => frm.save())
								.then(() => {
									frappe.show_alert({
										message: __('BAT-P validé avec succès'),
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
				});
			}).addClass("btn-primary").css({"background-color": "#52b69a", "border-color": "#52b69a"});
		}

		// Bouton 'Obsolète'
		if (!frm.doc.__islocal && (frm.doc.status === 'BAT-E Validé' || frm.doc.status === 'BAT-P Validé')) {
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
	}
});
