# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import getdate, now_datetime, get_datetime


class VisiteEntrepot(Document):
	def autoname(self):
		"""Générer automatiquement le nom du document"""
		from frappe.model.naming import make_autoname
		self.name = make_autoname("VE-.YYYY.-.#####")
	
	def validate(self):
		"""Validations avant sauvegarde"""
		# Vérifier que le visiteur est renseigné
		if not self.visiteur:
			frappe.throw("Le visiteur est obligatoire.")
		
		# Vérifier que la date de visite n'est pas dans le futur pour un statut "Terminé"
		if self.status == "Terminé" and self.date_visite:
			date_visite = getdate(self.date_visite)
			date_aujourdhui = getdate()
			if date_visite > date_aujourdhui:
				frappe.msgprint(
					"La date de visite ne peut pas être dans le futur pour une visite terminée.",
					indicator="orange",
					alert=True
				)
		
		# Vérifier que la date de visite est renseignée
		if not self.date_visite:
			frappe.throw("La date de visite est obligatoire.")

