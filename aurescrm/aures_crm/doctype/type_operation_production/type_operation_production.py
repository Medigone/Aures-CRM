# Copyright (c) 2025, Aures and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class TypeOperationProduction(Document):
	def validate(self):
		"""Validation des champs uniques"""
		# Vérifier l'unicité du nom_type
		if self.nom_type:
			existing = frappe.db.exists("Type Operation Production", {
				"nom_type": self.nom_type,
				"name": ["!=", self.name]
			})
			if existing:
				frappe.throw(f"Un type d'opération avec le nom '{self.nom_type}' existe déjà")
		
		# Vérifier l'unicité du code
		if self.code:
			existing = frappe.db.exists("Type Operation Production", {
				"code": self.code,
				"name": ["!=", self.name]
			})
			if existing:
				frappe.throw(f"Un type d'opération avec le code '{self.code}' existe déjà")
	
	@frappe.whitelist()
	def get_operations_actives(self):
		"""Récupérer toutes les opérations actives de ce type"""
		return frappe.get_all("Operation Production",
			filters={
				"type_operation": self.name,
				"statut": ["in", ["Assignée", "En attente", "En cours", "En pause"]]
			},
			fields=["name", "nom_operation", "ordre_production", "statut", 
			        "operateur_assigne", "date_heure_prevue_debut", "workstation"],
			order_by="date_heure_prevue_debut asc"
		)

