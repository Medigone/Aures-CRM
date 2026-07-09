# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class SiteRH(Document):
	def validate(self):
		self.validate_parent()

	def validate_parent(self):
		"""Empêcher un site d'être son propre parent ou de créer une boucle."""
		if not self.site_parent:
			return
		if self.site_parent == self.name:
			frappe.throw(_("Un site ne peut pas être son propre parent."))

		# Remonter la chaîne pour détecter une boucle (A → B → A).
		seen = {self.name}
		current = self.site_parent
		while current:
			if current in seen:
				frappe.throw(_("La hiérarchie des sites forme une boucle."))
			seen.add(current)
			current = frappe.db.get_value("Site RH", current, "site_parent")
