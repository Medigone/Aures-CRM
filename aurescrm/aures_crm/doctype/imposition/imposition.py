# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Imposition(Document):
	def after_save(self):
		"""Met à jour le taux de chutes de l'Etude Faisabilite liée après sauvegarde"""
		self.update_etude_faisabilite_taux_chutes()
	
	def update_etude_faisabilite_taux_chutes(self):
		"""Met à jour le taux de chutes dans toutes les Etudes Faisabilite liées à cette Imposition"""
		# Trouver toutes les Etudes Faisabilite qui utilisent cette Imposition
		etudes = frappe.get_all(
			"Etude Faisabilite",
			filters={"imposition": self.name},
			fields=["name"]
		)
		
		# Mettre à jour le taux_chutes pour chaque étude trouvée
		for etude in etudes:
			frappe.db.set_value(
				"Etude Faisabilite",
				etude.name,
				"taux_chutes",
				self.taux_chutes or 0,
				update_modified=False
			)


@frappe.whitelist()
def sync_taux_chutes_to_etude(imposition_name, etude_faisabilite_name):
	"""
	Synchronise le taux de chutes de l'Imposition vers l'Etude Faisabilite
	Cette méthode est appelée depuis le JavaScript après création/mise à jour d'une Imposition
	"""
	try:
		# Récupérer l'Imposition
		imposition = frappe.get_doc("Imposition", imposition_name)
		
		# Mettre à jour l'Etude Faisabilite
		frappe.db.set_value(
			"Etude Faisabilite",
			etude_faisabilite_name,
			"taux_chutes",
			imposition.taux_chutes or 0,
			update_modified=False
		)
		
		return {
			"success": True,
			"taux_chutes": imposition.taux_chutes or 0
		}
	except Exception as e:
		frappe.log_error(message=str(e), title="Erreur sync_taux_chutes_to_etude")
		return {
			"success": False,
			"error": str(e)
		}
