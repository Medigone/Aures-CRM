# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import today


class BAT(Document):
	def autoname(self):
		# Format: BAT-{code article}-{date}-V{version}
		date_str = today()
		# Supprimer 'CLI' de self.article
		article_without_cli = self.article.replace('CLI-', '')
		# Base name sans version
		base_name = f"BAT-{article_without_cli}-{date_str}"
		
		# Trouver la dernière version pour cet article à cette date
		version = 1
		while frappe.db.exists('BAT', f"{base_name}-V{version}"):
			version += 1
		
		# Construire le nom final avec la version
		self.name = f"{base_name}-V{version}"

	def validate(self):
		if self.status == 'BAT-P Validé':
			# Vérifier s'il existe déjà un BAT validé pour cet article
			existing_bat = frappe.db.exists({
				'doctype': 'BAT',
				'article': self.article,
				'status': 'BAT-P Validé',
				'name': ['!=', self.name]  # Exclure le document actuel
			})
			if existing_bat:
				frappe.throw(_("Un BAT est déjà validé pour cet article. Veuillez d'abord marquer l'ancien BAT comme obsolète."))

	# You can add other methods like validate, before_save, etc. here if needed
	pass
