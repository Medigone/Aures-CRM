# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.model.naming import make_autoname
from frappe.utils import today


class TicketCommercial(Document):
    def autoname(self):
        """Génère le nom du ticket au format TC-YY-MM-#####"""
        self.name = make_autoname("TC-.YY.-.MM.-.#####")

    def before_insert(self):
        """Définit les valeurs par défaut avant l'insertion"""
        if not self.commercial:
            self.commercial = frappe.session.user

    def validate(self):
        """Validations avant sauvegarde"""
        self.validate_required_fields()
        self.set_defaults()

    def validate_required_fields(self):
        """Vérifie les champs requis"""
        if not self.customer:
            frappe.throw(_("Le champ Client est obligatoire"))
        
        if not self.request_type:
            frappe.throw(_("Le champ Type de demande est obligatoire"))
        
        if not self.priority:
            frappe.throw(_("Le champ Priorité est obligatoire"))

    def set_defaults(self):
        """Définit les valeurs par défaut"""
        if not self.owner_user:
            self.owner_user = frappe.session.user
        
        if not self.creation_date:
            self.creation_date = today()
        
        # Définir le commercial avec l'utilisateur créateur si non renseigné
        if not self.commercial:
            self.commercial = frappe.session.user
