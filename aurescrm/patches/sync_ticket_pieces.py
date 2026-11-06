# Copyright (c) 2026, Aures Emballages and contributors
# For license information, please see license.txt

"""Aligne les tickets ouverts sur leurs pièces du dossier : les anciennes cases d'articles deviennent des vérifications signées. Idempotent."""

import frappe

from aurescrm.aures_crm.doctype.ticket_commercial.ticket_pieces import CLOSED, sync_ticket_pieces


def execute():
	rows = frappe.get_all(
		"Ticket Commercial",
		filters={"status": ["not in", CLOSED]},
		fields=["name", "request_type", "modified", "modified_by", "articles_verifies_par", "checklist_dd_articles", "checklist_eb_articles"],
	)
	for row in rows:
		if (row.checklist_dd_articles or row.checklist_eb_articles) and not row.articles_verifies_par:
			frappe.db.set_value("Ticket Commercial", row.name, {"articles_verifies_par": row.modified_by, "articles_verifies_le": row.modified}, update_modified=False)
		sync_ticket_pieces(row.name)
