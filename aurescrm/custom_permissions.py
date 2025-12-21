import frappe
from aurescrm.commercial_assignment import get_customer_commercial, get_customer_commercials, is_user_commercial_for_customer


def is_exempt_user(user):
    """Renvoie True si l'utilisateur possède le rôle 'Administrator' ou 'System Manager'."""
    roles = frappe.get_roles(user)
    return "Administrator" in roles or "System Manager" in roles


@frappe.whitelist()
def can_edit_customer(customer_name):
    """
    API pour vérifier si l'utilisateur courant peut éditer un client.
    La restriction ne s'applique qu'aux utilisateurs ayant le rôle "Commercial Itinérant".
    Gère maintenant plusieurs commerciaux par société.
    
    Retourne un dict avec:
    - can_edit: True/False
    - commercial_attribue: email du premier commercial attribué (ou None) - pour compatibilité
    - nom_commercial: nom affiché du premier commercial (ou None) - pour compatibilité
    - commercials: liste de tous les commerciaux [{'commercial': email, 'commercial_name': nom}, ...]
    - reason: raison si non éditable
    - source: 'child_table' | 'legacy' | 'none' (pour debug)
    """
    user = frappe.session.user
    user_roles = frappe.get_roles(user)
    
    # Admin et System Manager: tout autorisé
    if is_exempt_user(user):
        return {
            "can_edit": True,
            "commercial_attribue": None,
            "nom_commercial": None,
            "commercials": [],
            "reason": "exempt",
            "source": "none"
        }
    
    # Si l'utilisateur n'a pas le rôle "Commercial Itinérant", pas de restriction
    if "Commercial Itinérant" not in user_roles:
        return {
            "can_edit": True,
            "commercial_attribue": None,
            "nom_commercial": None,
            "commercials": [],
            "reason": "not_commercial_itinerant",
            "source": "none"
        }
    
    # Vérifier si l'utilisateur est un des commerciaux attribués (gère plusieurs commerciaux)
    is_commercial, commercials_info = is_user_commercial_for_customer(user, customer_name)
    
    commercials_list = commercials_info.get('commercials', [])
    source = commercials_info.get('source', 'none')
    
    # Si pas de commercial attribué, tout le monde peut éditer
    if not commercials_list:
        return {
            "can_edit": True,
            "commercial_attribue": None,
            "nom_commercial": None,
            "commercials": [],
            "reason": "not_assigned",
            "source": source
        }
    
    # Récupérer le premier commercial pour compatibilité avec l'UI existante
    first_commercial = commercials_list[0] if commercials_list else {}
    commercial_attribue = first_commercial.get('commercial')
    nom_commercial = first_commercial.get('commercial_name')
    
    # Si l'utilisateur est un des commerciaux attribués
    if is_commercial:
        return {
            "can_edit": True,
            "commercial_attribue": commercial_attribue,
            "nom_commercial": nom_commercial,
            "commercials": commercials_list,
            "reason": "owner",
            "source": source
        }
    
    # Sinon, lecture seule
    # Construire le message avec tous les commerciaux
    commercial_names = [c.get('commercial_name') or c.get('commercial') for c in commercials_list if c.get('commercial')]
    nom_commercial_display = ", ".join(commercial_names) if commercial_names else nom_commercial
    
    return {
        "can_edit": False,
        "commercial_attribue": commercial_attribue,
        "nom_commercial": nom_commercial_display,
        "commercials": commercials_list,
        "reason": "other_commercial",
        "source": source
    }


def has_customer_permission(doc, ptype, user):
    """
    Vérifie les permissions sur Customer:
    La restriction ne s'applique qu'aux utilisateurs ayant le rôle "Commercial Itinérant".
    Utilise la table enfant d'attribution commerciale avec fallback legacy.
    
    - Lecture (read, select, report, email, print): autorisée pour tous
    - Création (create): autorisée pour tous
    - Écriture/suppression (write, delete, submit, cancel, etc.):
      autorisée si commercial non attribué OU attribué à l'utilisateur
    """
    if not user:
        user = frappe.session.user

    # Admin et System Manager: tout autorisé
    if is_exempt_user(user):
        return True
    
    # Si l'utilisateur n'a pas le rôle "Commercial Itinérant", pas de restriction
    user_roles = frappe.get_roles(user)
    if "Commercial Itinérant" not in user_roles:
        return True

    # Permissions de lecture: autorisées pour tous
    read_permissions = ("read", "select", "report", "email", "print")
    if ptype in read_permissions:
        return True

    # Création: autorisée pour tous
    if ptype == "create":
        return True

    # Écriture/suppression: utiliser le module utilitaire
    if doc:
        is_commercial, _ = is_user_commercial_for_customer(user, doc.name)
        return is_commercial

    return True


