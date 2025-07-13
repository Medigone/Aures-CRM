import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

def execute():
    """
    Patch pour mettre à jour tous les articles existants avec custom_type_article = 'Client'
    Tous les articles créés jusqu'à présent sont considérés comme des articles de type Client.
    """
    
    # Forcer la synchronisation du DocType Item pour s'assurer que tous les champs personnalisés sont créés
    try:
        frappe.reload_doc("stock", "doctype", "item")
        frappe.db.commit()
    except Exception as e:
        frappe.log_error(f"Erreur lors du rechargement du DocType Item: {str(e)}")
    
    # Vérifier si le champ custom_type_article existe dans la table Item
    if not frappe.db.has_column("tabItem", "custom_type_article"):
        frappe.log_error("Le champ custom_type_article n'existe pas encore dans la table Item. Le patch sera ignoré.")
        return
    
    try:
        # Compter le nombre d'articles existants
        total_items = frappe.db.sql("SELECT COUNT(*) FROM `tabItem`")[0][0]
        
        if total_items == 0:
            frappe.log_error("Aucun article trouvé dans la base de données")
            return
        
        frappe.log_error(f"Début de la mise à jour de {total_items} articles avec custom_type_article = 'Client'")
        
        # Mettre à jour tous les articles où custom_type_article est NULL ou vide
        # Utilisation d'une requête SQL directe pour plus d'efficacité
        updated_count = frappe.db.sql("""
            UPDATE `tabItem` 
            SET `custom_type_article` = 'Client'
            WHERE (`custom_type_article` IS NULL OR `custom_type_article` = '')
        """)
        
        # Valider les changements
        frappe.db.commit()
        
        # Compter les articles mis à jour
        final_count = frappe.db.sql("""
            SELECT COUNT(*) FROM `tabItem` 
            WHERE `custom_type_article` = 'Client'
        """)[0][0]
        
        frappe.log_error(f"Patch terminé avec succès. {final_count} articles ont maintenant custom_type_article = 'Client'")
        
    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(f"Erreur lors de l'exécution du patch: {str(e)}")
        print(f"Erreur lors de l'exécution du patch: {str(e)}")
        raise e