// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Suivi Creance", {
	refresh(frm) {
		// Désactiver tous les champs si le statut est Obsolète
		if (frm.doc.status === 'Obsolète') {
			frm.disable_form();
			frm.set_df_property("html_bout_payement", "hidden", true);
			return;
		}

		frm.set_df_property('montant_tot_du', 'read_only', 1);
		updateRecapHtml(frm);

		frm.set_df_property("factures", "cannot_add_rows", false);
		frm.set_df_property("factures", "cannot_delete", false);
		frm.set_df_property("factures", "hidden", false);

		frm.set_df_property("paiements", "cannot_add_rows", true);
		frm.set_df_property("paiements", "cannot_delete", false);
		frm.set_df_property("paiements", "hidden", false);

		frm.set_df_property("promesses", "cannot_add_rows", true);
		frm.set_df_property("promesses", "cannot_delete", false);
		frm.set_df_property("promesses", "hidden", false);

		frm.set_df_property("litiges", "cannot_add_rows", true);
		frm.set_df_property("litiges", "cannot_delete", false);
		frm.set_df_property("litiges", "hidden", false);

		if (frm.is_new()) {
			frm.set_df_property("html_bout_payement", "hidden", true);
		} else {
			frm.set_df_property("html_bout_payement", "hidden", false);
		}

		const hasPaiements = Array.isArray(frm.doc.paiements) && frm.doc.paiements.length > 0;
		frm.set_df_property("montant_payement", "hidden", !hasPaiements);

		if (!frm.is_new()) {
			frm.add_custom_button(__('Importer Excel'), () => importFacturesExcel(frm), __('Factures'));
			frm.add_custom_button(__('Modèle Excel'), () => telechargerModeleExcel(), __('Factures'));
		}

		$(frm.fields_dict.html_bout_payement.wrapper)
			.empty()
			.append(`
				<button class="btn btn-sm" id="btn-paiement" style="background-color: #34a0a4; color: white;">
					Ajouter Paiement
				</button>
				<button class="btn btn-sm ml-2" id="btn-promesse" style="background-color: #f4a261; color: white;">
					Promesse de paiement
				</button>
			`);

		$(frm.fields_dict.html_bout_payement.wrapper).find("#btn-paiement").on("click", () => {
			const hasInvoices = Array.isArray(frm.doc.factures) && frm.doc.factures.length > 0;
			let dialogInstance;

			const toggleRepartitionSection = () => {
				if (!hasInvoices || !dialogInstance) {
					return;
				}

				const type_paiement = dialogInstance.get_value('type_paiement');
				const montant = dialogInstance.get_value('montant_payement') || 0;

				if (type_paiement && montant > 0) {
					dialogInstance.set_value('montant_restant', montant);

					let montant_restant = montant;
					frm.doc.factures.forEach(function(row) {
						if (montant_restant > 0) {
							const deja_paye = flt(row.montant_paiement);
							const reste_facture = Math.max(flt(row.montant_du) - deja_paye, 0);
							const montant_a_repartir = Math.min(montant_restant, reste_facture);
							dialogInstance.set_value(`paiement_${row.name}`, montant_a_repartir);
							montant_restant -= montant_a_repartir;
						} else {
							dialogInstance.set_value(`paiement_${row.name}`, 0);
						}
					});

					dialogInstance.set_value('montant_restant', montant_restant);
				}
			};

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
					default: frm.doc.montant_restant,
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
					onchange: function() {
						toggleRepartitionSection();
					}
				},
				{
					label: "Date Chèque/Virement",
					fieldname: "date_doc_payement",
					fieldtype: "Date",
					depends_on: "eval:doc.type_paiement==\"Chèque\" || doc.type_paiement==\"Virement\"",
					reqd: 1,
					mandatory_depends_on: "eval:doc.type_paiement==\"Chèque\" || doc.type_paiement==\"Virement\""
				},
				{
					label: "Nº",
					fieldname: "n_doc",
					fieldtype: "Data",
					depends_on: "eval:doc.type_paiement==\"Chèque\" || doc.type_paiement==\"Virement\"",
					reqd: 1,
					mandatory_depends_on: "eval:doc.type_paiement==\"Chèque\" || doc.type_paiement==\"Virement\""
				},
				{
					label: "Photo",
					fieldname: "photo",
					fieldtype: "Attach",
					depends_on: "eval:doc.type_paiement==\"Chèque\" || doc.type_paiement==\"Virement\"",
					reqd: 1,
					mandatory_depends_on: "eval:doc.type_paiement==\"Chèque\" || doc.type_paiement==\"Virement\""
				},
				{
					label: "Montant",
					fieldname: "montant_payement",
					fieldtype: "Currency",
					reqd: 1,
					default: 0,
					options: "د.ج",
					depends_on: "eval:doc.type_paiement",
					onchange: function() {
						toggleRepartitionSection();
					}
				}
			];

			if (hasInvoices) {
				fields = fields.concat([
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
				]);

				frm.doc.factures.forEach(function(row) {
					const deja_paye = flt(row.montant_paiement);
					const reste_facture = Math.max(flt(row.montant_du) - deja_paye, 0);
					fields.push({
						label: `Paiement pour ${row.facture || __('Sans n°')} (Reste: ${format_currency(reste_facture, "د.ج", 'ar-DZ')})`,
						fieldname: `paiement_${row.name}`,
						fieldtype: "Currency",
						default: 0,
						read_only: 0,
						options: "د.ج",
						depends_on: "eval:doc.type_paiement",
						onchange: function() {
							if (!dialogInstance) {
								return;
							}
							let montant_saisi = dialogInstance.get_value(`paiement_${row.name}`) || 0;
							const reste = Math.max(flt(row.montant_du) - flt(row.montant_paiement), 0);

							if (montant_saisi > reste) {
								frappe.msgprint({
									title: "Erreur",
									indicator: "red",
									message: `Le montant du paiement (${format_currency(montant_saisi, "د.ج", 'ar-DZ')}) ne peut pas dépasser le reste dû (${format_currency(reste, "د.ج", 'ar-DZ')}) pour la facture ${row.facture}`
								});
								dialogInstance.set_value(`paiement_${row.name}`, reste);
								montant_saisi = reste;
							}

							let total_reparti = 0;
							frm.doc.factures.forEach(function(r) {
								total_reparti += dialogInstance.get_value(`paiement_${r.name}`) || 0;
							});

							const montant_total = dialogInstance.get_value('montant_payement') || 0;
							const montant_restant = montant_total - total_reparti;

							dialogInstance.set_value('montant_restant', montant_restant);

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
			}

			dialogInstance = new frappe.ui.Dialog({
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

					if (hasInvoices) {
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

						const reste_a_repartir = values.montant_payement - total_reparti;
						if (Math.abs(reste_a_repartir) > 0.01) {
							frappe.msgprint({
								title: "Erreur",
								indicator: "red",
								message: "Veuillez répartir la totalité du montant du paiement sur les factures"
							});
							return;
						}

						frm.doc.factures.forEach(function(row) {
							const ajout = values[`paiement_${row.name}`] || 0;
							frappe.model.set_value(
								row.doctype,
								row.name,
								'montant_paiement',
								flt(row.montant_paiement) + flt(ajout)
							);
						});
					}

					frm.add_child("paiements", {
						type_paiement: values.type_paiement,
						date_doc_payement: values.date_doc_payement,
						n_doc: values.n_doc,
						photo: values.photo,
						montant: values.montant_payement,
						date_creation: frappe.datetime.get_today(),
						responsable: frappe.user.full_name() || frappe.session.user
					});

					frm.set_value("type_paiement", values.type_paiement);
					frm.set_value("date_doc_payement", values.date_doc_payement);
					frm.set_value("n_doc", values.n_doc);
					frm.set_value("photo", values.photo);

					let total_paye = 0;
					(frm.doc.paiements || []).forEach(function(row) {
						total_paye += flt(row.montant);
					});
					frm.set_value("montant_payement", total_paye);

					recalculerMontantsDepuisFactures(frm);
					updateStatus(frm);
					frm.refresh_field('factures');
					frm.refresh_field('paiements');
					frm.save();
					dialogInstance.hide();
				}
			});

			dialogInstance.show();
			toggleRepartitionSection();
		});

		$(frm.fields_dict.html_bout_payement.wrapper).find("#btn-promesse").on("click", function() {
			let d = new frappe.ui.Dialog({
				title: __("Saisir la promesse de paiement"),
				fields: [
					{
						label: __("Date promise"),
						fieldname: "date_promise",
						fieldtype: "Date",
						reqd: 1,
						default: frappe.datetime.get_today()
					},
					{
						label: __("Montant promis"),
						fieldname: "montant_promis",
						fieldtype: "Currency",
						reqd: 1,
						default: frm.doc.montant_restant || 0,
						options: "د.ج"
					},
					{
						label: __("Remarques"),
						fieldname: "remarques",
						fieldtype: "Small Text"
					}
				],
				primary_action_label: __("Valider"),
				primary_action(values) {
					if (flt(values.montant_promis) <= 0) {
						frappe.msgprint({
							title: __("Erreur"),
							indicator: "red",
							message: __("Le montant promis doit être supérieur à 0")
						});
						return;
					}
					frm.add_child("promesses", {
						date_creation: frappe.datetime.get_today(),
						responsable: frappe.user.full_name() || frappe.session.user,
						date_promise: values.date_promise,
						montant_promis: values.montant_promis,
						statut: "En cours",
						remarques: values.remarques || ""
					});
					frm.refresh_field("promesses");
					frm.save();
					d.hide();
				}
			});
			d.show();
		});

		if (
			frm.doc.status !== 'Totalement réglé'
			&& frm.doc.status !== 'Obsolète'
			&& !aLitigeOuvert(frm)
		) {
			frm.add_custom_button(__('Litige'), function() {
				ouvrirLitigeDialog(frm);
			}).addClass('btn-danger');
		}

		if (aLitigeOuvert(frm)) {
			frm.add_custom_button(__('Clôturer le litige'), function() {
				frappe.confirm(
					__('Clôturer tous les litiges ouverts ? Le statut du dossier sera recalculé selon le solde.'),
					function() {
						(frm.doc.litiges || []).forEach(function(row) {
							if (row.statut === 'Ouvert') {
								row.statut = 'Clos';
								row.date_cloture = frappe.datetime.get_today();
							}
						});
						frm.refresh_field('litiges');
						updateStatus(frm);
						frm.save();
						frappe.show_alert({
							message: __('Litige(s) clôturé(s)'),
							indicator: 'green'
						});
					}
				);
			});
		}
	},

	id_client: function(frm) {
		if (frm.is_new() && frm.doc.id_client) {
			frm.clear_table("factures");
			frm.refresh_field("factures");
			recalculerMontantsDepuisFactures(frm);
		}
	},

	factures_remove: function(frm) {
		recalculerMontantsDepuisFactures(frm);
		updateStatus(frm);
	},

	factures_add: function(frm) {
		recalculerMontantsDepuisFactures(frm);
		updateStatus(frm);
	},

	paiements_remove: function(frm) {
		let total_paye = 0;
		(frm.doc.paiements || []).forEach(function(row) {
			total_paye += flt(row.montant);
		});
		frm.set_value("montant_payement", total_paye);
		recalculerMontantsDepuisFactures(frm);
		updateStatus(frm);
	},

	promesses_remove: function(frm) {
		updateRecapHtml(frm);
	},

	litiges_remove: function(frm) {
		updateStatus(frm);
	}
});

