import frappe

def uppercase_customer_name(doc, method):
    # Vérifier que le champ 'customer_name' existe et n'est pas vide
    if doc.customer_name:
        # Convertir le nom en majuscules
        doc.customer_name = doc.customer_name.upper()
