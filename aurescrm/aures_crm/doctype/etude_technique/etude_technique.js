// Copyright (c) 2024, AURES Technologies and contributors
// For license information, please see license.txt

frappe.ui.form.on("Etude Technique", {
	refresh(frm) {
		// Votre code existant ici, s'il y en a
	},

	quantite(frm) {
		calculate_quant_feuilles(frm);
	},

	nbr_poses(frm) {
		calculate_quant_feuilles(frm);
	}
});

function calculate_quant_feuilles(frm) {
	let quantite = frm.doc.quantite || 0;
	let nbr_poses = frm.doc.nbr_poses || 0;

	if (nbr_poses > 0) {
		let quant_feuilles = Math.ceil(quantite / nbr_poses); // Utilise Math.ceil pour arrondir à l'entier supérieur
		frm.set_value("quant_feuilles", quant_feuilles);
	} else {
		frm.set_value("quant_feuilles", 0); // Ou une autre valeur par défaut si nbr_poses est 0 ou non défini
	}
	frm.refresh_field("quant_feuilles");
}
