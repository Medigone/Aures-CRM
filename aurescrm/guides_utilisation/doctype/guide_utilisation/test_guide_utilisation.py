# Copyright (c) 2026, Medigo and contributors
# License: MIT

import frappe
from frappe.tests.utils import FrappeTestCase

from aurescrm.guides_utilisation.api import get_guide, get_guides_catalogue
from aurescrm.guides_utilisation.permissions import user_can_view_guide


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


class TestGuidePermissions(FrappeTestCase):
	def setUp(self):
		_ensure_category()

	def _make_published_guide(self, slug, restrict=False, roles=None):
		guide = frappe.get_doc(
			{
				"doctype": "Guide Utilisation",
				"titre": slug,
				"slug": slug,
				"categorie": "Commercial",
				"restreindre_audience": 1 if restrict else 0,
				"roles_autorises": [{"role": r} for r in (roles or [])],
			}
		).insert(ignore_permissions=True)

		version = frappe.get_doc(
			{
				"doctype": "Guide Utilisation Version",
				"guide": guide.name,
				"numero_version": 1,
				"format_contenu": "Markdown",
				"contenu_markdown": f"# {slug}",
				"statut": "Brouillon",
			}
		)
		version.flags.allow_initial_publish = True
		version.insert(ignore_permissions=True)
		guide.reload()
		return guide

	def test_public_guide_visible(self):
		guide = self._make_published_guide("guide-public-test")
		self.assertTrue(user_can_view_guide(guide, "Guest"))
		items = get_guides_catalogue()
		self.assertTrue(any(i["id"] == "guide-public-test" for i in items))
		data = get_guide("guide-public-test")
		self.assertIn("guide-public-test", data["html"] + data["title"])

	def test_restricted_guide_hidden_without_role(self):
		guide = self._make_published_guide(
			"guide-restricted-test",
			restrict=True,
			roles=["Guide Gestionnaire"],
		)
		# Utilisateur sans rôle Guide Gestionnaire (Guest)
		self.assertFalse(user_can_view_guide(guide, "Guest"))
