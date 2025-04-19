import frappe
from frappe import _

def update_quotation_status_on_so_submit(doc, method):
    """
    Hook called on Sales Order submission.
    Updates the status of the linked Quotation (via custom_devis field) to 'Ordered'
    using frappe.db.set_value.
    """
    # Check if this Sales Order has a linked source Quotation via the custom field 'custom_devis'
    if doc.custom_devis:
        quotation_name = doc.custom_devis # Use the actual field name 'custom_devis'
        try:
            # Get the current status of the quotation first to avoid unnecessary updates
            # and ensure it exists.
            current_status = frappe.db.get_value("Quotation", quotation_name, "status")

            if current_status is None:
                 # Quotation doesn't exist, log error
                 frappe.log_error(f"Source Quotation {quotation_name} not found for Sales Order {doc.name}", "update_quotation_status_on_so_submit")
                 return # Exit the function

            # Check if the status is eligible for update (e.g., it's 'Open' or 'Submitted')
            if current_status in ["Open", "Submitted"]: # Adjust based on your Quotation statuses
                 # Use db.set_value to directly update the status field in the database
                 frappe.db.set_value("Quotation", quotation_name, "status", "Ordered")
                 # Optional: Update modified timestamp (usually good practice when using db.set_value)
                 frappe.db.set_value("Quotation", quotation_name, "modified", frappe.utils.now())

                 frappe.msgprint(_("Statut du Devis {0} mis à jour en 'Commandé'").format(quotation_name))
            # else: # Optional: Log if status is not eligible
            #    frappe.log_info(f"Quotation {quotation_name} status '{current_status}' not eligible for update to 'Ordered'.", "update_quotation_status_on_so_submit")

        # except frappe.DoesNotExistError: # This is handled by the get_value check now
        #     frappe.log_error(f"Source Quotation {quotation_name} not found for Sales Order {doc.name}", "update_quotation_status_on_so_submit")
        except Exception as e:
            # Catch potential errors from db.set_value or db.get_value
            frappe.log_error(f"Failed to update Quotation {quotation_name} status from SO {doc.name} using db.set_value: {e}", "update_quotation_status_on_so_submit")
            # Provide feedback to the user
            frappe.msgprint(_("Échec de la mise à jour du statut du Devis lié : {0}").format(e), indicator='red', title=_('Erreur'))
            # Optionally re-raise the exception if you want the SO submission to fail
            # raise

    # else:
        # Optional: Log if the SO doesn't have a source quotation link
        # frappe.log_info(f"Sales Order {doc.name} submitted without a source quotation link.", "update_quotation_status_on_so_submit")