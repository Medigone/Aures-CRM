// Copyright (c) 2026, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on('Creance Client', {
	refresh(frm) {
		render_suivi_recouvrement_html(frm);
	},
	statut(frm) {
		render_suivi_recouvrement_html(frm);
	},
	date_prochaine_relance(frm) {
		render_suivi_recouvrement_html(frm);
	},
	dernier_resultat_recouvrement(frm) {
		render_suivi_recouvrement_html(frm);
	},
	derniere_visite_recouvrement(frm) {
		render_suivi_recouvrement_html(frm);
	},
});

function render_suivi_recouvrement_html(frm) {
	const field = frm.get_field('html_suivi_recouvrement');
	if (!field || !field.$wrapper) {
		return;
	}

	const statut = frm.doc.statut || __('Ouverte');
	const relance = frm.doc.date_prochaine_relance
		? frappe.datetime.str_to_user(frm.doc.date_prochaine_relance)
		: '';
	const resultat = frm.doc.dernier_resultat_recouvrement || '';
	const visite = frm.doc.derniere_visite_recouvrement || '';

	const STATUT_STYLE = {
		Ouverte: { accent: '#3b82f6', bg: '#eff6ff', fg: '#1e40af', border: '#93c5fd' },
		'Partiellement recouvrée': { accent: '#f59e0b', bg: '#fffbeb', fg: '#b45309', border: '#fcd34d' },
		Soldée: { accent: '#10b981', bg: '#ecfdf5', fg: '#047857', border: '#6ee7b7' },
		Litige: { accent: '#ef4444', bg: '#fef2f2', fg: '#b91c1c', border: '#fca5a5' },
		Suspendue: { accent: '#64748b', bg: '#f8fafc', fg: '#475569', border: '#cbd5e1' },
	};

	const st = STATUT_STYLE[statut] || STATUT_STYLE.Ouverte;

	const visite_html = visite
		? frappe.utils.get_form_link('Visite Commerciale', visite, true, visite)
		: `<span style="color:#94a3b8;">${frappe.utils.escape_html(__('—'))}</span>`;

	const dash = `<span style="color:#94a3b8;">${frappe.utils.escape_html(__('—'))}</span>`;
	const paiement_loading = `<span style="color:#94a3b8;font-style:italic;">${frappe.utils.escape_html(
		__('Chargement…')
	)}</span>`;

	const creance_name = frm.doc.name;
	const currency_default = frappe.defaults.get_default('currency');

	const empty_hint =
		!resultat && !visite && !relance
			? `<p style="margin:10px 0 0 0;font-size:12px;color:#64748b;">${frappe.utils.escape_html(
					__(
						'Ces informations sont renseignées automatiquement lors de la soumission d’une visite commerciale de type Recouvrement liée à ce client.'
					)
			  )}</p>`
			: '';

	function paint(paiement_montant_html, paiement_type_html) {
		if (!frm.get_field('html_suivi_recouvrement')?.$wrapper) {
			return;
		}
		const html = `
		<div style="display:flex;border:1px solid #e2e8f0;border-radius:8px;
			overflow:hidden;background:#fff;margin:0;
			box-shadow:0 1px 4px rgba(15,23,42,0.06);">
			<div style="width:4px;flex-shrink:0;background:${st.accent};"></div>
			<div style="flex:1;padding:11px 13px 12px;">
				<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
					<span style="font-size:12px;font-weight:700;color:#334155;
						text-transform:uppercase;letter-spacing:0.06em;">
						${frappe.utils.escape_html(__('Suivi recouvrement'))}
					</span>
					<span style="font-size:10px;font-weight:600;color:${st.fg};
						background:${st.bg};border:1px solid ${st.border};
						padding:1px 8px;border-radius:3px;line-height:1.4;">
						${frappe.utils.escape_html(statut)}
					</span>
				</div>
				<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px 20px;font-size:12px;color:#475569;">
					<div>
						<div style="font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;margin-bottom:4px;">
							${frappe.utils.escape_html(__('Date prochaine relance'))}
						</div>
						<div style="font-weight:500;">
							${relance ? frappe.utils.escape_html(relance) : dash}
						</div>
					</div>
					<div>
						<div style="font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;margin-bottom:4px;">
							${frappe.utils.escape_html(__('Dernier résultat'))}
						</div>
						<div style="font-weight:500;">
							${resultat ? frappe.utils.escape_html(resultat) : dash}
						</div>
					</div>
					<div>
						<div style="font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;margin-bottom:4px;">
							${frappe.utils.escape_html(__('Dernier paiement reçu'))}
						</div>
						<div style="font-weight:500;">${paiement_montant_html}</div>
					</div>
					<div>
						<div style="font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;margin-bottom:4px;">
							${frappe.utils.escape_html(__('Type de paiement'))}
						</div>
						<div style="font-weight:500;">${paiement_type_html}</div>
					</div>
					<div style="grid-column:1/-1;">
						<div style="font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;margin-bottom:4px;">
							${frappe.utils.escape_html(__('Dernière visite recouvrement'))}
						</div>
						<div>${visite_html}</div>
					</div>
				</div>
				${empty_hint}
			</div>
		</div>`;
		field.$wrapper.html(html);
	}

	if (frm.is_new() || !creance_name) {
		paint(dash, dash);
		return;
	}

	paint(paiement_loading, paiement_loading);

	frappe.db
		.get_list('Mouvement Creance Client', {
			filters: {
				creance_client: creance_name,
				type_mouvement: 'Paiement recouvré',
			},
			fields: ['montant', 'type_paiement', 'date_mouvement'],
			order_by: 'date_mouvement desc, modified desc',
			limit: 1,
		})
		.then((rows) => {
			if (frm.doc.name !== creance_name) {
				return;
			}
			const p = rows && rows[0];
			if (!p) {
				paint(dash, dash);
				return;
			}
			const montant_fmt = format_currency(p.montant || 0, currency_default);
			const date_txt = p.date_mouvement
				? frappe.datetime.str_to_user(p.date_mouvement)
				: '';
			const montant_block = `${frappe.utils.escape_html(montant_fmt)}${
				date_txt
					? `<div style="font-size:11px;color:#94a3b8;font-weight:400;margin-top:2px;">${frappe.utils.escape_html(
							date_txt
					  )}</div>`
					: ''
			}`;
			const type_txt = (p.type_paiement || '').trim() || __('Non renseigné');
			paint(montant_block, frappe.utils.escape_html(type_txt));
		})
		.catch(() => {
			if (frm.doc.name !== creance_name) {
				return;
			}
			paint(dash, dash);
		});
}
