import frappe

@frappe.whitelist()
def generate_etude_faisabilite(docname):
    """
    Pour chaque ligne de la table 'liste_articles' du document Demande Faisabilite,
    crée un nouveau document 'Etude Faisabilite' et met à jour le statut de la demande.
    """
    try:
        # Récupérer le document Demande Faisabilite
        demande = frappe.get_doc("Demande Faisabilite", docname)
        
        # Vérifier s'il y a des articles dans la liste
        if not demande.get("liste_articles"):
            frappe.throw("Aucun article n'a été ajouté à la demande.")
        
        # Pour chaque article, créer un document Etude Faisabilite
        for row in demande.get("liste_articles"):
            etude = frappe.new_doc("Etude Faisabilite")
            etude.demande_faisabilite = demande.name
            etude.article = row.article
            etude.quantite = row.quantite  # Assurez-vous que le doctype Etude Faisabilite possède ce champ
            etude.date_livraison = row.date_livraison  # Vous pouvez adapter la logique de date si nécessaire
            etude.client = demande.client
            etude.commercial = demande.commercial
            etude.id_commercial = demande.id_commercial
            # Ajoutez ici d'autres affectations si besoin
            
            etude.insert(ignore_permissions=True)
        
        # Mise à jour du statut de la demande en "Confirmée"
        demande.status = "Confirmée"
        demande.save(ignore_permissions=True)
        
        return demande.status
        
    except Exception as e:
        frappe.log_error(message=str(e), title="Erreur generate_etude_faisabilite")
        frappe.throw("Une erreur est survenue lors de la génération des études de faisabilité.")