frappe.ui.form.on("Promesses Paiement Creance", {
	statut: function(frm) {
		updateRecapHtml(frm);
	},
	date_promise: function(frm) {
		updateRecapHtml(frm);
	}
});

frappe.ui.form.on("Litiges Creance", {
	statut: function(frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		if (row.statut === 'Clos' && !row.date_cloture) {
			frappe.model.set_value(cdt, cdn, 'date_cloture', frappe.datetime.get_today());
		} else if (row.statut === 'Ouvert') {
			frappe.model.set_value(cdt, cdn, 'date_cloture', null);
		}
		updateStatus(frm);
	}
});

frappe.ui.form.on("Paiements Creances", {
	montant: function(frm) {
		let total_paye = 0;
		(frm.doc.paiements || []).forEach(function(row) {
			total_paye += flt(row.montant);
		});
		frm.set_value("montant_payement", total_paye);
		recalculerMontantsDepuisFactures(frm);
		updateStatus(frm);
	}
});

frappe.ui.form.on("Factures Creances", {
	facture: function(frm) {
		recalculerMontantsDepuisFactures(frm);
		updateStatus(frm);
	},
	montant_du: function(frm) {
		recalculerMontantsDepuisFactures(frm);
		updateStatus(frm);
	},
	montant_paiement: function(frm) {
		recalculerMontantsDepuisFactures(frm);
		updateStatus(frm);
	}
});

