"""Création d'article depuis la PWA : le format passe par Cotations Article, sans refuser ce qui est encore en file."""

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from aurescrm.api.commercial_mobile import article_schema
from aurescrm.api.commercial_mutations import article_create, article_update


class TestCommercialArticle(FrappeTestCase):
	def setUp(self):
		self.client = frappe.get_all("Customer", pluck="name", limit=1)[0]
		patcher = patch("aurescrm.api.commercial_mutations.assert_client")
		patcher.start()
		self.addCleanup(patcher.stop)

	def create(self, **values):
		payload = {"client": self.client, "designation": f"zzz pwa {frappe.generate_hash(length=8)}", "procede": "Offset", **values}
		return frappe.get_doc("Item", article_create("Administrator", payload)["name"])

	def test_cotations_normalisees(self):
		self.assertEqual(self.create(cotations="80,5×35 x 118 mm").custom_cotations_article, "80.5x35x118")

	def test_cotations_mal_ecrites_refusees(self):
		with self.assertRaises(frappe.ValidationError):
			self.create(cotations="80 sur 35")

	def test_saisie_encore_en_file_avec_les_trois_dimensions(self):
		self.assertEqual(self.create(largeur=80, hauteur=120, longueur=30).custom_cotations_article, "80x120x30")

	def test_champs_abandonnes_hors_du_schema_mais_pas_refuses(self):
		self.assertFalse({"custom_largeur", "custom_hauteur", "custom_longueur"} & set(article_schema()["fields"]))
		doc = self.create(cotations="80x120")
		article_update("Administrator", {"article": doc.name, "fiche": {"custom_largeur": 90}})
		self.assertEqual(frappe.db.get_value("Item", doc.name, "custom_largeur"), 90)
