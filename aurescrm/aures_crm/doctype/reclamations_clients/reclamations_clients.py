# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import add_to_date, now_datetime, getdate

class ReclamationsClients(Document):
    def validate(self):
        # Si la date de création est renseignée, on calcule la date d'échéance (+10 jours)
        if self.date_creation:
            self.date_echeance = add_to_date(self.date_creation, days=10)
        
        # Si la date d'échéance est dépassée et que le statut est "Nouveau" ou "En Traitement",
        # on met à jour le statut à "En retard"
        if (self.date_echeance and 
            getdate(now_datetime()) > getdate(self.date_echeance) and 
            self.status in ["Nouveau", "En Traitement"]):
            self.status = "En retard"
        
        # Si le statut passe à "Traité" et que la date de résolution n'est pas encore renseignée,
        # on enregistre la date de résolution (la date courante)
        if self.status == "Traité" and not self.date_resolution:
            self.date_resolution = now_datetime()

def update_reclamations_status():
    """
    Parcourt les documents "Reclamations Clients" dont le statut est "Nouveau" ou "En Traitement"
    et met à jour leur statut à "En retard" si la date d'échéance est dépassée.
    """
    reclamations = frappe.get_all(
        "Reclamations Clients",
        filters={
            "status": ["in", ["Nouveau", "En Traitement"]]
        },
        fields=["name", "date_creation", "date_echeance", "status"]
    )

    for rec in reclamations:
        # Si la date d'échéance n'est pas renseignée mais la date de création est présente,
        # on calcule la date d'échéance à +10 jours
        if not rec.get("date_echeance") and rec.get("date_creation"):
            date_echeance = add_to_date(rec.get("date_creation"), days=10)
        else:
            date_echeance = rec.get("date_echeance")
        
        # Si la date d'échéance est dépassée, on met à jour le statut à "En retard"
        if date_echeance and getdate(now_datetime()) > getdate(date_echeance):
            frappe.db.set_value("Reclamations Clients", rec.name, "status", "En retard")
