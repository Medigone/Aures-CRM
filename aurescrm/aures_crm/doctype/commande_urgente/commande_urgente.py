# Copyright (c) 2025, Aures and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from aurescrm.commercial_assignment import get_customer_commercial


class CommandeUrgente(Document):
	"""DocType pour suivre et analyser les commandes déclarées comme urgentes"""
	
	def autoname(self):
		"""Générer automatiquement le nom du document"""
		from frappe.model.naming import make_autoname
		self.name = make_autoname("CU-.YY.-.MM.-.#####")
	
	def validate(self):
		"""Validation du document"""
		# Auto-fetch des champs si nécessaire
		if self.client and not self.nom_client:
			self.nom_client = frappe.db.get_value("Customer", self.client, "customer_name")
		
		# Utiliser le module utilitaire pour récupérer le commercial (table enfant + fallback legacy)
		if self.client and not self.id_commercial:
			commercial_info = get_customer_commercial(self.client)
			self.id_commercial = commercial_info.get('commercial')
			self.commercial = commercial_info.get('commercial_name')
		elif self.id_commercial and not self.commercial:
			self.commercial = frappe.db.get_value("User", self.id_commercial, "full_name")

