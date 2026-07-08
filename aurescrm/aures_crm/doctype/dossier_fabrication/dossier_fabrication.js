// Copyright (c) 2026, AURES Technologies and contributors

function parse_qty(v) {
	const x = parseFloat(v);
	return Number.isFinite(x) ? x : 0;
}

/**
 * Champ HTML Desk : affichage via df.options (pas doc.html_apercu).
 * Pattern Frappe : méthode whitelisted + set_df_property + refresh_field.
 */
function render_html_apercu(frm) {
	if (frm.is_new()) {
		frm.set_df_property(
			'html_apercu',
			'options',
			`<p class="text-muted">${__('Enregistrez le document pour afficher la synthèse.')}</p>`
		);
		frm.refresh_field('html_apercu');
		return;
	}

	frappe.require('/assets/aurescrm/css/dossier_fabrication.css').then(() => {
		frm.set_df_property(
			'html_apercu',
			'options',
			`<p class="text-muted">${__('Chargement de la synthèse...')}</p>`
		);
		frm.refresh_field('html_apercu');

		frappe.call({
			method: 'get_dossier_apercu_html',
			doc: frm.doc,
			callback(r) {
				if (!r.exc && r.message) {
					frm.set_df_property('html_apercu', 'options', r.message);
					frm.refresh_field('html_apercu');
					bind_apercu_programme_fab_date(frm);
					bind_apercu_programme_machine(frm);
				} else {
					frm.set_df_property(
						'html_apercu',
						'options',
						`<p class="text-muted">${__('Aucune synthèse disponible.')}</p>`
					);
					frm.refresh_field('html_apercu');
				}
			},
		});
	});
}

function qty_commandee_article(frm, article) {
	let s = 0;
	for (const row of frm.doc.lignes || []) {
		if (row.article === article) {
			s += parse_qty(row.quantite_commandee);
		}
	}
	return s;
}

function qty_deja_programmee(frm, article) {
	let s = 0;
	for (const row of frm.doc.programme_livraison || []) {
		if (row.article === article) {
			s += parse_qty(row.quantite_a_produire);
		}
	}
	return s;
}

function articles_from_lignes(frm) {
	const seen = new Set();
	const out = [];
	for (const row of frm.doc.lignes || []) {
		if (row.article && !seen.has(row.article)) {
			seen.add(row.article);
			out.push(row.article);
		}
	}
	return out;
}

function has_remaining_qty_to_program(frm) {
	for (const article of articles_from_lignes(frm)) {
		const remaining = qty_commandee_article(frm, article) - qty_deja_programmee(frm, article);
		if (remaining > 1e-6) {
			return true;
		}
	}
	return false;
}

function first_ligne_for_article(frm, article) {
	for (const row of frm.doc.lignes || []) {
		if (row.article === article) {
			return row;
		}
	}
	return null;
}

function is_planification_locked(frm) {
	return !!frm.doc.planification_validee;
}

function machine_link_query() {
	return {
		filters: {
			type_equipement: 'Presse Offset',
			procede: 'Offset',
		},
	};
}

function set_programme_livraison_readonly(frm) {
	const locked = is_planification_locked(frm);
	frm.set_df_property('programme_livraison', 'read_only', locked ? 1 : 0);
}

function bind_apercu_programme_fab_date(frm) {
	const fld = frm.fields_dict.html_apercu;
	if (!fld || !fld.$wrapper || !fld.$wrapper.length) {
		return;
	}
	fld.$wrapper.off('click.dfProgFab');
	fld.$wrapper.on('click.dfProgFab', '.df-edit-date-fab', function (e) {
		e.preventDefault();
		e.stopPropagation();
		const programme_row = $(this).attr('data-programme-row');
		const defIso = $(this).attr('data-date-iso') || '';
		if (!programme_row || frm.is_new()) {
			return;
		}
		const d = new frappe.ui.Dialog({
			title: __('Date fabrication prévue'),
			fields: [
				{
					fieldname: 'date_fabrication_prevue',
					fieldtype: 'Date',
					label: __('Date fabrication prévue'),
					reqd: 1,
					default: defIso || frappe.datetime.get_today(),
				},
			],
			primary_action_label: __('Enregistrer'),
			primary_action(values) {
				if (!values.date_fabrication_prevue) {
					return;
				}
				frappe.call({
					method:
						'aurescrm.aures_crm.doctype.dossier_fabrication.dossier_fabrication.update_programme_date_fabrication_prevue',
					args: {
						dossier_name: frm.doc.name,
						programme_row_name: programme_row,
						date_fabrication_prevue: values.date_fabrication_prevue,
					},
					callback(r) {
						if (!r.exc) {
							d.hide();
							frappe.show_alert({
								message: __('Date de fabrication mise à jour.'),
								indicator: 'green',
							});
							frm.reload_doc();
						}
					},
				});
			},
		});
		d.show();
	});
}

