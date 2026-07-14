# Copyright (c) 2026, Medigo and contributors
# License: MIT

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import cint


def _ensure_category(name="Commercial"):
	if not frappe.db.exists("Guide Categorie", name):
		frappe.get_doc(
			{
				"doctype": "Guide Categorie",
				"libelle": name,
				"ordre_affichage": 1,
				"actif": 1,
			}
		).insert(ignore_permissions=True)
	return name


class TestGuideUtilisationVersion(FrappeTestCase):
	def setUp(self):
		_ensure_category()

	def test_publish_replaces_previous_version(self):
		guide = frappe.get_doc(
			{
				"doctype": "Guide Utilisation",
				"titre": "Guide Test Publication",
				"slug": "guide-test-publication",
				"categorie": "Commercial",
				"description": "Test",
				"ordre_affichage": 1,
			}
		).insert(ignore_permissions=True)

		v1 = frappe.get_doc(
			{
				"doctype": "Guide Utilisation Version",
				"guide": guide.name,
				"numero_version": 1,
				"format_contenu": "Markdown",
				"contenu_markdown": "# V1",
				"statut": "Brouillon",
			}
		)
		v1.flags.allow_initial_publish = True
		v1.insert(ignore_permissions=True)

		guide.reload()
		self.assertEqual(guide.version_publiee, v1.name)

		v2 = frappe.get_doc(
			{
				"doctype": "Guide Utilisation Version",
				"guide": guide.name,
				"numero_version": 2,
				"format_contenu": "Markdown",
				"contenu_markdown": "# V2",
				"statut": "Brouillon",
			}
		).insert(ignore_permissions=True)

		v2.statut = "À valider"
		v2.save(ignore_permissions=True)
		v2.statut = "Publié"
		v2.save(ignore_permissions=True)

		guide.reload()
		v1.reload()
		self.assertEqual(guide.version_publiee, v2.name)
		self.assertEqual(v1.statut, "Archivé")
		self.assertEqual(cint(v2.numero_version), 2)

	def test_create_new_version_increments(self):
		guide = frappe.get_doc(
			{
				"doctype": "Guide Utilisation",
				"titre": "Guide Test Increment",
				"slug": "guide-test-increment",
				"categorie": "Commercial",
			}
		).insert(ignore_permissions=True)

		v1 = frappe.get_doc(
			{
				"doctype": "Guide Utilisation Version",
				"guide": guide.name,
				"numero_version": 1,
				"format_contenu": "Markdown",
				"contenu_markdown": "# Base",
				"statut": "Brouillon",
			}
		)
		v1.flags.allow_initial_publish = True
		v1.insert(ignore_permissions=True)
		guide.reload()

		new_name = guide.create_new_version(resume_modifications="suite")
		new_doc = frappe.get_doc("Guide Utilisation Version", new_name)
		self.assertEqual(cint(new_doc.numero_version), 2)
		self.assertEqual(new_doc.statut, "Brouillon")
		self.assertIn("# Base", new_doc.contenu_markdown)
