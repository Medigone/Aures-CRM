# -*- coding: utf-8 -*-
# Copyright (c) 2024, Medigo and contributors
# For license information, please see license.txt

import frappe
import os
from frappe.utils import get_site_path

def after_install():
    """Hook appelé après l'installation de l'app"""
    setup_plan_flexo_assets()
    setup_rh_module()


def setup_rh_module():
    """Créer les rôles RH et les données de base du module Ressources Humaines"""
    try:
        from aurescrm.ressources_humaines.setup import setup_rh_module as _setup_rh
        _setup_rh()
    except Exception as e:
        frappe.log_error(f"Error setting up RH module: {str(e)}", "RH Module Setup")

def setup_plan_flexo_assets():
    """S'assurer que les assets pour Plan Flexo sont disponibles"""
    try:
        # Vérifier que l'image SVG est accessible
        site_path = get_site_path()
        assets_path = os.path.join(site_path, "public", "assets", "aurescrm", "images")
        
        if not os.path.exists(assets_path):
            frappe.log_error(f"Assets path not found: {assets_path}", "Plan Flexo Setup")
        else:
            svg_file = os.path.join(assets_path, "sens_deroulement.svg")
            if os.path.exists(svg_file):
                frappe.logger().info("Plan Flexo assets setup completed successfully")
            else:
                frappe.log_error(f"SVG file not found: {svg_file}", "Plan Flexo Setup")
                
    except Exception as e:
        frappe.log_error(f"Error setting up Plan Flexo assets: {str(e)}", "Plan Flexo Setup")