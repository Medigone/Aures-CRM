# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Evenements(Document):
	pass

def validate(self):
    if self.date_fin < self.date_debut:
        frappe.throw("La Date Fin ne peut pas être antérieure à la Date Début")
