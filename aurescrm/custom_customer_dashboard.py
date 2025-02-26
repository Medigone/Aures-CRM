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
            "Payment Entry": "party",
        },
        "transactions": [
            {
                "label": _("Interactions Clients"),
                "items": ["Visite Commerciale", "Rendez Vous Client", "Appel Telephonique", "Reclamations Clients"],
            },
            {
                "label": _("Gestion des Produits et Études"),
                "items": ["Item", "BOM", "Etude Faisabilite", "Etude Technique"],
            },
            {
                "label": _("Documents de Vente et Paiements"),
                "items": ["Quotation", "Sales Order", "Sales Invoice", "Payment Entry"],
            },
        ],
    }
