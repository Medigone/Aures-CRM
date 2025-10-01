# -*- coding: utf-8 -*-
"""
Patch de migration : Ajout des champs couleur au Doctype Maquette
Date : Octobre 2025
Objectif : Ajouter les champs de gestion des couleurs CMJN et Pantone sans casser les données existantes.
"""

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

def execute():
    """
    Ajoute les nouveaux champs couleur au Doctype Maquette et crée les child doctypes.
    Cette fonction est idempotente et peut être exécutée plusieurs fois sans risque.
    """
    
    frappe.logger().info("=== Début du patch : Ajout des champs couleur à Maquette ===")
    
    # Étape 1 : Synchroniser les doctypes (child tables créées)
    try:
        # Vérifier si les child doctypes existent déjà
        if not frappe.db.exists("DocType", "Maquette CMJN Ligne"):
            frappe.logger().info("Création du child doctype : Maquette CMJN Ligne")
        
        if not frappe.db.exists("DocType", "Maquette Spot Color"):
            frappe.logger().info("Création du child doctype : Maquette Spot Color")
        
        # Recharger le doctype Maquette pour prendre en compte les nouveaux champs
        frappe.reload_doc("aures_crm", "doctype", "maquette", force=True)
        frappe.reload_doc("aures_crm", "doctype", "maquette_cmjn_ligne", force=True)
        frappe.reload_doc("aures_crm", "doctype", "maquette_spot_color", force=True)
        
        frappe.logger().info("✓ Doctypes rechargés avec succès")
        
    except Exception as e:
        frappe.logger().error(f"Erreur lors du rechargement des doctypes : {str(e)}")
        raise
    
    # Étape 2 : Vérifier que les nouveaux champs existent
    try:
        maquette_meta = frappe.get_meta("Maquette")
        new_fields = [
            'mode_couleur', 
            'resume_couleurs', 
            'profil_icc_sortie',
            'tolerance_delta_e',
            'nombre_couleurs_process',
            'cmjn_details',
            'nombre_spot_colors',
            'spot_colors'
        ]
        
        existing_fields = [f.fieldname for f in maquette_meta.fields]
        
        for field in new_fields:
            if field in existing_fields:
                frappe.logger().info(f"✓ Champ '{field}' existe")
            else:
                frappe.logger().warning(f"⚠ Champ '{field}' n'existe pas encore")
        
    except Exception as e:
        frappe.logger().error(f"Erreur lors de la vérification des champs : {str(e)}")
        raise
    
    # Étape 3 : Migration des données existantes (si nécessaire)
    # Pour l'instant, aucune migration de données n'est nécessaire car ce sont de nouveaux champs
    # Les anciennes maquettes resteront sans mode_couleur défini
    
    try:
        # Compter les maquettes existantes
        nb_maquettes = frappe.db.count("Maquette")
        frappe.logger().info(f"Nombre de maquettes existantes : {nb_maquettes}")
        
        # Optionnel : Initialiser mode_couleur à vide pour les maquettes existantes
        # (déjà fait par défaut, mais on peut le confirmer)
        
        frappe.logger().info("✓ Migration des données terminée")
        
    except Exception as e:
        frappe.logger().error(f"Erreur lors de la migration des données : {str(e)}")
        raise
    
    # Étape 4 : Commit des changements
    frappe.db.commit()
    
    frappe.logger().info("=== Patch terminé avec succès : Ajout des champs couleur à Maquette ===")
    frappe.msgprint(
        f"Migration réussie : Les champs couleur ont été ajoutés au Doctype Maquette.<br>"
        f"Nombre de maquettes dans la base : {nb_maquettes}",
        title="Patch de migration",
        indicator="green"
    )

