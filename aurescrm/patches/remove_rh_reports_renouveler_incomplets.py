# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Supprime les rapports RH « Documents a Renouveler » et « Dossiers Employes Incomplets ».

Idempotent : ne fait rien si les rapports ou liens workspace n'existent plus.
"""

import frappe

REPORTS_TO_REMOVE = (
	"Documents a Renouveler",
	"Dossiers Employes Incomplets",
)


def execute():
	_delete_reports()
	_clean_workspace_links()
	_clean_workspace_shortcuts()


def _delete_reports():
	for report_name in REPORTS_TO_REMOVE:
		if frappe.db.exists("Report", report_name):
			frappe.delete_doc("Report", report_name, force=1)


def _clean_workspace_links():
	if not frappe.db.table_exists("Workspace Link"):
		return

	frappe.db.sql(
		"""
		DELETE FROM `tabWorkspace Link`
		WHERE parent = %(workspace)s
			AND link_type = 'Report'
			AND link_to IN %(reports)s
		""",
		{"workspace": "Ressources Humaines", "reports": REPORTS_TO_REMOVE},
	)

	remaining = frappe.db.count(
		"Workspace Link",
		{
			"parent": "Ressources Humaines",
			"link_type": "Report",
			"type": "Link",
		},
	)
	frappe.db.sql(
		"""
		UPDATE `tabWorkspace Link`
		SET link_count = %(count)s
		WHERE parent = %(workspace)s
			AND label = 'Rapports'
			AND type = 'Card Break'
		""",
		{"count": remaining, "workspace": "Ressources Humaines"},
	)


def _clean_workspace_shortcuts():
	if not frappe.db.table_exists("Workspace Shortcut"):
		return

	frappe.db.sql(
		"""
		DELETE FROM `tabWorkspace Shortcut`
		WHERE parent = %(workspace)s
			AND type = 'Report'
			AND link_to IN %(reports)s
		""",
		{"workspace": "Ressources Humaines", "reports": REPORTS_TO_REMOVE},
	)