function bind_apercu_programme_machine(frm) {
	const fld = frm.fields_dict.html_apercu;
	if (!fld || !fld.$wrapper || !fld.$wrapper.length) {
		return;
	}
	fld.$wrapper.off('click.dfProgMachine');
	fld.$wrapper.on('click.dfProgMachine', '.df-edit-machine', function (e) {
		e.preventDefault();
		e.stopPropagation();
		const programme_row = $(this).attr('data-programme-row');
		const defMachine = $(this).attr('data-machine') || '';
		if (!programme_row || frm.is_new()) {
			return;
		}
		const d = new frappe.ui.Dialog({
			title: __('Machine'),
			fields: [
				{
					fieldname: 'machine',
					fieldtype: 'Link',
					options: 'Machine',
					label: __('Machine (presse offset)'),
					get_query: () => machine_link_query(),
					default: defMachine || null,
				},
			],
			primary_action_label: __('Enregistrer'),
			primary_action(values) {
				frappe.call({
					method:
						'aurescrm.aures_crm.doctype.dossier_fabrication.dossier_fabrication.update_programme_machine',
					args: {
						dossier_name: frm.doc.name,
						programme_row_name: programme_row,
						machine: values.machine || '',
					},
					callback(r) {
						if (!r.exc) {
							d.hide();
							frappe.show_alert({
								message: __('Machine mise à jour.'),
								indicator: 'green',
							});
							frm.reload_doc();
						}
					},
				});
			},
		});
		d.show();
	});
}

