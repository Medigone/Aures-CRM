# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

"""
Complément de backfill_niveau_urgence_u0 : Quotation + Sales Order (custom_niveau_urgence).

Ces colonnes existent seulement après la synchro des Custom Fields ; le patch principal
peut donc s'exécuter avant leur création. Ce patch est listé après pour maximiser
les chances qu'elles existent ; exécuter un second `bench migrate` sur le site si besoin.
"""

import frappe


def execute():
	paires = [
		("Quotation", "custom_niveau_urgence"),
		("Sales Order", "custom_niveau_urgence"),
	]

	frappe.db.auto_commit_on_many_writes = True
	for doctype, fieldname in paires:
		if not frappe.db.has_column(doctype, fieldname):
			print(
				f"backfill_niveau_urgence_u0_qso: colonne absente (relancer migrate après synchro) — "
				f"{doctype}.{fieldname}"
			)
			continue
		table = f"tab{doctype}"
		frappe.db.sql(
			f"""
			UPDATE `{table}`
			SET `{fieldname}` = %s
			WHERE 1=1
			""",
			("U0",),
		)
		print(f"backfill_niveau_urgence_u0_qso: {doctype}.{fieldname} -> U0 (toutes les lignes)")

	frappe.db.auto_commit_on_many_writes = False
	frappe.db.commit()
	print("\n✓ backfill_niveau_urgence_u0_quotation_sales_order: terminé\n")
