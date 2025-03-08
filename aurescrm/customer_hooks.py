import frappe

def uppercase_customer_name(doc, method):
    # Convertir le nom du client en majuscules s'il existe
    if doc.customer_name:
        doc.customer_name = doc.customer_name.upper()

def set_default_commercial(doc, method):
    if not doc.custom_commercial_attribué:  # Si le champ est vide
        # Attribuer le créateur comme commercial
        doc.custom_commercial_attribué = doc.owner
        
        # Récupérer le nom complet du créateur
        full_name = frappe.db.get_value("User", doc.owner, "full_name") or frappe.utils.get_fullname(doc.owner)
        doc.custom_nom_commercial = full_name
        
        # Supprimez l'appel explicite à frappe.db.set_value
        # Les valeurs affectées au document (doc) seront sauvegardées automatiquement
        # if not doc.is_new():
        #     frappe.db.set_value("Customer", doc.name, {
        #         "custom_commercial_attribué": doc.owner,
        #         "custom_nom_commercial": full_name
        #     }, update_modified=True)
