import frappe
from aurescrm.commercial_assignment import get_current_company


def uppercase_customer_name(doc, method):
    # Convertir le nom du client en majuscules s'il existe
    if doc.customer_name:
        doc.customer_name = doc.customer_name.upper()


def set_default_commercial(doc, method):
    """
    Attribue le créateur comme commercial par défaut si aucun n'est défini.
    Remplit à la fois le champ legacy ET la table enfant pour compatibilité.
    """
    # Récupérer la company par défaut de l'utilisateur
    default_company = get_current_company()
    
    # Si aucun commercial attribué (ni legacy ni table enfant pour cette company)
    has_legacy = doc.custom_commercial_attribué
    has_child_entry = False
    
    if default_company and doc.get("custom_commercial_assignments"):
        for row in doc.custom_commercial_assignments:
            if row.company == default_company:
                has_child_entry = True
                break
    
    # Si ni legacy ni entrée dans la table enfant, attribuer le créateur
    if not has_legacy and not has_child_entry:
        # Remplir le champ legacy (pour compatibilité)
        doc.custom_commercial_attribué = doc.owner
        
        # Récupérer le nom complet du créateur
        full_name = frappe.db.get_value("User", doc.owner, "full_name") or frappe.utils.get_fullname(doc.owner)
        doc.custom_nom_commercial = full_name
        
        # Ajouter aussi dans la table enfant si une company est définie
        if default_company:
            doc.append("custom_commercial_assignments", {
                "company": default_company,
                "commercial": doc.owner,
                "commercial_name": full_name,
                "is_principal": 1  # Le créateur devient automatiquement principal
            })


def ensure_single_principal_per_company(doc, method):
    """
    S'assure qu'il n'y a qu'un seul commercial principal par société.
    Si un commercial est marqué comme principal, décoche automatiquement les autres
    commerciaux de la même société.
    """
    if not doc.get("custom_commercial_assignments"):
        return
    
    # Grouper les attributions par société
    assignments_by_company = {}
    for idx, assignment in enumerate(doc.custom_commercial_assignments):
        company = assignment.get("company")
        if not company:
            continue
        
        if company not in assignments_by_company:
            assignments_by_company[company] = []
        
        assignments_by_company[company].append({
            "idx": idx,
            "assignment": assignment
        })
    
    # Pour chaque société, s'assurer qu'il n'y a qu'un seul principal
    for company, assignments in assignments_by_company.items():
        # Trier par index pour garder l'ordre de la liste
        assignments_sorted = sorted(assignments, key=lambda x: x["idx"])
        
        principals = [
            a for a in assignments_sorted 
            if a["assignment"].get("is_principal")
        ]
        
        # Si plusieurs commerciaux sont marqués comme principaux
        if len(principals) > 1:
            # Garder seulement le premier dans l'ordre de la liste comme principal, décocher les autres
            # Cela permet à l'utilisateur de remettre le premier comme principal en le cochant
            for principal in principals[1:]:
                principal["assignment"].is_principal = 0


def sync_principal_commercial_to_legacy_field(doc, method):
    """
    Synchronise le commercial principal vers custom_commercial_attribué.
    Priorité: 1) Commercial principal (is_principal=1) de n'importe quelle société
              2) Premier commercial trouvé si aucun principal
    """
    if not doc.get("custom_commercial_assignments"):
        # Si la table enfant est vide, vider les champs legacy
        doc.custom_commercial_attribué = None
        doc.custom_nom_commercial = None
        return
    
    # Trouver le commercial principal (chercher dans toutes les sociétés)
    principal_commercial = None
    principal_name = None
    first_commercial = None
    first_name = None
    
    # Parcourir toutes les attributions
    for assignment in doc.custom_commercial_assignments:
        if assignment.get("commercial"):
            # Garder le premier commercial trouvé comme fallback
            if not first_commercial:
                first_commercial = assignment.commercial
                first_name = assignment.commercial_name
            
            # Si c'est un commercial principal, le prendre en priorité
            if assignment.get("is_principal"):
                principal_commercial = assignment.commercial
                principal_name = assignment.commercial_name
                break  # Arrêter dès qu'on trouve un principal
    
    # Utiliser le principal si trouvé, sinon le premier commercial
    final_commercial = principal_commercial or first_commercial
    final_name = principal_name or first_name
    
    # Mettre à jour les champs legacy
    if final_commercial:
        doc.custom_commercial_attribué = final_commercial
        doc.custom_nom_commercial = final_name
    else:
        # Si aucun commercial dans la table, vider les champs legacy
        doc.custom_commercial_attribué = None
        doc.custom_nom_commercial = None


@frappe.whitelist()
def get_customer_contacts(customer):
    contacts_data = frappe.db.sql("""
        SELECT 
            c.name AS docname,
            TRIM(CONCAT_WS(' ', c.first_name, c.last_name)) AS contact,
            c.designation,
            MAX(CASE WHEN pn.is_primary_mobile_no = 1 THEN pn.phone END) AS mobile,
            MAX(CASE WHEN e.is_primary = 1 THEN e.email_id END) AS email
        FROM `tabContact` c
        LEFT JOIN `tabDynamic Link` dl 
            ON c.name = dl.parent AND dl.link_doctype = 'Customer' AND dl.link_name = %s
        LEFT JOIN `tabContact Phone` pn ON c.name = pn.parent
        LEFT JOIN `tabContact Email` e ON c.name = e.parent
        WHERE dl.link_name IS NOT NULL
        GROUP BY c.name
    """, (customer,), as_dict=True)
    
    return contacts_data
    