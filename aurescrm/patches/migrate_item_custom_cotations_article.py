# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

"""
Normalise Item.custom_cotations_article (2 ou 3 cotes, x/×, décimales . ou ,).

- « Sans » (toute casse) → vide
- Vide → construit depuis custom_largeur / custom_hauteur / custom_longueur si possible
- Sinon → normalisation ; si impossible, vide + log d’avertissement
"""

import frappe

from aurescrm.item_cotations import (
	build_cotations_from_dimensions,
	normalize_cotations_article,
)


def execute():
	required = (
		"custom_cotations_article",
		"custom_largeur",
		"custom_hauteur",
		"custom_longueur",
	)
	for col in required:
		if not frappe.db.has_column("Item", col):
			print(f"\n✗ migrate_item_custom_cotations_article: colonne Item.{col} absente — abandon\n")
			return

	items = frappe.get_all(
		"Item",
		fields=["name", "custom_cotations_article", "custom_largeur", "custom_hauteur", "custom_longueur"],
	)

	if not items:
		print("\n✓ migrate_item_custom_cotations_article: aucun article\n")
		return

	frappe.db.auto_commit_on_many_writes = True
	updated = 0
	warnings = 0

	for row in items:
		raw = row.custom_cotations_article
		raw_str = (raw or "").strip() if raw is not None else ""

		if raw_str.lower() == "sans":
			new_val = ""
		elif not raw_str:
			new_val = build_cotations_from_dimensions(
				row.custom_largeur,
				row.custom_hauteur,
				row.custom_longueur,
			) or ""
		else:
			norm = normalize_cotations_article(raw_str)
			if norm is None:
				frappe.logger().warning(
					f"migrate_item_custom_cotations_article: Item {row.name!r} valeur non normalisable {raw_str!r} → vide"
				)
				warnings += 1
				new_val = ""
			else:
				new_val = norm

		current = raw if raw is not None else ""
		if new_val != current:
			frappe.db.set_value(
				"Item",
				row.name,
				"custom_cotations_article",
				new_val,
				update_modified=False,
			)
			updated += 1

	frappe.db.auto_commit_on_many_writes = False
	frappe.db.commit()
	print(
		f"\n✓ Migration custom_cotations_article (Item): {len(items)} ligne(s) parcourue(s), "
		f"{updated} mise(s) à jour, {warnings} avertissement(s)\n"
	)
