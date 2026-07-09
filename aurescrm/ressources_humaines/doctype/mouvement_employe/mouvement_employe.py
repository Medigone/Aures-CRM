# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class MouvementEmploye(Document):
	def validate(self):
		if self.employe and self.employe in (self.ancien_responsable, self.nouveau_responsable):
			frappe.throw(_("L'employé ne peut pas être son propre responsable."))
