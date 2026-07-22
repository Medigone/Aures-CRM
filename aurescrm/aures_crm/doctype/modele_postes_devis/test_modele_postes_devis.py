# Copyright (c) 2026, Aures Emballages and contributors
# For license information, please see license.txt

import frappe
from frappe.tests.utils import FrappeTestCase


class TestModelePostesDevis(FrappeTestCase):
	def setUp(self):
		self.bareme_a = self._make_bareme("TEST-MODELE-A")
		self.bareme_b = self._make_bareme("TEST-MODELE-B")

	def tearDown(self):
		for name in frappe.get_all(
			"Modele Postes Devis",
			filters={"libelle": ("like", "TEST-MODELE-%")},
			pluck="name",
		):
			frappe.delete_doc("Modele Postes Devis", name, force=True)

		for name in frappe.get_all(
			"Bareme Cout Fixe",
			filters={"libelle": ("like", "TEST-MODELE-%")},
			pluck="name",
		):
			frappe.delete_doc("Bareme Cout Fixe", name, force=True)

	def _make_bareme(self, libelle):
		doc = frappe.get_doc(
			{
				"doctype": "Bareme Cout Fixe",
				"libelle": libelle,
				"categorie": "Autre",
				"unite_calcul": "Forfait",
				"is_active": 1,
				"cout_fixe": 10,
			}
		)
		doc.insert()
		return doc

	def test_rejects_duplicate_bareme(self):
		doc = frappe.get_doc(
			{
				"doctype": "Modele Postes Devis",
				"libelle": "TEST-MODELE-DUP",
				"is_active": 1,
				"postes": [
					{"ordre": 1, "bareme": self.bareme_a.name, "nombre_passages": 1},
					{"ordre": 2, "bareme": self.bareme_a.name, "nombre_passages": 1},
				],
			}
		)
		with self.assertRaises(frappe.ValidationError):
			doc.insert()

	def test_rejects_invalid_passages(self):
		doc = frappe.get_doc(
			{
				"doctype": "Modele Postes Devis",
				"libelle": "TEST-MODELE-PASS",
				"is_active": 1,
				"postes": [
					{"ordre": 1, "bareme": self.bareme_a.name, "nombre_passages": 0},
				],
			}
		)
		with self.assertRaises(frappe.ValidationError):
			doc.insert()

	def test_get_postes_from_modele(self):
		from aurescrm.aures_crm.doctype.modele_postes_devis.modele_postes_devis import (
			get_postes_from_modele,
		)

		modele = frappe.get_doc(
			{
				"doctype": "Modele Postes Devis",
				"libelle": "TEST-MODELE-OK",
				"is_active": 1,
				"postes": [
					{"ordre": 2, "bareme": self.bareme_b.name, "nombre_passages": 2},
					{"ordre": 1, "bareme": self.bareme_a.name, "nombre_passages": 1},
				],
			}
		)
		modele.insert()

		result = get_postes_from_modele(modele.name)
		self.assertEqual(len(result["postes"]), 2)
		self.assertEqual(result["postes"][0]["libelle"], "TEST-MODELE-A")
		self.assertEqual(result["postes"][0]["nombre_passages"], 1)
		self.assertEqual(result["postes"][1]["libelle"], "TEST-MODELE-B")
		self.assertEqual(result["postes"][1]["nombre_passages"], 2)
		self.assertEqual(result["postes"][0]["cout_fixe"], 10)
