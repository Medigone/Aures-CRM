# Copyright (c) 2026, Medigo and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from aurescrm.aures_crm.doctype.dossier_essai_blanc import dossier_essai_blanc as deb_module
from aurescrm.item_paper_options import (
	ensure_grammage_papier,
	ensure_type_papier,
	get_grammage_papier_options,
	get_type_papier_options,
)


class TestDossierEssaiBlanc(FrappeTestCase):
	def test_get_item_support_grammage_for_prompt_returns_fields(self):
		items = frappe.get_all("Item", filters={"disabled": 0}, pluck="name", limit=1)
		if not items:
			return
		out = deb_module.get_item_support_grammage_for_prompt(items[0])
		self.assertIn("custom_support", out)
		self.assertIn("custom_grammage", out)
		self.assertIn("support_options", out)
		self.assertIn("grammage_options", out)
		self.assertIsInstance(out["support_options"], list)
		self.assertIsInstance(out["grammage_options"], list)

	def test_validate_item_support_grammage_values_rejects_blank(self):
		with self.assertRaises(frappe.ValidationError):
			deb_module._validate_item_support_grammage_values("", "")

	def test_validate_item_support_grammage_values_accepts_known_options(self):
		support_opts = get_type_papier_options()
		gram_opts = get_grammage_papier_options()
		if not support_opts or not gram_opts:
			support = ensure_type_papier("Test Support DEB")
			gram = ensure_grammage_papier(999)
			support_opts = [support]
			gram_opts = [gram]
		s, g = deb_module._validate_item_support_grammage_values(support_opts[0], gram_opts[0])
		self.assertEqual(s, support_opts[0])
		self.assertEqual(g, gram_opts[0])

	def test_advance_dossier_essai_blanc_step_sets_trace_fields(self):
		frappe.set_user("Administrator")
		customer = frappe.db.get_value("Customer", {"disabled": 0}, "name", order_by="creation asc")
		if not customer:
			return
		d = frappe.new_doc("Dossier Essai Blanc")
		d.client = customer
		d.date_livraison = frappe.utils.today()
		d.status = "Commandé"
		d.insert(ignore_permissions=True)
		try:
			deb_module.advance_dossier_essai_blanc_step(d.name)
			d.reload()
			self.assertEqual(d.status, "Production à lancer")
			self.assertEqual(d.prod_a_lancer_par, "Administrator")
			self.assertTrue(d.prod_a_lancer_le)
			deb_module.advance_dossier_essai_blanc_step(d.name)
			d.reload()
			self.assertEqual(d.status, "En production")
			self.assertEqual(d.en_production_par, "Administrator")
			self.assertTrue(d.en_production_le)
			deb_module.advance_dossier_essai_blanc_step(d.name)
			d.reload()
			self.assertEqual(d.status, "Prêt pour livraison")
			self.assertEqual(d.pret_livraison_par, "Administrator")
			self.assertTrue(d.pret_livraison_le)
		finally:
			frappe.delete_doc("Dossier Essai Blanc", d.name, force=True, ignore_permissions=True)
