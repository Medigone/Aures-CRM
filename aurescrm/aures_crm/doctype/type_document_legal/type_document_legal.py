# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class TypeDocumentLegal(Document):
	"""
	DocType pour définir les différents types de documents légaux.
	Permet de catégoriser les documents et de définir leurs propriétés communes.
	"""
	
	def validate(self):
		"""
		Validation des données du type de document légal.
		"""
		# Vérifier que la durée de validité est positive si elle est définie
		if self.duree_validite and self.duree_validite < 0:
			frappe.throw("La durée de validité doit être positive ou nulle.")
			
		# Si la durée est 0, cela signifie que le document n'a pas de date d'expiration
		if self.duree_validite == 0:
			self.unite_duree = "Jours"  # Valeur par défaut