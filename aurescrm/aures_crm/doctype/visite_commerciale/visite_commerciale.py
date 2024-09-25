# Copyright (c) 2024, Medigo and contributors
# For license information, please see license.txt

from frappe.model.document import Document
import frappe
from frappe.model.mapper import get_mapped_doc
from frappe.utils import now, get_datetime, now_datetime  # Import pour gérer la date et l'heure

class VisiteCommerciale(Document):
    def before_save(self):
        # 1. Vérifie si le champ 'utilisateur' est vide, et le remplit avec le créateur (owner) si nécessaire
        if not self.utilisateur:
            self.utilisateur = self.owner  # Définit 'utilisateur' avec le propriétaire initial (créateur)

        # 2. Si le statut passe à "En Cours" et que 'heure_debut_visite' n'est pas encore définie, la mettre à jour
        if self.status == "En Cours" and not self.heure_debut_visite:
            now = frappe.utils.now()  # Récupère l'heure actuelle
            self.heure_debut_visite = now  # Mise à jour du champ 'heure_debut_visite' avec l'heure actuelle

        # 3. Si le statut est "Terminé" et que 'heure_fin_visite' n'est pas encore définie, la mettre à jour
        if self.status == "Terminé" and not self.heure_fin_visite:
            now = frappe.utils.now()  # Utilise frappe.utils.now() pour obtenir l'heure actuelle
            self.heure_fin_visite = now  # Met à jour le champ 'heure_fin_visite'

            # 4. Calculer la durée entre 'heure_debut_visite' et 'heure_fin_visite' si elles sont toutes deux présentes
            if self.heure_debut_visite and self.heure_fin_visite:
                start_time = frappe.utils.get_datetime(self.heure_debut_visite)
                end_time = frappe.utils.get_datetime(self.heure_fin_visite)

                # Calcul de la durée en minutes
                duration_in_minutes = (end_time - start_time).total_seconds() / 60

                # Arrondir la durée à l'entier le plus proche
                self.duree_visite = round(duration_in_minutes)

@frappe.whitelist()
def make_quotation_from_visite_commerciale(source_name, target_doc=None):
    # Fonction pour mapper les valeurs manquantes dans le Quotation
    def set_missing_values(source, target):
        target.quotation_to = "Customer"
        # Tu peux définir ici d'autres valeurs par défaut ou calculées

    # Utilise get_mapped_doc pour mapper Visite Commerciale vers Quotation
    target_doc = get_mapped_doc(
        "Visite Commerciale",  # Source DocType
        source_name,  # Le nom de la Visite Commerciale à mapper
        {
            "Visite Commerciale": {
                "doctype": "Quotation",  # Destination DocType
                "field_map": {
                    "client": "party_name",  # Mapping du champ client
                },
                "field_no_map": [
                    "naming_series",  # Si tu veux ignorer certains champs dans la destination
                ]
            }
        },
        target_doc,
        set_missing_values  # Appelle la fonction pour ajouter les valeurs manquantes
    )

    # Si nécessaire, applique des règles ou logiques spécifiques après le mappage
    target_doc.run_method("set_missing_values")
    target_doc.run_method("calculate_taxes_and_totals")

    # Récupération de valeurs depuis Visite Commerciale pour compléter le Quotation
    customer = frappe.db.get_value("Customer", {"name": target_doc.party_name}, ["default_price_list", "default_currency"])
    if customer:
        target_doc.selling_price_list = customer[0]
        target_doc.currency = customer[1]

    return target_doc
