from frappe import _

def get_data(**kwargs):
    return {
        "fieldname": "customer",
        "non_standard_fieldnames": {
            "Visite Commerciale": "client",  
            "Appel Telephonique": "client",  
        },
        "transactions": [
            {"items": ["Visite Commerciale", "Appel Telephonique"]},
        ],
    }
