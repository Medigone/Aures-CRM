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
        },
        "transactions": [
            {
                "label": _("VENTES"),
                "items": ["Quotation", "Sales Order", "Item"],
            },
            {
                "label": _("CRM"),
                "items": ["Visite Commerciale", "Appel Telephonique"],
            },
        ],
    }