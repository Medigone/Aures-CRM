# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

"""
Module utilitaire pour la gestion des attributions commerciales par société.
Single source of truth pour les permissions, auto-remplissage et notifications.
"""

import frappe
from frappe import _


def get_current_company(company=None):
    """
    Retourne la société à utiliser pour l'attribution commerciale.
    
    Args:
        company: Société explicite (optionnel)
    
    Returns:
        str: Nom de la société ou None
    """
    if company:
        return company
    return frappe.defaults.get_user_default("Company")


def get_customer_commercials(customer_name, company=None, *, allow_legacy_fallback=True):
    """
    Récupère TOUS les commerciaux attribués à un client pour une société donnée.
    
    Args:
        customer_name: Nom du Customer
        company: Société (si None, utilise la société par défaut de l'utilisateur)
        allow_legacy_fallback: Si True, fallback sur les champs legacy si pas de donnée dans la table enfant
    
    Returns:
        dict: {
            'commercials': liste de dicts [{'commercial': email, 'commercial_name': nom}, ...],
            'source': 'child_table' | 'legacy' | 'none'
        }
    """
    result = {
        'commercials': [],
        'source': 'none'
    }
    
    if not customer_name:
        return result
    
    # Déterminer la société
    target_company = get_current_company(company)
    
    if target_company:
        # Chercher TOUTES les attributions dans la table enfant pour cette company
        # Prioriser le commercial principal (is_principal desc)
        assignments = frappe.get_all(
            "Customer Commercial Assignment",
            filters={
                "parent": customer_name,
                "parenttype": "Customer",
                "parentfield": "custom_commercial_assignments",
                "company": target_company
            },
            fields=["commercial", "commercial_name", "is_principal"],
            order_by="is_principal desc, creation asc"
        )
        
        if assignments:
            result['commercials'] = [
                {
                    'commercial': a.get("commercial"),
                    'commercial_name': a.get("commercial_name"),
                    'is_principal': bool(a.get("is_principal"))
                }
                for a in assignments if a.get("commercial")
            ]
            result['source'] = 'child_table'
            return result
    
    # Fallback sur les champs legacy si autorisé
    if allow_legacy_fallback:
        legacy_data = frappe.db.get_value(
            "Customer",
            customer_name,
            ["custom_commercial_attribué", "custom_nom_commercial"],
            as_dict=True
        )
        
        if legacy_data and legacy_data.get("custom_commercial_attribué"):
            result['commercials'] = [{
                'commercial': legacy_data.get("custom_commercial_attribué"),
                'commercial_name': legacy_data.get("custom_nom_commercial")
            }]
            result['source'] = 'legacy'
            
            # Log debug pour monitoring
            frappe.logger("commercial_assignment").debug(
                f"Legacy fallback used for customer {customer_name}, company {target_company}"
            )
            
            return result
    
    return result


def get_customer_commercial(customer_name, company=None, *, allow_legacy_fallback=True):
    """
    Récupère le PREMIER commercial attribué à un client pour une société donnée.
    Fonction de compatibilité pour les cas où un seul commercial est nécessaire.
    
    Args:
        customer_name: Nom du Customer
        company: Société (si None, utilise la société par défaut de l'utilisateur)
        allow_legacy_fallback: Si True, fallback sur les champs legacy si pas de donnée dans la table enfant
    
    Returns:
        dict: {
            'commercial': email du commercial (ou None),
            'commercial_name': nom affiché du commercial (ou None),
            'source': 'child_table' | 'legacy' | 'none'
        }
    """
    result = {
        'commercial': None,
        'commercial_name': None,
        'source': 'none'
    }
    
    # Utiliser la fonction qui retourne tous les commerciaux
    all_commercials = get_customer_commercials(customer_name, company, allow_legacy_fallback=allow_legacy_fallback)
    
    if all_commercials.get('commercials') and len(all_commercials['commercials']) > 0:
        first = all_commercials['commercials'][0]
        result['commercial'] = first.get('commercial')
        result['commercial_name'] = first.get('commercial_name')
        result['source'] = all_commercials.get('source', 'none')
    
    return result


