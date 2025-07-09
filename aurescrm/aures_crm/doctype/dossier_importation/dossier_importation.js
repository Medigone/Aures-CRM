// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Dossier Importation", {
	refresh(frm) {
		// Initialisation standard du formulaire
	}
});

// Gestion des événements sur la table enfant Documents Achat Importation
frappe.ui.form.on("Documents Achat Importation", {
	/**
	 * Met à jour le statut lorsqu'un document est sélectionné
	 * @param {Object} frm - L'objet formulaire parent
	 * @param {Object} cdt - Type de document enfant
	 * @param {Object} cdn - Nom du document enfant
	 */
	document: function(frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		
		// Vérifier que les champs nécessaires sont remplis
		if (row.lien_doctype && row.document) {
			// Appel au serveur pour récupérer le statut du document
			frappe.call({
				method: "frappe.client.get",
				args: {
					doctype: row.lien_doctype,
					name: row.document
				},
				callback: function(response) {
					if (response.message) {
						const doc = response.message;
						let status = getDocumentStatus(doc, row.lien_doctype);
						
						// Mettre à jour le statut dans la ligne
						frappe.model.set_value(cdt, cdn, "statut", status);
						frm.refresh_field("achats");
					}
				},
				error: function(err) {
					console.error("Erreur lors de la récupération du statut:", err);
					frappe.model.set_value(cdt, cdn, "statut", "Erreur");
					frm.refresh_field("achats");
				}
			});
		} else {
			// Réinitialiser le statut si le document est effacé
			frappe.model.set_value(cdt, cdn, "statut", "");
			frm.refresh_field("achats");
		}
	},
	
	/**
	 * Met à jour le statut lorsque le type de document change
	 */
	lien_doctype: function(frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		
		// Réinitialiser le document et le statut si le type de document change
		frappe.model.set_value(cdt, cdn, "document", "");
		frappe.model.set_value(cdt, cdn, "statut", "");
		frm.refresh_field("achats");
	}
});

/**
 * Fonction utilitaire pour déterminer le statut d'un document
 * @param {Object} doc - Le document récupéré
 * @param {String} doctype - Le type de document
 * @returns {String} - Le statut formaté
 */
