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
        },
        "transactions": [
            {
               
                "items": ["Quotation", "Sales Order", "Visite Commerciale"],
            },
            {
               
                "items": ["Item", "BOM"],
            },
            
        ],
    }