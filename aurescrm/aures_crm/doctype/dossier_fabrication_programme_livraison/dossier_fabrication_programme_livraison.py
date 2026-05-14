# Copyright (c) 2026, AURES Technologies and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class DossierFabricationProgrammeLivraison(Document):
	def validate(self):
		# Rétrocompatibilité : anciennes lignes sans date de fabrication → recopier la livraison référence
		if not self.get("date_fabrication_prevue") and self.get("date_livraison"):
			self.date_fabrication_prevue = self.date_livraison
