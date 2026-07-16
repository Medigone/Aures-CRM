# Copyright (c) 2026, Medigo and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase


class TestCalculDevis(FrappeTestCase):
	def test_calculate_costs_from_postes(self):
		calcul = frappe.get_doc(
			{
				"doctype": "Calcul Devis",
				"quantite": 1000,
				"nbr_poses": 4,
				"taux_gache_tirage": 10,
				"format_imp": "500x400",
				"grammage": 100,
				"cout_support_kg": 2,
				"marge_percent": 20,
				"postes": [
					{
						"libelle": "Impression offset",
						"nombre_passages": 2,
						"cout_fixe": 100,
						"unite_calcul": "Par feuille",
						"cout_variable_unitaire": 0.05,
					},
					{
						"libelle": "Pelliculage",
						"nombre_passages": 1,
						"cout_fixe": 50,
						"unite_calcul": "Par 1000 unités",
						"cout_variable_unitaire": 30,
					},
					{
						"libelle": "Prépresse",
						"nombre_passages": 3,
						"unite_calcul": "Forfait",
						"cout_variable_unitaire": 25,
					},
				],
			}
		)

		calcul.calculate_surface()
		calcul.calculate_support_cost()
		calcul.calculate_costs()

		self.assertEqual(calcul.quantite_feuilles, 250)
		self.assertEqual(calcul.quantite_feuilles_gache, 275)
		self.assertAlmostEqual(calcul.cout_support_total, 11)
		self.assertAlmostEqual(calcul.total_couts_fixes, 250)
		self.assertAlmostEqual(calcul.total_couts_variables, 132.5)
		self.assertAlmostEqual(calcul.cout_total, 393.5)
		self.assertAlmostEqual(calcul.cout_unitaire, 0.3935)
		self.assertAlmostEqual(calcul.prix_unitaire_propose, 0.4722)
		self.assertAlmostEqual(calcul.prix_total_propose, 472.2)
