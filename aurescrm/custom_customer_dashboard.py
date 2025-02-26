from frappe import _

def get_data(**kwargs):
    return {
        "fieldname": "customer",
        "non_standard_fieldnames": {
            "Visite Commerciale": "client",  
            "Appel Telephonique": "client",
            "Quotation": "party_name",
            "Sales Order": "customer",
            "Item": "custom_client",
            "BOM": "custom_client",
            "Rendez Vous Client": "client",
            "Etude Technique": "client",
            "Reclamations Clients": "client",
            "Etude Faisabilite": "client",
            "Sales Invoice": "customer",
        },
        "transactions": [
            {
               
                "items": ["Visite Commerciale", "Rendez Vous Client", "Appel Telephonique", "Reclamations Clients"],
            },
            {
               
                "items": ["Item", "Quotation", "Sales Order", "Sales Invoice"],
            },
            {
               
                "items": ["Etude Technique", "BOM", "Etude Faisabilite"],
            },
            
            
        ],
    }