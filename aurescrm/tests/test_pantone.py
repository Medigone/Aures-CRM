# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import json
import re
import unittest

import frappe
from frappe.modules.import_file import import_doc
from frappe.tests.utils import FrappeTestCase

from aurescrm.passages import _parse_couleurs_item
from aurescrm.pantone import DOCTYPE, cmjn_code, derive_impression, describe, normalize_code


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
		self.assertEqual(cmjn_code(100, 50, 0, 20), "C100 M50 N20")
		self.assertEqual(cmjn_code(0, 0, 0, 100), "N100")
		self.assertEqual(cmjn_code(100, 100, 100, 100), "C100 M100 J100 N100")
		self.assertEqual(cmjn_code(0, 0, 0, 0), "C0 M0 J0 N0")

	def test_derive_impression_et_passages(self):
		pantone = {"type_couleur": "Pantone"}
		noir = {"type_couleur": "CMJN", "n": 100}
		teinte = {"type_couleur": "CMJN", "c": 100, "m": 50, "n": 20}
		cases = [
			([teinte], "Quadri", "CMJN", 4),
			([teinte, teinte], "Quadri", "CMJN", 4),
			([teinte, noir], "Quadri", "CMJN", 4),
			([pantone, pantone], "Pantone", "2", 2),
			([teinte, teinte, pantone, pantone], "Quadri +Pantone", "CMJN + 2", 6),
			([pantone, pantone, pantone, noir], "Pantone", "4", 4),
			([noir], None, "1", 1),
			([noir, noir], None, "1", 1),
		]
		for rows, impression, couleurs, total in cases:
			derived = derive_impression(rows)
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

	def test_fixture_garde_les_corrections(self):
		self._add("9996 C", "#000000", "Manuel")
		self._add("9995 C", "#000000", "pantonr")
		for code in ("9996 C", "9995 C"):
			import_doc({"doctype": DOCTYPE, "name": code, "code": code, "hex": "#ffffff", "source": "pantonr", "approximative": 0})
		self.assertEqual(frappe.db.get_value(DOCTYPE, "9996 C", ["hex", "source"]), ("#000000", "Manuel"))
		self.assertEqual(frappe.db.get_value(DOCTYPE, "9995 C", "hex"), "#ffffff")

	def test_fixture_complete(self):
		path = frappe.get_app_path("aurescrm", "fixtures", "couleur_pantone.json")
		with open(path, encoding="utf-8") as handle:
			rows = json.load(handle)
		self.assertTrue(rows)
		self.assertTrue(all(row["name"] == row["code"] == normalize_code(row["code"]) and re.fullmatch(r"#[0-9a-f]{6}", row["hex"]) for row in rows))
		self.assertEqual(len({row["name"] for row in rows}), len(rows))
