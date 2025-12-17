import frappe


def is_exempt_user(user):
    """Renvoie True si l'utilisateur possède le rôle 'Administrator' ou 'System Manager'."""
    roles = frappe.get_roles(user)
    return "Administrator" in roles or "System Manager" in roles


@frappe.whitelist()
def can_edit_customer(customer_name):
    """
    API pour vérifier si l'utilisateur courant peut éditer un client.
    Retourne un dict avec:
    - can_edit: True/False
    - commercial_attribue: email du commercial attribué (ou None)
    - nom_commercial: nom affiché du commercial (ou None)
    - reason: raison si non éditable
    """
    user = frappe.session.user
    
    # Admin et System Manager: tout autorisé
    if is_exempt_user(user):
        return {"can_edit": True, "commercial_attribue": None, "nom_commercial": None, "reason": "exempt"}
    
    # Récupérer le commercial attribué et son nom directement en base (bypass permlevel)
    customer_data = frappe.db.get_value(
        "Customer", 
        customer_name, 
        ["custom_commercial_attribué", "custom_nom_commercial"],
        as_dict=True
    )
    
    commercial_attribue = customer_data.get("custom_commercial_attribué") if customer_data else None
    nom_commercial = customer_data.get("custom_nom_commercial") if customer_data else None
    
    # Si pas de commercial attribué, tout le monde peut éditer
    if not commercial_attribue:
        return {"can_edit": True, "commercial_attribue": None, "nom_commercial": None, "reason": "not_assigned"}
    
    # Si l'utilisateur est le commercial attribué
    if commercial_attribue == user:
        return {"can_edit": True, "commercial_attribue": commercial_attribue, "nom_commercial": nom_commercial, "reason": "owner"}
    
    # Sinon, lecture seule
    return {"can_edit": False, "commercial_attribue": commercial_attribue, "nom_commercial": nom_commercial, "reason": "other_commercial"}


def has_customer_permission(doc, ptype, user):
    """
    Vérifie les permissions sur Customer:
    - Lecture (read, select, report, email, print): autorisée pour tous
    - Création (create): autorisée pour tous
    - Écriture/suppression (write, delete, submit, cancel, etc.):
      autorisée si custom_commercial_attribué est vide OU égal à l'utilisateur
    """
    if not user:
        user = frappe.session.user

    # Admin et System Manager: tout autorisé
    if is_exempt_user(user):
        return True

    # Permissions de lecture: autorisées pour tous
    read_permissions = ("read", "select", "report", "email", "print")
    if ptype in read_permissions:
        return True

    # Création: autorisée pour tous
    if ptype == "create":
        return True

    # Écriture/suppression: autorisée si non attribué ou attribué à l'utilisateur
    commercial_attribue = doc.get("custom_commercial_attribué") if doc else None
    if not commercial_attribue or commercial_attribue == user:
        return True

    return False


# Note: get_customer_permission_query_conditions n'est plus utilisé
# car on affiche maintenant tous les clients (restriction supprimée de hooks.py)

def get_quotation_permission_query_conditions(user):
    if not user:
        user = frappe.session.user
    if is_exempt_user(user):
        return ""
    if "Commercial Itinérant" in frappe.get_roles(user):
        return f"""exists (
            select 1 from `tabCustomer`
            where `tabCustomer`.name = `tabQuotation`.party_name
              and `tabCustomer`.custom_commercial_attribué = '{user}'
        )"""
    return ""

def get_sales_order_permission_query_conditions(user):
    if not user:
        user = frappe.session.user
    if is_exempt_user(user):
        return ""
    if "Commercial Itinérant" in frappe.get_roles(user):
        return f"""exists (
            select 1 from `tabCustomer`
            where `tabCustomer`.name = `tabSales Order`.customer
              and `tabCustomer`.custom_commercial_attribué = '{user}'
        )"""
    return ""

def get_delivery_note_permission_query_conditions(user):
    if not user:
        user = frappe.session.user
    if is_exempt_user(user):
        return ""
    if "Commercial Itinérant" in frappe.get_roles(user):
        return f"""exists (
            select 1 from `tabCustomer`
            where `tabCustomer`.name = `tabDelivery Note`.customer
              and `tabCustomer`.custom_commercial_attribué = '{user}'
        )"""
    return ""

def get_item_permission_query_conditions(user):
    if not user:
        user = frappe.session.user
    if is_exempt_user(user):
        return ""
    if "Commercial Itinérant" in frappe.get_roles(user):
        return f"""exists (
            select 1 from `tabCustomer`
            where `tabCustomer`.name = `tabItem`.custom_client
              and `tabCustomer`.custom_commercial_attribué = '{user}'
        )"""
    return ""

def get_sales_invoice_permission_query_conditions(user):
    if not user:
        user = frappe.session.user
    if is_exempt_user(user):
        return ""
    if "Commercial Itinérant" in frappe.get_roles(user):
        return f"""exists (
            select 1 from `tabCustomer`
            where `tabCustomer`.name = `tabSales Invoice`.customer
              and `tabCustomer`.custom_commercial_attribué = '{user}'
        )"""
    return ""

def get_payment_entry_permission_query_conditions(user):
    if not user:
        user = frappe.session.user
    # On suppose ici que le lien se fait via le champ 'party'
    if is_exempt_user(user):
        return ""
    if "Commercial Itinérant" in frappe.get_roles(user):
        return f"""exists (
            select 1 from `tabCustomer`
            where `tabCustomer`.name = `tabPayment Entry`.party
              and `tabCustomer`.custom_commercial_attribué = '{user}'
        )"""
    return ""

def get_bom_permission_query_conditions(user):
    if not user:
        user = frappe.session.user
    if is_exempt_user(user):
        return ""
    if "Commercial Itinérant" in frappe.get_roles(user):
        return f"""exists (
            select 1 from `tabCustomer`
            where `tabCustomer`.name = `tabBOM`.custom_client
              and `tabCustomer`.custom_commercial_attribué = '{user}'
        )"""
    return ""

def get_feasibility_study_permission_query_conditions(user):
    if not user:
        user = frappe.session.user
    # Pour le doctype "Etude Faisabilité", on suppose que le champ s'appelle 'client'
    if is_exempt_user(user):
        return ""
    if "Commercial Itinérant" in frappe.get_roles(user):
        return f"""exists (
            select 1 from `tabCustomer`
            where `tabCustomer`.name = `tabEtude Faisabilite`.client
              and `tabCustomer`.custom_commercial_attribué = '{user}'
        )"""
    return ""

def get_technical_study_permission_query_conditions(user):
    if not user:
        user = frappe.session.user
    # Pour le doctype "Etude Technique", on suppose que le champ s'appelle 'client'
    if is_exempt_user(user):
        return ""
    if "Commercial Itinérant" in frappe.get_roles(user):
        return f"""exists (
            select 1 from `tabCustomer`
            where `tabCustomer`.name = `tabEtude Technique`.client
              and `tabCustomer`.custom_commercial_attribué = '{user}'
        )"""
    return ""

def get_reclamations_clients_permission_query_conditions(user):
    if not user:
        user = frappe.session.user
    # Pour le doctype "Reclamations Clients", le champ de lien est 'client'
    if is_exempt_user(user):
        return ""
    if "Commercial Itinérant" in frappe.get_roles(user):
        return f"""exists (
            select 1 from `tabCustomer`
            where `tabCustomer`.name = `tabReclamations Clients`.client
              and `tabCustomer`.custom_commercial_attribué = '{user}'
        )"""
    return ""
