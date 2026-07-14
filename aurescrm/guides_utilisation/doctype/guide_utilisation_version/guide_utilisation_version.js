// Copyright (c) 2026, Medigo and contributors
// License: MIT

frappe.ui.form.on("Guide Utilisation Version", {
	refresh(frm) {
		frm.set_df_property("contenu_markdown", "reqd", frm.doc.format_contenu === "Markdown");
		frm.set_df_property("contenu_riche", "reqd", frm.doc.format_contenu === "Texte riche");

		if (frm.doc.guide) {
			frm.add_custom_button(__("Ouvrir le guide"), () => {
				frappe.set_route("Form", "Guide Utilisation", frm.doc.guide);
			});
		}
	},

	format_contenu(frm) {
		frm.set_df_property("contenu_markdown", "reqd", frm.doc.format_contenu === "Markdown");
		frm.set_df_property("contenu_riche", "reqd", frm.doc.format_contenu === "Texte riche");
		frm.refresh_fields(["contenu_markdown", "contenu_riche"]);
	},
});
