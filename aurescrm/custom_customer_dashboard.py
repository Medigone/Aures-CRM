from frappe import _

def get_data(**kwargs):
    return {
        "fieldname": "customer",
        "non_standard_fieldnames": {
            "Visite Commerciale": "client",  
            "Appel Telephonique": "client",
            "Quotation": "party_name",
            "Sales Order": "customer",
        },
        "transactions": [
            {
                "label": _("VENTES"),
                "items": ["Quotation", "Sales Order"],
            },
            {
                "label": _("CRM"),
                "items": ["Visite Commerciale", "Appel Telephonique"],
            },
        ],
    }