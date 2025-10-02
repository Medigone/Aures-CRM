# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Trace(Document):
	def validate(self):
		self.validate_unique_article()
	
	def after_save(self):
		"""Met à jour les points de colle de l'Etude Faisabilite liée après sauvegarde"""
		self.update_etude_faisabilite_points_colle()
		
	def validate_unique_article(self):
		if self.article:
			existing_trace = frappe.db.exists("Trace", {
				"article": self.article,
				"name": ["!=", self.name]
			})
			
			if existing_trace:
				frappe.throw(
					msg=f"Cet article possède déjà un trace.",
					title="Article déjà tracé",
				)
	
	def update_etude_faisabilite_points_colle(self):
		"""Met à jour les points de colle dans toutes les Etudes Faisabilite liées à ce Trace"""
		# Trouver toutes les Etudes Faisabilite qui utilisent ce Trace
		etudes = frappe.get_all(
			"Etude Faisabilite",
			filters={"trace": self.name},
			fields=["name"]
		)
		
		# Mettre à jour les points_colle pour chaque étude trouvée
		for etude in etudes:
			frappe.db.set_value(
				"Etude Faisabilite",
				etude.name,
				"points_colle",
				self.points_colle or 0,
				update_modified=False
			)


@frappe.whitelist()
def sync_points_colle_to_etude(trace_name, etude_faisabilite_name):
	"""
	Synchronise les points de colle du Trace vers l'Etude Faisabilite
	Cette méthode est appelée depuis le JavaScript après création/mise à jour d'un Trace
	"""
	try:
		# Récupérer le Trace
		trace = frappe.get_doc("Trace", trace_name)
		
		# Mettre à jour l'Etude Faisabilite
		frappe.db.set_value(
			"Etude Faisabilite",
			etude_faisabilite_name,
			"points_colle",
			trace.points_colle or 0,
			update_modified=False
		)
		
		return {
			"success": True,
			"points_colle": trace.points_colle or 0
		}
	except Exception as e:
		frappe.log_error(message=str(e), title="Erreur sync_points_colle_to_etude")
		return {
			"success": False,
			"error": str(e)
		}
