import frappe
from frappe.utils import add_days, now_datetime


@frappe.whitelist()
def get_recent_activity(limit=10, days=7):
	"""Retourne les activités récentes de l'utilisateur courant.

	Affiche les créations (Comment Created) et les modifications (Version)
	pour les documents visibles par l'utilisateur.
	"""
	user = frappe.session.user
	if not user or user == "Guest":
		return []

	limit = int(limit or 10)
	days = int(days or 7)
	start = add_days(now_datetime(), -days)
	fetch_limit = max(limit * 5, 50)

	versions = frappe.get_all(
		"Version",
		filters={
			"owner": user,
			"creation": (">=", start),
		},
		fields=["ref_doctype", "docname", "creation"],
		order_by="creation desc",
		limit=fetch_limit,
	)

	comments = frappe.get_all(
		"Comment",
		filters={
			"owner": user,
			"creation": (">=", start),
			"comment_type": "Created",
		},
		fields=["reference_doctype", "reference_name", "creation"],
		order_by="creation desc",
		limit=fetch_limit,
	)

	activities = []

	for row in versions:
		doctype = row.get("ref_doctype")
		name = row.get("docname")
		if not doctype or not name:
			continue
		if not frappe.has_permission(doctype, "read", doc=name):
			continue
		activities.append(
			{
				"action": "Modifié",
				"doctype": doctype,
				"name": name,
				"timestamp": row.get("creation"),
			}
		)

	for row in comments:
		doctype = row.get("reference_doctype")
		name = row.get("reference_name")
		if not doctype or not name:
			continue
		if not frappe.has_permission(doctype, "read", doc=name):
			continue
		activities.append(
			{
				"action": "Créé",
				"doctype": doctype,
				"name": name,
				"timestamp": row.get("creation"),
			}
		)

	activities.sort(key=lambda x: x.get("timestamp") or 0, reverse=True)

	unique = []
	seen = set()
	for item in activities:
		key = f"{item['doctype']}::{item['name']}"
		if key in seen:
			continue
		seen.add(key)
		unique.append(item)
		if len(unique) >= limit:
			break

	return unique
