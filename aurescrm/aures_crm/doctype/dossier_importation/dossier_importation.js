// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Dossier Importation", {
	refresh(frm) {
		// Initialisation standard du formulaire
		frm.trigger('setup_html_douanes');
		frm.trigger('setup_html_banque');
		frm.trigger('setup_html_commercial');
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
		
		// Calculer la progression des documents validés
		const totalDocuments = documents ? documents.length : 0;
		const documentsValides = documents ? documents.filter(doc => doc.status === 'Validé').length : 0;
		const progressPercentage = totalDocuments > 0 ? Math.round((documentsValides / totalDocuments) * 100) : 0;
		
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
				
				<!-- Barre de progression -->
				<div style="padding: 16px; border-bottom: 1px solid #e8ecef; background: #fafbfc;">
					<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
						<span style="font-size: 13px; font-weight: 500; color: #495057;">Progression des validations</span>
						<span style="font-size: 13px; color: #6c757d;">${documentsValides}/${totalDocuments} documents validés</span>
					</div>
					<div style="background: #e9ecef; border-radius: 10px; height: 8px; overflow: hidden;">
						<div style="
							background: ${progressPercentage === 100 ? '#28a745' : progressPercentage >= 50 ? '#fd7e14' : '#dc3545'};
							height: 100%;
							width: ${progressPercentage}%;
							transition: width 0.3s ease;
							border-radius: 10px;
						"></div>
					</div>
					<div style="text-align: center; margin-top: 6px;">
						<span style="font-size: 12px; font-weight: 600; color: ${progressPercentage === 100 ? '#28a745' : '#6c757d'};">${progressPercentage}%</span>
					</div>
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
		
		// Calculer la progression des documents validés
		const totalDocuments = documents ? documents.length : 0;
		const documentsValides = documents ? documents.filter(doc => doc.status === 'Validé').length : 0;
		const progressPercentage = totalDocuments > 0 ? Math.round((documentsValides / totalDocuments) * 100) : 0;
		
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
				
				<!-- Barre de progression -->
				<div style="padding: 16px; border-bottom: 1px solid #e8ecef; background: #fafbfc;">
					<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
						<span style="font-size: 13px; font-weight: 500; color: #495057;">Progression des validations</span>
						<span style="font-size: 13px; color: #6c757d;">${documentsValides}/${totalDocuments} documents validés</span>
					</div>
					<div style="background: #e9ecef; border-radius: 10px; height: 8px; overflow: hidden;">
						<div style="
							background: ${progressPercentage === 100 ? '#28a745' : progressPercentage >= 50 ? '#fd7e14' : '#dc3545'};
							height: 100%;
							width: ${progressPercentage}%;
							transition: width 0.3s ease;
							border-radius: 10px;
						"></div>
					</div>
					<div style="text-align: center; margin-top: 6px;">
						<span style="font-size: 12px; font-weight: 600; color: ${progressPercentage === 100 ? '#28a745' : '#6c757d'};">${progressPercentage}%</span>
					</div>
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
						// Afficher le message de succès simplifié
						frappe.show_alert({
							message: response.message.message,
							indicator: 'green'
						}, 5);
						
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
						// Afficher le message de succès simplifié
						frappe.show_alert({
							message: response.message.message,
							indicator: 'green'
						}, 5);
						
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
	},

	// === SECTION COMMERCIALE ===
	setup_html_commercial(frm) {
		// Créer le contenu HTML initial
		frm.trigger('render_documents_commercial');
	},

	render_documents_commercial(frm) {
		// Vérifier que le champ html_commercial existe
		if (!frm.fields_dict.html_commercial) {
			console.error('Le champ html_commercial n\'existe pas dans le formulaire');
			return;
		}
		
		// Charger les documents
		frm.events.load_documents_commercial(frm);
	},

	load_documents_commercial(frm) {
		// Récupérer les documents existants
		if (!frm.is_new()) {
			frappe.call({
				method: 'get_documents_commerciaux',
				doc: frm.doc,
				callback: function(response) {
					console.log('Documents commerciaux récupérés:', response.message);
					const documents = response.message || [];
					frm.events.build_documents_html_commercial(frm, documents);
				},
				error: function(err) {
					console.error('Erreur lors de la récupération des documents commerciaux:', err);
					frm.events.build_documents_html_commercial(frm, []);
				}
			});
		} else {
			frm.events.build_documents_html_commercial(frm, []);
		}
	},

	build_documents_html_commercial(frm, documents) {
		// Fonction utilitaire pour obtenir la classe de couleur Frappe
		const getStatusIndicatorClass = (statut) => {
			const statusMap = {
				'Brouillon': 'orange',
				'Soumis': 'blue',
				'Validé': 'green',
				'Terminé': 'green',
				'Annulé': 'red',
				'En cours': 'yellow',
				'Fermé': 'gray'
			};
			return statusMap[statut] || 'gray';
		};
		
		// Construire le HTML de la liste des documents
		let html_content = `
			<div style="background: #ffffff; border: 1px solid #e8ecef; border-radius: 8px; overflow: hidden;">
				<!-- En-tête -->
				<div style="background: #f8f9fa; padding: 16px; border-bottom: 1px solid #e8ecef; display: flex; justify-content: space-between; align-items: center;">
					<div>
						<h5 style="margin: 0; color: #495057; font-weight: 600;">💼 Documents Commerciaux</h5>
						<small style="color: #6c757d;">Gestion des documents d'achat liés</small>
					</div>
					<button class="btn btn-success btn-sm" id="btn-rafraichir-docs-commercial" style="border-radius: 6px;">
						<i class="fa fa-refresh" style="margin-right: 4px;"></i>Actualiser
					</button>
				</div>
		`;
		
		if (documents && documents.length > 0) {
			// Liste des documents
			html_content += `<div style="padding: 0;">`;
			
			documents.forEach((doc, index) => {
				const statusClass = getStatusIndicatorClass(doc.status_display);
				
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
								<span style="font-weight: 500; color: #495057; margin-right: 8px;">${doc.type_document}</span>
								<span style="font-weight: 400; color: #6c757d; margin-right: 8px;">${doc.name}</span>
								<span class="indicator-pill ${statusClass}">${doc.status_display}</span>
							</div>
							<div style="font-size: 13px; color: #6c757d;">
								${doc.date_creation ? `Date: ${doc.date_creation}` : 'Aucune date'}
								${doc.montant ? ` | Total: ${frappe.format(doc.montant, {fieldtype: 'Currency'})}` : ''}
								${doc.supplier_name ? ` | Fournisseur: ${doc.supplier_name}` : ''}
							</div>
						</div>
						
						<!-- Boutons d'action -->
						<div style="display: flex; gap: 6px; margin-left: 12px;">
							<button class="btn btn-outline-primary btn-xs btn-view-doc-commercial" 
								data-doctype="${doc.doctype_name}"
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
					<p style="margin: 0; font-size: 14px;">Aucun document commercial trouvé</p>
					<small>Les documents d'achat liés à ce dossier apparaîtront ici</small>
				</div>
			`;
		}
		
		html_content += `</div>`;
		
		// Injecter le HTML dans le champ
		frm.fields_dict.html_commercial.$wrapper.html(html_content);
		
		// Attacher les événements
		frm.events.attach_events_commercial(frm);
	},

	attach_events_commercial(frm) {
		const $wrapper = frm.fields_dict.html_commercial.$wrapper;
		
		// Bouton actualiser documents
		$wrapper.find('#btn-rafraichir-docs-commercial').on('click', function() {
			frm.trigger('render_documents_commercial');
		});
		
		// Boutons voir document
		$wrapper.find('.btn-view-doc-commercial').on('click', function() {
			const doctype = $(this).data('doctype');
			const documentName = $(this).data('document');
			frappe.set_route('Form', doctype, documentName);
		});
	}
});