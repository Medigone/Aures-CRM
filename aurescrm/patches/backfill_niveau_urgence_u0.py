# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

"""
Déploiement initial du niveau d'urgence : force 'U0' sur toutes les lignes des
documents du cycle (demande, études, devis, commande, étude technique).

À utiliser lorsque la prod n'a pas encore d'urgences U1+ enregistrées (tout à U0).

Ticket Commercial est exclu : les champs d'urgence du ticket ne sont pas modifiés
par ce patch (workflow demande / validation inchangé côté ticket).
"""

import frappe


def execute():
	paires = [
		("Demande Faisabilite", "niveau_urgence"),
		("Etude Faisabilite", "niveau_urgence"),
		("Etude Faisabilite Flexo", "niveau_urgence"),
		("Etude Technique", "niveau_urgence"),
		("Quotation", "custom_niveau_urgence"),
		("Sales Order", "custom_niveau_urgence"),
	]

	frappe.db.auto_commit_on_many_writes = True
	for doctype, fieldname in paires:
		if not frappe.db.has_column(doctype, fieldname):
			print(f"backfill_niveau_urgence_u0: ignoré (pas de colonne) — {doctype}.{fieldname}")
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
		print(f"backfill_niveau_urgence_u0: {doctype}.{fieldname} -> U0 (toutes les lignes)")

	frappe.db.auto_commit_on_many_writes = False
	frappe.db.commit()
	print("\n✓ backfill_niveau_urgence_u0: terminé (Ticket Commercial exclu)\n")
