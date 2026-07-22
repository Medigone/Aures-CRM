# Copyright (c) 2026, Aures Emballages and contributors
# For license information, please see license.txt

"""Backfill status / dates sur Modele Postes Devis existants. Idempotent."""

from __future__ import annotations

import frappe
from frappe.utils import cint, get_datetime


def execute():
	if not frappe.db.exists("DocType", "Modele Postes Devis"):
		return
	if not frappe.db.table_exists("Modele Postes Devis"):
		return

	# Colonnes ajoutées au migrate précédent de cette session
	for name in frappe.get_all("Modele Postes Devis", pluck="name"):
		row = frappe.db.get_value(
			"Modele Postes Devis",
			name,
			["is_active", "creation", "modified", "status", "date_creation", "date_modification"],
			as_dict=True,
		)
		if not row:
			continue

		status = "Actif" if cint(row.is_active) else "Inactif"
		date_creation = row.date_creation or get_datetime(row.creation)
		date_modification = row.date_modification or get_datetime(row.modified)

		frappe.db.set_value(
			"Modele Postes Devis",
			name,
			{
				"status": status,
				"date_creation": date_creation,
				"date_modification": date_modification,
			},
			update_modified=False,
		)
