from frappe.model.document import Document
import frappe
from frappe.model.mapper import get_mapped_doc
from frappe.utils import now, get_datetime, get_fullname, today  # Importez 'today'

class VisiteCommerciale(Document):
    def before_save(self):

        # 1. Vérifie si le champ 'utilisateur' est vide, et le remplit avec l'ID (email) de l'utilisateur connecté
        if not self.utilisateur:
            self.utilisateur = frappe.session.user

        # 2. Vérifie si le champ 'nom_utilisateur' est vide, et le remplit avec le full_name du créateur
        if not self.nom_utilisateur:
            self.nom_utilisateur = get_fullname(self.owner)

        # 3. Si le statut passe à "En Cours" et que 'heure_debut_visite' n'est pas encore définie, la mettre à jour
        if self.status == "En Cours" and not self.heure_debut_visite:
            now = frappe.utils.now()  # Récupère l'heure actuelle
            self.heure_debut_visite = now
            self.date = today()  # Enregistre la date actuelle dans le champ 'date'

        # 4. Si le statut est "Terminé" et que 'heure_fin_visite' n'est pas encore définie, la mettre à jour
        if self.status == "Terminé" and not self.heure_fin_visite:
            now = frappe.utils.now()
            self.heure_fin_visite = now

            # 5. Calculer la durée entre 'heure_debut_visite' et 'heure_fin_visite' si elles sont toutes deux présentes
            if self.heure_debut_visite and self.heure_fin_visite:
                start_time = frappe.utils.get_datetime(self.heure_debut_visite)
                end_time = frappe.utils.get_datetime(self.heure_fin_visite)

                # Calcul de la durée en minutes
                duration_in_minutes = (end_time - start_time).total_seconds() / 60

                # Arrondir la durée à l'entier le plus proche
                self.duree_visite = round(duration_in_minutes)
