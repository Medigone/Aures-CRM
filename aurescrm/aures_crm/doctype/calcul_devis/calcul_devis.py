# Copyright (c) 2026, Aures Emballages and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, cint
import math


class CalculDevis(Document):
    def autoname(self):
        from frappe.model.naming import make_autoname
        self.name = make_autoname("CALC-.YYYY.-.#####")

    def validate(self):
        self.calculate_surface()
        self.calculate_support_cost()
        self.calculate_costs()

    def before_save(self):
        self.calculate_surface()
        self.calculate_support_cost()
        self.calculate_costs()

    def calculate_surface(self):
        """
        Calcule la surface de la feuille à partir du format d'impression.
        Format attendu: "720x450" (largeur x hauteur en mm)
        Surface en m² = (largeur × hauteur) / 1,000,000
        """
        self.surface_feuille = 0
        self.poids_feuille = 0
        
        if self.format_imp:
            try:
                # Parser le format "LARGEURxHAUTEUR" ou "LARGEUR×HAUTEUR"
                format_str = str(self.format_imp).lower().replace('×', 'x')
                if 'x' in format_str:
                    parts = format_str.split('x')
                    largeur = flt(parts[0].strip())
                    hauteur = flt(parts[1].strip())
                    
                    # Calculer la surface en m²
                    self.surface_feuille = (largeur * hauteur) / 1000000
                    
                    # Calculer le poids si grammage disponible
                    grammage = cint(self.grammage) or 0
                    if grammage > 0 and self.surface_feuille > 0:
                        # Poids en grammes = surface (m²) × grammage (g/m²)
                        self.poids_feuille = flt(self.surface_feuille) * grammage
            except Exception:
                # En cas d'erreur de parsing, on garde les valeurs à 0
                pass

    def calculate_support_cost(self):
        """
        Calcule le coût du support par feuille à partir du coût au kg.
        Coût/feuille = (poids en g / 1000) × coût/kg
        """
        self.cout_support_feuille = 0
        
        poids_feuille = flt(self.poids_feuille or 0)
        cout_support_kg = flt(self.cout_support_kg or 0)
        
        if poids_feuille > 0 and cout_support_kg > 0:
            # Convertir le poids en kg (diviser par 1000) puis multiplier par le coût/kg
            self.cout_support_feuille = (poids_feuille / 1000) * cout_support_kg

    def calculate_costs(self):
        """
        Calcule le support et les coûts des postes de production.
        
        1. Quantité Feuilles = Quantité commandée ÷ Nombre de poses
        2. Feuilles avec Gâche = Feuilles × (1 + Taux Gâche%)
        3. Coût Support Total = Coût Support/Feuille × Feuilles avec gâche
        4. Total Coûts Fixes = Σ(coût fixe × passages)
        5. Total Coûts Variables = Σ(coût unitaire × passages × quantité de référence)
        6. Coût Total = Support + Fixes + Variables
        7. Coût Unitaire = Coût Total ÷ Quantité commandée
        8. Prix Unitaire = Coût Unitaire × (1 + Marge%)
        9. Prix Total = Prix Unitaire × Quantité commandée
        """
        
        # 1. Quantité de feuilles nécessaires = Quantité ÷ Nombre de poses
        nbr_poses = cint(self.nbr_poses) or 1
        quantite = flt(self.quantite or 0)
        self.quantite_feuilles = math.ceil(quantite / nbr_poses) if nbr_poses > 0 else 0
        
        # 2. Feuilles avec gâche de tirage
        taux_gache = flt(self.taux_gache_tirage or 0) / 100
        self.quantite_feuilles_gache = math.ceil(flt(self.quantite_feuilles) * (1 + taux_gache))

        # 3. Coût total du support pour les feuilles avec gâche
        self.cout_support_total = flt(self.cout_support_feuille or 0) * flt(
            self.quantite_feuilles_gache
        )

        # 4 et 5. Totaux issus des postes saisis manuellement
        total_fixes = 0
        total_variables = 0

        for poste in self.postes or []:
            passages = cint(poste.nombre_passages) or 1
            total_fixes += flt(poste.cout_fixe or 0) * passages

            if poste.unite_calcul == "Par feuille":
                quantite_reference = flt(self.quantite_feuilles_gache)
            elif poste.unite_calcul == "Par 1000 unités":
                quantite_reference = quantite / 1000
            else:
                # Un forfait est appliqué une fois par passage.
                quantite_reference = 1

            total_variables += (
                flt(poste.cout_variable_unitaire or 0) * passages * quantite_reference
            )

        self.total_couts_fixes = total_fixes
        self.total_couts_variables = total_variables

        # 6. Coût total = support + coûts fixes + coûts variables
        self.cout_total = (
            flt(self.cout_support_total)
            + flt(self.total_couts_fixes)
            + flt(self.total_couts_variables)
        )
        
        # 7. Coût unitaire = Coût total / Quantité commandée
        if quantite > 0:
            self.cout_unitaire = flt(self.cout_total) / quantite
        else:
            self.cout_unitaire = 0
        
        # 8. Prix unitaire proposé = Coût unitaire × (1 + Marge%)
        marge_multiplier = 1 + (flt(self.marge_percent or 0) / 100)
        self.prix_unitaire_propose = flt(self.cout_unitaire) * marge_multiplier
        
        # 9. Prix total proposé = Prix unitaire × Quantité
        self.prix_total_propose = flt(self.prix_unitaire_propose) * quantite


@frappe.whitelist()
def generate_calcul_devis_for_quotation(quotation_name):
    """
    Génère un Calcul Devis pour chaque ligne article du Devis (Quotation Item).
    Évite les doublons par ligne via quotation_item_row lorsque le champ existe.
    
    Args:
        quotation_name: Nom du Devis (Quotation)
    
    Returns:
        dict: Résultat avec le nombre de documents créés
    """
    quotation = frappe.get_doc("Quotation", quotation_name)
    has_row_field = frappe.get_meta("Calcul Devis").has_field("quotation_item_row")

    created_count = 0
    skipped_count = 0
    created_docs = []

    sorted_items = sorted(quotation.items, key=lambda r: (r.idx or 0, r.name or ""))

    for item in sorted_items:
        if not item.item_code:
            continue

        if has_row_field and item.name:
            existing = frappe.db.exists(
                "Calcul Devis", {"devis": quotation_name, "quotation_item_row": item.name}
            )
        else:
            existing = frappe.db.exists(
                "Calcul Devis",
                {"devis": quotation_name, "article": item.item_code, "quantite": item.qty},
            )

        if existing:
            skipped_count += 1
            continue

        calcul_devis = frappe.new_doc("Calcul Devis")
        calcul_devis.devis = quotation_name
        calcul_devis.client = quotation.custom_id_client
        calcul_devis.article = item.item_code
        calcul_devis.quantite = item.qty
        if has_row_field and item.name:
            calcul_devis.quotation_item_row = item.name

        imposition = frappe.db.get_value(
            "Imposition", {"article": item.item_code, "defaut": 1}, "name"
        )
        if imposition:
            calcul_devis.imposition = imposition

        calcul_devis.taux_gache_tirage = 3

        calcul_devis.insert(ignore_permissions=True)
        created_docs.append(calcul_devis.name)
        created_count += 1

    return {
        "created": created_count,
        "skipped": skipped_count,
        "documents": created_docs,
        "message": _("{0} Calcul(s) Devis créé(s), {1} ignoré(s) (déjà existants)").format(
            created_count, skipped_count
        ),
    }
