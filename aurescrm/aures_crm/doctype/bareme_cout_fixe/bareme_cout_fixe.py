# Copyright (c) 2026, Aures Emballages and contributors
# For license information, please see license.txt

from frappe.model.document import Document
from frappe.utils import cint


class BaremeCoutFixe(Document):
	def validate(self):
		self._sync_status_from_is_active()

	def _sync_status_from_is_active(self):
		self.status = "Actif" if cint(self.is_active) else "Inactif"
