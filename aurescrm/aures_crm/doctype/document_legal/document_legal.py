# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import add_days, add_months, add_years, getdate, nowdate

class DocumentLegal(Document):
	"""
	DocType principal pour gérer les documents légaux.
	Gère automatiquement les dates d'expiration et les statuts.
	"""
	
	def validate(self):
		"""
		Validation des données du document légal.
		"""
		# Calculer la date d'expiration si le type de document a une durée de validité
		self.calculer_date_expiration()
		
		# Mettre à jour le statut en fonction des dates
		self.mettre_a_jour_statut()
	
	def calculer_date_expiration(self):
		"""
		Calcule la date d'expiration en fonction du type de document.
		"""
		if not self.type_document:
			return
			
		# Récupérer les informations du type de document
		type_doc = frappe.get_doc("Type Document Legal", self.type_document)
		
		# Si le type de document a une durée de validité et que la date d'expiration n'est pas déjà définie
		if type_doc.duree_validite > 0 and not self.date_expiration:
			date_base = getdate(self.date_emission or nowdate())
			
			# Calculer la date d'expiration en fonction de l'unité de durée
			if type_doc.unite_duree == "Jours":
				self.date_expiration = add_days(date_base, type_doc.duree_validite)
			elif type_doc.unite_duree == "Mois":
				self.date_expiration = add_months(date_base, type_doc.duree_validite)
			elif type_doc.unite_duree == "Années":
				self.date_expiration = add_years(date_base, type_doc.duree_validite)
	
	def mettre_a_jour_statut(self):
		"""
		Met à jour le statut du document en fonction des dates et du workflow.
		"""
		# Ne pas modifier le statut si le document est annulé
		if self.statut == "Annulé":
			return
			
		# Vérifier si le document est expiré
		if self.date_expiration and getdate(self.date_expiration) < getdate(nowdate()):
			self.statut = "Expiré"
			return
			
		# Si le document a un workflow, le statut est géré par le workflow
		if hasattr(self, 'workflow_state') and self.workflow_state:
			return
			
		# Sinon, si le document est nouveau, le statut est "Brouillon"
		if self.is_new():
			self.statut = "Brouillon"
	
	def on_update(self):
		"""
		Actions à effectuer après la mise à jour du document.
		"""
		# Mettre à jour les références dans les tables enfant qui utilisent ce document
		self.mettre_a_jour_references()
	
	def mettre_a_jour_references(self):
		"""
		Met à jour les références dans les tables enfant qui utilisent ce document.
		"""
		# Rechercher toutes les tables Documents Legaux Importation qui référencent ce document
		docs_legaux = frappe.get_all(
			"Documents Legaux Importation",
			filters={
				"lien_doctype": "Document Legal",
				"document": self.name
			},
			fields=["name", "parent"]
		)
		
		# Mettre à jour le statut dans chaque référence
		for doc in docs_legaux:
			frappe.db.set_value("Documents Legaux Importation", doc.name, "statut", self.statut)
			
			# Notifier le parent qu'il y a eu une mise à jour
			if doc.parent:
				frappe.db.set_value("Dossier Importation", doc.parent, "modified", nowdate())