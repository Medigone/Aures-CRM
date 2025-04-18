# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class Maquette(Document):
    def validate(self):
        if self.is_new() or self.status != 'Référencée':
            self.nom_reference_par = ''

    @frappe.whitelist()
    def set_status_referenced(self):
        if self.status == "En attente":
            self.status = "Référencée"
            self.nom_reference_par = frappe.session.user
            self.save()
            return True
        return False
