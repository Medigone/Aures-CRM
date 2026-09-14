# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class SupportTechnique(Document):
	"""Caractéristiques techniques d'un couple support / grammage.

	Alimente le moteur d'imposition : pont mini, prix à la tonne et formats
	palette / bobine disponibles sans refente.
	"""

	def validate(self):
		if frappe.db.exists(
			"Support Technique",
			{"support": self.support, "grammage": self.grammage, "name": ["!=", self.name]},
		):
			frappe.throw(
				f"Un support technique existe déjà pour {self.support} {self.grammage} g/m²."
			)


def get_support_technique(support, grammage):
	"""Support technique correspondant au couple support/grammage, ou None."""
	if not support or not grammage:
		return None
	name = frappe.db.get_value(
		"Support Technique",
		{"support": support, "grammage": grammage, "disabled": 0},
		"name",
	)
	return frappe.get_doc("Support Technique", name) if name else None
