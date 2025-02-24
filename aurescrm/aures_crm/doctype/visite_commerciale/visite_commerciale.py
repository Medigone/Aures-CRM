from frappe.model.document import Document
import frappe
from frappe.utils import now, get_datetime, get_fullname, today

class VisiteCommerciale(Document):
    def before_save(self):
        """Exécute les vérifications et mises à jour avant la sauvegarde."""
        
        # 1. Vérifier et assigner l'utilisateur actuel si non défini
        if not self.utilisateur:
            self.utilisateur = frappe.session.user

        # 2. Définir la date et l'heure de début si le statut est "En Cours"
        if self.status == "En Cours" and not self.heure_debut_visite:
            self.heure_debut_visite = now()
            self.date = today()

        # 3. Si la visite est "Terminée", gérer l'heure de fin et la durée
        if self.status == "Terminé":
            self.set_fin_visite_et_duree()

        # 4. Mise à jour de la date si le statut est "En Cours"
        self.set_date_when_in_progress()

    def before_submit(self):
        """
        Exécuté juste avant la soumission du document (docstatus=0 → docstatus=1).
        Vérifie si la visite est marquée comme "Terminé" et met à jour les champs nécessaires.
        """
        if self.status == "Terminé":
            self.set_fin_visite_et_duree()

    def set_fin_visite_et_duree(self):
        """
        Définit automatiquement l'heure de fin et calcule la durée de la visite
        si le statut est "Terminé".
        """
        if not self.heure_fin_visite:
            self.heure_fin_visite = now()

        if self.heure_debut_visite and self.heure_fin_visite:
            start_time = get_datetime(self.heure_debut_visite)
            end_time = get_datetime(self.heure_fin_visite)
            self.duree_visite = round((end_time - start_time).total_seconds() / 60)

    def set_date_when_in_progress(self):
        """
        Met à jour la date lorsque le statut est "En Cours".
        """
        if self.status == "En Cours":
            self.date = today()
