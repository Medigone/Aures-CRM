# Copyright (c) 2024, Medigo and Contributors
# See license.txt

# import frappe
from frappe.tests.utils import FrappeTestCase
import frappe
from frappe.utils import now_datetime
from datetime import datetime


class TestVisiteCommerciale(FrappeTestCase):
	pass

# Server Script - Before Save


if doc.status == "Terminé" and not doc.heure_fin_visite:
    # Récupérer la date et l'heure actuelles
    now = now_datetime()

    # Mettre à jour le champ 'heure_fin_visite' avec l'heure actuelle
    doc.heure_fin_visite = now

    # Calculer la durée entre 'heure_debut_visite' et 'heure_fin_visite' si elles sont toutes les deux définies
    if doc.heure_debut_visite and doc.heure_fin_visite:
        # Convertir les heures en format datetime
        start_time = frappe.utils.get_datetime(doc.heure_debut_visite)
        end_time = frappe.utils.get_datetime(doc.heure_fin_visite)

        # Calculer la durée en minutes
        duration_in_minutes = (end_time - start_time).total_seconds() / 60

        # Arrondir la durée à l'entier le plus proche
        doc.duree_visite = round(duration_in_minutes)
