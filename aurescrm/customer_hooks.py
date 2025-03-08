import frappe
from frappe.permissions import get_user_permissions

def uppercase_customer_name(doc, method):
    # Vérifier que le champ 'customer_name' existe et n'est pas vide
    if doc.customer_name:
        # Convertir le nom en majuscules
        doc.customer_name = doc.customer_name.upper()

def set_default_commercial(doc, method):
    if not doc.custom_commercial_attribué:  # Si le champ est vide
        doc.custom_commercial_attribué = doc.owner  # Définir l'utilisateur créateur
        
        # Récupérer le nom complet de l'utilisateur créateur
        full_name = frappe.db.get_value("User", doc.owner, "full_name") or frappe.utils.get_fullname(doc.owner)
        
        # Mettre à jour le champ 'custom_nom_commercial' avec le full name du créateur
        doc.custom_nom_commercial = full_name

        # Mise à jour explicite pour éviter les erreurs de permission
        frappe.db.set_value("Customer", doc.name, {
            "custom_commercial_attribué": doc.owner,
            "custom_nom_commercial": full_name
        }, update_modified=True)



def update_user_permission(doc, method):
    """
    Lors de la sauvegarde d'un Customer, cette fonction supprime toutes les permissions
    existantes pour ce client qui ne correspondent pas à l'utilisateur défini dans
    custom_commercial_attribué.
    
    Si l'utilisateur assigné existe et possède le rôle "Commercial Itinérant", une nouvelle
    permission est créée.
    """
    new_assigned = doc.custom_commercial_attribué

    # Supprimer toutes les permissions existantes pour ce client qui ne correspondent pas à new_assigned
    existing_permissions = frappe.get_all("User Permission", filters={
        "allow": "Customer",
        "for_value": doc.name
    }, fields=["name", "user"])

    for perm in existing_permissions:
        if perm.user != new_assigned:
            frappe.delete_doc("User Permission", perm.name, ignore_permissions=True)

    # Si aucun utilisateur assigné, on ne fait rien de plus
    if not new_assigned:
        # Pour forcer la restriction, on vide aussi le cache pour cet utilisateur
        frappe.cache().hdel("user_permissions", new_assigned)
        return

    # Vérifier si l'utilisateur assigné possède le rôle "Commercial Itinérant"
    roles = frappe.get_roles(new_assigned)
    if "Commercial Itinérant" in roles:
        # Créer la permission si elle n'existe pas déjà
        if not frappe.db.exists("User Permission", {
            "user": new_assigned,
            "allow": "Customer",
            "for_value": doc.name
        }):
            new_permission = frappe.get_doc({
                "doctype": "User Permission",
                "user": new_assigned,
                "allow": "Customer",
                "for_value": doc.name,
                "apply_to_all_doctypes": 1,
                "is_default": 0,
                "hide_descendants": 0
            })
            new_permission.insert(ignore_permissions=True)
    # Vider le cache des permissions pour que la modification soit prise en compte
    frappe.cache().hdel("user_permissions", new_assigned)