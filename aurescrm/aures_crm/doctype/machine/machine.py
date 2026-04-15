import frappe
from frappe import _
from frappe.model.document import Document


class Machine(Document):
	def validate(self):
		self.set_is_active_from_status()
		if self.type_equipement == "Presse Offset":
			self.validate_format_dimensions()

	def set_is_active_from_status(self):
		self.is_active = 1 if self.status == "Operationnelle" else 0

	def validate_format_dimensions(self):
		if self.format_max_laize and self.format_min_laize:
			if self.format_min_laize > self.format_max_laize:
				frappe.throw(
					_("Le format min laize ({0}) ne peut pas dépasser le format max laize ({1})").format(
						self.format_min_laize, self.format_max_laize
					)
				)

		if self.format_max_developpement and self.format_min_developpement:
			if self.format_min_developpement > self.format_max_developpement:
				frappe.throw(
					_("Le format min développement ({0}) ne peut pas dépasser le format max développement ({1})").format(
						self.format_min_developpement, self.format_max_developpement
					)
				)
