from frappe.model.document import Document
import frappe
from frappe.utils import now, get_datetime, get_fullname, today

class VisiteCommerciale(Document):
    def before_save(self):
        # 1. Vérifie si le champ 'utilisateur' est vide, et le remplit avec l'ID (email) de l'utilisateur connecté
        if not self.utilisateur:
            self.utilisateur = frappe.session.user

        # 2. Vérifie si le champ 'nom_utilisateur' est vide, et le remplit avec le full_name du créateur
        # if not self.nom_utilisateur:
        #     self.nom_utilisateur = get_fullname(self.owner)

        # 3. Si le statut passe à "En Cours" et que 'heure_debut_visite' n'est pas encore définie, la mettre à jour
        if self.status == "En Cours" and not self.heure_debut_visite:
            current_time = now()
            self.heure_debut_visite = current_time
            self.date = today()

        # On appelle la méthode pour s'assurer que 'date' est à jour 
        # si on repasse en "En Cours" ou qu'on sauvegarde à nouveau
        self.set_date_when_in_progress()

    def before_submit(self):
        """
        Appelée juste avant de passer docstatus=0 à docstatus=1
        """
        # On décide que la soumission correspond au statut "Terminé"
        # ou bien on vérifie explicitement si doc.status == "Terminé"
        if self.status == "Terminé":
            # Si heure_fin_visite n'existe pas, on la met
            if not self.heure_fin_visite:
                self.heure_fin_visite = now()

            # Calcul de la durée
            if self.heure_debut_visite and self.heure_fin_visite:
                start_time = get_datetime(self.heure_debut_visite)
                end_time = get_datetime(self.heure_fin_visite)
                duration_in_minutes = (end_time - start_time).total_seconds() / 60
                self.duree_visite = round(duration_in_minutes)

    def set_date_when_in_progress(self):
        """
        Méthode pour (ré)initialiser le champ 'date' 
        lorsque le statut est 'En Cours'. 
        """
        if self.status == "En Cours":
            self.date = today()
