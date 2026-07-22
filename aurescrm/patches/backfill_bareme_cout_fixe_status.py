# Copyright (c) 2026, Aures Emballages and contributors
# For license information, please see license.txt

"""Backfill status sur Bareme Cout Fixe existants. Idempotent."""

from __future__ import annotations

import frappe
from frappe.utils import cint


def execute():
	if not frappe.db.exists("DocType", "Bareme Cout Fixe"):
		return
	if not frappe.db.table_exists("Bareme Cout Fixe"):
		return
	if not frappe.db.has_column("Bareme Cout Fixe", "status"):
		return

	for name in frappe.get_all("Bareme Cout Fixe", pluck="name"):
		row = frappe.db.get_value(
			"Bareme Cout Fixe",
			name,
			["is_active", "status"],
			as_dict=True,
		)
		if not row:
			continue

		status = "Actif" if cint(row.is_active) else "Inactif"
		if row.status == status:
			continue

		frappe.db.set_value(
			"Bareme Cout Fixe",
			name,
			"status",
			status,
			update_modified=False,
		)
