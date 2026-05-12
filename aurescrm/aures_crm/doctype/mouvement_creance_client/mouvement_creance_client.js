// Copyright (c) 2026, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on('Mouvement Creance Client', {
	refresh(frm) {
		apply_suivi_creances_toggle_mouvement(frm);
	},
});

function apply_suivi_creances_toggle_mouvement(frm) {
	const active = frappe.boot?.aurescrm_suivi_creances_actif !== false;
	if (!active) {
		frm.dashboard.set_headline(
			`<div>${__(
				'Le suivi des créances est désactivé dans Paramètres Suivi Créances. Création et modification des mouvements sont bloquées côté serveur.'
			)}</div>`,
			'red'
		);
		if (frm.is_new()) {
			frm.disable_save();
		} else {
			frm.enable_save();
		}
	} else {
		frm.dashboard.clear_headline();
		frm.enable_save();
	}
}
