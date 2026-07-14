# Copyright (c) 2026, Medigo and contributors
# License: MIT

"""Permissions scriptées pour les guides d'utilisation."""

from __future__ import annotations

import frappe

ADMIN_ROLES = ("System Manager", "Guide Gestionnaire", "Guide Validateur", "Guide Redacteur")


def _is_guide_admin(user: str | None = None) -> bool:
	user = user or frappe.session.user
	if user == "Administrator":
		return True
	return bool(set(frappe.get_roles(user)) & set(ADMIN_ROLES))


def user_can_view_guide(guide, user: str | None = None) -> bool:
	"""Vérifie si un utilisateur peut consulter un guide publié."""
	user = user or frappe.session.user
	if _is_guide_admin(user):
		return True

	if getattr(guide, "desactive", 0):
		return False
	if not getattr(guide, "version_publiee", None):
		return False

	if not getattr(guide, "restreindre_audience", 0):
		return True

	allowed = {row.role for row in (guide.roles_autorises or []) if row.role}
	if not allowed:
		return False
	return bool(allowed & set(frappe.get_roles(user)))


def get_guide_permission_query_conditions(user: str | None = None) -> str:
	"""Filtre les listes Guide Utilisation selon l'audience."""
	user = user or frappe.session.user
	if _is_guide_admin(user):
		return ""

	roles = frappe.get_roles(user)
	role_list = ", ".join(frappe.db.escape(r) for r in roles) or "''"
	return f"""(
		`tabGuide Utilisation`.`desactive` = 0
		AND `tabGuide Utilisation`.`version_publiee` IS NOT NULL
		AND `tabGuide Utilisation`.`version_publiee` != ''
		AND (
			IFNULL(`tabGuide Utilisation`.`restreindre_audience`, 0) = 0
			OR EXISTS (
				SELECT 1
				FROM `tabGuide Audience Role`
				WHERE `tabGuide Audience Role`.`parent` = `tabGuide Utilisation`.`name`
				AND `tabGuide Audience Role`.`parenttype` = 'Guide Utilisation'
				AND `tabGuide Audience Role`.`role` IN ({role_list})
			)
		)
	)"""


def has_guide_permission(doc, ptype: str | None = None, user: str | None = None) -> bool:
	"""Contrôle d'accès documentaire pour Guide Utilisation."""
	user = user or frappe.session.user
	if _is_guide_admin(user):
		return True
	if ptype and ptype != "read":
		return False
	return user_can_view_guide(doc, user)


def get_version_permission_query_conditions(user: str | None = None) -> str:
	"""Les lecteurs n'ont pas accès à la liste des versions."""
	user = user or frappe.session.user
	if _is_guide_admin(user):
		return ""
	return "1=0"


def has_version_permission(doc, ptype: str | None = None, user: str | None = None) -> bool:
	"""Accès aux versions réservé aux rôles éditoriaux."""
	user = user or frappe.session.user
	return _is_guide_admin(user)
