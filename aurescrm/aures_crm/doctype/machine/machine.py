import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, flt


class Machine(Document):
	def validate(self):
		self.set_defaults()
		self.set_is_active_from_status()
		self.set_total_couleurs()
		if self.type_equipement == "Presse Offset":
			self.validate_format_dimensions()
			self.validate_grammage()

	def set_defaults(self):
		if not self.methode_calcul_devis:
			self.methode_calcul_devis = "Forfait + coût par 1000"
		if not self.unite_production:
			self.unite_production = "Feuille"
		if self.nombre_operateurs is None:
			self.nombre_operateurs = 1

	def set_total_couleurs(self):
		self.total_couleurs = cint(self.nb_couleurs_recto) + cint(self.nb_couleurs_verso)

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

	def validate_grammage(self):
		if flt(self.grammage_min) and flt(self.grammage_max):
			if flt(self.grammage_min) > flt(self.grammage_max):
				frappe.throw(
					_("Le grammage minimum ({0}) ne peut pas dépasser le grammage maximum ({1})").format(
						self.grammage_min, self.grammage_max
					)
				)
