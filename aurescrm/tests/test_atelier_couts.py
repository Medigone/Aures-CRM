# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Les coûts de l'imposition : visibles par l'équipe devis seule."""

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from aurescrm.imposition import droits

LIGNE = {"libelle": "1020 × 720", "nb_poses": 6, "tonnage": 0.7, "cout_matiere": 1200.0, "cout_par_1000": 40.0}


class TestCoutsEquipeDevis(FrappeTestCase):
	def tearDown(self):
		frappe.set_user("Administrator")

	def test_hors_equipe_devis(self):
		with patch.object(droits.frappe, "get_roles", return_value=["Chargé Étude Faisabilité"]):
			frappe.set_user("Guest")
			self.assertFalse(droits.voit_couts())
			ligne = droits.masquer_ligne(dict(LIGNE))
			self.assertNotIn("cout_matiere", ligne)
			self.assertNotIn("cout_par_1000", ligne)
			self.assertEqual(ligne["tonnage"], 0.7)
			self.assertEqual([set(row) for row in droits.masquer_lignes([dict(LIGNE)])], [set(LIGNE) - set(droits.CHAMPS_COUTS)])

	def test_equipe_devis(self):
		for role in ("Chargé Devis", "Responsable Devis", "System Manager"):
			with patch.object(droits.frappe, "get_roles", return_value=[role]):
				frappe.set_user("Guest")
				self.assertTrue(droits.voit_couts(), role)
				self.assertEqual(droits.masquer_ligne(dict(LIGNE)), LIGNE)

	def test_champs_au_niveau_un(self):
		"""Le Desk masque les mêmes champs : niveau de permission 1, lu par l'équipe devis."""
		for doctype, champs in (("Calcul Imposition", ["prix_tonne"]), ("Scenario Imposition", ["cout_matiere", "cout_par_1000"]), ("Support Technique", ["prix_tonne"])):
			meta = frappe.get_meta(doctype)
			for champ in champs:
				self.assertEqual(meta.get_field(champ).permlevel, 1, f"{doctype}.{champ}")
		roles = {p.role for p in frappe.get_meta("Calcul Imposition").permissions if p.permlevel == 1 and p.read}
		self.assertEqual(roles, {"System Manager", "Responsable Devis", "Chargé Devis"})
