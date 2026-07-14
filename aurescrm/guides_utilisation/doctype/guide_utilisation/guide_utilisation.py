# Copyright (c) 2026, Medigo and contributors
# License: MIT

from __future__ import annotations

import re

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, cstr


class GuideUtilisation(Document):
	def validate(self):
		self.slug = _normalize_slug(self.slug or self.titre)
		if self.restreindre_audience and not self.roles_autorises:
			frappe.throw(_("Ajoutez au moins un rôle autorisé lorsque l'audience est restreinte."))

	@frappe.whitelist()
	def create_new_version(self, resume_modifications: str | None = None):
		"""Crée une nouvelle version brouillon à partir de la version publiée courante."""
		frappe.has_permission(self.doctype, "write", doc=self, throw=True)

		latest = frappe.db.sql(
			"""
			SELECT MAX(numero_version) FROM `tabGuide Utilisation Version`
			WHERE guide = %s
			""",
			self.name,
		)
		next_number = cint(latest[0][0] if latest and latest[0][0] else 0) + 1

		source = None
		if self.version_publiee and frappe.db.exists("Guide Utilisation Version", self.version_publiee):
			source = frappe.get_doc("Guide Utilisation Version", self.version_publiee)

		doc = frappe.get_doc(
			{
				"doctype": "Guide Utilisation Version",
				"guide": self.name,
				"numero_version": next_number,
				"format_contenu": source.format_contenu if source else "Markdown",
				"contenu_markdown": source.contenu_markdown if source else "",
				"contenu_riche": source.contenu_riche if source else "",
				"resume_modifications": resume_modifications or "",
				"statut": "Brouillon",
			}
		)
		doc.insert()
		return doc.name


def _normalize_slug(value: str) -> str:
	slug = cstr(value).strip().lower()
	slug = slug.replace(" ", "-")
	slug = re.sub(r"[^a-z0-9\-]+", "-", slug)
	slug = re.sub(r"-{2,}", "-", slug).strip("-")
	if not slug:
		frappe.throw(_("Le slug du guide est invalide."))
	return slug
