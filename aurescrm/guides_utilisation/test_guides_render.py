# Copyright (c) 2026, Medigo and contributors
# License: MIT

from frappe.tests.utils import FrappeTestCase

from aurescrm.guides_utilisation.api import _render_version_html


class _FakeVersion:
	def __init__(self, format_contenu, contenu_markdown="", contenu_riche=""):
		self.format_contenu = format_contenu
		self.contenu_markdown = contenu_markdown
		self.contenu_riche = contenu_riche


class TestGuideRender(FrappeTestCase):
	def test_markdown_to_html(self):
		html = _render_version_html(_FakeVersion("Markdown", contenu_markdown="# Titre\n\nBonjour"))
		self.assertIn("<h1", html)
		self.assertIn("Titre", html)
		self.assertIn("Bonjour", html)

	def test_rich_text_sanitized(self):
		html = _render_version_html(
			_FakeVersion(
				"Texte riche",
				contenu_riche='<p>OK</p><script>alert(1)</script><img src=x onerror=alert(1)>',
			)
		)
		self.assertIn("<p>OK</p>", html)
		self.assertNotIn("<script>", html.lower())
		self.assertNotIn("onerror", html.lower())
