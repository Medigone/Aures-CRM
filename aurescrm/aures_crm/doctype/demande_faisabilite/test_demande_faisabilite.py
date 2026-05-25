# Copyright (c) 2025, Medigo and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from aurescrm.aures_crm.doctype.demande_faisabilite.demande_faisabilite import (
	generate_etude_faisabilite,
	get_expected_procede_from_ticket,
	validate_procede_for_demande,
)


class TestDemandeFaisabilite(FrappeTestCase):
	def test_can_generate_etudes(self):
		"""Test que la méthode can_generate_etudes fonctionne correctement"""
		demande = frappe.new_doc("Demande Faisabilite")
		demande.client = "Test Client"
		demande.date_livraison = "2025-12-31"

		demande.status = "Brouillon"
		self.assertTrue(
			demande.can_generate_etudes(),
			"Le statut initial 'Brouillon' devrait permettre de générer des études",
		)

		invalid_statuses = [
			"Confirmée",
			"En Cours",
			"Partiellement Finalisée",
			"Finalisée",
			"Devis Établis",
			"Commandé",
			"Fermée",
			"Annulée",
		]

		for status in invalid_statuses:
			demande.status = status
			self.assertFalse(
				demande.can_generate_etudes(),
				f"Le statut '{status}' ne devrait pas permettre de générer des études",
			)

	def test_generate_etude_faisabilite_validation(self):
		"""Test que la fonction generate_etude_faisabilite valide correctement le statut"""
		demande = frappe.new_doc("Demande Faisabilite")
		demande.client = frappe.db.get_value(
			"Customer",
			{"custom_commune": ["is", "set"]},
			"name",
		)
		demande.date_livraison = "2025-12-31"
		demande.type = "Premier Tirage"
		demande.status = "Annulée"
		demande.append(
			"liste_articles",
			{
				"article": frappe.db.get_value("Item", {}, "name"),
				"quantite": 1,
				"date_livraison": "2025-12-31",
			},
		)
		demande.insert(ignore_permissions=True)

		with self.assertRaises(frappe.ValidationError):
			generate_etude_faisabilite(demande.name)


