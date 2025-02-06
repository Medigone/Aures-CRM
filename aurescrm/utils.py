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


def custom_delivery_address_naming(doc, method):
    """
    Génère automatiquement le nom de l'adresse de livraison en fonction du client associé.
    Le format sera : <ID_Client>-<numéro séquentiel (format 001, 002, ...)>
    """
    # N'effectuer le renommage que pour les documents nouveaux
    if not doc.get("__islocal"):
        return

    if doc.client:
        # Récupère l'ID du client (le champ client est un lien vers Customer)
        customer_id = frappe.get_value("Customer", doc.client, "name")
        if not customer_id:
            frappe.throw("Le champ Client est invalide ou vide.")
        
        # Compte le nombre d'adresses existantes pour ce client
        existing_count = frappe.db.count("Adresses de livraison", filters={"client": doc.client})
        
        # Génère le compteur pour ce client (format : 001, 002, etc.)
        next_number = f"{existing_count + 1:03}"
        
        # Construit le nom complet
        doc.name = f"{customer_id}-{next_number}"
    else:
        frappe.throw("Veuillez sélectionner un client pour générer un code pour l'adresse de livraison.")
