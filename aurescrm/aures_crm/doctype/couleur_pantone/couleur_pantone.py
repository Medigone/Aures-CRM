# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import re

import frappe
from frappe import _
from frappe.model.document import Document

from aurescrm.pantone import normalize_code


class CouleurPantone(Document):
	"""Une référence Pantone et sa couleur d'écran, indicative : le nuancier imprimé fait foi."""

	def before_naming(self):
		self.code = normalize_code(self.code)

	def validate(self):
		self.hex = (self.hex or "").strip().lower()
		if not re.fullmatch(r"#[0-9a-f]{6}", self.hex):
			frappe.throw(_("La couleur doit être au format #RRGGBB."))
