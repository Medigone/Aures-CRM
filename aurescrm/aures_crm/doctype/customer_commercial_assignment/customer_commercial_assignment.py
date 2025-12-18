# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class CustomerCommercialAssignment(Document):
    def validate(self):
        """Valider qu'il n'y a qu'un seul commercial principal par société"""
        if self.is_principal:
            # Vérifier s'il existe déjà un autre commercial principal pour cette société
            existing_principal = frappe.db.exists(
                "Customer Commercial Assignment",
                {
                    "parent": self.parent,
                    "parenttype": "Customer",
                    "parentfield": "custom_commercial_assignments",
                    "company": self.company,
                    "is_principal": 1,
                    "name": ["!=", self.name]
                }
            )
            
            if existing_principal:
                frappe.throw(
                    f"Un commercial principal existe déjà pour la société {self.company}. "
                    "Décochez d'abord l'autre commercial principal."
                )

