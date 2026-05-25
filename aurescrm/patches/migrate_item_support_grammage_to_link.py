# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""
Crée les masters Type Papier / Grammage Papier et réconcilie Item.custom_support
et Item.custom_grammage après passage Select → Link.
"""

import frappe

from aurescrm.item_paper_options import (
	ensure_grammage_papier,
	ensure_type_papier,
	seed_grammage_papier_defaults,
	seed_type_papier_defaults,
)


def execute():
	if not frappe.db.table_exists("Type Papier") or not frappe.db.table_exists("Grammage Papier"):
		print("\n✗ migrate_item_support_grammage_to_link: DocTypes absents — abandon\n")
		return

	required = ("custom_support", "custom_grammage")
	for col in required:
		if not frappe.db.has_column("Item", col):
			print(f"\n✗ migrate_item_support_grammage_to_link: colonne Item.{col} absente — abandon\n")
			return

	seed_type_papier_defaults()
	seed_grammage_papier_defaults()

	support_created = 0
	grammage_created = 0
	support_cleared = 0
	grammage_cleared = 0

	for value in frappe.db.sql_list(
		"SELECT DISTINCT `custom_support` FROM `tabItem` WHERE IFNULL(`custom_support`, '') != ''"
	):
		raw = (value or "").strip()
		if not raw:
			continue
		if frappe.db.exists("Type Papier", raw):
			continue
		ensure_type_papier(raw)
		support_created += 1

	for value in frappe.db.sql_list(
		"SELECT DISTINCT `custom_grammage` FROM `tabItem` WHERE IFNULL(`custom_grammage`, '') != ''"
	):
		raw = (value or "").strip()
		if not raw:
			continue
		if frappe.db.exists("Grammage Papier", raw):
			continue
		link_name = ensure_grammage_papier(raw)
		if link_name:
			grammage_created += 1
		else:
			frappe.logger().warning(
				f"migrate_item_support_grammage_to_link: grammage invalide {raw!r} sur Item(s) — vidé"
			)

	items = frappe.get_all("Item", fields=["name", "custom_support", "custom_grammage"])
	for row in items:
		support = (row.custom_support or "").strip()
		if support and not frappe.db.exists("Type Papier", support):
			frappe.logger().warning(
				f"migrate_item_support_grammage_to_link: Item {row.name!r} support {support!r} → vide"
			)
			frappe.db.set_value("Item", row.name, "custom_support", "", update_modified=False)
			support_cleared += 1

		grammage = (row.custom_grammage or "").strip()
		if not grammage:
			continue
		if frappe.db.exists("Grammage Papier", grammage):
			continue
		link_name = ensure_grammage_papier(grammage)
		if link_name:
			if link_name != grammage:
				frappe.db.set_value(
					"Item",
					row.name,
					"custom_grammage",
					link_name,
					update_modified=False,
				)
		else:
			frappe.logger().warning(
				f"migrate_item_support_grammage_to_link: Item {row.name!r} grammage {grammage!r} → vide"
			)
			frappe.db.set_value("Item", row.name, "custom_grammage", "", update_modified=False)
			grammage_cleared += 1

	frappe.db.commit()
	print(
		"\n✓ Migration support/grammage Item → Link terminée: "
		f"{support_created} support(s) créé(s), {grammage_created} grammage(s) créé(s), "
		f"{support_cleared} support(s) vidé(s), {grammage_cleared} grammage(s) vidé(s)\n"
	)
