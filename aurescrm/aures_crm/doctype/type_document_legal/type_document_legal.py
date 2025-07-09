# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class TypeDocumentLegal(Document):
	"""
	DocType pour définir les différents types de documents légaux.
	Permet de catégoriser les documents selon leur catégorie et de définir leurs propriétés.
	"""
	
	def validate(self):
		"""
		Validation des données du type de document légal.
		"""
		# Vérifier que le nom du type est unique dans la catégorie
		if self.nom_type and self.categorie:
			existing = frappe.db.exists("Type Document Legal", {
				"nom_type": self.nom_type,
				"categorie": self.categorie,
				"name": ["!=", self.name]
			})
			if existing:
				frappe.throw(f"Un type de document avec le nom '{self.nom_type}' existe déjà dans la catégorie '{self.categorie}'.")
		
		# Vérifier que la catégorie est active
		if self.categorie:
			categorie_doc = frappe.get_doc("Categorie Document Legal", self.categorie)
			if categorie_doc.status == "Désactivé":
				frappe.throw(f"Impossible de créer un type de document dans une catégorie désactivée: '{self.categorie}'.")
	
	def before_save(self):
		"""
		Actions à effectuer avant la sauvegarde.
		"""
		# Nettoyer le nom du type (supprimer les espaces en début/fin)
		if self.nom_type:
			self.nom_type = self.nom_type.strip()
	
	def on_update(self):
		"""
		Actions à effectuer après la mise à jour du document.
		"""
		# Log de l'activité pour traçabilité
		frappe.logger().info(f"Type de document légal mis à jour: {self.nom_type} dans la catégorie {self.categorie}")