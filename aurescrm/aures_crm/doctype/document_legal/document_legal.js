// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Document Legal", {
	refresh: function(frm) {
		// Ajouter des indicateurs visuels pour le statut
		frm.trigger('update_status_indicator');
		
		// Ajouter un bouton pour marquer comme validé si le document est en cours
		if (frm.doc.statut === "En cours") {
			frm.add_custom_button(__('Marquer comme Validé'), function() {
				frm.set_value('statut', 'Validé');
				frm.save();
			});
		}
		
		// Ajouter un bouton pour annuler le document
		if (["Brouillon", "En cours", "Validé"].includes(frm.doc.statut)) {
			frm.add_custom_button(__('Annuler'), function() {
				frm.set_value('statut', 'Annulé');
				frm.save();
			});
		}
	},
	
	type_document: function(frm) {
		// Récupérer les informations du type de document
		if (frm.doc.type_document) {
			frappe.call({
				method: "frappe.client.get",
				args: {
					doctype: "Type Document Legal",
					name: frm.doc.type_document
				},
				callback: function(response) {
					if (response.message) {
						const type_doc = response.message;
						
						// Calculer la date d'expiration si nécessaire
						if (type_doc.duree_validite > 0 && frm.doc.date_emission && !frm.doc.date_expiration) {
							let date_expiration = frappe.datetime.add_days(frm.doc.date_emission, 0);
							
							if (type_doc.unite_duree === "Jours") {
								date_expiration = frappe.datetime.add_days(frm.doc.date_emission, type_doc.duree_validite);
							} else if (type_doc.unite_duree === "Mois") {
								date_expiration = frappe.datetime.add_months(frm.doc.date_emission, type_doc.duree_validite);
							} else if (type_doc.unite_duree === "Années") {
								date_expiration = frappe.datetime.add_months(frm.doc.date_emission, type_doc.duree_validite * 12);
							}
							
							frm.set_value('date_expiration', date_expiration);
						}
					}
				}
			});
		}
	},
	
	date_emission: function(frm) {
		// Recalculer la date d'expiration si la date d'émission change
		frm.trigger('type_document');
	},
	
	date_expiration: function(frm) {
		// Mettre à jour le statut si la date d'expiration change
		frm.trigger('update_status');
	},
	
	statut: function(frm) {
		// Mettre à jour l'indicateur de statut
		frm.trigger('update_status_indicator');
	},
	
	update_status: function(frm) {
		// Ne pas modifier le statut si le document est annulé
		if (frm.doc.statut === "Annulé") {
			return;
		}
		
		// Vérifier si le document est expiré
		if (frm.doc.date_expiration) {
			const today = frappe.datetime.get_today();
			if (frm.doc.date_expiration < today) {
				frm.set_value('statut', 'Expiré');
			}
		}
	},
	
	update_status_indicator: function(frm) {
		// Définir l'indicateur de statut
		let color = "blue";
		
		switch(frm.doc.statut) {
			case "Brouillon":
				color = "lightblue";
				break;
			case "En cours":
				color = "orange";
				break;
			case "Validé":
				color = "green";
				break;
			case "Expiré":
				color = "red";
				break;
			case "Annulé":
				color = "gray";
				break;
		}
		
		frm.page.set_indicator(frm.doc.statut, color);
	}
});