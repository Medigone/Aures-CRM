# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class DocumentsAchatImportation(Document):
	"""
	Table enfant pour gérer les documents d'achat importation.
	Récupère automatiquement le statut du document lié dynamiquement.
	"""
	
	def validate(self):
		"""
		Récupère et met à jour le statut du document lié dynamiquement.
		"""
		self.fetch_document_status()  
	
	def fetch_document_status(self):
		"""
		Récupère le statut du document référencé dans le champ dynamique.
		"""
		if self.lien_doctype and self.document:
			try:
				# Récupération du document lié
				doc = frappe.get_doc(self.lien_doctype, self.document)
				
				# Vérification si le document a un champ 'status' ou 'workflow_state'
				if hasattr(doc, 'status') and doc.status:
					self.statut = doc.status
				elif hasattr(doc, 'workflow_state') and doc.workflow_state:
					self.statut = doc.workflow_state
				elif hasattr(doc, 'docstatus'):
					# Conversion du docstatus en texte explicite
					if doc.docstatus == 0:
						self.statut = "Brouillon"
					elif doc.docstatus == 1:
						self.statut = "Soumis"
					elif doc.docstatus == 2:
						self.statut = "Annulé"
				else:
					self.statut = "Statut non disponible"
			except frappe.DoesNotExistError:
				self.statut = "Document non trouvé"
			except Exception as e:
				frappe.log_error(f"Erreur lors de la récupération du statut: {str(e)}", "Documents Achat Importation")
				self.statut = "Erreur"
		else:
			self.statut = ""
