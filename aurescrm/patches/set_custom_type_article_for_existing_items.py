import frappe

def execute():
    """
    Patch pour mettre à jour tous les articles existants avec custom_type_article = 'Client'
    Tous les articles créés jusqu'à présent sont considérés comme des articles de type Client.
    """
    
    # Vérifier si le champ custom_type_article existe
    if not frappe.db.has_column("Item", "custom_type_article"):
        frappe.log("Le champ custom_type_article n'existe pas – patch ignoré")
        return
    
    # Compter les articles à mettre à jour (ceux sans valeur pour custom_type_article)
    pre_blank = frappe.db.count("Item", {
        "custom_type_article": ("in", [None, ""])
    })
    
    if pre_blank == 0:
        frappe.log("Aucun article vierge – rien à faire")
        return
    
    frappe.log(f"Début de la mise à jour de {pre_blank} articles avec custom_type_article = 'Client'")
    
    try:
        # Mise à jour en une requête pour la performance
        frappe.db.sql("""
            UPDATE `tabItem`
            SET `custom_type_article` = 'Client'
            WHERE custom_type_article IS NULL OR custom_type_article = ''
        """)
        
        # Valider les changements
        frappe.db.commit()
        
        # Log final avec le nombre exact d'articles mis à jour
        frappe.log(f"Patch terminé : {pre_blank} articles mis à jour avec succès")
        
    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(f"Erreur lors de l'exécution du patch: {str(e)}")
        raise e