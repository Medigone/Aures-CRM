# Copyright (c) 2025, Aures and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


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
		
		if self.client and not self.id_commercial:
			self.id_commercial = frappe.db.get_value("Customer", self.client, "custom_commercial_attribué")
		
		if self.id_commercial and not self.commercial:
			self.commercial = frappe.db.get_value("User", self.id_commercial, "full_name")

