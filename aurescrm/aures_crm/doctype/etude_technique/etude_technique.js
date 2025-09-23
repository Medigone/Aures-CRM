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
		if (!frm.doc.__islocal && frm.doc.status === 'En Cours') {
			if (!frm.doc.bat) {
				// Le bouton existant pour créer un BAT
				frm.add_custom_button(__('Créer BAT'), function() {
					frappe.confirm(
						__('Voulez-vous créer un BAT à partir de cette étude technique ?'),
						function() {
							// Action si l'utilisateur confirme
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
											// Mettre à jour le champ 'bat' dans l'étude technique
											frappe.call({
												method: 'frappe.client.set_value',
												args: {
													doctype: 'Etude Technique',
													name: frm.doc.name,
													fieldname: 'bat',
													value: r.message.name
												},
												callback: function(response) {
													if (!response.exc) {
														frappe.show_alert({
															message: __('BAT créé avec succès'),
															indicator: 'green'
														});
														frm.reload_doc();
														frappe.set_route('Form', 'BAT', r.message.name);
													}
												}
											});
										} else {
											frappe.msgprint(__('Erreur lors de la création du BAT'));
										}
									}
								});
							});
						},
						function() {
							// Action si l'utilisateur annule
							frappe.show_alert({
								message: __('Création du BAT annulée'),
								indicator: 'orange'
							});
						}
					);
				}).addClass('btn-primary');
			} else {
				// Nouveau bouton pour créer un nouveau BAT
				frm.add_custom_button(__('Créer nouveau BAT'), function() {
					frappe.confirm(
						__('Voulez-vous créer un nouveau BAT ? L\'ancien BAT sera marqué comme obsolète.'),
						function() {
							frappe.call({
								method: 'aurescrm.aures_crm.doctype.etude_technique.etude_technique.create_new_bat_from_etude',
								args: {
									docname: frm.doc.name
								},
								callback: function(r) {
									if (r.message && r.message.status === 'success') {
										frappe.show_alert({
											message: __(r.message.message),
											indicator: 'green'
										});
										frm.reload_doc();
										frappe.set_route('Form', 'BAT', r.message.bat_name);
									} else {
										frappe.msgprint(__(r.message.message));
									}
								}
							});
						}
					);
				}).addClass('btn-warning');
			}
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

function generate_bat_list_html(bats) {
	let html = '<div class="bat-list-container">';
	html += '<table class="table table-bordered">';
	html += '<thead><tr>';
	html += '<th>Nom BAT</th><th>Statut</th><th>Date</th><th>Client</th><th>Validé par</th><th>Actions</th>';
	html += '</tr></thead><tbody>';
	
	bats.forEach(bat => {
		let status_color = get_status_color(bat.status);
		let validated_by = bat.valide_par_nom || bat.echantillon_par_nom || '-';
		
		html += '<tr>';
		html += `<td><strong>${bat.name}</strong></td>`;
		html += `<td><span class="badge" style="background-color: ${status_color}">${bat.status}</span></td>`;
		html += `<td>${bat.date || '-'}</td>`;
		html += `<td>${bat.client || '-'}</td>`;
		html += `<td>${validated_by}</td>`;
		html += `<td><button class="btn btn-sm btn-primary link-bat-btn" data-bat-name="${bat.name}">Lier</button></td>`;
		html += '</tr>';
	});
	
	html += '</tbody></table>';
	html += '</div>';
	
	// Ajouter les styles CSS
	html += '<style>';
	html += '.bat-list-container { max-height: 400px; overflow-y: auto; }';
	html += '.badge { color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; }';
	html += '.link-bat-btn { margin: 2px; }';
	html += '</style>';
	
	return html;
}

function get_status_color(status) {
	switch(status) {
		case 'Nouveau': return '#007bff';
		case 'BAT-E Validé': return '#fd7e14';
		case 'BAT-P Validé': return '#28a745';
		case 'Obsolète': return '#dc3545';
		default: return '#6c757d';
	}
}
