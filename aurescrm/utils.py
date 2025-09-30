from frappe.model.naming import make_autoname
import frappe


def custom_item_naming(doc, method):
    """
    Génère automatiquement le nom de l'article selon le type d'article :
    - Type "Client" : <ID_Client>-<numéro séquentiel>
    - Type "Général" : ITEM-<numéro séquentiel>
    """
    if not doc.get("custom_type_article"):
        frappe.throw("Veuillez sélectionner un type d'article pour générer un code Item.")
    
    if doc.custom_type_article == "Client":
        # Articles spécifiques à un client
        if not doc.custom_client:
            frappe.throw("Veuillez sélectionner un client pour les articles de type 'Client'.")
        
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
        
    elif doc.custom_type_article == "Général":
        # Articles généraux (matières premières, consommables, etc.)
        doc.name = make_autoname("ITEM-.####")
        
    else:
        frappe.throw(f"Type d'article '{doc.custom_type_article}' non reconnu.")



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
    """Met à jour la description de l'article en combinant plusieurs champs organisés par sections."""
    # Debug: vérifier si la fonction est appelée
    frappe.logger().info(f"update_item_description appelée pour l'article: {doc.item_code}")
    
    # Informations de base (première ligne)
    base_info = []
    if doc.item_code:
        base_info.append(str(doc.item_code))
    if doc.custom_support and str(doc.custom_support).lower() != 'sans':
        base_info.append(str(doc.custom_support))
    if doc.custom_grammage and str(doc.custom_grammage).lower() != 'sans':
        base_info.append(f"{doc.custom_grammage}Gr")
    if doc.custom_cotations_article and str(doc.custom_cotations_article).lower() != 'sans':
        base_info.append(str(doc.custom_cotations_article))
    if doc.custom_notice and str(doc.custom_notice).lower() != 'pas de notice':
        base_info.append(str(doc.custom_notice))
    
    description_parts = []
    if base_info:
        description_parts.append(' '.join(base_info))
    
    # Section Offset
    offset_fields = []
    if doc.custom_impression and str(doc.custom_impression).lower() != 'sans':
        offset_fields.append(f"Impression: {doc.custom_impression}")
    if doc.custom_nbr_couleurs and str(doc.custom_nbr_couleurs).lower() != 'sans':
        offset_fields.append(f"Couleurs: {doc.custom_nbr_couleurs}")
    if doc.custom_pelliculage and str(doc.custom_pelliculage).lower() != 'sans':
        offset_fields.append(f"Pelliculage: {doc.custom_pelliculage}")
    if doc.custom_marquage_à_chaud and str(doc.custom_marquage_à_chaud).lower() != 'sans':
        offset_fields.append(f"Marquage à chaud: {doc.custom_marquage_à_chaud}")
    
    if offset_fields:
        description_parts.append("OFFSET: " + " | ".join(offset_fields))
    
    # Section Options Vernis
    vernis_fields = []
    if doc.custom_acrylique == 1:
        vernis_fields.append("Acrylique")
    if doc.custom_sélectif == 1:
        vernis_fields.append("Sélectif")
    if doc.custom_uv == 1:
        vernis_fields.append("UV")
    if doc.custom_drip_off == 1:
        vernis_fields.append("Drip-off")
    if doc.custom_mat_gras == 1:
        vernis_fields.append("Mat gras")
    if doc.custom_blister == 1:
        vernis_fields.append("Blister")
    
    if vernis_fields:
        description_parts.append("OPTIONS VERNIS: " + " | ".join(vernis_fields))
    
    # Section Finition Offset
    finition_fields = []
    if doc.custom_recto_verso == 1:
        finition_fields.append("Recto-verso")
    if doc.custom_fenêtre == 1:
        finition_fields.append("Fenêtre")
    if doc.custom_braille == 1:
        finition_fields.append("Braille")
    if doc.custom_gaufrage__estampage == 1:
        finition_fields.append("Gaufrage/Estampage")
    if doc.custom_massicot == 1:
        finition_fields.append("Massicot")
    if doc.custom_collerette == 1:
        finition_fields.append("Collerette")
    if doc.custom_blanc_couvrant == 1:
        finition_fields.append("Blanc couvrant")
    
    if finition_fields:
        description_parts.append("FINITION OFFSET: " + " | ".join(finition_fields))
    
    # Assembler la description finale
    description = '\n'.join(description_parts) if description_parts else ''
    
    # Debug: vérifier les valeurs des champs
    frappe.logger().info(f"Description générée pour {doc.item_code}: {description}")
    frappe.logger().info(f"Valeur custom_pelliculage: {doc.get('custom_pelliculage')}")
    
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
