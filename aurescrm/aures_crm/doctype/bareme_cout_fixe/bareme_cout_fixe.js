// Copyright (c) 2026, Aures Emballages and contributors
// For license information, please see license.txt

frappe.ui.form.on("Bareme Cout Fixe", {
	refresh: function (frm) {
		frm.clear_custom_buttons();
		setup_active_button(frm);

		if (!frm.is_new() && !frm.doc.is_active) {
			frm.dashboard.set_headline_alert(
				__("Ce barème est inactif et ne pourra pas être sélectionné dans les Calculs Devis."),
				"orange"
			);
		} else {
			frm.dashboard.clear_headline();
		}
	},

	is_active: function (frm) {
		frm.set_value("status", cint(frm.doc.is_active) ? "Actif" : "Inactif");
	},
});

function setup_active_button(frm) {
	if (frm.is_new()) {
		return;
	}

	const is_active = cint(frm.doc.is_active);
	const action_text = is_active ? __("Désactiver") : __("Activer");
	const new_value = is_active ? 0 : 1;

	frm.add_custom_button(action_text, function () {
		frappe.confirm(
			__("Êtes-vous sûr de vouloir {0} ce barème ?", [action_text.toLowerCase()]),
			function () {
				frm.set_value("is_active", new_value);
				frm.set_value("status", new_value ? "Actif" : "Inactif");
				frm.save().then(() => {
					frappe.show_alert({
						message: is_active
							? __("Le barème a été désactivé.")
							: __("Le barème a été activé."),
						indicator: "green",
					});
				});
			}
		);
	});
}
