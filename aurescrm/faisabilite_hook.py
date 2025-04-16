import frappe
from frappe import _

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



@frappe.whitelist()
def update_demande_status_from_etudes(doc, method):
    """
    Hook déclenché lors de la mise à jour d'un document "Etude Faisabilite".
    Il parcourt les études associées au parent "Demande Faisabilite" et
    met à jour son statut de la manière suivante :
      - "En Cours" si au moins une étude a le statut "En étude"
      - "Finalisée" si toutes les études ont le statut "Réalisable" ou "Non Réalisable"
      - "Partiellement Finalisée" si aucune étude n'est en "En étude" et au moins une est 
        "Réalisable" ou "Non Réalisable"
    
    La mise à jour n'intervient pas si le statut du parent est "Devis Établis" ou "Annulée".
    De plus, la mise à jour ne rétrograde pas le statut ; il y a une progression monotone.
    """
    parent_name = doc.demande_faisabilite
    if not parent_name:
        return

    parent = frappe.get_doc("Demande Faisabilite", parent_name)

    # Ne pas mettre à jour si le parent est dans un état final (hors Confirmée)
    if parent.status in ["Devis Établis", "Annulée"]:
        return

    # Récupérer les statuts de toutes les études liées
    etudes = frappe.get_all("Etude Faisabilite", filters={"demande_faisabilite": parent_name}, fields=["status"])
    if not etudes:
        return

    statuses = [e.status for e in etudes]

    # Calcul du nouveau statut en fonction des règles
    if any(s == "En étude" for s in statuses):
        computed_status = "En Cours"
    elif all(s in ["Réalisable", "Non Réalisable"] for s in statuses):
        computed_status = "Finalisée"
    elif any(s in ["Réalisable", "Non Réalisable"] for s in statuses):
        computed_status = "Partiellement Finalisée"
    else:
        # Si aucune règle ne s'applique, on ne modifie pas
        return

    # Classement des statuts pour assurer une progression monotone
    status_rank = {
        "Brouillon": 0,
        "Confirmée": 1,
        "En Cours": 2,
        "Partiellement Finalisée": 3,
        "Finalisée": 4
    }
    current_rank = status_rank.get(parent.status, 0)
    new_rank = status_rank.get(computed_status, 0)

    # Mise à jour uniquement si le nouveau statut est supérieur (progression) ou si le parent est en "Confirmée"
    if current_rank < new_rank or parent.status == "Confirmée":
        parent.status = computed_status
        parent.save(ignore_permissions=True)
        frappe.msgprint("Statut de la Demande Faisabilité mis à jour en: " + computed_status)


@frappe.whitelist()
def cancel_etudes_faisabilite(docname):
    """
    Tente d'annuler la Demande Faisabilite.
    Retourne un dict avec :
      - status: "ok" si annulée
      - status: "blocked" si études bloquantes
      - blocked_etudes: liste des ID bloquants
    """
    try:
        parent = frappe.get_doc("Demande Faisabilite", docname)

        etudes = frappe.get_all(
            "Etude Faisabilite",
            filters={"demande_faisabilite": docname},
            fields=["name", "status"]
        )

        bloquees = [e["name"] for e in etudes if e["status"] in ["Réalisable", "Non Réalisable"]]
        if bloquees:
            return {
                "status": "blocked",
                "blocked_etudes": bloquees
            }

        # Pas de blocage, on peut annuler
        parent.status = "Annulée"
        parent.save(ignore_permissions=True)

        return {
            "status": "ok"
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Erreur cancel_etudes_faisabilite")
        frappe.throw(_("Une erreur est survenue pendant l'annulation."))


@frappe.whitelist()
def get_articles_for_quotation(docname):
    """
    Retourne la liste des articles (et quantités) liés à une Demande Faisabilite
    via les Études de Faisabilité avec le statut "Réalisable".
    """
    try:
        etudes = frappe.get_all(
            "Etude Faisabilite",
            filters={
                "demande_faisabilite": docname,
                "status": "Réalisable"
            },
            fields=["article", "quantite"]
        )
        return etudes
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Erreur get_articles_for_quotation")
        frappe.throw(_("Impossible de récupérer les articles pour le devis."))
