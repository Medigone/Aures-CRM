# Copyright (c) 2026, Aures Emballages and contributors
# For license information, please see license.txt

"""Droits du poste Étude : le Responsable d'étude lit Clients et Articles, l'équipe Flexo conduit ses études. Idempotent.

Les fixtures Custom DocPerm et Workflow sont désactivées dans `hooks.py` : ce patch applique ces deux changements.
Les autres droits (Tickets, Demandes, Études Flexo) sont dans le JSON des DocTypes.
"""

import frappe

RESPONSABLE = "Responsable Étude Faisabilité"
ETUDE_FLEXO = "Étude Flexo"
WORKFLOW_FLEXO = "Etude Faisabilite Flexo"


def _grant_read(doctype, role):
	if frappe.db.exists("Custom DocPerm", {"parent": doctype, "role": role, "permlevel": 0}):
		return
	frappe.get_doc(
		{
			"doctype": "Custom DocPerm",
			"parent": doctype,
			"parenttype": "DocType",
			"parentfield": "permissions",
			"role": role,
			"permlevel": 0,
			"read": 1,
			"select": 1,
			"report": 1,
			"print": 1,
			"email": 1,
		}
	).insert(ignore_permissions=True)
	frappe.clear_cache(doctype=doctype)


def _flexo_transitions():
	if not frappe.db.exists("Workflow", WORKFLOW_FLEXO):
		return
	workflow = frappe.get_doc("Workflow", WORKFLOW_FLEXO)
	if all(row.allowed == ETUDE_FLEXO for row in workflow.transitions):
		return
	for row in workflow.transitions:
		row.allowed = ETUDE_FLEXO
	workflow.save(ignore_permissions=True)


def execute():
	for doctype in ("Customer", "Item"):
		_grant_read(doctype, RESPONSABLE)
	_flexo_transitions()
