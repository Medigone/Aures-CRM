// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Suivi Creance", {
	refresh(frm) {
		// Désactiver tous les champs si le statut est Obsolète
		if (frm.doc.status === 'Obsolète') {
			frm.disable_form();
			frm.set_df_property("html_bout_payement", "hidden", true);
			return; // Sortir de la fonction pour ne pas afficher les boutons
		}

		// Masquer les boutons "Add Row" et "Delete" pour la table factures
		frm.set_df_property("factures", "cannot_add_rows", true);
		frm.set_df_property("factures", "cannot_delete", true);
		
		// Masquer la table factures pendant la création
		if (frm.is_new()) {
			frm.set_df_property("factures", "hidden", true);
		} else {
			frm.set_df_property("factures", "hidden", false);
		}

		// Masquer les boutons pendant la création
		if (frm.is_new()) {
			frm.set_df_property("html_bout_payement", "hidden", true);
		} else {
			frm.set_df_property("html_bout_payement", "hidden", false);
		}

		// Masquer le champ montant_payement s'il n'y a pas de type de paiement
		frm.set_df_property("montant_payement", "hidden", !frm.doc.type_paiement);

		// Ajouter les boutons de paiement dans le champ HTML
		$(frm.fields_dict.html_bout_payement.wrapper)
			.empty()
			.append(`
				${!frm.doc.type_paiement ? `
					<button class="btn btn-primary btn-sm" id="btn-paiement">
						Ajouter Paiement
					</button>
					<button class="btn btn-secondary btn-sm ml-2" id="btn-promesse">
						Promesse de paiement
					</button>
				` : !frm.doc.ecr_paiement ? `
					<button class="btn btn-danger btn-sm ml-2" id="btn-supprimer-paiement">
						Supprimer Paiement
					</button>
				` : ''}
			`);

		// Gestionnaire d'événement pour le bouton Supprimer Paiement
		$(frm.fields_dict.html_bout_payement.wrapper).find("#btn-supprimer-paiement").on("click", function() {
			frappe.confirm(
				'Êtes-vous sûr de vouloir supprimer les informations de paiement ?',
				function() {
					// Action si l'utilisateur confirme
					frm.set_value("type_paiement", "");
					frm.set_value("date_doc_payement", "");
					frm.set_value("n_doc", "");
					frm.set_value("photo", "");
					frm.set_value("montant_payement", 0);
					
					// Réinitialiser les montants de paiement dans la table des factures
					frm.doc.factures.forEach(function(row) {
						frappe.model.set_value(row.doctype, row.name, 'montant_paiement', 0);
					});
					
					updateStatus(frm); // Mise à jour du statut après suppression
					frm.refresh_field('factures'); // Rafraîchir l'affichage de la table
					frm.save();
					frappe.show_alert({
						message: 'Informations de paiement supprimées',
						indicator: 'green'
					});
				}
			);
		});

		// Gestionnaire d'événement pour le bouton Paiement
		$(frm.fields_dict.html_bout_payement.wrapper).find("#btn-paiement").on("click", () => {
			let fields = [
				{
					fieldtype: "Section Break",
					label: "Informations de la créance"
				},
				{
					label: "Montant total dû",
					fieldname: "montant_tot_du_display",
					fieldtype: "Currency",
					read_only: 1,
					default: frm.doc.montant_tot_du,
					options: "د.ج",
					bold: 1
				},
				{
					fieldtype: "Section Break",
					label: "Informations du paiement"
				},
				{
					label: "Type Paiement",
					fieldname: "type_paiement",
					fieldtype: "Select",
					options: "Espèce\nChèque\nVirement",
					reqd: 1,
					default: frm.doc.type_paiement,
					onchange: function() {
						toggleRepartitionSection(d);
					}
				},
				{
					label: "Date Chèque/Virement",
					fieldname: "date_doc_payement",
					fieldtype: "Date",
					depends_on: "eval:doc.type_paiement==\"Chèque\" || doc.type_paiement==\"Virement\"",
					default: frm.doc.date_doc_payement,
					reqd: 1,
					mandatory_depends_on: "eval:doc.type_paiement==\"Chèque\" || doc.type_paiement==\"Virement\""
				},
				{
					label: "Nº",
					fieldname: "n_doc",
					fieldtype: "Data",
					depends_on: "eval:doc.type_paiement==\"Chèque\" || doc.type_paiement==\"Virement\"",
					default: frm.doc.n_doc,
					reqd: 1,
					mandatory_depends_on: "eval:doc.type_paiement==\"Chèque\" || doc.type_paiement==\"Virement\""
				},
				{
					label: "Photo",
					fieldname: "photo",
					fieldtype: "Attach",
					depends_on: "eval:doc.type_paiement==\"Chèque\" || doc.type_paiement==\"Virement\"",
					default: frm.doc.photo,
					reqd: 1,
					mandatory_depends_on: "eval:doc.type_paiement==\"Chèque\" || doc.type_paiement==\"Virement\""
				},
				{
					label: "Montant",
					fieldname: "montant_payement",
					fieldtype: "Currency",
					reqd: 1,
					default: frm.doc.montant_payement,
					options: "د.ج",
					depends_on: "eval:doc.type_paiement",
					onchange: function() {
						toggleRepartitionSection(d);
					}
				},
				{
					fieldtype: "Section Break",
					fieldname: "section_repartition",
					label: "Répartition du paiement",
					depends_on: "eval:doc.type_paiement"
				},
				{
					label: "Montant restant à répartir",
					fieldname: "montant_restant",
					fieldtype: "Currency",
					read_only: 1,
					default: 0,
					options: "د.ج",
					bold: 1,
					depends_on: "eval:doc.type_paiement"
				}
			];

			// Ajouter dynamiquement les champs pour chaque facture
			frm.doc.factures.forEach(function(row) {
				fields.push({
					label: `Paiement pour ${row.facture} (Montant dû: ${format_currency(row.montant_du, "د.ج", 'ar-DZ')})`,
					fieldname: `paiement_${row.name}`,
					fieldtype: "Currency",
					default: 0,
					read_only: 0,
					options: "د.ج",
					depends_on: "eval:doc.type_paiement",
					onchange: function() {
						let montant_saisi = d.get_value(`paiement_${row.name}`) || 0;
						let montant_du = row.montant_du || 0;

						// Vérifier si le montant saisi dépasse le montant dû
						if (montant_saisi > montant_du) {
							frappe.msgprint({
								title: "Erreur",
								indicator: "red",
								message: `Le montant du paiement (${format_currency(montant_saisi, "د.ج", 'ar-DZ')}) ne peut pas dépasser le montant dû (${format_currency(montant_du, "د.ج", 'ar-DZ')}) pour la facture ${row.facture}`
							});
							d.set_value(`paiement_${row.name}`, montant_du);
							montant_saisi = montant_du;
						}

						let total_reparti = 0;
						frm.doc.factures.forEach(function(r) {
							total_reparti += d.get_value(`paiement_${r.name}`) || 0;
						});
						
						let montant_total = d.get_value('montant_payement') || 0;
						let montant_restant = montant_total - total_reparti;
						
						d.set_value('montant_restant', montant_restant);
						
						if (total_reparti > montant_total) {
							frappe.msgprint({
								title: "Erreur",
								indicator: "red",
								message: "Montant réparti supérieur au paiement"
							});
						}
					}
				});
			});

			let d = new frappe.ui.Dialog({
				title: "Saisir le paiement",
				fields: fields,
				primary_action_label: "Valider",
				primary_action(values) {
					if (values.montant_payement <= 0) {
						frappe.msgprint({
							title: "Erreur",
							indicator: "red",
							message: "Le montant du paiement doit être supérieur à 0"
						});
						return;
					}

					let total_reparti = 0;
					frm.doc.factures.forEach(function(row) {
						total_reparti += values[`paiement_${row.name}`] || 0;
					});

					if (total_reparti > values.montant_payement) {
						frappe.msgprint({
							title: "Erreur",
							indicator: "red",
							message: "Impossible de valider : le montant réparti est supérieur au montant du paiement"
						});
						return;
					}

					// Vérifier que tout le montant est réparti
					if (Math.abs(values.montant_restant) > 0.01) {
						frappe.msgprint({
							title: "Erreur",
							indicator: "red",
							message: "Veuillez répartir la totalité du montant du paiement sur les factures"
						});
						return;
					}

					// Mettre à jour les montants de paiement dans les factures
					frm.doc.factures.forEach(function(row) {
						frappe.model.set_value(row.doctype, row.name, 'montant_paiement', 
							values[`paiement_${row.name}`] || 0);
					});

					frm.set_value("type_paiement", values.type_paiement);
					frm.set_value("date_doc_payement", values.date_doc_payement);
					frm.set_value("n_doc", values.n_doc);
					frm.set_value("photo", values.photo);
					frm.set_value("montant_payement", values.montant_payement);
					updateStatus(frm);
					frm.refresh_field('factures');
					frm.save();
					d.hide();
				}
			});

			// Fonction pour gérer l'affichage de la section répartition
			function toggleRepartitionSection(dialog) {
				let type_paiement = dialog.get_value('type_paiement');
				let montant = dialog.get_value('montant_payement') || 0;
				
				if (type_paiement && montant > 0) {
					dialog.set_value('montant_restant', montant);
					
					// Pré-remplir les répartitions
					let montant_restant = montant;
					frm.doc.factures.forEach(function(row) {
						if (montant_restant > 0) {
							let montant_du = row.montant_du || 0;
							let montant_a_repartir = Math.min(montant_restant, montant_du);
							dialog.set_value(`paiement_${row.name}`, montant_a_repartir);
							montant_restant -= montant_a_repartir;
						} else {
							dialog.set_value(`paiement_${row.name}`, 0);
						}
					});
					
					// Mettre à jour le montant restant après la répartition
					dialog.set_value('montant_restant', montant_restant);
				}
			}

			d.show();
		});

		// Gestionnaire d'événement pour le bouton Promesse de paiement
		$(frm.fields_dict.html_bout_payement.wrapper).find("#btn-promesse").on("click", function() {
			let d = new frappe.ui.Dialog({
				title: "Saisir la promesse de paiement",
				fields: [
					{
						label: "Date Promesse de paiement",
						fieldname: "date_prom_paiement",
						fieldtype: "Date",
						reqd: 1,
						default: frm.doc.date_prom_paiement
					}
				],
				primary_action_label: "Valider",
				primary_action(values) {
					frm.set_value("date_prom_paiement", values.date_prom_paiement);
					frm.set_value("status", "Promesse de paiement");
					frm.save();
					d.hide();
				}
			});
			d.show();
		});

		// Ajouter le bouton Litige dans la barre d'outils du formulaire
		if (frm.doc.status !== 'Totalement réglé' && frm.doc.status !== 'Obsolète') {
			frm.add_custom_button(__('Marquer comme Litige'), function() {
				frappe.confirm(
					'Êtes-vous sûr de vouloir marquer cette créance comme litige ?',
					function() {
						frm.set_value('status', 'Litige');
						frm.save();
						frappe.show_alert({
							message: 'Statut mis à jour : Litige',
							indicator: 'orange'
						});
					}
				);
			});
		}

		// Vérifier si une écriture de paiement est déjà liée
		if (!frm.doc.ecr_paiement) {
			// Gestionnaire d'événement pour le bouton Supprimer Paiement
			$(frm.fields_dict.html_bout_payement.wrapper).find("#btn-supprimer-paiement").on("click", function() {
				frappe.confirm(
					'Êtes-vous sûr de vouloir supprimer les informations de paiement ?',
					function() {
						// Action si l'utilisateur confirme
						frm.set_value("type_paiement", "");
						frm.set_value("date_doc_payement", "");
						frm.set_value("n_doc", "");
						frm.set_value("photo", "");
						frm.set_value("montant_payement", 0);
						
						// Réinitialiser les montants de paiement dans la table des factures
						frm.doc.factures.forEach(function(row) {
							frappe.model.set_value(row.doctype, row.name, 'montant_paiement', 0);
						});
						
						updateStatus(frm); // Mise à jour du statut après suppression
						frm.refresh_field('factures'); // Rafraîchir l'affichage de la table
						frm.save();
						frappe.show_alert({
							message: 'Informations de paiement supprimées',
							indicator: 'green'
						});
					}
				);
			});

			// Ajouter le bouton Générer Paiements si un paiement existe
			if (frm.doc.type_paiement) {
				frm.add_custom_button(__('Générer Paiements'), function() {
					frappe.confirm(
						'Voulez-vous générer les écritures de paiement en brouillon ?',
						function() {
							frm.call({
								doc: frm.doc,
								method: 'generer_ecritures_paiement',
								callback: function(r) {
									frm.reload_doc();
								}
							});
						}
					);
				}, __("Actions"));
			}
		}
	},
	
	id_client: function(frm) {
		// Vider la table des factures si le client change
		if (frm.is_new() && frm.doc.id_client) {
			frm.clear_table("factures");
			frm.refresh_field("factures");
		}
	}
});

// Gestion de la table enfant Factures Creances
frappe.ui.form.on("Factures Creances", {
	montant_paiement: function(frm, cdt, cdn) {
		// Recalculer le montant restant lorsqu'un paiement est saisi
		let total_restant = 0;
		frm.doc.factures.forEach(function(row) {
			total_restant += (row.montant_du - (row.montant_paiement || 0));
		});
		frm.set_value("montant_restant", total_restant);
		updateStatus(frm); // Ajouter l'appel à updateStatus ici
	}
});

// Fonction pour mettre à jour le statut
function updateStatus(frm) {
	if (!frm.doc.montant_payement || frm.doc.montant_payement <= 0) {
		// Si pas de paiement ou paiement supprimé
		if (frm.doc.date_prom_paiement) {
			frm.set_value('status', 'Promesse de paiement');
		} else {
			frm.set_value('status', 'Nouveau');
		}
	} else {
		// Si un paiement existe
		if (frm.doc.montant_restant === 0) {
			frm.set_value('status', 'Totalement réglé');
		} else if (frm.doc.montant_restant > 0 && frm.doc.montant_restant < frm.doc.montant_tot_du) {
			frm.set_value('status', 'Partiellement réglé');
		}
	}
}
