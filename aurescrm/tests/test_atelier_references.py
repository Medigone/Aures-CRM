# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import unittest

from aurescrm.api.bureau_atelier_references import cotes, ecart_cotes


class TestArticlesProches(unittest.TestCase):
	def test_cotes_triees(self):
		self.assertEqual(cotes("120x40x160"), (40.0, 120.0, 160.0))
		self.assertEqual(cotes("56,3×280"), (56.3, 280.0))
		self.assertEqual(cotes(""), ())
		self.assertEqual(cotes("sans"), ())

	def test_ecart(self):
		self.assertEqual(ecart_cotes(cotes("100x200x34"), cotes("34x100x200")), 0)
		self.assertAlmostEqual(ecart_cotes(cotes("100x200x34"), cotes("110x200x34")), 10 / 110)
		self.assertIsNone(ecart_cotes(cotes("100x200x34"), cotes("100x200")))
		self.assertIsNone(ecart_cotes((), cotes("100x200")))
