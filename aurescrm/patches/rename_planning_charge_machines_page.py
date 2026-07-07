import frappe


OLD_PAGE = "planning-charge-machines"
NEW_PAGE = "planning-production"


def execute():
	"""Renomme la page Planning et met à jour les liens workspace éventuels."""
	if frappe.db.exists("Page", OLD_PAGE):
		if frappe.db.exists("Page", NEW_PAGE):
			frappe.delete_doc("Page", OLD_PAGE, force=1)
		else:
			frappe.rename_doc("Page", OLD_PAGE, NEW_PAGE, force=True)

	if frappe.db.has_column("Workspace Link", "link_to"):
		frappe.db.sql(
			"""
			UPDATE `tabWorkspace Link`
			SET link_to = %s
			WHERE link_type = 'Page' AND link_to = %s
			""",
			(NEW_PAGE, OLD_PAGE),
		)
