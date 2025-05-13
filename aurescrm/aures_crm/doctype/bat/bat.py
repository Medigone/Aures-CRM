# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class BAT(Document):
	def autoname(self):
		# Format: BAT-{client}-{article}-{etude_tech}
		self.name = f"BAT-{self.client}-{self.article}-{self.etude_tech}"

	# You can add other methods like validate, before_save, etc. here if needed
	pass
