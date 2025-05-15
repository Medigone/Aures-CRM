// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Suivi Creance", {
	refresh(frm) {
		// Button removed as requested
	},
	
	id_client: function(frm) {
		// Vider la table des factures si le client change
		if (frm.is_new() && frm.doc.id_client) {
			frm.clear_table("factures");
			frm.refresh_field("factures");
		}
	}
});

// Gestion de la table enfant Factures Creances
frappe.ui.form.on("Factures Creances", {
	montant_paiement: function(frm, cdt, cdn) {
		// Recalculer le montant total dû lorsqu'un paiement est saisi
		let total = 0;
		frm.doc.factures.forEach(function(row) {
			total += (row.montant_du - (row.montant_paiement || 0));
		});
		frm.set_value("montant_tot_du", total);
	}
});
