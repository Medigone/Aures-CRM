# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

"""
Recalcule Etude Faisabilite.nbr_feuilles pour les enregistrements existants.

Même règle que le contrôleur : quantité ÷ nombre de poses de l'imposition liée,
arrondi supérieur (cf. compute_nbr_feuilles). Sans imposition ou poses invalides : 0.
"""

import frappe

from aurescrm.aures_crm.doctype.etude_faisabilite.etude_faisabilite import compute_nbr_feuilles


def execute():
	if not frappe.db.has_column("Etude Faisabilite", "nbr_feuilles"):
		return

	etudes = frappe.get_all(
		"Etude Faisabilite",
		fields=["name", "quantite", "imposition"],
	)

	if not etudes:
		print("\n✓ migrate_etude_faisabilite_nbr_feuilles: aucune étude\n")
		return

	imposition_names = {e.imposition for e in etudes if e.imposition}
	poses_by_imp = {}
	if imposition_names:
		for row in frappe.get_all(
			"Imposition",
			filters={"name": ["in", list(imposition_names)]},
			fields=["name", "nbr_poses"],
		):
			poses_by_imp[row.name] = row.nbr_poses or 0

	frappe.db.auto_commit_on_many_writes = True
	for e in etudes:
		if not e.imposition:
			val = 0
		elif e.imposition not in poses_by_imp:
			# Imposition absente ou supprimée
			val = 0
		else:
			val = compute_nbr_feuilles(e.quantite, poses_by_imp[e.imposition])

		frappe.db.set_value(
			"Etude Faisabilite",
			e.name,
			"nbr_feuilles",
			val,
			update_modified=False,
		)

	frappe.db.auto_commit_on_many_writes = False
	frappe.db.commit()
	print(f"\n✓ Migration nbr_feuilles (Etude Faisabilite): {len(etudes)} document(s) mis à jour\n")
