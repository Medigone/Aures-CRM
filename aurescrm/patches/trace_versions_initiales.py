"""Les tracés d'avant les versions deviennent la version 1, en service depuis leur création."""

import frappe


def execute():
	if not frappe.get_meta("Trace").has_field("statut"):
		return
	frappe.db.sql(
		"""update `tabTrace`
		set statut = ifnull(nullif(statut, ''), 'En service'),
			ver = if(ifnull(ver, 0) < 1, 1, ver),
			date_activation = ifnull(date_activation, date(creation))"""
	)
