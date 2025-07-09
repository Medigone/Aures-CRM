// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Dossier Importation", {
	refresh(frm) {
		// Initialisation standard du formulaire
		frm.trigger('setup_html_douanes');
		frm.trigger('setup_html_banque');
	},
	
	setup_html_douanes(frm) {
		// Créer le contenu HTML initial
		frm.trigger('render_documents_douanes');
	},
	
	setup_html_banque(frm) {
		// Créer le contenu HTML initial
		frm.trigger('render_documents_banque');
	},
	
	load_documents_douanes(frm) {
		// Récupérer les documents existants
		if (!frm.is_new()) {
			frappe.call({
				method: 'get_documents_legaux_douanes',
				doc: frm.doc,
				callback: function(response) {
					console.log('Documents douanes récupérés:', response.message);
					const documents = response.message || [];
					frm.events.build_documents_html(frm, documents);
				},
				error: function(err) {
					console.error('Erreur lors de la récupération des documents douanes:', err);
					frm.events.build_documents_html(frm, []);
				}
			});
		} else {
			frm.events.build_documents_html(frm, []);
		}
	},
	
	load_documents_banque(frm) {
		// Récupérer les documents existants
		if (!frm.is_new()) {
			frappe.call({
				method: 'get_documents_legaux_banque',
				doc: frm.doc,
				callback: function(response) {
					console.log('Documents banque récupérés:', response.message);
					const documents = response.message || [];
					frm.events.build_documents_html_banque(frm, documents);
				},
				error: function(err) {
					console.error('Erreur lors de la récupération des documents banque:', err);
					frm.events.build_documents_html_banque(frm, []);
				}
			});
		} else {
			frm.events.build_documents_html_banque(frm, []);
		}
	},
	
	render_documents_douanes(frm) {
		// Vérifier que le champ html_douanes existe
		if (!frm.fields_dict.html_douanes) {
			console.error('Le champ html_douanes n\'existe pas dans le formulaire');
			return;
		}
		
		// Charger les documents
		frm.events.load_documents_douanes(frm);
	},
	
	render_documents_banque(frm) {
		// Vérifier que le champ html_banque existe
		if (!frm.fields_dict.html_banque) {
			console.error('Le champ html_banque n\'existe pas dans le formulaire');
			return;
		}
		
		// Charger les documents
		frm.events.load_documents_banque(frm);
	},
	
	build_documents_html(frm, documents) {
		// Fonction utilitaire pour obtenir la couleur de fond du statut
		const getStatusColor = (statut) => {
			const colors = {
				'Brouillon': '#e9ecef',
				'En cours': '#fff3cd',
				'Validé': '#d4edda',
				'Expiré': '#f8d7da',
				'Annulé': '#e2e3e5'
			};
			return colors[statut] || '#e9ecef';
		};
		
		// Fonction utilitaire pour obtenir la couleur du texte du statut
		const getStatusTextColor = (statut) => {
			const textColors = {
				'Brouillon': '#495057',
				'En cours': '#856404',
				'Validé': '#155724',
				'Expiré': '#721c24',
				'Annulé': '#383d41'
			};
			return textColors[statut] || '#495057';
		};
		
		// Construire le HTML de la liste des documents
		let html_content = `
			<div style="background: #ffffff; border: 1px solid #e8ecef; border-radius: 8px; overflow: hidden;">
				<!-- En-tête -->
				<div style="background: #f8f9fa; padding: 16px; border-bottom: 1px solid #e8ecef; display: flex; justify-content: space-between; align-items: center;">
					<div>
						<h5 style="margin: 0; color: #495057; font-weight: 600;">📋 Documents Douanes</h5>
						<small style="color: #6c757d;">Gestion des documents légaux</small>
					</div>
					<button class="btn btn-primary btn-sm" id="btn-generer-docs-douanes" style="border-radius: 6px;">
						<i class="fa fa-plus" style="margin-right: 4px;"></i>Générer
					</button>
				</div>
		`;
		
		if (documents && documents.length > 0) {
			// Liste des documents
			html_content += `<div style="padding: 0;">`;
			
			documents.forEach((doc, index) => {
				const statusColor = getStatusColor(doc.status);
				const statusTextColor = getStatusTextColor(doc.status);
				
				html_content += `
					<div class="document-item" style="
						padding: 12px 16px; 
						border-bottom: ${index < documents.length - 1 ? '1px solid #f1f3f4' : 'none'};
						display: flex; 
						align-items: center; 
						justify-content: space-between;
						transition: background-color 0.2s;
					" 
						onmouseover="this.style.backgroundColor='#f8f9fa'" 
						onmouseout="this.style.backgroundColor='transparent'">
						
						<!-- Informations du document -->
						<div style="flex: 1; min-width: 0;">
							<div style="display: flex; align-items: center; margin-bottom: 4px;">
								<span style="font-weight: 500; color: #495057; margin-right: 8px;">${doc.nom_type || doc.type_document}</span>
								<span class="badge" style="
									padding: 4px 10px;
									font-size: 11px;
									font-weight: 500;
									color: ${statusTextColor};
									background-color: ${statusColor};
									border: 1px solid ${statusTextColor}20;
									border-radius: 4px;
								">
									${doc.status}
								</span>
							</div>
							<div style="font-size: 13px; color: #6c757d;">
								${doc.reference ? `Réf: ${doc.reference}` : 'Aucune référence'}
							</div>
						</div>
						
						<!-- Boutons d'action -->
						<div style="display: flex; gap: 6px; margin-left: 12px;">
							<button class="btn btn-outline-secondary btn-xs btn-action-statut" 
							data-document="${doc.name}" 
							data-current-status="${doc.status}"
								style="padding: 4px 8px; font-size: 11px; border-radius: 4px;">
								<i class="fa fa-edit"></i>
							</button>
							<button class="btn btn-outline-primary btn-xs btn-view-doc" 
								data-document="${doc.name}"
								style="padding: 4px 8px; font-size: 11px; border-radius: 4px;">
								<i class="fa fa-eye"></i>
							</button>
						</div>
					</div>
				`;
			});
			
			html_content += `</div>`;
		} else {
			// Message si aucun document
			html_content += `
				<div style="padding: 32px; text-align: center; color: #6c757d;">
					<i class="fa fa-file-text-o" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;"></i>
					<p style="margin: 0; font-size: 14px;">Aucun document généré</p>
					<small>Cliquez sur "Générer" pour créer les documents légaux</small>
				</div>
			`;
		}
		
		html_content += `</div>`;
		
		// Injecter le HTML dans le champ
		frm.fields_dict.html_douanes.$wrapper.html(html_content);
		
		// Attacher les événements
		frm.events.attach_events(frm);
	},
	
	build_documents_html_banque(frm, documents) {
		// Fonction utilitaire pour obtenir la couleur de fond du statut
		const getStatusColor = (statut) => {
			const colors = {
				'Brouillon': '#e9ecef',
				'En cours': '#fff3cd',
				'Validé': '#d4edda',
				'Expiré': '#f8d7da',
				'Annulé': '#e2e3e5'
			};
			return colors[statut] || '#e9ecef';
		};
		
		// Fonction utilitaire pour obtenir la couleur du texte du statut
		const getStatusTextColor = (statut) => {
			const textColors = {
				'Brouillon': '#495057',
				'En cours': '#856404',
				'Validé': '#155724',
				'Expiré': '#721c24',
				'Annulé': '#383d41'
			};
			return textColors[statut] || '#495057';
		};
		
		// Construire le HTML de la liste des documents
		let html_content = `
			<div style="background: #ffffff; border: 1px solid #e8ecef; border-radius: 8px; overflow: hidden;">
				<!-- En-tête -->
				<div style="background: #f8f9fa; padding: 16px; border-bottom: 1px solid #e8ecef; display: flex; justify-content: space-between; align-items: center;">
					<div>
						<h5 style="margin: 0; color: #495057; font-weight: 600;">🏦 Documents Banque</h5>
						<small style="color: #6c757d;">Gestion des documents bancaires</small>
					</div>
					<button class="btn btn-primary btn-sm" id="btn-generer-docs-banque" style="border-radius: 6px;">
						<i class="fa fa-plus" style="margin-right: 4px;"></i>Générer
					</button>
				</div>
		`;
		
		if (documents && documents.length > 0) {
			// Liste des documents
			html_content += `<div style="padding: 0;">`;
			
			documents.forEach((doc, index) => {
				const statusColor = getStatusColor(doc.status);
				const statusTextColor = getStatusTextColor(doc.status);
				
				html_content += `
					<div class="document-item" style="
						padding: 12px 16px; 
						border-bottom: ${index < documents.length - 1 ? '1px solid #f1f3f4' : 'none'};
						display: flex; 
						align-items: center; 
						justify-content: space-between;
						transition: background-color 0.2s;
					" 
						onmouseover="this.style.backgroundColor='#f8f9fa'" 
						onmouseout="this.style.backgroundColor='transparent'">
						
						<!-- Informations du document -->
						<div style="flex: 1; min-width: 0;">
							<div style="display: flex; align-items: center; margin-bottom: 4px;">
								<span style="font-weight: 500; color: #495057; margin-right: 8px;">${doc.nom_type || doc.type_document}</span>
								<span class="badge" style="
									padding: 4px 10px;
									font-size: 11px;
									font-weight: 500;
									color: ${statusTextColor};
									background-color: ${statusColor};
									border: 1px solid ${statusTextColor}20;
									border-radius: 4px;
								">
									${doc.status}
								</span>
							</div>
							<div style="font-size: 13px; color: #6c757d;">
								${doc.reference ? `Réf: ${doc.reference}` : 'Aucune référence'}
							</div>
						</div>
						
						<!-- Boutons d'action -->
						<div style="display: flex; gap: 6px; margin-left: 12px;">
							<button class="btn btn-outline-secondary btn-xs btn-action-statut-banque" 
						data-document="${doc.name}" 
						data-current-status="${doc.status}"
								style="padding: 4px 8px; font-size: 11px; border-radius: 4px;">
								<i class="fa fa-edit"></i>
							</button>
							<button class="btn btn-outline-primary btn-xs btn-view-doc-banque" 
								data-document="${doc.name}"
								style="padding: 4px 8px; font-size: 11px; border-radius: 4px;">
								<i class="fa fa-eye"></i>
							</button>
						</div>
					</div>
				`;
			});
			
			html_content += `</div>`;
		} else {
			// Message si aucun document
			html_content += `
				<div style="padding: 32px; text-align: center; color: #6c757d;">
					<i class="fa fa-university" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;"></i>
					<p style="margin: 0; font-size: 14px;">Aucun document bancaire généré</p>
					<small>Cliquez sur "Générer" pour créer les documents bancaires</small>
				</div>
			`;
		}
		
		html_content += `</div>`;
		
		// Injecter le HTML dans le champ
		frm.fields_dict.html_banque.$wrapper.html(html_content);
		
		// Attacher les événements
		frm.events.attach_events_banque(frm);
	},
	
	attach_events(frm) {
		const $wrapper = frm.fields_dict.html_douanes.$wrapper;
		
		// Bouton générer documents
		$wrapper.find('#btn-generer-docs-douanes').on('click', function() {
		    frm.events.generer_documents_douanes(frm); // Au lieu de frm.trigger
		});
		
		// Dans attach_events_banque(frm)
		// Bouton générer documents
		$wrapper.find('#btn-generer-docs-banque').on('click', function() {
		    frm.events.generer_documents_banque(frm); // Au lieu de frm.trigger
		});
		
		// Boutons changer statut
		$wrapper.find('.btn-action-statut').on('click', function() {
			const documentName = $(this).data('document');
			const currentStatus = $(this).data('current-status');
			frm.events.changer_statut_document(frm, documentName, currentStatus);
		});
		
		// Boutons voir document
		$wrapper.find('.btn-view-doc').on('click', function() {
			const documentName = $(this).data('document');
			frappe.set_route('Form', 'Document Legal', documentName);
		});
	},
	
	attach_events_banque(frm) {
		const $wrapper = frm.fields_dict.html_banque.$wrapper;
		
		// Bouton générer documents
		$wrapper.find('#btn-generer-docs-banque').on('click', function() {
			frm.trigger('generer_documents_banque');
		});
		
		// Boutons changer statut
		$wrapper.find('.btn-action-statut-banque').on('click', function() {
			const documentName = $(this).data('document');
			const currentStatus = $(this).data('current-status');
			frm.events.changer_statut_document_banque(frm, documentName, currentStatus);
		});
		
		// Boutons voir document
		$wrapper.find('.btn-view-doc-banque').on('click', function() {
			const documentName = $(this).data('document');
			frappe.set_route('Form', 'Document Legal', documentName);
		});
	},
	
	changer_statut_document(frm, documentName, currentStatus) {
		// Options de statut disponibles
		const statusOptions = [
			'Brouillon',
			'En cours', 
			'Validé',
			'Expiré',
			'Annulé'
		];
		
		// Créer le dialogue de sélection
		const dialog = new frappe.ui.Dialog({
			title: 'Changer le statut',
			fields: [{
				fieldname: 'nouveau_statut',
				fieldtype: 'Select',
				label: 'Nouveau statut',
				options: statusOptions.join('\n'),
				default: currentStatus,
				reqd: 1
			}],
			primary_action_label: 'Modifier',
			primary_action: function(values) {
				if (values.nouveau_statut === currentStatus) {
					frappe.msgprint('Le statut sélectionné est identique au statut actuel.');
					return;
				}
				
				// Appeler la méthode serveur
				frappe.call({
					method: 'changer_statut_document_legal',
					doc: frm.doc,
					args: {
						document_name: documentName,
						nouveau_statut: values.nouveau_statut
					},
					callback: function(response) {
						if (response.message && response.message.success) {
							frappe.show_alert({
								message: response.message.message,
								indicator: 'green'
							});
							// Rafraîchir la liste
							frm.trigger('render_documents_douanes');
						} else {
							frappe.msgprint({
								message: response.message?.message || 'Erreur lors du changement de statut',
								indicator: 'red'
							});
						}
					},
					error: function(err) {
						frappe.msgprint({
							message: 'Erreur lors du changement de statut: ' + err.message,
							indicator: 'red'
						});
					}
				});
				
				dialog.hide();
			}
		});
		
		dialog.show();
	},
	
	changer_statut_document_banque(frm, documentName, currentStatus) {
		// Options de statut disponibles
		const statusOptions = [
			'Brouillon',
			'En cours', 
			'Validé',
			'Expiré',
			'Annulé'
		];
		
		// Créer le dialogue de sélection
		const dialog = new frappe.ui.Dialog({
			title: 'Changer le statut',
			fields: [{
				fieldname: 'nouveau_statut',
				fieldtype: 'Select',
				label: 'Nouveau statut',
				options: statusOptions.join('\n'),
				default: currentStatus,
				reqd: 1
			}],
			primary_action_label: 'Modifier',
			primary_action: function(values) {
				if (values.nouveau_statut === currentStatus) {
					frappe.msgprint('Le statut sélectionné est identique au statut actuel.');
					return;
				}
				
				// Appeler la méthode serveur
				frappe.call({
					method: 'changer_statut_document_legal',
					doc: frm.doc,
					args: {
						document_name: documentName,
						nouveau_statut: values.nouveau_statut
					},
					callback: function(response) {
						if (response.message && response.message.success) {
							frappe.show_alert({
								message: response.message.message,
								indicator: 'green'
							});
							// Rafraîchir la liste
							frm.trigger('render_documents_banque');
						} else {
							frappe.msgprint({
								message: response.message?.message || 'Erreur lors du changement de statut',
								indicator: 'red'
							});
						}
					},
					error: function(err) {
						frappe.msgprint({
							message: 'Erreur lors du changement de statut: ' + err.message,
							indicator: 'red'
						});
					}
				});
				
				dialog.hide();
			}
		});
		
		dialog.show();
	},

	generer_documents_douanes(frm) {
		// Vérifier que le document est sauvegardé
		if (frm.is_new()) {
			frappe.msgprint({
				message: __('Veuillez d\'abord sauvegarder le dossier d\'importation.'),
				indicator: 'orange'
			});
			return;
		}
		
		// Demander confirmation
		frappe.confirm(
			__('Voulez-vous générer automatiquement tous les documents légaux pour la catégorie "Douanes" ?'),
			function() {
				// Afficher un indicateur de chargement
				frappe.show_alert({
					message: __('Génération des documents en cours...'),
					indicator: 'blue'
				});
				
				// Appeler la méthode serveur
				frappe.call({
					method: 'generer_documents_legaux_douanes',
					doc: frm.doc,
					callback: function(response) {
						if (response.message && response.message.success) {
							// Afficher le message de succès
							frappe.msgprint({
								title: __('Documents générés avec succès'),
								message: response.message.message,
								indicator: 'green'
							});
							
							// Rafraîchir la liste des documents
							frm.events.render_documents_douanes(frm);
						} else {
							frappe.msgprint({
								title: __('Erreur'),
								message: __('Une erreur est survenue lors de la génération des documents.'),
								indicator: 'red'
							});
						}
					},
					error: function(err) {
						console.error('Erreur lors de la génération des documents:', err);
						frappe.msgprint({
							title: __('Erreur'),
							message: err.message || __('Une erreur est survenue lors de la génération des documents.'),
							indicator: 'red'
						});
					}
				});
			},
			function() {
				// Annulation - ne rien faire
			}
		);
	},
	
	generer_documents_banque(frm) {
		// Vérifier que le document est sauvegardé
		if (frm.is_new()) {
			frappe.msgprint({
				message: __('Veuillez d\'abord sauvegarder le dossier d\'importation.'),
				indicator: 'orange'
			});
			return;
		}
		
		// Demander confirmation
		frappe.confirm(
			__('Voulez-vous générer automatiquement tous les documents légaux pour la catégorie "Banque" ?'),
			function() {
				// Afficher un indicateur de chargement
				frappe.show_alert({
					message: __('Génération des documents bancaires en cours...'),
					indicator: 'blue'
				});
				
				// Appeler la méthode serveur
				frappe.call({
					method: 'generer_documents_legaux_banque',
					doc: frm.doc,
					callback: function(response) {
						if (response.message && response.message.success) {
							// Afficher le message de succès
							frappe.msgprint({
								title: __('Documents générés avec succès'),
								message: response.message.message,
								indicator: 'green'
							});
							
							// Rafraîchir la liste des documents
							frm.events.render_documents_banque(frm);
						} else {
							frappe.msgprint({
								title: __('Erreur'),
								message: __('Une erreur est survenue lors de la génération des documents bancaires.'),
								indicator: 'red'
							});
						}
					},
					error: function(err) {
						console.error('Erreur lors de la génération des documents bancaires:', err);
						frappe.msgprint({
							title: __('Erreur'),
							message: err.message || __('Une erreur est survenue lors de la génération des documents bancaires.'),
							indicator: 'red'
						});
					}
				});
			},
			function() {
				// Annulation - ne rien faire
			}
		);
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
	if (doc.status) return doc.status;
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
						frappe.model.set_value(cdt, cdn, "statut", doc_legal.status);
						
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