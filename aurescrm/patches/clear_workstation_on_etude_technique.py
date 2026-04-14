import frappe


def execute():
	"""Clear stale Workstation references on Etude Technique since the field now points to Machine."""
	count = frappe.db.count("Etude Technique", {"machine": ["is", "set"]})
	if count:
		frappe.db.sql(
			"""UPDATE `tabEtude Technique` SET machine = NULL WHERE machine IS NOT NULL AND machine != ''"""
		)
		frappe.db.commit()
		frappe.msgprint(f"Nettoyé {count} référence(s) Workstation sur Etude Technique.")
