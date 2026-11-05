# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import re

import frappe
from frappe import _
from frappe.model.document import Document

from aurescrm.pantone import normalize_code


class CouleurPantone(Document):
	"""Une référence Pantone et sa couleur d'écran, indicative : le nuancier imprimé fait foi."""

	def before_import(self):
		"""La fixture se réimporte à chaque migration : une ligne corrigée à la main garde ses valeurs."""
		current = frappe.db.get_value(self.doctype, self.name, ["hex", "source", "approximative"], as_dict=True)
		if current and current.source == "Manuel":
			self.update(current)

	def before_naming(self):
		self.code = normalize_code(self.code)

	def validate(self):
		self.hex = (self.hex or "").strip().lower()
		if not re.fullmatch(r"#[0-9a-f]{6}", self.hex):
			frappe.throw(_("La couleur doit être au format #RRGGBB."))
