// Copyright (c) 2026, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Support Technique", {
	grammage(frm) {
		// Valeurs de départ du pont mini : 2,5 mm à 270 g, 3,5 mm à 400 g.
		if (frm.doc.pont_mini) {
			return;
		}
		const valeur = parseFloat(frm.doc.grammage);
		if (!valeur) {
			return;
		}
		frm.set_value("pont_mini", valeur >= 350 ? 3.5 : 2.5);
	},
});
