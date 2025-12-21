# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

"""
Patch pour synchroniser le commercial du champ legacy custom_commercial_attribué 
vers la table enfant custom_commercial_assignments et le marquer comme principal.
Si custom_commercial_attribué est vide, laisse la table vide.
"""

import frappe


def execute():
    """
    Pour chaque Customer:
    - Si custom_commercial_attribué est rempli: 
      - Ajouter dans la table enfant pour la société par défaut (ou première société)
      - Marquer comme principal (is_principal=1)
    - Si custom_commercial_attribué est vide:
      - S'assurer que la table enfant est vide (ou ne rien faire si déjà vide)
    """
    # Sécurité: ne rien faire si le DocType cible n'existe pas encore
    if not frappe.db.exists("DocType", "Customer Commercial Assignment"):
        frappe.log_error(
            "DocType 'Customer Commercial Assignment' n'existe pas",
            "Sync Legacy Commercial to Child Table"
        )
        return
    
    # Vérifier que le champ table existe sur Customer
    if not frappe.db.has_column("Customer", "custom_commercial_assignments"):
        frappe.log_error(
            "Champ 'custom_commercial_assignments' n'existe pas sur Customer",
            "Sync Legacy Commercial to Child Table"
        )
        return
    
    # Récupérer toutes les Companies
    companies = frappe.get_all("Company", pluck="name")
    if not companies:
        frappe.log_error(
            "Aucune Company trouvée",
            "Sync Legacy Commercial to Child Table"
        )
        return
    
    # Utiliser la première société comme société par défaut
    default_company = companies[0]
    if len(companies) > 1:
        frappe.logger("patches").warning(
            f"Plusieurs sociétés trouvées ({len(companies)}). Utilisation de: {default_company}"
        )
    
    # Récupérer tous les Customers
    customers = frappe.db.sql("""
        SELECT name, custom_commercial_attribué, custom_nom_commercial
        FROM `tabCustomer`
    """, as_dict=True)
    
    if not customers:
        frappe.logger("patches").info("Aucun Customer trouvé")
        return
    
    added = 0
    updated_to_principal = 0
    cleared = 0
    skipped = 0
    errors = []
    
    for customer in customers:
        customer_name = customer.name
        legacy_commercial = customer.custom_commercial_attribué
        legacy_commercial_name = customer.custom_nom_commercial
        
        try:
            # Charger le Customer
            doc = frappe.get_doc("Customer", customer_name)
            
            # Récupérer les attributions existantes pour la société par défaut
            existing_assignments = [
                row for row in doc.get("custom_commercial_assignments", [])
                if row.get("company") == default_company
            ]
            
            # Cas 1: custom_commercial_attribué est rempli
            if legacy_commercial:
                # Vérifier si le commercial existe
                if not frappe.db.exists("User", legacy_commercial):
                    errors.append(f"{customer_name}: User '{legacy_commercial}' inexistant")
                    skipped += 1
                    continue
                
                # Récupérer le nom complet si nécessaire
                if not legacy_commercial_name:
                    legacy_commercial_name = frappe.db.get_value(
                        "User", legacy_commercial, "full_name"
                    ) or frappe.get_fullname(legacy_commercial)
                
                # Chercher si ce commercial existe déjà dans la table pour cette société
                existing_assignment = None
                for row in existing_assignments:
                    if row.get("commercial") == legacy_commercial:
                        existing_assignment = row
                        break
                
                if existing_assignment:
                    # Mettre à jour pour marquer comme principal
                    if not existing_assignment.get("is_principal"):
                        existing_assignment.is_principal = 1
                        existing_assignment.commercial_name = legacy_commercial_name
                        doc.save(ignore_permissions=True)
                        updated_to_principal += 1
                    else:
                        skipped += 1
                else:
                    # Ajouter le commercial dans la table enfant et marquer comme principal
                    # S'assurer qu'il n'y a qu'un seul principal pour cette société
                    for row in existing_assignments:
                        if row.get("is_principal"):
                            row.is_principal = 0
                    
                    doc.append("custom_commercial_assignments", {
                        "company": default_company,
                        "commercial": legacy_commercial,
                        "commercial_name": legacy_commercial_name,
                        "is_principal": 1
                    })
                    doc.save(ignore_permissions=True)
                    added += 1
            
            # Cas 2: custom_commercial_attribué est vide
            else:
                # Supprimer toutes les attributions pour la société par défaut
                if existing_assignments:
                    for assignment in existing_assignments:
                        doc.remove(assignment)
                    doc.save(ignore_permissions=True)
                    cleared += 1
                else:
                    skipped += 1
        
        except Exception as e:
            errors.append(f"{customer_name}: {str(e)[:100]}")
            frappe.log_error(
                f"Erreur lors du traitement de {customer_name}: {str(e)}",
                "Sync Legacy Commercial to Child Table"
            )
    
    frappe.db.commit()
    
    # Log du résultat
    log_message = f"""
Synchronisation Legacy Commercial vers Child Table terminée:
- Company par défaut: {default_company}
- Ajoutés: {added}
- Mis à jour comme principal: {updated_to_principal}
- Tableaux vidés: {cleared}
- Ignorés: {skipped}
- Erreurs: {len(errors)}
"""
    
    if errors:
        log_message += "\nDétail des erreurs:\n" + "\n".join(errors[:20])
        if len(errors) > 20:
            log_message += f"\n... et {len(errors) - 20} autres erreurs"
    
    frappe.logger("patches").info(log_message)
    
    if errors:
        frappe.log_error(log_message, "Sync Legacy Commercial to Child Table - Erreurs")

