# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import today


class BAT(Document):
	def autoname(self):
		# Format: BAT-{code article}-{date}
		date_str = today().replace("-", "")
		self.name = f"BAT-{self.article}-{date_str}"

	# You can add other methods like validate, before_save, etc. here if needed
	pass
