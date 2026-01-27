import frappe
# import json # No longer needed here
# from erpnext.selling.doctype.quotation.quotation import _make_sales_order # Keep this commented or remove
from frappe import _
from frappe.model.mapper import get_mapped_doc # Import needed for get_mapped_doc
from frappe.utils import getdate, nowdate

@frappe.whitelist()
def make_sales_order_draft(source_name):
    """
    Génère une Sales Order en brouillon à partir d'un Devis.
    Si le devis a déjà des commandes partielles, crée une commande avec les articles restants.
    Sinon, crée une commande complète avec tous les articles.
    """
    try:
        # Importer la fonction d'analyse depuis sales_order_hooks
        from aurescrm.sales_order_hooks import analyze_quotation_command_status
        
        # Analyser l'état de commande du devis
        command_analysis = analyze_quotation_command_status(source_name)
        
        # Si le devis est entièrement commandé, on ne peut pas créer de nouvelle commande
        if command_analysis["custom_status"] == "Entièrement commandé":
            frappe.throw(_("Devis entièrement commandé. Impossible de créer une nouvelle commande."))
        
        # Vérifier s'il y a des commandes en brouillon
        if command_analysis.get("has_draft_orders", False):
            draft_count = command_analysis.get("draft_orders_count", 0)
            frappe.msgprint(_("Attention : Il y a {0} commande(s) en brouillon liée(s) à ce devis. Vous pouvez les finaliser au lieu d'en créer une nouvelle.").format(draft_count), 
                           indicator='orange', 
                           title=_('Commandes en brouillon existantes'))
        
        # Si le devis a déjà des commandes partielles, créer une commande avec les articles restants
        if command_analysis["custom_status"] == "Partiellement commandé":
            return create_smart_sales_order_with_remaining_items(source_name, command_analysis)
        
        # Sinon, créer une commande complète avec tous les articles (logique originale)
        return create_complete_sales_order(source_name)
        
    except Exception as e:
        # IMPORTANT: utiliser des kwargs pour éviter l'inversion title/message
        # et garder un titre <= 140 caractères.
        frappe.log_error(
            title=f"Création SO depuis Devis échouée: {source_name}",
            message=f"{e}\n\n{frappe.get_traceback()}",
        )
        frappe.throw(_("Erreur lors de la création de la commande."))

def _ensure_sales_order_delivery_dates(so):
    """
    ERPNext impose: date(s) de livraison >= date de commande (transaction_date).
    On aligne l'entête et les lignes pour éviter une ValidationError lors du insert().
    """
    tx_date = getdate(so.transaction_date or nowdate())

    # Entête
    header_delivery = getdate(so.delivery_date) if so.delivery_date else tx_date
    if header_delivery < tx_date:
        header_delivery = tx_date
    so.delivery_date = header_delivery

    # Lignes
    for item in so.get("items") or []:
        # Selon version ERPNext: Sales Order Item utilise généralement delivery_date.
        item_delivery = None
        if getattr(item, "delivery_date", None):
            item_delivery = getdate(item.delivery_date)
        elif getattr(item, "schedule_date", None):
            item_delivery = getdate(item.schedule_date)
        else:
            item_delivery = header_delivery

        if item_delivery < tx_date:
            item_delivery = tx_date

        if hasattr(item, "delivery_date"):
            item.delivery_date = item_delivery
        if hasattr(item, "schedule_date"):
            item.schedule_date = item_delivery


