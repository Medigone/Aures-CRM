# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

from frappe.tests.utils import FrappeTestCase

from aurescrm.pilotage_commercial_kpi import month_bounds, priority_level_from_score


class TestPilotageCommercialKpi(FrappeTestCase):
	def test_month_bounds(self):
		from frappe.utils import getdate

		start, end = month_bounds(getdate("2026-04-15"))
		self.assertEqual(str(start), "2026-04-01")
		self.assertEqual(str(end), "2026-04-30")

	def test_priority_level_from_score(self):
		self.assertEqual(priority_level_from_score(75), "Critique")
		self.assertEqual(priority_level_from_score(50), "Haute")
		self.assertEqual(priority_level_from_score(25), "Normale")
		self.assertEqual(priority_level_from_score(5), "Basse")
