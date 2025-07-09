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
		
		# Préparer le message de retour
		message_parts = []
		
		if documents_crees:
			message_parts.append(f"✅ {len(documents_crees)} document(s) créé(s): {', '.join(documents_crees)}")
		
		if documents_existants:
			message_parts.append(f"ℹ️ {len(documents_existants)} document(s) existant(s) ignoré(s): {', '.join(documents_existants)}")
		
		if not documents_crees and not documents_existants:
			message_parts.append("Aucun document à créer.")
		
		return {
			"success": True,
			"message": "\n".join(message_parts),
			"documents_crees": len(documents_crees),
			"documents_existants": len(documents_existants)
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
		
		# Préparer le message de retour
		message_parts = []
		
		if documents_crees:
			message_parts.append(f"✅ {len(documents_crees)} document(s) créé(s): {', '.join(documents_crees)}")
		
		if documents_existants:
			message_parts.append(f"ℹ️ {len(documents_existants)} document(s) existant(s) ignoré(s): {', '.join(documents_existants)}")
		
		if not documents_crees and not documents_existants:
			message_parts.append("Aucun document à créer.")
		
		return {
			"success": True,
			"message": "\n".join(message_parts),
			"documents_crees": len(documents_crees),
			"documents_existants": len(documents_existants)
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
