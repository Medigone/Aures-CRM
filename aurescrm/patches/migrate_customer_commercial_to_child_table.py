# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

"""
Patch de migration: copie custom_commercial_attribué vers la table enfant Customer Commercial Assignment.
Cette patch ne s'exécute qu'une seule fois (gérée par Frappe).
"""

import frappe


def execute():
    """
    Migration idempotente des attributions commerciales legacy vers la table enfant.
    - Détecte l'unique Company existante (ou la première si plusieurs)
    - Pour chaque Customer avec custom_commercial_attribué renseigné:
      - Crée une ligne dans la table enfant si elle n'existe pas déjà
    """
    # Sécurité: ne rien faire si le DocType cible n'existe pas encore
    if not frappe.db.exists("DocType", "Customer Commercial Assignment"):
        frappe.log_error(
            "DocType 'Customer Commercial Assignment' n'existe pas",
            "Migration Commercial Assignment"
        )
        return
    
    # Vérifier que le champ table existe sur Customer
    if not frappe.db.has_column("Customer", "custom_commercial_assignments"):
        frappe.log_error(
            "Champ 'custom_commercial_assignments' n'existe pas sur Customer",
            "Migration Commercial Assignment"
        )
        return
    
    # Récupérer les Companies
    companies = frappe.get_all("Company", pluck="name")
    if not companies:
        frappe.log_error(
            "Aucune Company trouvée",
            "Migration Commercial Assignment"
        )
        return
    
    target_company = companies[0]
    if len(companies) > 1:
        frappe.logger("patches").warning(
            f"Plusieurs sociétés trouvées ({len(companies)}). Migration pour: {target_company}"
        )
    
    # Récupérer les Customers avec un commercial attribué (champ legacy)
    customers = frappe.db.sql("""
        SELECT name, custom_commercial_attribué, custom_nom_commercial
        FROM `tabCustomer`
        WHERE custom_commercial_attribué IS NOT NULL
          AND custom_commercial_attribué != ''
    """, as_dict=True)
    
    if not customers:
        frappe.logger("patches").info("Aucun Customer avec commercial attribué à migrer")
        return
    
    migrated = 0
    skipped = 0
    errors = []
    
    for customer in customers:
        customer_name = customer.name
        commercial = customer.custom_commercial_attribué
        commercial_name = customer.custom_nom_commercial
        
        # Vérifier si une attribution existe déjà pour cette company (idempotence)
        exists = frappe.db.exists(
            "Customer Commercial Assignment",
            {
                "parent": customer_name,
                "parenttype": "Customer",
                "parentfield": "custom_commercial_assignments",
                "company": target_company
            }
        )
        
        if exists:
            skipped += 1
            continue
        
        # Vérifier que le commercial (User) existe
        if not frappe.db.exists("User", commercial):
            errors.append(f"{customer_name}: User '{commercial}' inexistant")
            continue
        
        try:
            # Charger le Customer et ajouter l'attribution
            doc = frappe.get_doc("Customer", customer_name)
            doc.append("custom_commercial_assignments", {
                "company": target_company,
                "commercial": commercial,
                "commercial_name": commercial_name or frappe.db.get_value("User", commercial, "full_name")
            })
            doc.save(ignore_permissions=True)
            migrated += 1
        except Exception as e:
            errors.append(f"{customer_name}: {str(e)[:100]}")
    
    frappe.db.commit()
    
    # Log du résultat
    log_message = f"""
Migration Commercial Assignments terminée:
- Company cible: {target_company}
- Migrés: {migrated}
- Ignorés (déjà existants): {skipped}
- Erreurs: {len(errors)}
"""
    
    if errors:
        log_message += "\nDétail des erreurs:\n" + "\n".join(errors[:20])
        if len(errors) > 20:
            log_message += f"\n... et {len(errors) - 20} autres erreurs"
    
    frappe.logger("patches").info(log_message)
    
    if errors:
        frappe.log_error(log_message, "Migration Commercial Assignment - Erreurs")

