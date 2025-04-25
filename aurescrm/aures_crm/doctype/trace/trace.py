# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Trace(Document):
	def validate(self):
		self.validate_unique_article()
		
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
