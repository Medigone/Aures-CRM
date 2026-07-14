# Copyright (c) 2026, Medigo and contributors
# License: MIT

"""Import idempotent des guides Markdown historiques vers les DocTypes."""

from __future__ import annotations

import os

import frappe

from aurescrm.guides_utilisation.catalogue import GUIDES
from aurescrm.guides_utilisation.setup import seed_guide_categories


def _docs_root() -> str:
	app_path = frappe.get_app_path("aurescrm")
	return os.path.realpath(os.path.join(app_path, "..", "docs"))


def execute():
	seed_guide_categories()

	docs_root = _docs_root()
	ordre = 10

	for entry in GUIDES:
		slug = entry["id"]
		if frappe.db.exists("Guide Utilisation", {"slug": slug}):
			continue

		category = entry["category"]
		if not frappe.db.exists("Guide Categorie", category):
			frappe.get_doc(
				{
					"doctype": "Guide Categorie",
					"libelle": category,
					"ordre_affichage": ordre,
					"actif": 1,
				}
			).insert(ignore_permissions=True)

		file_path = os.path.join(docs_root, entry["file"])
		if not os.path.isfile(file_path):
			frappe.log_error(
				f"Fichier guide manquant pour import: {entry['file']}",
				"Guides Import",
			)
			continue

		with open(file_path, encoding="utf-8") as handle:
			markdown = handle.read()

		guide = frappe.get_doc(
			{
				"doctype": "Guide Utilisation",
				"titre": entry["title"],
				"slug": slug,
				"categorie": category,
				"description": entry.get("description") or "",
				"ordre_affichage": ordre,
				"desactive": 0,
				"restreindre_audience": 0,
			}
		)
		guide.insert(ignore_permissions=True)

		version = frappe.get_doc(
			{
				"doctype": "Guide Utilisation Version",
				"guide": guide.name,
				"numero_version": 1,
				"format_contenu": "Markdown",
				"contenu_markdown": markdown,
				"resume_modifications": "Import initial depuis docs/",
				"statut": "Brouillon",
			}
		)
		version.flags.allow_initial_publish = True
		version.insert(ignore_permissions=True)

		ordre += 10
