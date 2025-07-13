import frappe

def execute():
    """
    Patch pour mettre à jour tous les articles existants avec custom_type_article = 'Client'
    Tous les articles créés jusqu'à présent sont considérés comme des articles de type Client.
    """
    
    # Obtenir tous les articles existants
    items = frappe.db.get_all("Item", pluck="name")
    
    if not items:
        frappe.log_error("Aucun article trouvé dans la base de données")
        return
    
    frappe.log_error(f"Début de la mise à jour de {len(items)} articles avec custom_type_article = 'Client'")
    
    # Compteur pour suivre les mises à jour
    updated_count = 0
    
    try:
        for item_name in items:
            # Vérifier si l'article a déjà une valeur pour custom_type_article
            current_value = frappe.db.get_value("Item", item_name, "custom_type_article")
            
            # Mettre à jour seulement si le champ est vide
            if not current_value:
                frappe.db.set_value("Item", item_name, "custom_type_article", "Client", update_modified=False)
                updated_count += 1
        
        # Valider les changements
        frappe.db.commit()
        
        frappe.log_error(f"Patch terminé avec succès. {updated_count} articles mis à jour avec custom_type_article = 'Client'")
        
    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(f"Erreur lors de l'exécution du patch: {str(e)}")
        raise e