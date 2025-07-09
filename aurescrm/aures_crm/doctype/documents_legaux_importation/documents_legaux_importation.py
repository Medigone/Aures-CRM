# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class DocumentsLegauxImportation(Document):
	"""
	Table enfant pour gérer les documents légaux importation.
	Utilise le DocType Document Legal pour centraliser la gestion des documents légaux.
	"""
	
	def validate(self):
		"""
	Validation des données et synchronisation avec le document légal lié.
	"""
		self.sync_document_legal_data()
	
	def sync_document_legal_data(self):
		"""
		Synchronise les données avec le document légal lié.
		Les champs sont automatiquement synchronisés via les fetch_from,
		mais cette méthode permet de s'assurer que tout est à jour.
		"""
		if self.document_legal:
			try:
				# Récupération du document légal lié
				doc_legal = frappe.get_doc("Document Legal", self.document_legal)
				
				# Mise à jour des champs (bien que cela soit fait automatiquement par fetch_from)
				self.type_document = doc_legal.type_document
				self.reference = doc_legal.reference
				self.statut = doc_legal.statut
				
			except frappe.DoesNotExistError:
				frappe.msgprint(f"Le document légal {self.document_legal} n'existe pas.", alert=True)
				# Réinitialiser les champs
				self.type_document = ""
				self.reference = ""
				self.statut = "Document non trouvé"
			except Exception as e:
				frappe.log_error(f"Erreur lors de la synchronisation avec le document légal: {str(e)}", "Documents Legaux Importation")
				self.statut = "Erreur"
		else:
			# Si aucun document légal n'est sélectionné, réinitialiser les champs
			self.type_document = ""
			self.reference = ""
			self.statut = ""
