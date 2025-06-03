from frappe.model.naming import make_autoname
import frappe


def custom_item_naming(doc, method):
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



def format_item_fields(doc, method):
    """
    - Convertit `item_code` en majuscules.
    - Génère automatiquement `item_name` à partir de `item_code`.
    """
    if doc.item_code:
        doc.item_code = doc.item_code.upper()

        # Générer automatiquement item_name basé sur item_code
        doc.item_name = doc.item_code  # `item_name` sera toujours égal à `item_code`


def update_item_description(doc, method):
    """Met à jour la description de l'article en combinant plusieurs champs."""
    # Première ligne : informations de base
    base_info = []
    
    # Traiter chaque champ individuellement pour gérer le cas spécial du grammage
    if doc.item_code:
        base_info.append(str(doc.item_code))
    if doc.custom_support:
        base_info.append(str(doc.custom_support))
    if doc.custom_grammage:
        base_info.append(f"{doc.custom_grammage}Gr")
    if doc.custom_cotations_article:
        base_info.append(str(doc.custom_cotations_article))
    
    description = ' '.join(base_info) + '\n' if base_info else '\n'
    
    # Liste des champs à vérifier
    fields_to_check = [
        ('custom_acrylique', 'Acrylique'),
        ('custom_sélectif', 'Sélectif'),
        ('custom_uv', 'UV'),
        ('custom_drip_off', 'Drip-off'),
        ('custom_mat_gras', 'Mat gras'),
        ('custom_blister', 'Blister'),
        ('custom_recto_verso', 'Recto-verso'),
        ('custom_fenêtre', 'Fenêtre'),
        ('custom_braille', 'Braille'),
        ('custom_gaufrage__estampage', 'Gaufrage/Estampage'),
        ('custom_massicot', 'Massicot'),
        ('custom_collerette', 'Collerette'),
        ('custom_blanc_couvrant', 'Blanc couvrant')
    ]
    
    # Ajouter les étiquettes des champs qui ont la valeur 1
    additional_info = [label for field, label in fields_to_check if doc.get(field) == 1]
    if additional_info:
        description += ' | '.join(additional_info)
    
    # Mettre à jour la description
    doc.description = description


@frappe.whitelist()
def update_all_items_description():
    """Met à jour la description de tous les articles."""
    # Récupérer tous les articles
    items = frappe.get_all("Item", fields=["name"])
    count = 0
    
    for item in items:
        doc = frappe.get_doc("Item", item.name)
        update_item_description(doc, None)
        doc.save()
        count += 1
    
    return count
