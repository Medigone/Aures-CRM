import frappe
# from erpnext.selling.doctype.quotation.quotation import _make_sales_order # Keep this commented or remove
from frappe import _
from frappe.model.mapper import get_mapped_doc # Import needed for get_mapped_doc

@frappe.whitelist()
def make_sales_order_draft(source_name):
    """
    Génère une Sales Order en brouillon à partir d'un Devis,
    en utilisant la logique native pour remplir les champs standards,
st    puis en copiant les champs custom nécessaires.
e    """
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

    # 3) Save the Sales Order to the database (remains in Draft status)
    so.insert(ignore_permissions=True) # Save the draft document

    # Return the name of the created Sales Order
    return so.name
