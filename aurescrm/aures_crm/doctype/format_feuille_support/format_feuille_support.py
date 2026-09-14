# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import cint, flt


class FormatFeuilleSupport(Document):
	"""Palette (laize × depl imposés) ou bobine (laize fixe, depl optionnel = max de coupe)."""

	def validate(self):
		if flt(self.laize) <= 0:
			frappe.throw("La laize doit être strictement positive.")
		if not cint(self.bobine) and flt(self.depl) <= 0:
			frappe.throw("Le déplacement est obligatoire pour une palette.")
