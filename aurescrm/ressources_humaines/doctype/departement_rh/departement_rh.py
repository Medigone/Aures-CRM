# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class DepartementRH(Document):
	def validate(self):
		self.validate_parent()

	def validate_parent(self):
		"""Empêcher un département d'être son propre parent (structure hiérarchique simple)."""
		if self.departement_parent and self.departement_parent == self.name:
			frappe.throw(_("Un département ne peut pas être son propre parent."))