function recalculerMontantsDepuisFactures(frm) {
	let total_du = 0;
	(frm.doc.factures || []).forEach(function(row) {
		total_du += flt(row.montant_du);
	});

	let total_paye = 0;
	(frm.doc.paiements || []).forEach(function(row) {
		total_paye += flt(row.montant);
	});
	frm.doc.montant_payement = total_paye;

	const restant_global = total_du - total_paye;
	frm.set_value("montant_tot_du", total_du);
	frm.set_value("montant_payement", total_paye);
	frm.set_value("montant_restant", restant_global > 0 ? restant_global : 0);
	frm.set_value("total_arrive_echeance", calculerTotalEcheance(frm));
	updateRecapHtml(frm);
}

function calculerTotalEcheance(frm) {
	const today = frappe.datetime.get_today();
	let total = 0;
	(frm.doc.factures || []).forEach(function(row) {
		if (!row.date_echeance) {
			return;
		}
		if (row.date_echeance <= today) {
			const reste = flt(row.montant_du) - flt(row.montant_paiement);
			if (reste > 0) {
				total += reste;
			}
		}
	});
	return total;
}

function aLitigeOuvert(frm) {
	return (frm.doc.litiges || []).some(function(row) {
		return row.statut === 'Ouvert';
	});
}

function ouvrirLitigeDialog(frm) {
	const d = new frappe.ui.Dialog({
		title: __('Ouvrir un litige'),
		fields: [
			{
				label: __('Motif'),
				fieldname: 'motif',
				fieldtype: 'Small Text',
				reqd: 1
			},
			{
				label: __('Remarques'),
				fieldname: 'remarques',
				fieldtype: 'Small Text'
			}
		],
		primary_action_label: __('Valider'),
		primary_action(values) {
			const motif = (values.motif || '').trim();
			if (!motif) {
				frappe.msgprint({
					title: __('Erreur'),
					indicator: 'red',
					message: __('Le motif est obligatoire')
				});
				return;
			}
			frm.add_child('litiges', {
				date_creation: frappe.datetime.get_today(),
				responsable: frappe.user.full_name() || frappe.session.user,
				motif: motif,
				statut: 'Ouvert',
				remarques: values.remarques || ''
			});
			frm.refresh_field('litiges');
			updateStatus(frm);
			frm.save();
			d.hide();
			frappe.show_alert({
				message: __('Litige ouvert'),
				indicator: 'orange'
			});
		}
	});
	d.show();
}

