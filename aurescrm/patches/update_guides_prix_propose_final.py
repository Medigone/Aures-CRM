# Copyright (c) 2026, Medigo and contributors
# License: MIT

"""Republie les guides Calcul Devis après ajout du prix proposé final."""

from __future__ import annotations

import os

import frappe

from aurescrm.guides_utilisation.catalogue import get_guide_by_id

SLUGS = ("calcul-devis", "methode-calcul-devis")
RESUME = (
	"Ajout Prix proposé final (saisie manuelle), Prix total final, "
	"et marges commerciales sur coût / sur prix."
)
MARKER = "prix_propose_final_marges_commerciales_v1"


def _docs_root() -> str:
	app_path = frappe.get_app_path("aurescrm")
	return os.path.realpath(os.path.join(app_path, "..", "docs"))


def execute():
	# Garde anti double exécution via contenu déjà à jour
	docs_root = _docs_root()

	for slug in SLUGS:
		entry = get_guide_by_id(slug)
		if not entry:
			continue

		guide_name = frappe.db.get_value("Guide Utilisation", {"slug": slug}, "name")
		if not guide_name:
			continue

		file_path = os.path.join(docs_root, entry["file"])
		if not os.path.isfile(file_path):
			frappe.log_error(
				f"Fichier guide manquant: {entry['file']}",
				"Guides Update Prix Final",
			)
			continue

		with open(file_path, encoding="utf-8") as handle:
			markdown = handle.read()

		# Idempotence : si la version publiée contient déjà le marqueur métier
		published = frappe.db.get_value(
			"Guide Utilisation", guide_name, "version_publiee"
		)
		if published:
			current_md = frappe.db.get_value(
				"Guide Utilisation Version", published, "contenu_markdown"
			) or ""
			if "Prix proposé final" in current_md and "Marge commerciale sur coût" in current_md:
				continue

		latest = frappe.db.sql(
			"""
			SELECT MAX(numero_version) FROM `tabGuide Utilisation Version`
			WHERE guide = %s
			""",
			guide_name,
		)
		next_number = int(latest[0][0] or 0) + 1

		version = frappe.get_doc(
			{
				"doctype": "Guide Utilisation Version",
				"guide": guide_name,
				"numero_version": next_number,
				"format_contenu": "Markdown",
				"contenu_markdown": markdown,
				"resume_modifications": f"{RESUME} [{MARKER}]",
				"statut": "Brouillon",
			}
		)
		version.flags.allow_initial_publish = True
		version.insert(ignore_permissions=True)