def is_user_commercial_for_customer(user, customer_name, company=None):
    """
    Vérifie si l'utilisateur est UN DES commerciaux attribués pour ce client et cette société.
    Gère maintenant plusieurs commerciaux par société.
    
    Args:
        user: Email de l'utilisateur
        customer_name: Nom du Customer
        company: Société (optionnel)
    
    Returns:
        tuple: (is_commercial: bool, commercial_info: dict)
    """
    all_commercials_info = get_customer_commercials(customer_name, company)
    
    # Si pas de commercial attribué, considéré comme "editable par tous"
    if not all_commercials_info.get('commercials'):
        return (True, {'commercials': [], 'source': all_commercials_info.get('source', 'none')})
    
    # Vérifier si l'utilisateur est dans la liste des commerciaux attribués
    commercial_emails = [c.get('commercial') for c in all_commercials_info['commercials'] if c.get('commercial')]
    is_commercial = user in commercial_emails
    
    return (is_commercial, all_commercials_info)


def set_customer_commercial_from_doc(doc, customer_field='customer', company_field='company'):
    """
    Remplit les champs commercial sur un document à partir du Customer lié.
    Utilisé dans les hooks before_validate des DocTypes impactés.
    
    Args:
        doc: Document Frappe
        customer_field: Nom du champ client sur le document (default: 'customer')
        company_field: Nom du champ société sur le document (default: 'company')
    
    Returns:
        dict: Infos du commercial (ou None si pas trouvé)
    """
    customer_name = doc.get(customer_field)
    if not customer_name:
        return None
    
    # Utiliser la company du document si disponible, sinon default user
    company = doc.get(company_field) if company_field else None
    
    commercial_info = get_customer_commercial(customer_name, company)
    
    return commercial_info


@frappe.whitelist()
def get_customer_commercial_api(customer_name, company=None):
    """
    API whitelisted pour récupérer le PREMIER commercial d'un client (appelable depuis JS).
    Pour compatibilité avec le code existant.
    
    Args:
        customer_name: Nom du Customer
        company: Société (optionnel)
    
    Returns:
        dict: Infos du commercial
    """
    return get_customer_commercial(customer_name, company)


@frappe.whitelist()
def get_customer_commercials_api(customer_name, company=None):
    """
    API whitelisted pour récupérer TOUS les commerciaux d'un client (appelable depuis JS).
    
    Args:
        customer_name: Nom du Customer
        company: Société (optionnel)
    
    Returns:
        dict: Liste de tous les commerciaux
    """
    return get_customer_commercials(customer_name, company)


# =============================================================================
# HOOKS BEFORE_VALIDATE POUR REMPLIR LES CHAMPS COMMERCIAL
# =============================================================================

def set_commercial_on_demande_faisabilite(doc, method):
    """
    Hook before_validate pour Demande Faisabilite.
    Remplit id_commercial et commercial à partir du Customer lié.
    """
    if not doc.client:
        return
    
    commercial_info = get_customer_commercial(doc.client)
    
    if commercial_info.get('commercial'):
        doc.id_commercial = commercial_info.get('commercial')
        doc.commercial = commercial_info.get('commercial_name')


def set_commercial_on_sales_order(doc, method):
    """
    Hook before_validate pour Sales Order.
    Remplit custom_id_commercial et custom_commercial à partir du Customer lié.
    """
    if not doc.customer:
        return
    
    # Utiliser la company du document
    commercial_info = get_customer_commercial(doc.customer, doc.company)
    
    if commercial_info.get('commercial'):
        doc.custom_id_commercial = commercial_info.get('commercial')
        doc.custom_commercial = commercial_info.get('commercial_name')


def set_commercial_on_quotation(doc, method):
    """
    Hook before_validate pour Quotation.
    Remplit custom_commercial à partir du Customer lié (party_name ou custom_id_client).
    """
    # Quotation peut avoir party_name (Customer) ou custom_id_client
    customer_name = doc.get('custom_id_client') or doc.get('party_name')
    
    if not customer_name:
        return
    
    # Utiliser la company du document
    commercial_info = get_customer_commercial(customer_name, doc.company)
    
    if commercial_info.get('commercial_name'):
        doc.custom_commercial = commercial_info.get('commercial_name')


def set_commercial_on_commande_urgente(doc, method):
    """
    Hook before_validate pour Commande Urgente.
    Remplit id_commercial et commercial à partir du Customer lié.
    """
    if not doc.client:
        return
    
    commercial_info = get_customer_commercial(doc.client)
    
    if commercial_info.get('commercial'):
        doc.id_commercial = commercial_info.get('commercial')
        doc.commercial = commercial_info.get('commercial_name')

