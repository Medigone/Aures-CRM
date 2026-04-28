// Copyright (c) 2026, AURES Technologies and contributors

function parse_qty(v) {
	const x = parseFloat(v);
	return Number.isFinite(x) ? x : 0;
}

/**
 * Les champs fieldtype "HTML" dans Frappe affichent par défaut uniquement `df.options`
 * (template DocField), pas la valeur `doc.html_apercu`. On injecte donc le HTML serveur.
 * Utiliser `ControlHTML.html()` évite de casser la structure interne du contrôle.
 */
function render_html_apercu(frm) {
	try {
		const fld = frm.fields_dict.html_apercu;
		if (!fld || !fld.$wrapper || !fld.$wrapper.length) {
			return;
		}

		const set_html = (inner) => {
			if (typeof fld.html === 'function') {
				fld.html(inner);
			} else {
				fld.$wrapper.html(inner);
			}
		};

		if (frm.is_new()) {
			set_html(`<p class="text-muted">${__('Enregistrez le document pour afficher la synthèse.')}</p>`);
			return;
		}

		set_html(`<p class="text-muted">${__('Chargement de la synthèse...')}</p>`);
		frappe.call({
			method:
				'aurescrm.aures_crm.doctype.dossier_fabrication.dossier_fabrication.get_dossier_apercu_html',
			args: { dossier_name: frm.doc.name },
			callback(r) {
				if (!r.exc && r.message) {
					set_html(r.message);
				} else {
					set_html(`<p class="text-muted">${__('Aucune synthèse disponible.')}</p>`);
				}
			},
		});
	} catch (e) {
		console.error('Dossier Fabrication html_apercu', e);
	}
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

frappe.ui.form.on('Dossier Fabrication', {
	refresh(frm) {
		try {
			setTimeout(() => render_html_apercu(frm), 0);

			if (frm.is_new()) {
				return;
			}

			if (has_remaining_qty_to_program(frm)) {
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
								label: __('Date livraison'),
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
									quantite_a_produire: values.quantite_a_produire,
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

			const prog = frm.doc.programme_livraison || [];
			const eligible_etude = prog
				.map((row, i) => ({ row, programme_idx: i + 1 }))
				.filter(({ row }) => row.article && !row.etude_technique);

			if (prog.length) {
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

			if (eligible_etude.length) {
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
								const date_part = row.date_livraison
									? frappe.datetime.str_to_user(row.date_livraison)
									: __('Sans date');
								const q = parse_qty(row.quantite_a_produire);
								let lbl = `${date_part} — ${__('Qté')} ${q}`;
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
							const dateStr = r.date_livraison
								? frappe.datetime.str_to_user(r.date_livraison)
								: __('Sans date');
							const qtyStr = String(parse_qty(r.quantite_a_produire));
							wrap.$wrapper.html(
								`<div class="small"><p class="mb-2"><strong>${__('Article')}</strong> : ${escape_html(r.article)}</p>` +
									`<p class="mb-1"><strong>${__('Quantité à produire')}</strong> : ${escape_html(qtyStr)}</p>` +
									`<p class="mb-0"><strong>${__('Date de livraison')}</strong> : ${escape_html(dateStr)}</p></div>`
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
		} catch (e) {
			console.error('Dossier Fabrication refresh', e);
		}
	},
});
