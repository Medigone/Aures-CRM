// Copyright (c) 2026, Medigo and contributors
// License: MIT

frappe.ui.form.on("Guide Utilisation", {
	refresh(frm) {
		if (!frm.is_new()) {
			frm.add_custom_button(__("Ouvrir la bibliothèque"), () => {
				frappe.route_options = { guide: frm.doc.slug };
				frappe.set_route("guides-utilisation");
			});

			if (frappe.user.has_role(["Guide Redacteur", "Guide Validateur", "Guide Gestionnaire", "System Manager"])) {
				frm.add_custom_button(__("Créer une nouvelle version"), () => {
					frappe.prompt(
						[
							{
								fieldname: "resume_modifications",
								fieldtype: "Small Text",
								label: __("Résumé des modifications"),
							},
						],
						(values) => {
							frm.call("create_new_version", {
								resume_modifications: values.resume_modifications,
							}).then((r) => {
								if (r.message) {
									frappe.set_route("Form", "Guide Utilisation Version", r.message);
								}
							});
						},
						__("Nouvelle version"),
						__("Créer")
					);
				});
			}
		}

		if (frm.doc.version_publiee) {
			frm.add_custom_button(__("Version publiée"), () => {
				frappe.set_route("Form", "Guide Utilisation Version", frm.doc.version_publiee);
			});
		}
	},
});
