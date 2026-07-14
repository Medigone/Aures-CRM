# Copyright (c) 2026, Medigo and contributors
# License: MIT

"""API lecture seule des guides publiés (source : DocTypes)."""

from __future__ import annotations

import frappe
from frappe import _
from frappe.utils.data import md_to_html
from frappe.utils.html_utils import sanitize_html

from aurescrm.guides_utilisation.permissions import user_can_view_guide


def _render_version_html(version) -> str:
	if version.format_contenu == "Markdown":
		raw = str(md_to_html(version.contenu_markdown or "") or "")
	else:
		raw = version.contenu_riche or ""
	return sanitize_html(raw)


def _guide_to_catalogue_item(guide) -> dict:
	return {
		"id": guide.slug,
		"slug": guide.slug,
		"title": guide.titre,
		"category": guide.categorie,
		"description": guide.description or "",
		"version": guide.version_publiee,
		"ordre_affichage": guide.ordre_affichage or 100,
	}


@frappe.whitelist()
def get_guides_catalogue() -> list[dict]:
	"""Retourne le catalogue des guides publiés visibles pour l'utilisateur courant."""
	guides = frappe.get_all(
		"Guide Utilisation",
		filters={"desactive": 0},
		fields=[
			"name",
			"slug",
			"titre",
			"categorie",
			"description",
			"ordre_affichage",
			"version_publiee",
			"restreindre_audience",
			"desactive",
		],
		order_by="ordre_affichage asc, titre asc",
	)

	result = []
	for row in guides:
		if not row.version_publiee:
			continue
		guide = frappe.get_doc("Guide Utilisation", row.name)
		if not user_can_view_guide(guide):
			continue
		result.append(_guide_to_catalogue_item(guide))
	return result


@frappe.whitelist()
def get_guide(guide_id: str | None = None, slug: str | None = None) -> dict:
	"""Charge la version publiée d'un guide (slug = guide_id historique)."""
	key = (slug or guide_id or "").strip()
	if not key:
		frappe.throw(_("Identifiant de guide manquant."), frappe.ValidationError)

	name = frappe.db.get_value("Guide Utilisation", {"slug": key}, "name")
	if not name:
		# Compatibilité : le name peut être égal au slug
		if frappe.db.exists("Guide Utilisation", key):
			name = key
		else:
			frappe.throw(_("Guide introuvable : {0}").format(key), frappe.DoesNotExistError)

	guide = frappe.get_doc("Guide Utilisation", name)
	if not user_can_view_guide(guide):
		frappe.throw(_("Vous n'avez pas accès à ce guide."), frappe.PermissionError)

	if not guide.version_publiee:
		frappe.throw(_("Ce guide n'a pas encore de version publiée."), frappe.DoesNotExistError)

	version = frappe.get_doc("Guide Utilisation Version", guide.version_publiee)
	if version.statut != "Publié":
		frappe.throw(_("La version courante n'est pas publiée."), frappe.ValidationError)

	return {
		"id": guide.slug,
		"slug": guide.slug,
		"title": guide.titre,
		"category": guide.categorie,
		"description": guide.description or "",
		"version": version.name,
		"numero_version": version.numero_version,
		"publie_le": version.publie_le,
		"html": _render_version_html(version),
	}


@frappe.whitelist()
def user_can_manage_guides() -> bool:
	"""Indique si l'utilisateur courant peut gérer les guides depuis le Desk."""
	roles = set(frappe.get_roles())
	return bool(
		roles
		& {"System Manager", "Guide Gestionnaire", "Guide Validateur", "Guide Redacteur"}
	)
