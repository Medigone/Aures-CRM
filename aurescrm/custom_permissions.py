import frappe

def is_exempt_user(user):
    """Renvoie True si l'utilisateur possède le rôle 'Administrator' ou 'System Manager'."""
    roles = frappe.get_roles(user)
    return "Administrator" in roles or "System Manager" in roles

def get_customer_permission_query_conditions(user):
    if not user:
        user = frappe.session.user
    if is_exempt_user(user):
        return ""
    if "Commercial Itinérant" in frappe.get_roles(user):
        return "`tabCustomer`.custom_commercial_attribué = '{0}'".format(user)
    return ""

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
            where `tabCustomer`.name = `tabEtude Faisabilité`.client
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
