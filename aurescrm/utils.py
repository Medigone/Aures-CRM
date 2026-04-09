import frappe
from frappe import _
from frappe.model.naming import make_autoname
from frappe.utils import cint


def custom_item_naming(doc, method):
    """
    Génère automatiquement le nom de l'article selon le type d'article :
    - Type "Client" : <ID_Client>-<numéro séquentiel>
    - Type "Général" + item_group "Support d'impression" : SUPPORT-<numéro séquentiel>
    - Type "Général" (autres item_group) : ITEM-<numéro séquentiel>
    - Sous-article : <code_parent>-<incrément>
    """
    if cint(doc.get("custom_sous_article")) and doc.get("custom_article_parent"):
        count = frappe.db.count("Item", {"custom_article_parent": doc.custom_article_parent})
        doc.name = f"{doc.custom_article_parent}-{count + 1}"
        return

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
        # Vérifier si c'est un support d'impression
        if doc.item_group == "Support d'impression":
            # Articles de type Support d'impression avec compteur séparé
            doc.name = make_autoname("SUPPORT-.####")
        else:
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



def ensure_item_code_for_sous_article(doc, method):
    """Avant validate : le code article doit exister pour les sous-articles (name vient de autoname)."""
    if cint(doc.get("custom_sous_article")) and doc.get("custom_article_parent") and doc.get("name"):
        doc.item_code = doc.name


def format_item_fields(doc, method):
    """
    - Convertit `item_code` en majuscules.
    - Génère automatiquement `item_name` à partir de `item_code`.
    - Sous-articles : `item_code` = `name` (ID technique) ; `item_name` = désignation (champ description).
    """
    if cint(doc.get("custom_sous_article")) and doc.get("name"):
        doc.item_code = doc.name
        if doc.item_code:
            doc.item_code = doc.item_code.upper()
        # La désignation saisie au prompt est dans description (avant update_item_description)
        if (doc.description or "").strip():
            doc.item_name = (doc.description or "").strip().upper()
        else:
            doc.item_name = doc.item_code
        return

    if doc.item_code:
        doc.item_code = doc.item_code.upper()

        # Générer automatiquement item_name basé sur item_code
        doc.item_name = doc.item_code  # `item_name` sera toujours égal à `item_code`


def update_item_description(doc, method):
    """Met à jour la description de l'article en combinant plusieurs champs organisés par sections."""
    # Sous-articles : la description est la désignation métier saisie à la création — ne pas reconstruire
    if cint(doc.get("custom_sous_article")):
        return

    # Debug: vérifier si la fonction est appelée
    frappe.logger().info(f"update_item_description appelée pour l'article: {doc.item_code}")
    
    # Pour les articles de type "Général", utiliser uniquement le item_code comme description
    if doc.get("custom_type_article") == "Général":
        doc.description = doc.item_code if doc.item_code else ''
        return
    
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
    """Met à jour la description de tous les articles.
    Peut être exécutée manuellement ou via le scheduler.
    """
    frappe.logger().info("Début de la mise à jour des descriptions d'articles")
    
    # Récupérer tous les articles
    items = frappe.get_all("Item", fields=["name"])
    count_success = 0
    count_errors = 0
    
    for item in items:
        try:
            doc = frappe.get_doc("Item", item.name)
            update_item_description(doc, None)
            doc.save(ignore_permissions=True)
            count_success += 1
        except Exception as e:
            count_errors += 1
            frappe.logger().error(f"Erreur lors de la mise à jour de l'article {item.name}: {str(e)}")
    
    message = f"Mise à jour terminée : {count_success} articles mis à jour, {count_errors} erreurs"
    frappe.logger().info(message)
    
    return {
        "success": count_success,
        "errors": count_errors,
        "message": message
    }


@frappe.whitelist(methods=["GET", "POST"])
def get_sub_articles(parent_item: str):
    """Liste les sous-articles liés à un article parent."""
    if not parent_item:
        return []
    parent = frappe.get_doc("Item", parent_item) if frappe.db.exists("Item", parent_item) else None
    if not parent:
        frappe.throw(_("Article parent introuvable."))
    frappe.has_permission("Item", "read", doc=parent, throw=True)

    return frappe.get_all(
        "Item",
        filters={"custom_article_parent": parent_item},
        fields=["name", "description", "custom_quantite_sous_article"],
        order_by="name asc",
    )


@frappe.whitelist(methods=["POST"])
def create_sous_article(parent_item: str, designation: str, quantite: float):
    """
    Crée un Item sous-article à partir d'un article parent (article composé).
    Copie les caractéristiques principales du parent ; nom = <parent>-<n>.
    """
    if not parent_item or not frappe.db.exists("Item", parent_item):
        frappe.throw(_("Article parent invalide ou introuvable."))

    designation = (designation or "").strip()
    if not designation:
        frappe.throw(_("La désignation du sous-article est obligatoire."))

    quantite = float(quantite or 0)
    if quantite <= 0:
        frappe.throw(_("La quantité doit être strictement positive."))

    parent = frappe.get_doc("Item", parent_item)
    frappe.has_permission("Item", "write", doc=parent, throw=True)
    frappe.has_permission("Item", "create", throw=True)

    if cint(parent.get("custom_sous_article")):
        frappe.throw(_("Un sous-article ne peut pas avoir de sous-articles."))

    if not cint(parent.get("custom_article_compose")):
        parent.db_set("custom_article_compose", 1, update_modified=False)

    child = frappe.copy_doc(parent)
    child.name = None
    child.item_code = None
    child.item_name = None
    child.custom_article_compose = 0
    child.custom_sous_article = 1
    child.custom_article_parent = parent.name
    child.custom_quantite_sous_article = quantite
    child.description = designation

    # Éviter les conflits de codes-barres uniques hérités du parent
    if child.meta.get_field("barcodes"):
        child.set("barcodes", [])

    child.insert()

    return child.name
