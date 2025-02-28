from frappe.model.naming import make_autoname
import frappe


def custom_item_naming(doc, method):
    if doc.item_group == "Produits":
        if doc.custom_client:
            # Récupérer l'ID du client
            customer_id = frappe.get_value("Customer", doc.custom_client, "name")
            if not customer_id:
                frappe.throw("Le champ Client est invalide ou vide.")

            # Récupérer le dernier numéro utilisé pour ce client
            last_number = frappe.get_value("Customer", doc.custom_client, "custom_dernier_numéro_article") or 0

            # Incrémenter le compteur
            next_number = last_number + 1

            # Mettre à jour le dernier numéro utilisé dans le Doctype Customer
            frappe.db.set_value("Customer", doc.custom_client, "custom_dernier_numéro_article", next_number)

            # Générer le nom complet de l'article
            doc.name = f"{customer_id}-{next_number:03}"

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