class TestDemandeFaisabiliteProcedeValidation(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.suffix = frappe.generate_hash(length=6)
		cls.site_offset = cls._ensure_site(f"Test Site Offset FA {cls.suffix}", "Offset")
		cls.site_flexo = cls._ensure_site(f"Test Site Flexo FA {cls.suffix}", "Flexo")
		cls.customer = frappe.db.get_value(
			"Customer",
			{"custom_commune": ["is", "set"]},
			"name",
		)
		if not cls.customer:
			raise Exception("Aucun client avec custom_commune trouvé pour les tests.")
		cls.item_offset = cls._ensure_item(f"FA-TEST-OFF-{cls.suffix}", "Offset")
		cls.item_flexo = cls._ensure_item(f"FA-TEST-FLX-{cls.suffix}", "Flexo")
		cls.item_compose = cls._ensure_compose_item(
			f"FA-TEST-CMP-{cls.suffix}",
			f"FA-TEST-SUB-OFF-{cls.suffix}",
			"Offset",
		)
		cls.ticket_offset = cls._ensure_ticket(cls.site_offset)
		cls.ticket_flexo = cls._ensure_ticket(cls.site_flexo)

	@classmethod
	def _ensure_site(cls, title, procede):
		existing = frappe.db.get_value("Site Production", {"title": title}, "name")
		if existing:
			return existing
		doc = frappe.get_doc(
			{
				"doctype": "Site Production",
				"title": title,
				"procede": procede,
				"status": "Actif",
			}
		)
		doc.insert(ignore_permissions=True)
		return doc.name

	@classmethod
	def _ensure_item(cls, item_code, procede):
		if frappe.db.exists("Item", item_code):
			frappe.db.set_value("Item", item_code, "custom_procédé", procede)
			return item_code

		item_group = frappe.db.get_value("Item Group", {"is_group": 0}, "name") or "All Item Groups"
		stock_uom = frappe.db.get_value("UOM", {}, "name") or "Unité"
		doc = frappe.get_doc(
			{
				"doctype": "Item",
				"item_code": item_code,
				"item_name": item_code,
				"item_group": item_group,
				"stock_uom": stock_uom,
				"is_stock_item": 0,
				"custom_type_article": "Général",
				"custom_procédé": procede,
			}
		)
		doc.insert(ignore_permissions=True)
		return doc.name

	@classmethod
	def _ensure_compose_item(cls, parent_code, sub_code, sub_procede):
		sub_code = cls._ensure_item(sub_code, sub_procede)
		if frappe.db.exists("Item", parent_code):
			frappe.db.set_value("Item", parent_code, "custom_article_compose", 1)
			frappe.db.set_value("Item", sub_code, "custom_article_parent", parent_code)
			return parent_code

		item_group = frappe.db.get_value("Item Group", {"is_group": 0}, "name") or "All Item Groups"
		stock_uom = frappe.db.get_value("UOM", {}, "name") or "Unité"
		parent = frappe.get_doc(
			{
				"doctype": "Item",
				"item_code": parent_code,
				"item_name": parent_code,
				"item_group": item_group,
				"stock_uom": stock_uom,
				"is_stock_item": 0,
				"custom_type_article": "Général",
				"custom_article_compose": 1,
				"custom_procédé": sub_procede,
			}
		)
		parent.insert(ignore_permissions=True)
		parent_name = parent.name
		frappe.db.set_value("Item", sub_code, "custom_article_parent", parent_name)
		frappe.db.set_value("Item", sub_code, "custom_quantite_sous_article", 1)
		return parent_name

	@classmethod
	def _ensure_ticket(cls, site):
		ticket = frappe.get_doc(
			{
				"doctype": "Ticket Commercial",
				"customer": cls.customer,
				"request_type": "Demande de devis",
				"site": site,
				"status": "Nouveau",
			}
		)
		ticket.insert(ignore_permissions=True)
		return ticket.name

	def _make_demande(self, ticket=None, articles=None):
		demande = frappe.new_doc("Demande Faisabilite")
		demande.client = self.customer
		demande.date_livraison = "2026-12-31"
		demande.type = "Premier Tirage"
		demande.status = "Brouillon"
		if ticket:
			demande.ticket_commercial = ticket
		for article in articles or []:
			demande.append(
				"liste_articles",
				{
					"article": article["item"],
					"quantite": article.get("qty", 100),
					"date_livraison": "2026-12-31",
					"procede_article": article.get("procede"),
				},
			)
		return demande

	def test_get_expected_procede_from_ticket(self):
		self.assertEqual(get_expected_procede_from_ticket(self.ticket_offset), "Offset")
		self.assertEqual(get_expected_procede_from_ticket(self.ticket_flexo), "Flexo")

	def test_offset_ticket_accepts_offset_article(self):
		demande = self._make_demande(
			ticket=self.ticket_offset,
			articles=[{"item": self.item_offset, "procede": "Offset"}],
		)
		validate_procede_for_demande(demande)

	def test_offset_ticket_rejects_flexo_article(self):
		demande = self._make_demande(
			ticket=self.ticket_offset,
			articles=[{"item": self.item_flexo, "procede": "Flexo"}],
		)
		with self.assertRaises(frappe.ValidationError):
			validate_procede_for_demande(demande)

	def test_flexo_ticket_accepts_flexo_article(self):
		demande = self._make_demande(
			ticket=self.ticket_flexo,
			articles=[{"item": self.item_flexo, "procede": "Flexo"}],
		)
		validate_procede_for_demande(demande)

	def test_flexo_ticket_rejects_offset_article(self):
		demande = self._make_demande(
			ticket=self.ticket_flexo,
			articles=[{"item": self.item_offset, "procede": "Offset"}],
		)
		with self.assertRaises(frappe.ValidationError):
			validate_procede_for_demande(demande)

	def test_compose_item_with_matching_subarticles(self):
		demande = self._make_demande(
			ticket=self.ticket_offset,
			articles=[{"item": self.item_compose, "procede": "Offset"}],
		)
		validate_procede_for_demande(demande)

	def test_compose_item_with_mismatching_subarticle(self):
		sub_flexo = self._ensure_item(f"FA-TEST-SUB-FLX-{self.suffix}", "Flexo")
		parent = self._ensure_compose_item(
			f"FA-TEST-CMP-MIX-{self.suffix}",
			sub_flexo,
			"Flexo",
		)

		demande = self._make_demande(
			ticket=self.ticket_offset,
			articles=[{"item": parent, "procede": "Offset"}],
		)
		with self.assertRaises(frappe.ValidationError):
			validate_procede_for_demande(demande)

	def test_demande_without_ticket_homogeneous_flexo(self):
		demande = self._make_demande(
			articles=[
				{"item": self.item_flexo, "procede": "Flexo"},
				{"item": self.item_flexo, "procede": "Flexo", "qty": 200},
			]
		)
		validate_procede_for_demande(demande)

	def test_demande_without_ticket_rejects_mixed_procede(self):
		demande = self._make_demande(
			articles=[
				{"item": self.item_offset, "procede": "Offset"},
				{"item": self.item_flexo, "procede": "Flexo"},
			]
		)
		with self.assertRaises(frappe.ValidationError):
			validate_procede_for_demande(demande)

	def test_validate_on_save_with_ticket(self):
		demande = self._make_demande(
			ticket=self.ticket_flexo,
			articles=[{"item": self.item_offset, "procede": "Offset"}],
		)
		with self.assertRaises(frappe.ValidationError):
			demande.insert(ignore_permissions=True)

	def test_generate_etude_rejects_procede_mismatch(self):
		demande = self._make_demande(
			ticket=self.ticket_flexo,
			articles=[{"item": self.item_flexo, "procede": "Flexo"}],
		)
		demande.insert(ignore_permissions=True)

		frappe.db.set_value(
			"Articles Demande Faisabilite",
			demande.liste_articles[0].name,
			"procede_article",
			"Offset",
		)

		with self.assertRaises(frappe.ValidationError):
			generate_etude_faisabilite(demande.name)
