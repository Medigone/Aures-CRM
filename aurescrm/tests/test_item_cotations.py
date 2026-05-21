# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

"""
Tests unitaires pour aurescrm.item_cotations.
Exécuter avec: bench --site [site] run-tests --module aurescrm.tests.test_item_cotations
"""

import unittest

from aurescrm.item_cotations import (
	build_cotations_from_dimensions,
	normalize_cotations_article,
	validate_cotations_article_format,
)


class TestItemCotations(unittest.TestCase):
	def test_normalize_single_cote(self):
		self.assertEqual(normalize_cotations_article("75"), "75")
		self.assertEqual(normalize_cotations_article("75 mm"), "75")
		self.assertEqual(normalize_cotations_article("75,5 mm"), "75.5")
		self.assertEqual(normalize_cotations_article("75MM"), "75")

	def test_normalize_two_and_three_cotes(self):
		self.assertEqual(normalize_cotations_article("56×280"), "56x280")
		self.assertEqual(normalize_cotations_article("56,3×280"), "56.3x280")
		self.assertEqual(normalize_cotations_article("80x35x118"), "80x35x118")

	def test_normalize_invalid(self):
		self.assertIsNone(normalize_cotations_article(""))
		self.assertIsNone(normalize_cotations_article("sans"))
		self.assertIsNone(normalize_cotations_article("abc"))
		self.assertIsNone(normalize_cotations_article("56x"))

	def test_build_single_dimension(self):
		self.assertEqual(build_cotations_from_dimensions(75, 0, 0), "75")
		self.assertEqual(build_cotations_from_dimensions(0, 80, 0), "80")
		self.assertEqual(build_cotations_from_dimensions(0, 0, 118), "118")

	def test_build_two_and_three_dimensions(self):
		self.assertEqual(build_cotations_from_dimensions(56, 280, 0), "56x280")
		self.assertEqual(build_cotations_from_dimensions(80, 35, 118), "80x35x118")
		self.assertIsNone(build_cotations_from_dimensions(0, 0, 0))
		self.assertIsNone(build_cotations_from_dimensions(80, 0, 118))

	def test_validate_format(self):
		validate_cotations_article_format("")
		validate_cotations_article_format(None)
		validate_cotations_article_format("75")
		validate_cotations_article_format("56x280")
		validate_cotations_article_format("80x35x118")
