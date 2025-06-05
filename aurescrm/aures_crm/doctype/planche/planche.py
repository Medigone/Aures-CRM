# planche.py
# Copyright (c) 2025, Medigo and contributors
# Pour la licence, voir license.txt

import frappe
from frappe.model.document import Document

class Planche(Document):

    def autoname(self):
        """
        Cette méthode est appelée automatiquement par Frappe
        pour déterminer la valeur de self.name avant l'insertion.
        On force ici le format 'PLA-<largeur>x<hauteur>'.
        """
        # S’assurer que largeur et hauteur sont bien renseignés
        if not self.largeur or not self.hauteur:
            frappe.throw("Les champs 'largeur' et 'hauteur' doivent être renseignés pour générer le nom.")
        
        # Nettoyer/convertir en string (si nécessaire)
        largeur_str = str(self.largeur).strip()
        hauteur_str = str(self.hauteur).strip()
        
        # Générer le nom
        self.name = f"PLA-{largeur_str}x{hauteur_str}"
