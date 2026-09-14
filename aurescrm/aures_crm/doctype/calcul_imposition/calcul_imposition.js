frappe.ui.form.on("Calcul Imposition", {
	refresh(frm) {
		if (!frm.is_new()) {
			frm.add_custom_button(__("Ouvrir l'atelier"), () => {
				frappe.set_route("atelier-imposition", frm.doc.name);
			});
		}
	},
	trace(frm) {
		if (frm.doc.trace && !frm.doc.fichier_trace) {
			frappe.db.get_value("Trace", frm.doc.trace, "fichier_trace", (r) => {
				if (r && r.fichier_trace) {
					frm.set_value("fichier_trace", r.fichier_trace);
				}
			});
		}
	},
});
