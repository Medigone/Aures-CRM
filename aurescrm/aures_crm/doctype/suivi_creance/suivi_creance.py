# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class SuiviCreance(Document):
    def after_insert(self):
        """Appelé automatiquement après l'insertion d'un nouveau document"""
        self.recuperer_factures_impayees()
    
    def validate(self):
        """Appelé avant l'enregistrement du document"""
        self.calculer_pourcentage_recouvrement()
    
    def calculer_pourcentage_recouvrement(self):
        """Calcule le pourcentage de recouvrement"""
        if self.montant_tot_du and self.montant_tot_du > 0:
            self.pourcentage_recouvrement = (self.montant_payement or 0) / self.montant_tot_du * 100
        else:
            self.pourcentage_recouvrement = 0
    
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
    
    @frappe.whitelist()
    def generer_ecritures_paiement(self):
        """Génère une écriture de paiement pour le montant total avec les références des factures"""
        if not self.type_paiement:
            frappe.throw("Veuillez d'abord saisir un paiement avant de générer les écritures")
            
        # Récupérer les initiales de la société
        company = frappe.defaults.get_user_default("company")
        company_abbr = frappe.get_cached_value("Company", company, "abbr")
        
        # Convertir 'Espèce' en 'Espèces'
        mode_of_payment = "Espèces" if self.type_paiement == "Espèce" else self.type_paiement
        
        # Vérifier s'il y a des paiements à traiter
        lignes_avec_paiement = [row for row in self.factures if row.montant_paiement > 0]
        if not lignes_avec_paiement:
            frappe.throw("Aucun montant de paiement n'a été saisi")
            
        # Calculer le montant total du paiement
        montant_total = sum(row.montant_paiement for row in lignes_avec_paiement)
        
        # Créer une seule écriture de paiement
        payment_entry = frappe.get_doc({
            "doctype": "Payment Entry",
            "payment_type": "Receive",
            "party_type": "Customer",
            "party": self.id_client,
            "posting_date": frappe.utils.today(),
            "paid_amount": montant_total,
            "received_amount": montant_total,
            "target_exchange_rate": 1,
            "paid_to": f"1110 - Espèces - {company_abbr}",
            "paid_from": f"1310 - Débiteurs - {company_abbr}",
            "mode_of_payment": mode_of_payment,
            "reference_no": self.n_doc if self.n_doc else "",
            "reference_date": self.date_doc_payement if self.date_doc_payement else frappe.utils.today(),
            "references": [
                {
                    "reference_doctype": "Sales Invoice",
                    "reference_name": row.facture,
                    "allocated_amount": row.montant_paiement
                }
                for row in lignes_avec_paiement
            ]
        })
        
        payment_entry.insert(ignore_permissions=True)
        
        # Mettre à jour le champ ecr_paiement avec l'ID de l'écriture générée
        self.ecr_paiement = payment_entry.name
        self.save(ignore_permissions=True)
        
        montant_formate = frappe.format_value(montant_total, "Currency", currency="DZD")
        frappe.msgprint(f"Écriture de paiement créée pour un montant total de <strong>{montant_formate}</strong>")
