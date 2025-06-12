# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import today


class BAT(Document):
	def autoname(self):
		# Format: BAT-{code article}-{date}
		date_str = today()
		# Supprimer 'CLI' de self.article
		article_without_cli = self.article.replace('CLI-', '')
		self.name = f"BAT-{article_without_cli}-{date_str}"

	# You can add other methods like validate, before_save, etc. here if needed
	pass