function updateStatus(frm) {
	if (frm.doc.status === 'Obsolète') {
		updateRecapHtml(frm);
		return;
	}

	let nouveau_statut;
	if (aLitigeOuvert(frm)) {
		nouveau_statut = 'Litige';
	} else {
		const total_facture = flt(frm.doc.montant_tot_du);
		const paiement = flt(frm.doc.montant_payement);
		const solde = flt(frm.doc.montant_restant);

		if (total_facture > 0 && solde <= 0) {
			nouveau_statut = 'Totalement réglé';
		} else if (paiement > 0 && solde > 0) {
			nouveau_statut = 'Partiellement réglé';
		} else {
			nouveau_statut = 'Nouveau';
		}
	}

	if (frm.doc.status !== nouveau_statut) {
		frm.set_value('status', nouveau_statut);
	}

	updateRecapHtml(frm);
}

function compterPromessesEnRetard(frm) {
	const today = frappe.datetime.get_today();
	let count = 0;
	(frm.doc.promesses || []).forEach(function(row) {
		if (row.statut === 'En cours' && row.date_promise && row.date_promise < today) {
			count += 1;
		}
	});
	return count;
}

function updateRecapHtml(frm) {
	const field = frm.fields_dict.progression;
	if (!field || !field.$wrapper) {
		return;
	}

	const total_facture = flt(frm.doc.montant_tot_du);
	const total_paye = flt(frm.doc.montant_payement);
	const total_du = flt(frm.doc.montant_restant);
	const echeance = flt(frm.doc.total_arrive_echeance);
	const nb_retard = compterPromessesEnRetard(frm);
	const litige_ouvert = aLitigeOuvert(frm);

	const fmt = (amount) => format_currency(amount, frappe.defaults.get_default('currency') || 'DZD');

	const card = (label, value, accent) => `
		<div style="flex:1;min-width:140px;background:#fff;border:1px solid #e2e8f0;
					border-left:3px solid ${accent};border-radius:6px;padding:12px 14px;">
			<div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.03em;">
				${frappe.utils.escape_html(label)}
			</div>
			<div style="font-size:18px;font-weight:600;color:#0f172a;margin-top:4px;">
				${value}
			</div>
		</div>
	`;

	const alertes = [];
	if (nb_retard > 0) {
		alertes.push(`<div style="margin-top:10px;padding:8px 12px;border-radius:6px;background:#fef2f2;
					border:1px solid #fecaca;color:#b91c1c;font-size:12px;font-weight:600;">
				${frappe.utils.escape_html(__('{0} promesse(s) en retard', [nb_retard]))}
			</div>`);
	}
	if (litige_ouvert) {
		alertes.push(`<div style="margin-top:10px;padding:8px 12px;border-radius:6px;background:#fff7ed;
					border:1px solid #fed7aa;color:#c2410c;font-size:12px;font-weight:600;">
				${frappe.utils.escape_html(__('Litige en cours'))}
			</div>`);
	}

	const html = `
		<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:8px;">
			<div style="font-size:13px;font-weight:600;color:#475569;margin-bottom:2px;">
				${frappe.utils.escape_html(__('Récapitulatif créance'))}
			</div>
			<div style="font-size:11px;font-weight:400;color:#64748b;margin-bottom:10px;">
				${frappe.utils.escape_html([frm.doc.id_client, frm.doc.nom_client].filter(Boolean).join(' — ') || '—')}
			</div>
			<div style="display:flex;flex-wrap:wrap;gap:10px;">
				${card(__('Total facturé'), fmt(total_facture), '#3b82f6')}
				${card(__('Total paiements'), fmt(total_paye), '#10b981')}
				${card(__('Total dû'), fmt(total_du), total_du > 0 ? '#f59e0b' : '#10b981')}
				${card(__('Arrivé à échéance'), fmt(echeance), echeance > 0 ? '#ef4444' : '#94a3b8')}
			</div>
			${alertes.join('')}
		</div>
	`;

	field.$wrapper.html(html);
}

