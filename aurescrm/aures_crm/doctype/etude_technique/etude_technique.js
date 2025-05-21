// Copyright (c) 2024, AURES Technologies and contributors
// For license information, please see license.txt

frappe.ui.form.on("Etude Technique", {
	refresh(frm) {
		// Bouton 'Attribuer à moi'
		if (!frm.doc.__islocal && frm.doc.status === 'Nouveau') {
			frm.add_custom_button(__('À moi'), function() {
				let currentUser = frappe.session.user;

				frappe.call({
					method: "aurescrm.aures_crm.doctype.etude_technique.etude_technique.update_technicien",
					args: {
						docname: frm.doc.name,
						technicien_user: currentUser
					},
					callback: function(r) {
						if (r.message && r.message.status === "success") {
							// Mettre à jour l'UI SEULEMENT si l'appel serveur réussit
							let userFullName = r.message.full_name; // Récupérer le nom complet
							frm.set_value('technicien', currentUser);
							frm.set_value('nom_utilisateur', userFullName); // Mettre à jour le nom utilisateur
							frm.refresh_field('technicien');
							frm.refresh_field('nom_utilisateur'); // Rafraîchir le champ nom utilisateur
							frappe.show_alert({ message: __('Technicien assigné: ') + userFullName, indicator: 'green' });
							frm.reload_doc();
						} else {
							let error_msg = r.message ? r.message.message : __('Erreur inconnue');
							frappe.show_alert({ message: __('Erreur lors de la mise à jour: ') + error_msg, indicator: 'red' });
							console.error("Erreur update_technicien (callback):", r);
						}
					},
					error: function(r) {
						frappe.show_alert({ message: __('Erreur de communication serveur'), indicator: 'red' });
						console.error("Erreur update_technicien (error):", r);
					}
				});
			}, __("Attribuer"));
		}

		// Bouton 'Attribuer à...'
		if (!frm.doc.__islocal && frm.doc.status === 'Nouveau') {
			frm.add_custom_button(__('Attribuer à...'), function() {
				let dialog = new frappe.ui.Dialog({
					title: __('Sélectionner un Technicien Prépresse'),
					fields: [
						{
							label: __('Utilisateur'),
							fieldname: 'selected_user',
							fieldtype: 'Link',
							options: 'User',
							reqd: 1,
							get_query: function() {
								return {
									query: "aurescrm.aures_crm.doctype.etude_technique.etude_technique.get_techniciens_prepresse",
								};
							}
						}
					],
					primary_action_label: __('Sélectionner'),
					primary_action(values) {
						if (values.selected_user) {
							let selectedUser = values.selected_user;

							frappe.call({
								method: "aurescrm.aures_crm.doctype.etude_technique.etude_technique.update_technicien",
								args: {
									docname: frm.doc.name,
									technicien_user: selectedUser
								},
								callback: function(r) {
									if (r.message && r.message.status === "success") {
										// Mettre à jour l'UI SEULEMENT si l'appel serveur réussit
										let userFullName = r.message.full_name; // Récupérer le nom complet
										frm.set_value('technicien', selectedUser);
										frm.set_value('nom_utilisateur', userFullName); // Mettre à jour le nom utilisateur
										frm.refresh_field('technicien');
										frm.refresh_field('nom_utilisateur'); // Rafraîchir le champ nom utilisateur
										frappe.show_alert({ message: __('Technicien assigné: ') + userFullName, indicator: 'green' });
										frm.reload_doc();
									} else {
										let error_msg = r.message ? r.message.message : __('Erreur inconnue');
										frappe.show_alert({ message: __('Erreur lors de la mise à jour: ') + error_msg, indicator: 'red' });
										console.error("Erreur update_technicien (callback):", r);
									}
								},
								error: function(r) {
									frappe.show_alert({ message: __('Erreur de communication serveur'), indicator: 'red' });
									console.error("Erreur update_technicien (error):", r);
								}
							});
						}
						dialog.hide();
					}
				});
				dialog.show();
			}, __("Attribuer"));
		}
		// Bouton 'Créer BAT'
		if (!frm.doc.__islocal && frm.doc.status === 'Terminé') {
			frm.add_custom_button(__('Créer BAT'), function() {
				frappe.model.with_doctype('BAT', function() {
					let bat = frappe.model.get_new_doc('BAT');
					
					// Copier les données de l'étude technique vers le BAT
					bat.client = frm.doc.client;
					bat.article = frm.doc.article;
					bat.trace = frm.doc.trace;
					bat.maquette = frm.doc.maquette;
					bat.etude_tech = frm.doc.name;
					
					// Sauvegarder le BAT
					frappe.call({
						method: 'frappe.client.save',
						args: {
							doc: bat
						},
						callback: function(r) {
							if (!r.exc) {
								frappe.show_alert({
									message: __('BAT créé avec succès'),
									indicator: 'green'
								});
								frappe.set_route('Form', 'BAT', r.message.name);
							} else {
								frappe.msgprint(__('Erreur lors de la création du BAT'));
							}
						}
					});
				});
			}).addClass('btn-primary');
		}
	},

	quantite(frm) {
		calculate_quant_feuilles(frm);
	},

	nbr_poses(frm) {
		calculate_quant_feuilles(frm);
	}
});

function calculate_quant_feuilles(frm) {
	let quantite = frm.doc.quantite || 0;
	let nbr_poses = frm.doc.nbr_poses || 0;

	if (nbr_poses > 0) {
		let quant_feuilles = Math.ceil(quantite / nbr_poses); // Utilise Math.ceil pour arrondir à l'entier supérieur
		frm.set_value("quant_feuilles", quant_feuilles);
	} else {
		frm.set_value("quant_feuilles", 0); // Ou une autre valeur par défaut si nbr_poses est 0 ou non défini
	}
	frm.refresh_field("quant_feuilles");
}
