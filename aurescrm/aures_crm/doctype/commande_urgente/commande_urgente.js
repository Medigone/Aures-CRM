// Copyright (c) 2025, Aures and contributors
// For license information, please see license.txt

frappe.ui.form.on("Commande Urgente", {
	refresh(frm) {
		// Rafraîchir les champs fetch si nécessaire
		if (frm.doc.client && !frm.doc.nom_client) {
			frm.trigger("client");
		}
	},

	onload(frm) {
		// Définir le filtre pour le champ commande
		frm.set_query("commande", function() {
			if (frm.doc.client) {
				return {
					filters: {
						"customer": frm.doc.client
					}
				};
			}
		});
	},

	client(frm) {
		// Rafraîchir automatiquement les champs fetch liés au client
		if (frm.doc.client) {
			// Récupérer le nom du client
			frappe.db.get_value("Customer", frm.doc.client, "customer_name", (r) => {
				if (r) {
					frm.set_value("nom_client", r.customer_name);
				}
			});
			
			// Récupérer le commercial via l'API utilitaire (table enfant + fallback legacy)
			frappe.call({
				method: "aurescrm.commercial_assignment.get_customer_commercial_api",
				args: { customer_name: frm.doc.client },
				callback: function(r) {
					if (r.message) {
						frm.set_value("id_commercial", r.message.commercial);
						frm.set_value("commercial", r.message.commercial_name);
					}
				}
			});
			
			// Réinitialiser le champ commande si le client change
			if (frm.doc.commande) {
				frm.set_value("commande", "");
			}
		}
	},

	id_commercial(frm) {
		// Rafraîchir le nom complet du commercial
		if (frm.doc.id_commercial) {
			frappe.db.get_value("User", frm.doc.id_commercial, "full_name", (r) => {
				if (r) {
					frm.set_value("commercial", r.full_name);
				}
			});
		}
	}
});

