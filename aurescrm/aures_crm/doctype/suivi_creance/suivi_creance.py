# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class SuiviCreance(Document):
    def after_insert(self):
        """Appelé automatiquement après l'insertion d'un nouveau document"""
        self.recuperer_factures_impayees()
    
    def recuperer_factures_impayees(self):
        """Récupère toutes les factures impayées pour le client sélectionné"""
        frappe.logger().debug(f"Début récupération factures pour client: {self.id_client}")
        
        if not self.id_client:
            frappe.logger().debug("Pas de client sélectionné")
            return
                
        factures = frappe.get_all(
            "Sales Invoice",
            filters={
                "customer": self.id_client,
                "docstatus": 1,
                "outstanding_amount": (">", 0)
            },
            fields=["name", "posting_date", "outstanding_amount"]
        )
        
        frappe.logger().debug(f"Factures trouvées: {len(factures)}")
        # Ajouter les factures à la table enfant
        for facture in factures:
            self.append("factures", {
                "facture": facture.name,
                "date": facture.posting_date,
                "montant_du": facture.outstanding_amount,
                "montant_paiement": 0
            })
        
        # Calculer le montant total dû
        self.montant_tot_du = sum(row.montant_du for row in self.factures)
        
        # Sauvegarder les modifications
        self.save(ignore_permissions=True)
