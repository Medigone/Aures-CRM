from frappe.model.naming import make_autoname
import frappe
import re

def custom_item_naming(doc, method):
    if doc.item_group == "Produits":  # Vérifie si le groupe d'article est 'Produits'
        if doc.custom_client:  # Vérifie si un client est lié
            # Récupère l'ID du client
            customer_id = frappe.get_value("Customer", doc.custom_client, "name")
            if not customer_id:
                frappe.throw("Le champ Client est invalide ou vide.")
            
            # Récupérer tous les articles existants pour ce client
            existing_items = frappe.get_all(
                "Item",
                filters={"custom_client": doc.custom_client},
                fields=["name"],
                order_by="name desc"
            )
            
            # Déterminer le plus grand numéro utilisé
            max_number = 0
            pattern = re.compile(rf"^{customer_id}-(\d+)$")  # Cherche des noms au format CLIENT-001
            
            for item in existing_items:
                match = pattern.match(item["name"])
                if match:
                    num = int(match.group(1))
                    max_number = max(max_number, num)
            
            # Génère le prochain numéro disponible
            next_number = f"{max_number + 1:03}"  # Format 001, 002, etc.
            
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


import frappe

def format_item_fields(doc, method):
    """
    - Convertit `item_code` en majuscules.
    - Génère automatiquement `item_name` à partir de `item_code`.
    """
    if doc.item_code:
        doc.item_code = doc.item_code.upper()

        # Générer automatiquement item_name basé sur item_code
        doc.item_name = doc.item_code  # `item_name` sera toujours égal à `item_code`
