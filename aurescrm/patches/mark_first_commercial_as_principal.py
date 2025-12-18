# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

"""
Patch pour marquer le premier commercial de chaque société comme principal
pour les données existantes qui n'ont pas encore de commercial principal défini.
"""

import frappe


def execute():
    """
    Pour chaque Customer avec des attributions commerciales,
    marquer le premier commercial de chaque société comme principal si aucun n'est déjà principal.
    """
    # Récupérer tous les Customers qui ont des attributions
    customers_with_assignments = frappe.db.sql("""
        SELECT DISTINCT parent
        FROM `tabCustomer Commercial Assignment`
        WHERE parenttype = 'Customer'
          AND parentfield = 'custom_commercial_assignments'
    """, pluck="parent")
    
    if not customers_with_assignments:
        frappe.logger("patches").info("Aucun Customer avec attributions commerciales trouvé")
        return
    
    updated = 0
    
    for customer_name in customers_with_assignments:
        # Récupérer toutes les attributions groupées par société
        assignments_by_company = frappe.db.sql("""
            SELECT name, company, commercial, is_principal
            FROM `tabCustomer Commercial Assignment`
            WHERE parent = %s
              AND parenttype = 'Customer'
              AND parentfield = 'custom_commercial_assignments'
            ORDER BY company, creation asc
        """, (customer_name,), as_dict=True)
        
        # Grouper par société
        companies = {}
        for assignment in assignments_by_company:
            company = assignment.company
            if company not in companies:
                companies[company] = []
            companies[company].append(assignment)
        
        # Pour chaque société, vérifier s'il y a déjà un principal
        for company, assignments in companies.items():
            has_principal = any(a.get("is_principal") for a in assignments)
            
            # Si pas de principal, marquer le premier comme principal
            if not has_principal and assignments:
                first_assignment = assignments[0]
                frappe.db.set_value(
                    "Customer Commercial Assignment",
                    first_assignment.name,
                    "is_principal",
                    1
                )
                updated += 1
    
    frappe.db.commit()
    
    frappe.logger("patches").info(
        f"Patch terminée: {updated} commerciaux marqués comme principaux"
    )