function importFacturesExcel(frm) {
	const d = new frappe.ui.Dialog({
		title: __('Importer des factures'),
		fields: [
			{
				fieldname: 'file_url',
				fieldtype: 'Attach',
				label: __('Fichier Excel (.xlsx)'),
				reqd: 1
			},
			{
				fieldname: 'remplacer',
				fieldtype: 'Check',
				label: __('Remplacer les factures existantes'),
				default: 0,
				description: __('Sinon, seules les nouvelles factures (n° absent) sont ajoutées')
			},
			{
				fieldtype: 'HTML',
				options: `<p class="text-muted small">${__(
					'Colonnes attendues : facture, date, date_echeance, montant_du. Les n° déjà présents sont ignorés.'
				)}</p>`
			}
		],
		primary_action_label: __('Importer'),
		primary_action(values) {
			if (!values.file_url) {
				frappe.msgprint(__('Veuillez sélectionner un fichier'));
				return;
			}
			frm.call({
				doc: frm.doc,
				method: 'importer_factures_excel',
				args: {
					file_url: values.file_url,
					remplacer: values.remplacer ? 1 : 0
				},
				freeze: true,
				freeze_message: __('Import en cours...'),
				callback(r) {
					d.hide();
					frm.reload_doc();
					if (r.message) {
						const imported = r.message.imported || 0;
						const skipped = r.message.skipped || 0;
						let message = __('{0} facture(s) importée(s)', [imported]);
						if (skipped) {
							message += ` — ${__('{0} déjà présente(s) ignorée(s)', [skipped])}`;
						}
						frappe.show_alert({
							message: message,
							indicator: imported > 0 ? 'green' : 'blue'
						});
					}
				}
			});
		}
	});
	d.show();
}

function telechargerModeleExcel() {
	open(
		frappe.urllib.get_full_url(
			'/api/method/aurescrm.aures_crm.doctype.suivi_creance.suivi_creance.telecharger_modele_factures_excel'
		)
	);
}
