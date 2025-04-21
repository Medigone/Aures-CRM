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

@frappe.whitelist()
def generate_technical_studies(sales_order_name):
    """
    Generate technical studies for each item in the Sales Order.
    For each item:
    1. Get the feasibility request ID from custom_demande_de_faisabilité
    2. Find feasibility studies with status "Réalisable" linked to that request
    3. Extract the "Trace" and "Imposition" IDs
    4. Create technical studies with these IDs
    """
    try:
        # Get the Sales Order document
        sales_order = frappe.get_doc("Sales Order", sales_order_name)
        
        # Check if the Sales Order has a feasibility request
        if not sales_order.custom_demande_de_faisabilité:
            frappe.msgprint(_("Aucune demande de faisabilité n'est associée à cette commande."), 
                           indicator='yellow', 
                           title=_('Attention'))
            return
        
        # Get the feasibility request ID
        feasibility_request_id = sales_order.custom_demande_de_faisabilité
        
        # Find feasibility studies with status "Réalisable" linked to this request
        feasibility_studies = frappe.get_all(
            "Etude Faisabilite",
            filters={
                "demande_faisabilite": feasibility_request_id,
                "status": "Réalisable"
            },
            fields=["name", "trace", "imposition"]
        )
        
        if not feasibility_studies:
            frappe.msgprint(_("Aucune étude de faisabilité avec statut 'Réalisable' n'a été trouvée pour cette demande."), 
                           indicator='yellow', 
                           title=_('Attention'))
            return
        
        # Counter for created studies
        created_studies = 0
        
        # Calculate due date (creation date + 1 day)
        import datetime
        due_date = datetime.datetime.now() + datetime.timedelta(days=1)
        
        # For each item in the Sales Order
        for item in sales_order.items:
            # Create a technical study for this item
            technical_study = frappe.new_doc("Etude Technique")
            technical_study.sales_order = sales_order_name
            technical_study.item_code = item.item_code
            technical_study.item_name = item.item_name
            technical_study.qty = item.qty
            
            # Fix field names to match exactly what the doctype expects
            technical_study.client = sales_order.customer  # Changed from 'customer' to 'client'
            technical_study.date_echeance = due_date.strftime('%Y-%m-%d')  # Changed from 'date_decheance' to 'date_echeance'
            
            # Set article and quantite fields
            technical_study.article = item.item_code
            technical_study.quantite = item.qty
            
            # Use the first feasibility study that has both trace and imposition
            for study in feasibility_studies:
                if study.trace and study.imposition:
                    technical_study.trace = study.trace
                    technical_study.imposition = study.imposition
                    technical_study.etude_faisabilite = study.name
                    break
            
            # Save the technical study
            technical_study.insert()
            created_studies += 1
        
        if created_studies > 0:
            frappe.msgprint(_("{0} étude(s) technique(s) créée(s) avec succès.").format(created_studies), 
                           indicator='green', 
                           title=_('Succès'))
        else:
            frappe.msgprint(_("Aucune étude technique n'a été créée. Vérifiez que les études de faisabilité contiennent des informations de trace et d'imposition."), 
                           indicator='yellow', 
                           title=_('Attention'))
            
    except Exception as e:
        frappe.log_error(f"Failed to generate technical studies for Sales Order {sales_order_name}: {e}", 
                        "generate_technical_studies")
        frappe.msgprint(_("Échec de la génération des études techniques: {0}").format(str(e)), 
                       indicator='red', 
                       title=_('Erreur'))