def create_smart_sales_order_with_remaining_items(source_name, command_analysis):
    """
    Crée une commande avec seulement les articles restants à commander
    """
    # Récupérer les articles restants
    remaining_items = command_analysis["remaining_items"]
    
    if not remaining_items:
        frappe.throw(_("Aucun article restant à commander."))
    
    # Créer la commande avec les articles restants
    quotation = frappe.get_doc("Quotation", source_name)
    so = frappe.new_doc("Sales Order")
    
    # Copier les informations du devis
    so.customer = quotation.party_name
    so.order_type = quotation.order_type or "Sales"
    so.delivery_date = quotation.custom_date_de_livraison
    
    # Copier les champs personnalisés
    if hasattr(quotation, 'custom_demande_faisabilité'):
        so.custom_demande_de_faisabilité = quotation.custom_demande_faisabilité
    so.custom_devis = source_name
    
    # Ajouter seulement les articles restants
    for item_data in remaining_items:
        # Récupérer les détails complets de l'article depuis le devis original
        quotation_item = frappe.get_all(
            "Quotation Item",
            filters={
                "parent": source_name,
                "item_code": item_data["item_code"]
            },
            fields=["item_name", "rate", "uom", "description"],
            limit=1
        )
        
        if quotation_item:
            item = quotation_item[0]
            so.append("items", {
                "item_code": item_data["item_code"],
                "item_name": item.item_name,
                "qty": item_data["remaining_qty"],
                "rate": item.rate,
                "uom": item.uom,
                "description": item.description,
                # Evite l'erreur ERPNext si la date de livraison est vide/ancienne
                "delivery_date": so.delivery_date or so.transaction_date or nowdate(),
            })
    
    _ensure_sales_order_delivery_dates(so)

    # Sauvegarder la commande en brouillon
    so.insert(ignore_permissions=True)
    
    # Peupler la table des maquettes
    populate_maquettes_for_sales_order(so, quotation)
    
    frappe.msgprint(_("Commande créée : {0}").format(so.name), 
                   indicator='green', 
                   title=_('Commande Créée'))
    
    return so.name


def create_complete_sales_order(source_name):
    """
    Crée une commande complète avec tous les articles du devis (logique originale)
    """
    # 1) Use get_mapped_doc to create a Sales Order in memory (Draft)
    #    from the source Quotation.
    so = get_mapped_doc(
        "Quotation",
        source_name,
        {
            "Quotation": {
                "doctype": "Sales Order",
                "validation": {
                    "docstatus": ["=", 1] # Ensure the quotation is submitted
                },
                # Map necessary fields from Quotation to Sales Order
                "field_map": {
                    # Map customer (party_name in Quotation -> customer in Sales Order)
                    "party_name": "customer",
                    # Map order type (will map if source has value)
                    "order_type": "order_type",
                    # Map the custom delivery date field
                    "custom_date_de_livraison": "delivery_date"
                    # Add other header field mappings if needed
                }
            },
            "Quotation Item": {
                "doctype": "Sales Order Item",
                "field_map": {
                    "rate": "rate",
                    "qty": "qty",
                    # Add other necessary item mappings here
                    # Ensure item_code is mapped if not automatically handled
                    "item_code": "item_code"
                },
            },
        },
        ignore_permissions=True
    )

    # Set a default Order Type if it wasn't mapped (e.g., if empty in Quotation)
    if not so.order_type:
        so.order_type = "Sales" # Or use another appropriate default type

    # 2) Copy your custom feasibility study link field from the Quotation
    #    Using the correct field name with the accent
    val_faisab = frappe.db.get_value(
        "Quotation", source_name, "custom_demande_faisabilité" # Correct field name for Quotation
    )

    if val_faisab:
        # Assign the value to the correct field name in Sales Order
        so.custom_demande_de_faisabilité = val_faisab # Correct field name for Sales Order

    # Set the custom field linking back to the source Quotation using the correct field name
    so.custom_devis = source_name # Use the actual field name 'custom_devis'

    _ensure_sales_order_delivery_dates(so)

    # 3) Save the Sales Order to the database (remains in Draft status)
    so.insert(ignore_permissions=True)

    # 4) Populate custom_liste_maquettes
    quotation = frappe.get_doc("Quotation", source_name)
    populate_maquettes_for_sales_order(so, quotation)

    frappe.msgprint(_("Commande créée : {0}").format(so.name), 
                   indicator='green', 
                   title=_('Commande Créée'))

    return so.name


def populate_maquettes_for_sales_order(so, quotation):
    """
    Peuple la table custom_liste_maquettes pour la nouvelle commande
    """
    so.custom_liste_maquettes = []
    
    for item in so.items:
        item_code = item.item_code
        if not item_code:
            continue
        
        maquette_name = None
        
        # Trouver la maquette active pour cet article
        active_maquette = frappe.get_list(
            "Maquette",
            filters={
                "article": item_code,
                "status": "Version Activée"
            },
            fields=["name"],
            limit_page_length=1
        )
        
        if active_maquette:
            maquette_name = active_maquette[0].name
        else:
            frappe.log_error(
                title="populate_maquettes_for_sales_order",
                message=f"No active Maquette for item {item_code}",
            )
        
        # Ajouter la ligne dans la table des maquettes
        so.append("custom_liste_maquettes", {
            "article": item_code,
            "maquette": maquette_name
        })
    
    # Sauvegarder les modifications
    so.save(ignore_permissions=True)

