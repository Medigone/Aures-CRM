# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate

from aurescrm.pilotage_commercial_kpi import refresh_pilotage_kpis


class PilotageCommercial(Document):
	def validate(self):
		if self.manager_user and self.user and self.manager_user == self.user:
			frappe.throw(_("Le responsable hiérarchique ne peut pas être le même que l'utilisateur."))

		if self.user:
			enabled = frappe.db.get_value("User", self.user, "enabled")
			if enabled == 0:
				frappe.throw(_("L'utilisateur sélectionné est désactivé."))

		if self.record_status == "Actif":
			for field, label in (
				(self.commercial_department, _("Département commercial")),
				(self.profile_category, _("Catégorie de profil")),
				(self.commercial_type, _("Type de commercial")),
				(self.portfolio_orientation, _("Orientation portefeuille")),
			):
				if not field:
					frappe.throw(
						_("Pour une fiche active, le champ {0} est obligatoire.").format(label)
					)

		self._validate_target_overlaps()

	def before_save(self):
		if self.user:
			self.display_name = frappe.db.get_value("User", self.user, "full_name") or self.user

	def _validate_target_overlaps(self):
		rows = list(self.targets or [])
		for i, a in enumerate(rows):
			if not a.period_start or not a.period_end or not a.metric_code or not a.period_type:
				continue
			ps_a, pe_a = getdate(a.period_start), getdate(a.period_end)
			if ps_a > pe_a:
				frappe.throw(
					_("Ligne objectif {0}: la date de début est après la date de fin.").format(i + 1)
				)
			for j, b in enumerate(rows):
				if i >= j or not b.period_start or not b.period_end:
					continue
				if a.metric_code != b.metric_code or a.period_type != b.period_type:
					continue
				ps_b, pe_b = getdate(b.period_start), getdate(b.period_end)
				if ps_a <= pe_b and ps_b <= pe_a:
					frappe.throw(
						_(
							"Chevauchement d'objectifs pour la métrique {0} ({1})."
						).format(a.metric_code, a.period_type)
					)

	def recalculate_kpis(self, append_snapshot: bool = True):
		refresh_pilotage_kpis(self.name, append_snapshot=append_snapshot)


@frappe.whitelist()
def refresh_kpis(name: str, append_snapshot=1):
	"""Recalcul KPI + sauvegarde (bouton Desk)."""
	frappe.has_permission("Pilotage Commercial", "write", doc=name, throw=True)
	from frappe.utils import cint

	append = cint(append_snapshot)
	doc = frappe.get_doc("Pilotage Commercial", name)
	doc.recalculate_kpis(append_snapshot=bool(append))
	return {"ok": True, "name": doc.name}