# Note: get_customer_permission_query_conditions n'est plus utilisé
# car on affiche maintenant tous les clients (restriction supprimée de hooks.py)


def build_commercial_permission_query_condition(customer_field, user):
    """
    Construit une condition SQL pour vérifier si l'utilisateur est commercial pour un client.
    Vérifie à la fois le champ legacy ET la table enfant Customer Commercial Assignment.
    
    Args:
        customer_field: Nom du champ qui référence le Customer (ex: `tabQuotation`.party_name)
        user: Email de l'utilisateur
    
    Returns:
        str: Condition SQL à utiliser dans une clause WHERE ou EXISTS
    """
    # Échapper le nom d'utilisateur pour éviter les injections SQL
    # Frappe utilise déjà des paramètres sécurisés, mais on double la sécurité
    user_escaped = frappe.db.escape(user)
    
    return f"""exists (
        select 1 from `tabCustomer`
        where `tabCustomer`.name = {customer_field}
          and (
            `tabCustomer`.custom_commercial_attribué = {user_escaped}
            or exists (
                select 1 from `tabCustomer Commercial Assignment`
                where `tabCustomer Commercial Assignment`.parent = `tabCustomer`.name
                  and `tabCustomer Commercial Assignment`.parenttype = 'Customer'
                  and `tabCustomer Commercial Assignment`.parentfield = 'custom_commercial_assignments'
                  and `tabCustomer Commercial Assignment`.commercial = {user_escaped}
            )
          )
    )"""


def get_quotation_permission_query_conditions(user):
    if not user:
        user = frappe.session.user
    if is_exempt_user(user):
        return ""
    if "Commercial Itinérant" in frappe.get_roles(user):
        return build_commercial_permission_query_condition("`tabQuotation`.party_name", user)
    return ""

def get_sales_order_permission_query_conditions(user):
    if not user:
        user = frappe.session.user
    if is_exempt_user(user):
        return ""
    if "Commercial Itinérant" in frappe.get_roles(user):
        return build_commercial_permission_query_condition("`tabSales Order`.customer", user)
    return ""

def get_delivery_note_permission_query_conditions(user):
    if not user:
        user = frappe.session.user
    if is_exempt_user(user):
        return ""
    if "Commercial Itinérant" in frappe.get_roles(user):
        return build_commercial_permission_query_condition("`tabDelivery Note`.customer", user)
    return ""

def get_item_permission_query_conditions(user):
    if not user:
        user = frappe.session.user
    if is_exempt_user(user):
        return ""
    if "Commercial Itinérant" in frappe.get_roles(user):
        return build_commercial_permission_query_condition("`tabItem`.custom_client", user)
    return ""

def get_sales_invoice_permission_query_conditions(user):
    if not user:
        user = frappe.session.user
    if is_exempt_user(user):
        return ""
    if "Commercial Itinérant" in frappe.get_roles(user):
        return build_commercial_permission_query_condition("`tabSales Invoice`.customer", user)
    return ""

def get_payment_entry_permission_query_conditions(user):
    if not user:
        user = frappe.session.user
    # On suppose ici que le lien se fait via le champ 'party'
    if is_exempt_user(user):
        return ""
    if "Commercial Itinérant" in frappe.get_roles(user):
        return build_commercial_permission_query_condition("`tabPayment Entry`.party", user)
    return ""

def get_bom_permission_query_conditions(user):
    if not user:
        user = frappe.session.user
    if is_exempt_user(user):
        return ""
    if "Commercial Itinérant" in frappe.get_roles(user):
        return build_commercial_permission_query_condition("`tabBOM`.custom_client", user)
    return ""

def get_feasibility_study_permission_query_conditions(user):
    if not user:
        user = frappe.session.user
    # Pour le doctype "Etude Faisabilité", on suppose que le champ s'appelle 'client'
    if is_exempt_user(user):
        return ""
    if "Commercial Itinérant" in frappe.get_roles(user):
        return build_commercial_permission_query_condition("`tabEtude Faisabilite`.client", user)
    return ""

def get_technical_study_permission_query_conditions(user):
    if not user:
        user = frappe.session.user
    # Pour le doctype "Etude Technique", on suppose que le champ s'appelle 'client'
    if is_exempt_user(user):
        return ""
    if "Commercial Itinérant" in frappe.get_roles(user):
        return build_commercial_permission_query_condition("`tabEtude Technique`.client", user)
    return ""

def get_reclamations_clients_permission_query_conditions(user):
    if not user:
        user = frappe.session.user
    # Pour le doctype "Reclamations Clients", le champ de lien est 'client'
    if is_exempt_user(user):
        return ""
    if "Commercial Itinérant" in frappe.get_roles(user):
        return build_commercial_permission_query_condition("`tabReclamations Clients`.client", user)
    return ""
