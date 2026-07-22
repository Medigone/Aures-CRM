# Copyright (c) 2026, Medigo and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import cint


class TestBaremeCoutFixe(FrappeTestCase):
	def tearDown(self):
		for name in frappe.get_all(
			"Bareme Cout Fixe",
			filters={"libelle": ("like", "TEST-BCF-%")},
			pluck="name",
		):
			frappe.delete_doc("Bareme Cout Fixe", name, force=True)

	def test_status_synced_from_is_active(self):
		doc = frappe.get_doc(
			{
				"doctype": "Bareme Cout Fixe",
				"libelle": "TEST-BCF-ACTIF",
				"is_active": 1,
			}
		).insert()
		self.assertEqual(doc.status, "Actif")
		self.assertTrue(cint(doc.is_active))

		doc.is_active = 0
		doc.save()
		self.assertEqual(doc.status, "Inactif")
		self.assertFalse(cint(doc.is_active))

		doc.is_active = 1
		doc.save()
		self.assertEqual(doc.status, "Actif")
