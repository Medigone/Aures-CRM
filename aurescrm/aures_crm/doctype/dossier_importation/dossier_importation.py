# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _


class DossierImportation(Document):
	"""DocType pour gérer les dossiers d'importation."""
	
	@frappe.whitelist()
	def generer_documents_legaux_douanes(self):
		"""
		Génère automatiquement les documents légaux pour la catégorie 'Douanes'.
		Crée un document pour chaque type de document légal actif de la catégorie 'Douanes'.
		"""
		# Vérifier que le dossier est sauvegardé
		if self.is_new():
			frappe.throw(_("Veuillez d'abord sauvegarder le dossier d'importation."))
		
		# Rechercher la catégorie 'Douanes'
		categorie_douanes = frappe.db.get_value(
			"Categorie Document Legal",
			{"categorie": "Douanes", "status": "Activé"},
			"name"
		)
		
		if not categorie_douanes:
			frappe.throw(_("Aucune catégorie 'Douanes' active trouvée. Veuillez créer et activer cette catégorie."))
		
		# Récupérer tous les types de documents légaux actifs pour la catégorie 'Douanes'
		types_documents = frappe.get_all(
			"Type Document Legal",
			filters={
				"categorie": categorie_douanes,
				"status": "Activé"
			},
			fields=["name", "nom_type", "description"]
		)
		
		if not types_documents:
			frappe.throw(_("Aucun type de document actif trouvé pour la catégorie 'Douanes'."))
		
		documents_crees = []
		documents_existants = []
		
		for type_doc in types_documents:
			# Vérifier si un document de ce type existe déjà pour ce dossier
			existant = frappe.db.exists(
				"Document Legal",
				{
					"dossier_import": self.name,
					"type_document": type_doc.name
				}
			)
			
			if existant:
				documents_existants.append(type_doc.nom_type)
				continue
			
			# Créer le nouveau document légal
			doc_legal = frappe.new_doc("Document Legal")
			doc_legal.update({
				"titre": f"{type_doc.nom_type} - {self.nom_fournisseur or self.name}",
				"categorie": categorie_douanes,
				"type_document": type_doc.name,
				"dossier_import": self.name,
				"status": "Brouillon",
				"description": type_doc.description or f"Document {type_doc.nom_type} généré automatiquement pour le dossier {self.name}"
			})
			
			try:
				doc_legal.insert()
				documents_crees.append(type_doc.nom_type)
			except Exception as e:
				frappe.log_error(f"Erreur lors de la création du document {type_doc.nom_type}: {str(e)}")
				continue
		
		# Préparer le message de retour simplifié
		total_crees = len(documents_crees)
		total_existants = len(documents_existants)
		
		if total_crees > 0:
			message = f"{total_crees} document(s) généré(s) avec succès"
		else:
			message = "Aucun nouveau document à créer"
		
		return {
			"success": True,
			"message": message,
			"documents_crees": total_crees,
			"documents_existants": total_existants
		}
	
	@frappe.whitelist()
	def get_documents_legaux_douanes(self):
		"""
		Récupère la liste des documents légaux de la catégorie 'Douanes' pour ce dossier.
		"""
		# Rechercher la catégorie 'Douanes'
		categorie_douanes = frappe.db.get_value(
			"Categorie Document Legal",
			{"categorie": "Douanes", "status": "Activé"},
			"name"
		)
		
		if not categorie_douanes:
			return []
		
		# Récupérer tous les documents légaux de cette catégorie pour ce dossier
		documents = frappe.get_all(
			"Document Legal",
			filters={
				"dossier_import": self.name,
				"categorie": categorie_douanes
			},
			fields=[
				"name", "titre", "status", "type_document", 
				"reference", "date_emission", "date_expiration"
			],
			order_by="creation desc"
		)
		
		# Enrichir avec les informations du type de document
		for doc in documents:
			type_info = frappe.db.get_value(
				"Type Document Legal",
				doc.type_document,
				["nom_type", "description"]
			)
			if type_info:
				doc.nom_type = type_info[0]
				doc.description_type = type_info[1]
			else:
				doc.nom_type = doc.type_document
				doc.description_type = ""
		
		return documents

	@frappe.whitelist()
	def get_documents_commerciaux(self):
		"""
		Récupère la liste des documents commerciaux (Devis Fournisseur, Commande d'achat, Reçu d'achat, Facture fournisseur)
		liés à ce dossier d'importation via le champ custom_dossier_importation.
		"""
		documents = []
		
		# Types de documents commerciaux à récupérer
		doctypes_commerciaux = [
			{"doctype": "Supplier Quotation", "label": "Devis Fournisseur"},
			{"doctype": "Purchase Order", "label": "Commande d'achat"},
			{"doctype": "Purchase Receipt", "label": "Reçu d'achat"},
			{"doctype": "Purchase Invoice", "label": "Facture fournisseur"}
		]
		
		for doc_info in doctypes_commerciaux:
			try:
				# Définir les champs à récupérer selon le type de document
				fields = [
					"name", "status", "docstatus", "creation", "modified",
					"supplier", "supplier_name", "total", "grand_total"
				]
				
				# Ajouter le champ transaction_date pour les Devis Fournisseur
				if doc_info["doctype"] == "Supplier Quotation":
					fields.append("transaction_date")
				
				# Récupérer les documents de ce type liés au dossier
				docs = frappe.get_all(
					doc_info["doctype"],
					filters={"custom_dossier_importation": self.name},
					fields=fields,
					order_by="creation desc"
				)
				
				# Enrichir chaque document avec des informations supplémentaires
				for doc in docs:
					doc.type_document = doc_info["label"]
					doc.doctype_name = doc_info["doctype"]
					
					# Déterminer le statut basé sur docstatus avec traduction en français
					if doc.docstatus == 0:
						doc.status_display = "Brouillon"
					elif doc.docstatus == 1:
						doc.status_display = "Validé"
					elif doc.docstatus == 2:
						doc.status_display = "Annulé"
					else:
						# Traduire les statuts anglais en français
						status_translations = {
							"Draft": "Brouillon",
							"Submitted": "Validé",
							"Cancelled": "Annulé",
							"Open": "Ouvert",
							"Closed": "Fermé",
							"Completed": "Terminé",
							"Pending": "En attente",
							"On Hold": "En attente"
						}
						status = doc.get("status", "Inconnu")
						doc.status_display = status_translations.get(status, status)
					
					# Formatage des montants
					doc.montant = doc.get("grand_total") or doc.get("total") or 0
					
					# Formatage des dates - utiliser transaction_date pour les Devis Fournisseur
					if doc_info["doctype"] == "Supplier Quotation" and doc.get("transaction_date"):
						doc.date_creation = frappe.utils.formatdate(doc.transaction_date, "dd/mm/yyyy")
					elif doc.creation:
						doc.date_creation = frappe.utils.formatdate(doc.creation, "dd/mm/yyyy")
					if doc.modified:
						doc.date_modification = frappe.utils.formatdate(doc.modified, "dd/mm/yyyy")
				
				documents.extend(docs)
				
			except Exception as e:
				frappe.log_error(f"Erreur lors de la récupération des {doc_info['label']}: {str(e)}")
				continue
		
		return documents
	
	@frappe.whitelist()
	def changer_statut_document_legal(self, document_name, nouveau_statut):
		"""
		Change le statut d'un document légal spécifique.
		"""
		try:
			# Vérifier que le document appartient bien à ce dossier
			doc_legal = frappe.get_doc("Document Legal", document_name)
			
			if doc_legal.dossier_import != self.name:
				frappe.throw(_("Ce document n'appartient pas à ce dossier d'importation."))
			
			# Mettre à jour le statut
			doc_legal.status = nouveau_statut
			doc_legal.save()
			
			return {
				"success": True,
				"message": f"Statut du document '{doc_legal.titre}' mis à jour vers '{nouveau_statut}'"
			}
			
		except Exception as e:
			frappe.log_error(f"Erreur lors du changement de statut: {str(e)}")
			return {
				"success": False,
				"message": f"Erreur: {str(e)}"
			}
	
	@frappe.whitelist()
	def generer_documents_legaux_banque(self):
		"""
		Génère automatiquement les documents légaux pour la catégorie 'Banque'.
		Crée un document pour chaque type de document légal actif de la catégorie 'Banque'.
		"""
		# Vérifier que le dossier est sauvegardé
		if self.is_new():
			frappe.throw(_("Veuillez d'abord sauvegarder le dossier d'importation."))
		
		# Rechercher la catégorie 'Banque'
		categorie_banque = frappe.db.get_value(
			"Categorie Document Legal",
			{"categorie": "Banque", "status": "Activé"},
			"name"
		)
		
		if not categorie_banque:
			frappe.throw(_("Aucune catégorie 'Banque' active trouvée. Veuillez créer et activer cette catégorie."))
		
		# Récupérer tous les types de documents légaux actifs pour la catégorie 'Banque'
		types_documents = frappe.get_all(
			"Type Document Legal",
			filters={
				"categorie": categorie_banque,
				"status": "Activé"
			},
			fields=["name", "nom_type", "description"]
		)
		
		if not types_documents:
			frappe.throw(_("Aucun type de document actif trouvé pour la catégorie 'Banque'."))
		
		documents_crees = []
		documents_existants = []
		
		for type_doc in types_documents:
			# Vérifier si un document de ce type existe déjà pour ce dossier
			existant = frappe.db.exists(
				"Document Legal",
				{
					"dossier_import": self.name,
					"type_document": type_doc.name
				}
			)
			
			if existant:
				documents_existants.append(type_doc.nom_type)
				continue
			
			# Créer le nouveau document légal
			doc_legal = frappe.new_doc("Document Legal")
			doc_legal.update({
				"titre": f"{type_doc.nom_type} - {self.nom_fournisseur or self.name}",
				"categorie": categorie_banque,
				"type_document": type_doc.name,
				"dossier_import": self.name,
				"status": "Brouillon",
				"description": type_doc.description or f"Document {type_doc.nom_type} généré automatiquement pour le dossier {self.name}"
			})
			
			try:
				doc_legal.insert()
				documents_crees.append(type_doc.nom_type)
			except Exception as e:
				frappe.log_error(f"Erreur lors de la création du document {type_doc.nom_type}: {str(e)}")
				continue
		
		# Préparer le message de retour simplifié
		total_crees = len(documents_crees)
		total_existants = len(documents_existants)
		
		if total_crees > 0:
			message = f"{total_crees} document(s) généré(s) avec succès"
		else:
			message = "Aucun nouveau document à créer"
		
		return {
			"success": True,
			"message": message,
			"documents_crees": total_crees,
			"documents_existants": total_existants
		}
	
	@frappe.whitelist()
	def get_documents_legaux_banque(self):
		"""
		Récupère la liste des documents légaux de la catégorie 'Banque' pour ce dossier.
		"""
		# Rechercher la catégorie 'Banque'
		categorie_banque = frappe.db.get_value(
			"Categorie Document Legal",
			{"categorie": "Banque", "status": "Activé"},
			"name"
		)
		
		if not categorie_banque:
			return []
		
		# Récupérer tous les documents légaux de cette catégorie pour ce dossier
		documents = frappe.get_all(
			"Document Legal",
			filters={
				"dossier_import": self.name,
				"categorie": categorie_banque
			},
			fields=[
				"name", "titre", "status", "type_document", 
				"reference", "date_emission", "date_expiration"
			],
			order_by="creation desc"
		)
		
		# Enrichir avec les informations du type de document
		for doc in documents:
			type_info = frappe.db.get_value(
				"Type Document Legal",
				doc.type_document,
				["nom_type", "description"]
			)
			if type_info:
				doc.nom_type = type_info[0]
				doc.description_type = type_info[1]
			else:
				doc.nom_type = doc.type_document
				doc.description_type = ""
		
		return documents
