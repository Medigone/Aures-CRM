// Copyright (c) 2026, AURES Technologies and contributors
// Panneau HTML « custom_html_etudes_techniques » + bouton « Créer Dossier Fabrication » (source unique dans le code ; évite les anciens Client Scripts en base).

/** Libellés historiques / variantes à retirer avant d’ajouter le bouton canonique */
const DF_LABELS_TO_REMOVE = ['Créer dossier fabrication', 'Créer Dossier Fabrication'];

function strip_dossier_fabrication_buttons(frm) {
	const group = __('Create');
	for (const lbl of DF_LABELS_TO_REMOVE) {
		try {
			frm.remove_custom_button(lbl, group);
			frm.remove_custom_button(__(lbl), group);
		} catch (e) {
			/* ignore */
		}
	}
}

function load_fabrication_panel_html(frm) {
	const fld = frm.get_field('custom_html_etudes_techniques');
	if (!fld || !fld.$wrapper) {
		return;
	}
	frappe.call({
		method: 'aurescrm.sales_order_hooks.get_sales_order_fabrication_dashboard',
		args: { sales_order_name: frm.doc.name },
		callback(r) {
			if (r.exc) {
				return;
			}
			const dossier = (r.message || {}).dossier;
			let html =
				"<div style='display: flex; flex-direction: column; gap: 12px; padding-bottom: 10px; min-width: 280px;'>";
			html +=
				"<div style='border: 0.5px solid #d1d8dd; border-radius: 8px; overflow: hidden;'>";
			html +=
				'<div style="padding: 12px 16px; border-bottom: 0.5px solid #d1d8dd; background-color: #f8f9fa;">';
			html +=
				'<span style="font-size: 14px; font-weight: 600; color: #1a1a1a;">' +
				__('Dossier fabrication') +
				'</span>';
			html += '</div>';
			html += "<div style='padding: 16px; background-color: #ffffff;'>";
			if (dossier) {
				html +=
					"<a href='#' onclick=\"frappe.set_route('Form','Dossier Fabrication','" +
					frappe.utils.escape_html(dossier) +
					"'); return false;\" style='font-size: 13px; font-weight: 500; color: #2e86c1;'>" +
					frappe.utils.escape_html(dossier) +
					'</a>';
			} else {
				html +=
					"<span style='font-size: 12px; color: #888;'>" +
					__('Aucun dossier fabrication pour cette commande.') +
					'</span>';
			}
			html += '</div></div></div>';
			fld.$wrapper.html(html);
		},
	});
}

function add_dossier_fabrication_button_once(frm) {
	frappe.call({
		method: 'aurescrm.sales_order_hooks.check_existing_technical_studies',
		args: { sales_order_name: frm.doc.name },
		callback(r) {
			if (r.exc || r.message !== false) {
				return;
			}
			strip_dossier_fabrication_buttons(frm);
			frm.add_custom_button(
				__('Dossier Fabrication'),
				() => {
					frappe.confirm(
						__('Confirmer la création d\'un dossier fabrication pour cette commande ?'),
						() => {
							frappe.call({
								method: 'aurescrm.sales_order_hooks.generate_technical_studies',
								args: { sales_order_name: frm.doc.name },
								callback(res) {
									if (!res.exc) {
										frm.reload_doc();
									}
								},
							});
						}
					);
				},
				__('Create')
			);
		},
	});
}

frappe.ui.form.on('Sales Order', {
	refresh(frm) {
		// Après les Client Scripts éventuels en base (anciennes listes d’études), on impose le HTML depuis le code.
		setTimeout(() => load_fabrication_panel_html(frm), 500);
		if (!frm.is_new() && frm.doc.docstatus === 1) {
			setTimeout(() => add_dossier_fabrication_button_once(frm), 450);
		}
	},
});
