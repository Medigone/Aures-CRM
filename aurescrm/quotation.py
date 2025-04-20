import frappe
# import json # No longer needed here
# from erpnext.selling.doctype.quotation.quotation import _make_sales_order # Keep this commented or remove
from frappe import _
from frappe.model.mapper import get_mapped_doc # Import needed for get_mapped_doc

@frappe.whitelist()
def make_sales_order_draft(source_name):
    """
    Génère une Sales Order en brouillon à partir d'un Devis,
    en utilisant la logique native pour remplir les champs standards,
    puis en copiant les champs custom nécessaires et en peuplant la table des maquettes.
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
    # Add logging to see the fetched value (optional, can be removed after testing)
    frappe.log_error(f"Fetched custom_demande_faisabilité from {source_name}: {val_faisab}", "make_sales_order_draft Debug")

    if val_faisab:
        # Assign the value to the correct field name in Sales Order
        so.custom_demande_de_faisabilité = val_faisab # Correct field name for Sales Order
        # Add logging to confirm assignment (optional, can be removed after testing)
        frappe.log_error(f"Assigned {val_faisab} to custom_demande_de_faisabilité in new SO", "make_sales_order_draft Debug")
    else:
       # Optional logging
       frappe.log_error(f"Value for custom_demande_faisabilité not found or empty in Quotation {source_name}", "make_sales_order_draft Debug")


    # Set the custom field linking back to the source Quotation using the correct field name
    so.custom_devis = source_name # Use the actual field name 'custom_devis'

    # --- Start: Populate custom_liste_maquettes ---
    so.custom_liste_maquettes = []
    # missing_maquette_items = [] # No longer needed to store for frontend

    qtn_items = frappe.get_all("Quotation Item", filters={"parent": source_name}, fields=["item_code"])

    for item in qtn_items:
        item_code = item.item_code
        if not item_code:
            continue # Skip if item_code is missing in quotation item

        maquette_name = None # Initialize maquette_name as None

        # Find the active Maquette for this item_code
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
            maquette_name = active_maquette[0].name # Assign if found
        else:
            # Optional: Log if no active maquette is found for an item (backend only)
            frappe.log_error(
                f"No active Maquette found for item {item_code} from Quotation {source_name}",
                "make_sales_order_draft Info"
            )

        # Always append a row for the item
        # The 'maquette' field will be None if no active_maquette was found
        so.append("custom_liste_maquettes", {
            "article": item_code, # Replace 'article' if the field name in the child table is different
            "maquette": maquette_name # Replace 'maquette' if the field name in the child table is different
        })

    # --- End: Populate custom_liste_maquettes ---

    # --- Remove the section storing missing maquette info ---
    # if missing_maquette_items:
    #     so.custom_missing_maquettes_info = json.dumps(missing_maquette_items)
    # else:
    #     so.custom_missing_maquettes_info = None

    # 3) Save the Sales Order to the database (remains in Draft status)
    so.insert(ignore_permissions=True)

    return so.name
