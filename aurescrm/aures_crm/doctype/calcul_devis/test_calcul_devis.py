# Copyright (c) 2026, Medigo and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase


class TestCalculDevis(FrappeTestCase):
	def _make_doc_payload(self, **extra):
		payload = {
			"doctype": "Calcul Devis",
			"quantite": 1000,
			"nbr_poses": 4,
			"format_imp": "500x400",
			"grammage": 100,
			"cout_support_kg": 2,
			"marge_percent": 20,
			"postes": [
				{
					"libelle": "Impression offset",
					"nombre_passages": 2,
					"cout_fixe": 100,
					"gache_feuilles": 50,
					"unite_calcul": "Par feuille",
					"cout_variable_unitaire": 0.05,
				},
				{
					"libelle": "Vernis sérigraphique",
					"nombre_passages": 1,
					"cout_fixe": 50,
					"gache_feuilles": 20,
					"unite_calcul": "Par 1000 unités",
					"cout_variable_unitaire": 30,
				},
				{
					"libelle": "Découpe",
					"nombre_passages": 3,
					"gache_feuilles": 30,
					"unite_calcul": "Forfait",
					"cout_variable_unitaire": 25,
				},
			],
		}
		payload.update(extra)
		return payload

	def test_calculate_costs_from_postes(self):
		calcul = frappe.get_doc(self._make_doc_payload())

		calcul.calculate_surface()
		calcul.calculate_support_cost()
		calcul.calculate_costs()

		# 1000 / 4 = 250 feuilles ; gâche 50+20+30 = 100 → 350
		self.assertEqual(calcul.quantite_feuilles, 250)
		self.assertEqual(calcul.total_gache_feuilles, 100)
		self.assertEqual(calcul.quantite_feuilles_gache, 350)
		# cout_feuille = (20g/1000) × 2 = 0.04 ; support = 0.04 × 350 = 14
		self.assertAlmostEqual(calcul.cout_support_total, 14)
		# fixes: 100×2 + 50×1 + 0 = 250
		self.assertAlmostEqual(calcul.total_couts_fixes, 250)
		# vars: 0.05×2×350 + 30×1×1 + 25×3×1 = 35 + 30 + 75 = 140
		self.assertAlmostEqual(calcul.total_couts_variables, 140)
		self.assertAlmostEqual(calcul.cout_total, 404)
		self.assertAlmostEqual(calcul.cout_unitaire, 0.404)
		self.assertAlmostEqual(calcul.prix_unitaire_propose, 0.4848)
		self.assertAlmostEqual(calcul.prix_total_propose, 484.8)
		# Sans saisie manuelle : total final et marges à zéro
		self.assertAlmostEqual(calcul.prix_total_final or 0, 0)
		self.assertAlmostEqual(calcul.marge_commerciale_cout or 0, 0)
		self.assertAlmostEqual(calcul.marge_commerciale_prix or 0, 0)

	def test_prix_propose_final_and_marges(self):
		calcul = frappe.get_doc(self._make_doc_payload(prix_propose_final=0.45))

		calcul.calculate_surface()
		calcul.calculate_support_cost()
		calcul.calculate_costs()

		# Référence inchangée
		self.assertAlmostEqual(calcul.prix_unitaire_propose, 0.4848)
		self.assertAlmostEqual(calcul.prix_total_propose, 484.8)

		# Prix final saisi + dérivés
		self.assertAlmostEqual(calcul.prix_propose_final, 0.45)
		self.assertAlmostEqual(calcul.prix_total_final, 450)
		# (0.45 - 0.404) / 0.404 × 100 ≈ 11.3861
		self.assertAlmostEqual(calcul.marge_commerciale_cout, 11.3861, places=4)
		# (0.45 - 0.404) / 0.45 × 100 ≈ 10.2222
		self.assertAlmostEqual(calcul.marge_commerciale_prix, 10.2222, places=4)

		# Recalcul sans changement de marge : conserve la saisie manuelle
		calcul.calculate_costs()
		self.assertAlmostEqual(calcul.prix_propose_final, 0.45)

		# Modification de la marge : réalignement du PU final sur le PU proposé
		calcul.marge_percent = 25
		calcul._doc_before_save = frappe._dict(marge_percent=20)
		calcul.calculate_costs()
		self.assertAlmostEqual(calcul.prix_unitaire_propose, 0.404 * 1.25)
		self.assertAlmostEqual(calcul.prix_propose_final, calcul.prix_unitaire_propose)
