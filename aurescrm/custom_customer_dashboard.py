from frappe import _

def get_data(**kwargs):
    return {
        "fieldname": "customer",
        "non_standard_fieldnames": {
            "Opportunite": "client",
            "Visite Commerciale": "client",  
            "Appel Telephonique": "client",  
        },
        "transactions": [
            {"items": ["Opportunite", "Visite Commerciale", "Appel Telephonique"]},
        ],
    }
