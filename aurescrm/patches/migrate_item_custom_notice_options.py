# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

"""
Réécrit Item.custom_notice après changement des options Select.

Anciennes valeurs : Pas de Notice, Notice avec Pliage, Notice sans Pliage.
Nouvelles options : ligne vide + Avec Pliage + Sans Pliage (cf. item.json).
"""

import frappe

VALID = ("", "Avec Pliage", "Sans Pliage")


def execute():
	if not frappe.db.has_column("tabItem", "custom_notice"):
		return

	frappe.db.sql(
		"""
		UPDATE `tabItem`
		SET `custom_notice`=%s
		WHERE LOWER(TRIM(`custom_notice`))=%s
		""",
		("Avec Pliage", "notice avec pliage"),
	)
	frappe.db.sql(
		"""
		UPDATE `tabItem`
		SET `custom_notice`=%s
		WHERE LOWER(TRIM(`custom_notice`))=%s
		""",
		("Sans Pliage", "notice sans pliage"),
	)
	frappe.db.sql(
		"""
		UPDATE `tabItem`
		SET `custom_notice`=%s
		WHERE LOWER(TRIM(`custom_notice`))=%s
		""",
		("", "pas de notice"),
	)
	frappe.db.sql(
		"UPDATE `tabItem` SET `custom_notice`=%s WHERE `custom_notice` IS NULL",
		("",),
	)

	invalid = frappe.db.sql(
		f"""
		SELECT `name`, `custom_notice`
		FROM `tabItem`
		WHERE `custom_notice` NOT IN ({", ".join(["%s"] * len(VALID))})
		""",
		VALID,
	)

	for name, value in invalid:
		frappe.logger().warning(
			f"migrate_item_custom_notice_options: Item {name!r} valeur inattendue {value!r} → vide"
		)
		frappe.db.set_value(
			"Item",
			name,
			"custom_notice",
			"",
			update_modified=False,
		)

	frappe.db.commit()
	print("\n✓ Migration custom_notice (Item) terminée\n")
