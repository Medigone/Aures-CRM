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
        self.calculate_finitions_cost()
        self.calculate_costs()

    def before_save(self):
        self.calculate_surface()
        self.calculate_support_cost()
        self.calculate_finitions_cost()
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

    def calculate_finitions_cost(self):
        """
        Calcule le coût total des finitions par feuille.
        Pour chaque finition active, coût = surface (m²) × coût/m²
        """
        surface = flt(self.surface_feuille or 0)
        total_finitions = 0
        
        # Liste des finitions avec leur champ check et leur champ coût
        finitions = [
            # Finitions de type Select (non vide et différent de "Sans")
            ('fin_pelliculage', 'cout_pelliculage_m2', 'select'),
            ('fin_marquage_chaud', 'cout_marquage_chaud_m2', 'select'),
            # Finitions de type Check (booléen)
            ('fin_acrylique', 'cout_acrylique_m2', 'check'),
            ('fin_uv', 'cout_uv_m2', 'check'),
            ('fin_selectif', 'cout_selectif_m2', 'check'),
            ('fin_drip_off', 'cout_drip_off_m2', 'check'),
            ('fin_mat_gras', 'cout_mat_gras_m2', 'check'),
            ('fin_blister', 'cout_blister_m2', 'check'),
            ('fin_recto_verso', 'cout_recto_verso_m2', 'check'),
            ('fin_fenetre', 'cout_fenetre_m2', 'check'),
            ('fin_braille', 'cout_braille_m2', 'check'),
            ('fin_gaufrage', 'cout_gaufrage_m2', 'check'),
            ('fin_massicot', 'cout_massicot_m2', 'check'),
            ('fin_collerette', 'cout_collerette_m2', 'check'),
            ('fin_blanc_couvrant', 'cout_blanc_couvrant_m2', 'check'),
        ]
        
        for fin_field, cout_field, field_type in finitions:
            fin_value = self.get(fin_field)
            cout_m2 = flt(self.get(cout_field) or 0)
            
            # Vérifier si la finition est active
            is_active = False
            if field_type == 'select':
                # Pour les champs Select: actif si non vide et différent de "Sans"
                is_active = fin_value and str(fin_value).strip().lower() != 'sans'
            else:
                # Pour les champs Check: actif si = 1
                is_active = cint(fin_value) == 1
            
            if is_active and cout_m2 > 0 and surface > 0:
                total_finitions += surface * cout_m2
        
        self.total_cout_finitions_feuille = total_finitions

    def calculate_costs(self):
        """
        Calcule les coûts selon l'approche par feuille:
        
        1. Quantité Feuilles = Quantité commandée ÷ Nombre de poses
        2. Feuilles avec Gâche = Feuilles × (1 + Taux Gâche%)
        3. Total Coûts Fixes = Σ(coûts fixes)
        4. Total Coûts Variables = Σ(coûts par feuille) × Feuilles avec gâche
        5. Coût Total = Fixes + Variables
        6. Coût Unitaire = Coût Total ÷ Quantité commandée
        7. Prix Unitaire = Coût Unitaire × (1 + Marge%)
        """
        
        # 1. Quantité de feuilles nécessaires = Quantité ÷ Nombre de poses
        nbr_poses = cint(self.nbr_poses) or 1
        quantite = flt(self.quantite or 0)
        self.quantite_feuilles = math.ceil(quantite / nbr_poses) if nbr_poses > 0 else 0
        
        # 2. Feuilles avec gâche de tirage
        taux_gache = flt(self.taux_gache_tirage or 0) / 100
        self.quantite_feuilles_gache = math.ceil(flt(self.quantite_feuilles) * (1 + taux_gache))
        
        # 3. Total des coûts fixes
        self.total_couts_fixes = (
            flt(self.cout_calage or 0) +
            flt(self.cout_plaques_cliches or 0) +
            flt(self.cout_forme_decoupe or 0) +
            flt(self.cout_prepresse or 0) +
            flt(self.cout_autres_fixes or 0)
        )
        
        # 4. Total des coûts variables = (coûts par feuille) × (feuilles avec gâche)
        # Inclut: support + finitions + encres + MO + autres
        cout_par_feuille = (
            flt(self.cout_support_feuille or 0) +
            flt(self.total_cout_finitions_feuille or 0) +
            flt(self.cout_encres_feuille or 0) +
            flt(self.cout_mo_feuille or 0) +
            flt(self.cout_autres_feuille or 0)
        )
        self.total_couts_variables = cout_par_feuille * flt(self.quantite_feuilles_gache)
        
        # 5. Coût total = Fixes + Variables
        self.cout_total = flt(self.total_couts_fixes) + flt(self.total_couts_variables)
        
        # 6. Coût unitaire = Coût total / Quantité commandée
        if quantite > 0:
            self.cout_unitaire = flt(self.cout_total) / quantite
        else:
            self.cout_unitaire = 0
        
        # 7. Prix unitaire proposé = Coût unitaire × (1 + Marge%)
        marge_multiplier = 1 + (flt(self.marge_percent or 0) / 100)
        self.prix_unitaire_propose = flt(self.cout_unitaire) * marge_multiplier
        
        # 8. Prix total proposé = Prix unitaire × Quantité
        self.prix_total_propose = flt(self.prix_unitaire_propose) * quantite


@frappe.whitelist()
def generate_calcul_devis_for_quotation(quotation_name):
    """
    Génère un Calcul Devis pour chaque article du Devis.
    Évite les doublons si un Calcul Devis existe déjà pour l'article.
    
    Args:
        quotation_name: Nom du Devis (Quotation)
    
    Returns:
        dict: Résultat avec le nombre de documents créés
    """
    quotation = frappe.get_doc("Quotation", quotation_name)
    
    created_count = 0
    skipped_count = 0
    created_docs = []
    
    for item in quotation.items:
        # Vérifier si un Calcul Devis existe déjà pour cet article et ce devis
        existing = frappe.db.exists("Calcul Devis", {
            "devis": quotation_name,
            "article": item.item_code
        })
        
        if existing:
            skipped_count += 1
            continue
        
        # Créer le Calcul Devis
        calcul_devis = frappe.new_doc("Calcul Devis")
        calcul_devis.devis = quotation_name
        calcul_devis.client = quotation.custom_id_client
        calcul_devis.article = item.item_code
        calcul_devis.quantite = item.qty
        
        # Rechercher l'imposition par défaut (idéale) pour cet article
        imposition = frappe.db.get_value("Imposition", 
            {"article": item.item_code, "defaut": 1}, 
            "name"
        )
        if imposition:
            calcul_devis.imposition = imposition
        
        # Valeur par défaut pour le taux de gâche
        calcul_devis.taux_gache_tirage = 3  # 3% par défaut
        
        calcul_devis.insert(ignore_permissions=True)
        created_docs.append(calcul_devis.name)
        created_count += 1
    
    return {
        "created": created_count,
        "skipped": skipped_count,
        "documents": created_docs,
        "message": _("{0} Calcul(s) Devis créé(s), {1} ignoré(s) (déjà existants)").format(
            created_count, skipped_count
        )
    }
