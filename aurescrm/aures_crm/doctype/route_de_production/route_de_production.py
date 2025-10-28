# Copyright (c) 2025, AURES Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class RoutedeProduction(Document):
	def validate(self):
		"""Valider que les ordres d'étapes sont uniques"""
		ordres = [etape.ordre for etape in self.etapes]
		if len(ordres) != len(set(ordres)):
			frappe.throw("Les numéros d'ordre des étapes doivent être uniques")
		
		# Vérifier qu'il y a au moins une étape
		if not self.etapes:
			frappe.throw("La route de production doit contenir au moins une étape")
	
	def get_etapes_ordered(self):
		"""Retourner les étapes triées par ordre"""
		return sorted(self.etapes, key=lambda x: x.ordre)

