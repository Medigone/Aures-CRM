import frappe

@frappe.whitelist(allow_guest=True) # Autorise l'appel même pour les invités (ajustez si nécessaire)
def get_doctype_count(doctype_name):
    """
    Retourne le nombre de documents pour un Doctype donné.
    Utilise une requête GET pour potentiellement éviter les problèmes avec l'en-tête Expect.
    """
    try:
        # Vérifie si le Doctype existe et si l'utilisateur a la permission de lire
        # C'est une bonne pratique de sécurité, même si `frappe.db.count` le fait implicitement.
        if not frappe.db.exists("DocType", doctype_name) or not frappe.has_permission(doctype_name, "read"):
             # Ne retourne pas d'erreur explicite pour ne pas révéler d'informations sensibles.
             # Retourne 0 si le Doctype n'existe pas ou si l'utilisateur n'a pas la permission.
             return 0
        # Compte les documents du Doctype spécifié
        count = frappe.db.count(doctype_name)
        return count
    except Exception as e:
        # Enregistre l'erreur pour le débogage côté serveur
        frappe.log_error(f"Erreur lors du comptage de {doctype_name} dans get_doctype_count: {e}", "Home Badges Count")
        # Retourne 0 en cas d'erreur inattendue
        return 0