function getDocumentStatus(doc, doctype) {
	// 1. Traitement spécifique selon le type de document
	if (doctype === "Sales Order") {
		if (doc.status === "Closed") return "Fermé";
		if (doc.status === "On Hold") return "En attente";
		if (doc.status === "Completed") return "Terminé";
		if (doc.per_delivered === 100) return "Livré";
		if (doc.per_delivered > 0) return `Livré partiellement (${doc.per_delivered}%)`;
		if (doc.per_billed === 100) return "Facturé";
		if (doc.per_billed > 0) return `Facturé partiellement (${doc.per_billed}%)`;
	}
	
	else if (doctype === "Purchase Order") {
		if (doc.status === "Closed") return "Fermé";
		if (doc.status === "On Hold") return "En attente";
		if (doc.status === "Completed") return "Terminé";
		if (doc.per_received === 100) return "Reçu";
		if (doc.per_received > 0) return `Reçu partiellement (${doc.per_received}%)`;
		if (doc.per_billed === 100) return "Facturé";
		if (doc.per_billed > 0) return `Facturé partiellement (${doc.per_billed}%)`;
	}
	
	else if (doctype === "Quotation") {
		if (doc.status === "Lost") return "Perdu";
		if (doc.status === "Ordered") return "Commandé";
		if (doc.status === "Expired") return "Expiré";
	}
	
	else if (doctype === "Payment Entry") {
		if (doc.docstatus === 1) {
			if (doc.payment_type === "Receive") return "Paiement reçu";
			if (doc.payment_type === "Pay") return "Paiement effectué";
			if (doc.payment_type === "Internal Transfer") return "Transfert interne";
		}
	}
	
	else if (doctype === "Delivery Note" || doctype === "Purchase Receipt") {
		if (doc.status === "Return Issued") return "Retour émis";
		if (doc.status === "Completed") return "Terminé";
		if (doc.status === "Closed") return "Fermé";
	}
	
	// Dictionnaire de traduction pour les statuts en anglais
	const statusTranslations = {
		// Statuts génériques
		"Draft": "Brouillon",
		"Submitted": "Soumis",
		"Cancelled": "Annulé",
		"Completed": "Terminé",
		"Closed": "Fermé",
		"On Hold": "En attente",
		"Pending": "En attente",
		"Open": "Ouvert",
		"Expired": "Expiré",
		"Approved": "Approuvé",
		"Rejected": "Rejeté",
		"Partially Paid": "Partiellement payé",
		"Unpaid": "Non payé",
		"Paid": "Payé",
		"Return": "Retour",
		"Debit Note Issued": "Note de débit émise",
		"Credit Note Issued": "Note de crédit émise",
		"Return Issued": "Retour émis",
		"Partly Delivered": "Partiellement livré",
		"Delivered": "Livré",
		"Not Delivered": "Non livré",
		"Partly Received": "Partiellement reçu",
		"Received": "Reçu",
		"Not Received": "Non reçu",
		"Ordered": "Commandé",
		"To Bill": "À facturer",
		"Billed": "Facturé",
		"Not Billed": "Non facturé",
		"Lost": "Perdu",
		"To Deliver": "À livrer",
		"To Receive": "À recevoir",
		"In Transit": "En transit",
		"Partly Billed": "Partiellement facturé",
		"Unpaid and Discounted": "Non payé et remisé",
		"Overdue and Discounted": "En retard et remisé",
		"Overdue": "En retard",
		"Internal Transfer": "Transfert interne",
		"Partially Delivered": "Partiellement livré",
		"Partially Received": "Partiellement reçu",
		"Partially Billed": "Partiellement facturé",
		"Partially Paid": "Partiellement payé"
	};
	
	// 2. Workflow state (statut de workflow)
	if (doc.workflow_state) {
		// Traduire si une traduction existe, sinon garder la valeur originale
		return statusTranslations[doc.workflow_state] || doc.workflow_state;
	}
	
	// 3. Champ status (statut standard)
	if (doc.status) {
		// Traduire si une traduction existe, sinon garder la valeur originale
		return statusTranslations[doc.status] || doc.status;
	}
	
	// 4. Champs personnalisés courants
	if (doc.etat) return doc.etat;
	if (doc.état) return doc.état;
	if (doc.statut) return doc.statut;
	if (doc.etat_document) return doc.etat_document;
	if (doc.état_document) return doc.état_document;
	if (doc.statut_document) return doc.statut_document;
	
	// 5. Fallback sur docstatus avec conversion en texte explicite
	if (doc.docstatus === 0) return "Brouillon";
	if (doc.docstatus === 1) {
		// Pour les documents soumis, on vérifie s'il y a un champ 'is_cancelled' ou similaire
		if (doc.is_cancelled) return "Annulé";
		if (doc.is_expired) return "Expiré";
		if (doc.is_completed) return "Terminé";
		if (doc.is_validated) return "Validé";
		return "Soumis";
	}
	if (doc.docstatus === 2) return "Annulé";
	
	// Si aucun statut n'est trouvé
	return "Statut non disponible";
}

// Gestion des événements sur la table enfant Documents Legaux Importation
frappe.ui.form.on("Documents Legaux Importation", {
	/**
	 * Met à jour les informations lorsqu'un document légal est sélectionné
	 * @param {Object} frm - L'objet formulaire parent
	 * @param {Object} cdt - Type de document enfant
	 * @param {Object} cdn - Nom du document enfant
	 */
	document_legal: function(frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		
		// Vérifier que le document légal est sélectionné
		if (row.document_legal) {
			// Appel au serveur pour récupérer les informations du document légal
			frappe.call({
				method: "frappe.client.get",
				args: {
					doctype: "Document Legal",
					name: row.document_legal
				},
				callback: function(response) {
					if (response.message) {
						const doc_legal = response.message;
						
						// Mettre à jour les champs dans la ligne (bien que cela soit fait automatiquement par fetch_from)
						frappe.model.set_value(cdt, cdn, "type_document", doc_legal.type_document);
						frappe.model.set_value(cdt, cdn, "reference", doc_legal.reference);
						frappe.model.set_value(cdt, cdn, "date_emission", doc_legal.date_emission);
						frappe.model.set_value(cdt, cdn, "date_expiration", doc_legal.date_expiration);
						frappe.model.set_value(cdt, cdn, "statut", doc_legal.statut);
						
						frm.refresh_field("doc_legaux");
					}
				},
				error: function(err) {
					console.error("Erreur lors de la récupération du document légal:", err);
					frappe.model.set_value(cdt, cdn, "statut", "Erreur");
					frm.refresh_field("doc_legaux");
				}
			});
		} else {
			// Réinitialiser les champs si le document légal est effacé
			frappe.model.set_value(cdt, cdn, "type_document", "");
			frappe.model.set_value(cdt, cdn, "reference", "");
			frappe.model.set_value(cdt, cdn, "date_emission", null);
			frappe.model.set_value(cdt, cdn, "date_expiration", null);
			frappe.model.set_value(cdt, cdn, "statut", "");
			frm.refresh_field("doc_legaux");
		}
	}
});