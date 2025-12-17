# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.model.naming import make_autoname
from frappe.utils import getdate, today


class TicketCommercial(Document):
    def autoname(self):
        """Génère le nom du ticket au format TC-YY-MM-#####"""
        self.name = make_autoname("TC-.YY.-.MM.-.#####")

    def validate(self):
        """Validations avant sauvegarde"""
        self.validate_due_date()

    def validate_due_date(self):
        """Vérifie que l'échéance n'est pas dans le passé pour les tickets actifs"""
        if self.due_date and self.status in ("Nouveau", "En cours"):
            if getdate(self.due_date) < getdate(today()):
                frappe.msgprint(
                    _("L'échéance est dans le passé. Vérifiez la date si nécessaire."),
                    indicator="orange",
                    alert=True
                )
