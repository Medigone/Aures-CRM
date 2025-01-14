from frappe.model.naming import make_autoname
import frappe

def custom_item_naming(doc, method):
    if doc.item_group == "Produits":  # Vérifie si le groupe d'article est 'Produits'
        if doc.custom_client:  # Vérifie si un client est lié
            customer_id = frappe.get_value("Customer", doc.custom_client, "name")  # Récupère l'ID du client
            if not customer_id:
                frappe.throw("Le champ Client est invalide ou vide.")
            # Générer le code au format CLI-0001-0001
            doc.name = make_autoname(f"{customer_id}-.####")
        else:
            frappe.throw("Veuillez sélectionner un client pour générer un code Item.")
   
