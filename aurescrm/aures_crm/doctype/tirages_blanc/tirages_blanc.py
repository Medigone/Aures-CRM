# Copyright (c) 2024, Medigo and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document
import frappe

class TiragesBlanc(Document):
    def before_save(self):
        # 1. Vérifier si le champ 'utilisateur' est vide, et le remplir avec l'ID (email) du créateur (owner)
        if not self.utilisateur:
            self.utilisateur = self.owner  # Définit 'utilisateur' avec le propriétaire initial (créateur)

        # 2. Remplir le champ 'nom_utilisateur' avec le nom complet de l'utilisateur
        if self.utilisateur:
            # Récupérer le nom complet de l'utilisateur via frappe.get_fullname
            self.nom_utilisateur = frappe.utils.get_fullname(self.utilisateur)
