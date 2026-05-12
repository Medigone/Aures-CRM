# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import frappe


def boot_session(bootinfo):
	"""Expose suivi créances flag to desk for client scripts."""
	if frappe.db.exists("DocType", "Parametres Suivi Creances"):
		val = frappe.db.get_single_value("Parametres Suivi Creances", "suivi_creances_actif")
		bootinfo["aurescrm_suivi_creances_actif"] = bool(int(val or 0))
	else:
		bootinfo["aurescrm_suivi_creances_actif"] = True
