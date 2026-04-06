// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Pilotage Commercial", {
	refresh(frm) {
		if (frm.is_new()) {
			return;
		}
		if (frappe.model.can_write("Pilotage Commercial")) {
			frm.add_custom_button(__("Recalculer les KPI"), () => {
				frappe.call({
					method: "aurescrm.aures_crm.doctype.pilotage_commercial.pilotage_commercial.refresh_kpis",
					args: { name: frm.doc.name },
					freeze: true,
					callback: () => frm.reload_doc(),
				});
			});
		}
	},
});
