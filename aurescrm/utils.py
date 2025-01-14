from frappe.model.naming import make_autoname
import frappe

def custom_item_naming(doc, method):
    if doc.item_group == "Produits":  # Vérifie si le groupe d'article est 'Produits'
        if doc.custom_client:  # Vérifie si un client est lié
            # Récupère l'ID du client
            customer_id = frappe.get_value("Customer", doc.custom_client, "name")
            if not customer_id:
                frappe.throw("Le champ Client est invalide ou vide.")
            
            # Compte le nombre d'articles existants pour ce client
            existing_count = frappe.db.count("Item", filters={"custom_client": doc.custom_client})
            
            # Génère le compteur pour ce client
            next_number = f"{existing_count + 1:03}"  # Format 001, 002, etc.
            
            # Génère le nom complet
            doc.name = f"{customer_id}-{next_number}"
        else:
            frappe.throw("Veuillez sélectionner un client pour générer un code Item.")
