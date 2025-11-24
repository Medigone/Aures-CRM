from frappe.model.document import Document
import frappe
from frappe.utils import now, get_datetime, get_fullname, today

class VisiteCommerciale(Document):
    def before_save(self):
        """Exécute les vérifications et mises à jour avant la sauvegarde."""
        
        # 1. Vérifier et assigner l'utilisateur actuel si non défini
        if not self.utilisateur:
            self.utilisateur = frappe.session.user

        # 1.b Enregistrer le full name de l'utilisateur dans le champ 'nom_utilisateur'
        if not self.nom_utilisateur:
            self.nom_utilisateur = get_fullname(self.utilisateur)

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

@frappe.whitelist()
def get_events(start, end, filters=None):
    """
    Récupère les événements pour le calendrier avec des couleurs personnalisées selon le statut.
    """
    if not frappe.has_permission("Visite Commerciale", "read"):
        return []

    conditions = [
        ["date", ">=", start],
        ["date", "<=", end]
    ]
    
    if filters:
        if isinstance(filters, str):
            import json
            filters = json.loads(filters)
        
        if isinstance(filters, dict):
            for key, value in filters.items():
                conditions.append([key, "=", value])
        elif isinstance(filters, list):
            for filter in filters:
                conditions.append(filter)

    events = frappe.db.get_all("Visite Commerciale", filters=conditions, fields=["name", "date", "nom_client", "client", "status"])

    for event in events:
        event["start"] = event.get("date")
        event["end"] = event.get("date")
        event["title"] = event.get("nom_client") or event.get("client")
        
        if event["status"] == "Nouveau":
            event["color"] = "#d0ebff" # Bleu clair
        elif event["status"] == "En Cours":
            event["color"] = "#ffec99" # Orange clair
        elif event["status"] == "Terminé":
            event["color"] = "#b2f2bb" # Vert clair
        elif event["status"] == "Annulé":
            event["color"] = "#e9ecef" # Gris clair
            
    return events