frappe.ui.form.on('Dossier Fabrication', {
	refresh(frm) {
		try {
			setTimeout(() => render_html_apercu(frm), 0);
			set_programme_livraison_readonly(frm);

			if (frm.is_new()) {
				return;
			}

			const locked = is_planification_locked(frm);
			const prog = frm.doc.programme_livraison || [];
			const eligible_etude = prog
				.map((row, i) => ({ row, programme_idx: i + 1 }))
				.filter(({ row }) => row.article && !row.etude_technique);

			if (!locked && has_remaining_qty_to_program(frm)) {
				frm.add_custom_button(__('Programme livraison'), () => {
				try {
					const articles = articles_from_lignes(frm);
					if (!articles.length) {
						frappe.msgprint(__('Aucun article dans le récap commande.'));
						return;
					}

					const d = new frappe.ui.Dialog({
						title: __('Programme livraison'),
						fields: [
							{
								fieldname: 'article',
								fieldtype: 'Link',
								options: 'Item',
								label: __('Article'),
								reqd: 1,
								get_query: () => ({
									filters: { name: ['in', articles] },
								}),
							},
							{
								fieldname: 'info_restant',
								fieldtype: 'HTML',
								options: `<p class="text-muted small">${__('Sélectionnez un article pour voir le restant.')}</p>`,
							},
							{
								fieldname: 'date_livraison',
								fieldtype: 'Date',
								label: __('Date livraison référence'),
								reqd: 1,
								default: frappe.datetime.get_today(),
							},
							{
								fieldname: 'date_fabrication_prevue',
								fieldtype: 'Date',
								label: __('Date fabrication prévue'),
								reqd: 1,
								default: frappe.datetime.get_today(),
							},
							{
								fieldname: 'quantite_a_produire',
								fieldtype: 'Float',
								label: __('Quantité à produire'),
								reqd: 1,
							},
							{
								fieldname: 'machine',
								fieldtype: 'Link',
								options: 'Machine',
								label: __('Machine'),
								get_query: () => machine_link_query(),
							},
							{
								fieldname: 'allow_overflow',
								fieldtype: 'Check',
								label: __('Autoriser le dépassement de la quantité commandée'),
								default: 0,
							},
						],
						primary_action_label: __('Ajouter'),
						primary_action(values) {
							frappe.call({
								method:
									'aurescrm.aures_crm.doctype.dossier_fabrication.dossier_fabrication.add_programme_livraison',
								args: {
									dossier_name: frm.doc.name,
									article: values.article,
									date_livraison: values.date_livraison,
									date_fabrication_prevue: values.date_fabrication_prevue,
									quantite_a_produire: values.quantite_a_produire,
									machine: values.machine || '',
									allow_overflow: values.allow_overflow ? 1 : 0,
								},
								callback(r) {
									if (!r.exc) {
										d.hide();
										frm.reload_doc();
									}
								},
							});
						},
					});

					const update_restant = () => {
						const art = d.get_value('article');
						const wrap = d.fields_dict.info_restant;
						if (!wrap) {
							return;
						}
						if (!art) {
							wrap.$wrapper.html(
								`<p class="text-muted small">${__('Sélectionnez un article pour voir le restant.')}</p>`
							);
							return;
						}
						const cmd = qty_commandee_article(frm, art);
						const prog = qty_deja_programmee(frm, art);
						const rest = cmd - prog;
						d.set_value('quantite_a_produire', Math.max(rest, 0));
						const ligne = first_ligne_for_article(frm, art);
						if (ligne && ligne.date_livraison_commande) {
							d.set_value('date_livraison', ligne.date_livraison_commande);
						}
						if (ligne && ligne.machine) {
							d.set_value('machine', ligne.machine);
						}
						d.set_value('date_fabrication_prevue', frappe.datetime.get_today());
						const badge_style =
							'display:inline-block;padding:3px 9px;border-radius:12px;font-size:11px;font-weight:600;line-height:1.25;';
						const rest_color = rest > 0 ? '#28a745' : '#e63946';
						const rest_bg = rest > 0 ? 'rgba(40, 167, 69, 0.1)' : 'rgba(230, 57, 70, 0.1)';
						wrap.$wrapper.html(
							`<div style="display:flex; gap:7px; flex-wrap:wrap; margin:10px 0 12px 0; padding-left:0;">` +
								`<span style="${badge_style}background:rgba(17, 138, 178, 0.1);color:#118ab2;">${__('Commandé')} : ${cmd}</span>` +
								`<span style="${badge_style}background:rgba(255, 193, 7, 0.15);color:#856404;">${__('Déjà programmé')} : ${prog}</span>` +
								`<span style="${badge_style}background:${rest_bg};color:${rest_color};">${__('Restant')} : ${rest}</span>` +
							`</div>`
						);
					};

					d.show();
					const af = d.fields_dict.article;
					if (af && af.$input) {
						af.$input.on('change', () => update_restant());
						af.$input.on('awesomplete-selectcomplete', () => update_restant());
					}
					update_restant();
				} catch (e) {
					console.error('Programme livraison dialog', e);
					frappe.msgprint({
						title: __('Erreur'),
						message: e.message || String(e),
						indicator: 'red',
					});
				}
				});
			}

			if (!locked && prog.length) {
				frm.add_custom_button(
					__('Réinitialiser le programme livraison'),
					() => {
						frappe.confirm(
							__(
								'Supprimer toutes les lignes du programme livraison ? Les liens vers ce dossier seront retirés des études techniques concernées ; les documents d\'étude restent consultables.'
							),
							() => {
								frappe.call({
									method:
										'aurescrm.aures_crm.doctype.dossier_fabrication.dossier_fabrication.clear_programme_livraison',
									args: { dossier_name: frm.doc.name },
									callback(res) {
										if (!res.exc) {
											frappe.show_alert({
												message: __('Programme livraison réinitialisé.'),
												indicator: 'green',
											});
											frm.reload_doc();
										}
									},
								});
							}
						);
					},
					__('Actions')
				);
			}

			if (!locked && eligible_etude.length) {
				frm.add_custom_button(__('Créer étude technique'), () => {
					try {
						const articles_disponibles = [
							...new Set(eligible_etude.map((e) => e.row.article).filter(Boolean)),
						];

						/** label liste déroulante « livraison » → programme_idx (1-based) */
						let ligne_choice_map = new Map();

						const escape_html =
							typeof frappe.utils !== 'undefined' && frappe.utils.escape_html
								? frappe.utils.escape_html
								: (s) =>
										String(s ?? '')
											.replace(/&/g, '&amp;')
											.replace(/</g, '&lt;')
											.replace(/"/g, '&quot;');

						const d = new frappe.ui.Dialog({
							title: __('Créer étude technique'),
							fields: [
								{
									fieldname: 'article',
									fieldtype: 'Link',
									options: 'Item',
									label: __('Article'),
									reqd: 1,
									get_query: () => ({
										filters: { name: ['in', articles_disponibles] },
									}),
									description: __(
										'Article présent dans le programme livraison, sans étude technique encore créée pour cette ligne.'
									),
								},
								{
									fieldname: 'choix_ligne',
									fieldtype: 'Select',
									label: __('Livraison au programme'),
									description: __(
										'À renseigner uniquement si plusieurs livraisons sont programmées pour le même article.'
									),
									options: '\n',
								},
								{
									fieldname: 'detail_etude',
									fieldtype: 'HTML',
									options: `<p class="text-muted small">${__('Sélectionnez un article.')}</p>`,
								},
							],
							primary_action_label: __('Créer'),
							primary_action(values) {
								const art = values.article;
								if (!art) {
									frappe.msgprint(__('Choisissez un article.'));
									return;
								}
								const rows = eligible_etude.filter((e) => e.row.article === art);
								let programme_idx = null;
								if (rows.length === 1) {
									programme_idx = rows[0].programme_idx;
								} else if (rows.length > 1) {
									const lbl = values.choix_ligne;
									programme_idx = ligne_choice_map.get(lbl);
									if (!programme_idx) {
										frappe.msgprint(__('Précisez quelle livraison du programme doit recevoir l’étude.'));
										return;
									}
								}
								if (!programme_idx) {
									frappe.msgprint(__('Aucune ligne programme utilisable pour cet article.'));
									return;
								}
								frappe.call({
									method:
										'aurescrm.aures_crm.doctype.dossier_fabrication.dossier_fabrication.create_etude_technique_from_programme_line',
									args: {
										dossier_name: frm.doc.name,
										programme_idx,
									},
									callback(r) {
										if (!r.exc && r.message && r.message.name) {
											d.hide();
											frappe.set_route('Form', 'Etude Technique', r.message.name);
										}
										frm.reload_doc();
									},
								});
							},
						});

						const refresh_choix_ligne = (article) => {
							const fld = d.fields_dict.choix_ligne;
							if (!fld || !fld.df) {
								return;
							}
							ligne_choice_map = new Map();
							const rows = eligible_etude.filter((e) => e.row.article === article);
							if (rows.length <= 1) {
								fld.df.reqd = 0;
								fld.df.options = '\n';
								fld.last_options = undefined;
								fld.refresh();
								fld.$wrapper.hide();
								return;
							}
							fld.df.reqd = 1;
							const labels_seen = new Set();
							const opts = [];
							for (const { row, programme_idx } of rows) {
								const fab_part = row.date_fabrication_prevue
									? frappe.datetime.str_to_user(row.date_fabrication_prevue)
									: row.date_livraison
										? frappe.datetime.str_to_user(row.date_livraison)
										: __('Sans date');
								const liv_part = row.date_livraison
									? frappe.datetime.str_to_user(row.date_livraison)
									: '';
								const q = parse_qty(row.quantite_a_produire);
								let lbl = liv_part
									? `${fab_part} — ${__('Livr. ref.')} ${liv_part} — ${__('Qté')} ${q}`
									: `${fab_part} — ${__('Qté')} ${q}`;
								const base = lbl;
								let n = 1;
								while (labels_seen.has(lbl)) {
									n += 1;
									lbl = `${base} (${n})`;
								}
								labels_seen.add(lbl);
								ligne_choice_map.set(lbl, programme_idx);
								opts.push(lbl);
							}
							fld.df.options = opts.join('\n');
							fld.last_options = undefined;
							fld.refresh();
							fld.$wrapper.show();
							if (opts.length) {
								d.set_value('choix_ligne', opts[0]);
							}
						};

						const update_detail = () => {
							const wrap = d.fields_dict.detail_etude;
							if (!wrap || !wrap.$wrapper) {
								return;
							}
							const art = d.get_value('article');
							if (!art) {
								wrap.$wrapper.html(
									`<p class="text-muted small">${__('Sélectionnez un article.')}</p>`
								);
								d.fields_dict.choix_ligne.$wrapper.hide();
								return;
							}
							refresh_choix_ligne(art);
							const rows = eligible_etude.filter((e) => e.row.article === art);
							if (!rows.length) {
								wrap.$wrapper.html(
									`<p class="text-muted small">${__('Aucune ligne programme éligible pour cet article.')}</p>`
								);
								return;
							}
							let target = rows[0];
							if (rows.length > 1) {
								const lbl = d.get_value('choix_ligne');
								const idx = ligne_choice_map.get(lbl);
								const found = eligible_etude.find((e) => e.programme_idx === idx);
								if (found && found.row.article === art) {
									target = found;
								}
							}
							const r = target.row;
							const fabStr = r.date_fabrication_prevue
								? frappe.datetime.str_to_user(r.date_fabrication_prevue)
								: __('Sans date');
							const livStr = r.date_livraison
								? frappe.datetime.str_to_user(r.date_livraison)
								: __('Sans date');
							const qtyStr = String(parse_qty(r.quantite_a_produire));
							wrap.$wrapper.html(
								`<div class="small"><p class="mb-2"><strong>${__('Article')}</strong> : ${escape_html(r.article)}</p>` +
									`<p class="mb-1"><strong>${__('Quantité à produire')}</strong> : ${escape_html(qtyStr)}</p>` +
									`<p class="mb-1"><strong>${__('Date fabrication prévue')}</strong> : ${escape_html(fabStr)}</p>` +
									`<p class="mb-0"><strong>${__('Date livraison référence')}</strong> : ${escape_html(livStr)}</p></div>`
							);
						};

						d.show();
						const af = d.fields_dict.article;
						if (af && af.$input) {
							af.$input.on('change', update_detail);
							af.$input.on('awesomplete-selectcomplete', update_detail);
						}
						const lf = d.fields_dict.choix_ligne;
						if (lf && lf.$input) {
							lf.$input.on('change', update_detail);
						}
						d.fields_dict.choix_ligne.$wrapper.hide();
						update_detail();
					} catch (e) {
						console.error('Créer étude technique dialog', e);
						frappe.msgprint({
							title: __('Erreur'),
							message: e.message || String(e),
							indicator: 'red',
						});
					}
				});
			}

			if (!locked && prog.length && eligible_etude.length) {
				frm.add_custom_button(
					__('Valider la planification'),
					() => {
						frappe.confirm(
							__(
								'Valider la planification et générer toutes les études techniques ? Le programme sera verrouillé.'
							),
							() => {
								frappe.call({
									method:
										'aurescrm.aures_crm.doctype.dossier_fabrication.dossier_fabrication.valider_planification',
									args: { dossier_name: frm.doc.name },
									freeze: true,
									callback(res) {
										if (!res.exc) {
											frm.reload_doc();
										}
									},
								});
							}
						);
					},
					__('Actions')
				);
			}

			if (locked && frm.doc.status !== 'Clôturé') {
				frm.add_custom_button(
					__('Clôturer'),
					() => {
						frappe.confirm(__('Clôturer ce dossier de fabrication ?'), () => {
							frappe.call({
								method:
									'aurescrm.aures_crm.doctype.dossier_fabrication.dossier_fabrication.cloturer_dossier',
								args: { dossier_name: frm.doc.name },
								freeze: true,
								callback(res) {
									if (!res.exc) {
										frm.reload_doc();
									}
								},
							});
						});
					},
					__('Actions')
				);
			}
		} catch (e) {
			console.error('Dossier Fabrication refresh', e);
		}
	},
});
