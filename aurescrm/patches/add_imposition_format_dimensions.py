import re

import frappe


def execute():
	"""Parse existing format_imp text values into numeric format_laize and format_developpement fields."""
	impositions = frappe.get_all(
		"Imposition",
		filters={"format_imp": ["is", "set"]},
		fields=["name", "format_imp"],
	)

	updated = 0
	for imp in impositions:
		fmt = (imp.format_imp or "").strip()
		match = re.match(r"^(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)$", fmt)
		if match:
			laize = float(match.group(1))
			dev = float(match.group(2))
			frappe.db.set_value(
				"Imposition",
				imp.name,
				{"format_laize": laize, "format_developpement": dev},
				update_modified=False,
			)
			updated += 1

	if updated:
		frappe.db.commit()

	frappe.msgprint(f"Migration format_imp: {updated}/{len(impositions)} impositions mises à jour.")
