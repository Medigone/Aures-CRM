# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Paliers de quantité : le coût matière remonte dans les lignes, les paliers se rangent proprement."""

import unittest

from aurescrm.imposition.api import nettoyer_paliers
from aurescrm.imposition.optimiseur import Disposition, Parametres
from aurescrm.imposition.service import ligne_scenario


class TestPaliers(unittest.TestCase):
	def test_cout_matiere_dans_la_ligne(self):
		d = Disposition(libelle="1020 × 700", laize=1020, depl=700, n_col=7, n_rang=2, pas_laize=140, pas_depl=340, rotation=0)
		p = Parametres(pont=2.5, grammage=300.0, quantite=14_000, prix_tonne=200_000.0)
		ligne = ligne_scenario(d.libelle, d, p, 30_000)
		self.assertEqual(ligne["nb_feuilles"], 1000)
		self.assertAlmostEqual(ligne["cout_matiere"], 42_840, places=0)
		self.assertGreater(ligne["cout_par_1000"], 0)
		sans_prix = ligne_scenario(d.libelle, d, Parametres(pont=2.5, grammage=300.0, quantite=14_000), 30_000)
		self.assertEqual(sans_prix["cout_matiere"], 0)

	def test_paliers_nettoyes(self):
		self.assertEqual(nettoyer_paliers([20000, "5000", 5000, 0, -3, "x"]), [5000, 20000])
		self.assertEqual(nettoyer_paliers("10000"), [])
		self.assertEqual(len(nettoyer_paliers(list(range(1, 20)))), 8)
