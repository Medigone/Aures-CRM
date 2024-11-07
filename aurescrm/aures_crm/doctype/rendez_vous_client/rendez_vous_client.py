# Copyright (c) 2024, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class RendezVousClient(Document):
	pass


@frappe.whitelist()
def creer_visite_commerciale(client, commercial, date_heure):
    # Créer le document Visite Commerciale avec les informations fournies
    visite_commerciale = frappe.get_doc({
        "doctype": "Visite Commerciale",
        "client": client,
        "utilisateur": commercial,  # Utilisateur spécifié dans 'commercial'
        "date_rdv": date_heure       # Transfert de la date et heure du rendez-vous
    })
    
    # Insérer le document en base de données
    visite_commerciale.insert()
    
    # Retourner le nom du document créé pour la redirection
    return visite_commerciale.name



