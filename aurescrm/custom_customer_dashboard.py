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
            "Reclamations Clients": "client",
            "Demande Faisabilite": "client",
            "Etude Faisabilite": "client",
            "Etude Technique": "client",
            "Sales Invoice": "customer",
            "Payment Entry": "party",
            "Delivery Note": "customer",
            "Production Order": "customer",
            
        },
        "transactions": [
            {
                "label": _("Interactions Clients"),
                "items": ["Visite Commerciale", "Rendez Vous Client", "Appel Telephonique", "Reclamations Clients"],
            },
            {
                "label": _("Gestion des Produits et Études"),
                "items": ["Demande Faisabilite", "Etude Faisabilite", "Etude Technique", "Item", "BOM"],
            },
            {
                "label": _("Documents de Vente et Paiements"),
                "items": ["Quotation", "Sales Order", "Delivery Note", "Sales Invoice", "Payment Entry"],
            },
            {
                "label": _("Production"),
                "items": ["Production Order"],
            },
        ],
    }
