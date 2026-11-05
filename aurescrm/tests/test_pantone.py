# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import unittest

import frappe
from frappe.tests.utils import FrappeTestCase

from aurescrm.passages import _parse_couleurs_item
from aurescrm.pantone import DOCTYPE, cmjn_code, derive_impression, describe, import_reference, normalize_code


class TestPantoneRegles(unittest.TestCase):
	"""Sans base de données."""

	def test_normalize_code(self):
		for raw in ("P286C", "286c", "PANTONE 286 C", "pantone  286c", "PMS 286 C", "P 286 C", "PANTONE® 286-C"):
			self.assertEqual(normalize_code(raw), "286 C", raw)
		self.assertEqual(normalize_code("PANTONE 339"), "339")
		self.assertEqual(normalize_code("167"), "167")
		self.assertEqual(normalize_code("C1"), "C1")
		self.assertEqual(normalize_code("Reflex Blue c"), "REFLEX BLUE C")
		self.assertEqual(normalize_code(None), "")

	def test_cmjn_code(self):
		self.assertEqual(cmjn_code(100, 50, 0, 20), "C100 M50 J0 N20")

	def test_derive_impression_et_passages(self):
		cases = [
			(["CMJN"], "Quadri", "CMJN", 4),
			(["CMJN", "CMJN"], "Quadri", "CMJN", 4),
			(["Pantone", "Pantone"], "Pantone", "2", 2),
			(["CMJN", "CMJN", "Pantone", "Pantone"], "Quadri +Pantone", "CMJN + 2", 6),
		]
		for types, impression, couleurs, total in cases:
			derived = derive_impression(types)
			self.assertEqual((derived["impression"], derived["couleurs"], derived["total"]), (impression, couleurs, total))
			# Le calcul des passages lit cette forme sans changement.
			self.assertEqual(_parse_couleurs_item(derived["couleurs"]), total)


class TestPantoneBase(FrappeTestCase):
	def _add(self, code, hex_value="#112233", source="pantonr"):
		return frappe.get_doc({"doctype": DOCTYPE, "code": code, "hex": hex_value, "source": source}).insert(ignore_permissions=True)

	def test_nom_normalise(self):
		self.assertEqual(self._add("P9999C").name, "9999 C")

	def test_couleur_refusee_hors_format(self):
		with self.assertRaises(frappe.ValidationError):
			self._add("9998 C", "bleu")

	def test_describe(self):
		self._add("9997 C")
		details = describe(["9997 C", "9997", "C1"])
		self.assertEqual(details["9997 C"]["hex"], "#112233")
		self.assertEqual(details["9997 C"]["label"], "PANTONE 9997 C")
		self.assertEqual(details["9997"]["needs_suffix"], 1)
		self.assertEqual((details["C1"]["hex"], details["C1"]["needs_suffix"], details["C1"]["label"]), (None, 0, "C1"))

	def test_import_garde_les_lignes_manuelles(self):
		import json
		import tempfile

		self._add("9996 C", "#000000", "Manuel")
		self._add("9995 C", "#000000", "pantonr")
		rows = [
			{"code": "9996 C", "hex": "#ffffff", "source": "pantonr", "approximative": 0},
			{"code": "9995 C", "hex": "#ffffff", "source": "pantonr", "approximative": 0},
			{"code": "9994 C", "hex": "#ffffff", "source": "colors.csv", "approximative": 1},
		]
		with tempfile.NamedTemporaryFile("w", suffix=".json") as handle:
			json.dump(rows, handle)
			handle.flush()
			counts = import_reference(handle.name)
		self.assertEqual(frappe.db.get_value(DOCTYPE, "9996 C", "hex"), "#000000")
		self.assertEqual(frappe.db.get_value(DOCTYPE, "9995 C", "hex"), "#ffffff")
		self.assertEqual(frappe.db.get_value(DOCTYPE, "9994 C", "approximative"), 1)
		self.assertEqual((counts["manuelles_gardees"], counts["mises_a_jour"], counts["ajoutees"]), (1, 1, 1))
