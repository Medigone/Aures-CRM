import frappe

def uppercase_customer_name(doc, method):
    # Vérifier que le champ 'customer_name' existe et n'est pas vide
    if doc.customer_name:
        # Convertir le nom en majuscules
        doc.customer_name = doc.customer_name.upper()

def set_default_commercial(doc, method):
    if not doc.custom_commercial_attribué:  # Si le champ est vide
        doc.custom_commercial_attribué = doc.owner  # Définir l'utilisateur créateur
        
        # Récupérer le nom complet de l'utilisateur créateur
        full_name = frappe.db.get_value("User", doc.owner, "full_name") or frappe.utils.get_fullname(doc.owner)
        
        # Mettre à jour le champ 'custom_nom_commercial' avec le full name du créateur
        doc.custom_nom_commercial = full_name

        # Mise à jour explicite pour éviter les erreurs de permission
        frappe.db.set_value("Customer", doc.name, {
            "custom_commercial_attribué": doc.owner,
            "custom_nom_commercial": full_name
        }, update_modified=True)
