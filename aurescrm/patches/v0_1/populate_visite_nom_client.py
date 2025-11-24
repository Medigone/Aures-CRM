import frappe

def execute():
    """
    Remplit le champ nom_client pour les visites commerciales existantes.
    Utilise une requête SQL directe pour mettre à jour tous les documents, 
    y compris ceux qui sont soumis (docstatus=1).
    """
    frappe.db.sql("""
        UPDATE `tabVisite Commerciale` vc
        INNER JOIN `tabCustomer` c ON vc.client = c.name
        SET vc.nom_client = c.customer_name
        WHERE (vc.nom_client IS NULL OR vc.nom_client = '')
    """)
