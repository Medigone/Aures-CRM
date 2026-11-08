# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Gabarits standard : une seule pièce, les bonnes dimensions, et relus par le moteur comme un vrai tracé."""

import os
import tempfile
import unittest

from aurescrm.imposition.gabarits import A20, A20_20, FOND_AUTO, MODELES, encombrement, ecrire_pdf, generer_gabarit
from aurescrm.imposition.lecture_trace import lire_trace, metriques_developpe, silhouette


class TestGabarits(unittest.TestCase):
	def test_dimensions(self):
		for modele in MODELES:
			coupe, _rainage = generer_gabarit(modele, 120, 40, 160, epaisseur=0.4)
			largeur, hauteur = encombrement(coupe)
			# Patte de 15, deux faces de 120 et deux côtés de 40.
			self.assertAlmostEqual(largeur, 335, places=1)
			self.assertGreater(hauteur, 160 + 40)

	def test_couvercles(self):
		"""A20 et A20.20 ont la même hauteur ; le fond automatique est plus court, sans couvercle en bas."""
		hauteurs = {m: encombrement(generer_gabarit(m, 120, 40, 160)[0])[1] for m in MODELES}
		self.assertAlmostEqual(hauteurs[A20], hauteurs[A20_20], places=3)
		self.assertLess(hauteurs[FOND_AUTO], hauteurs[A20])

	def test_relu_par_le_moteur(self):
		with tempfile.TemporaryDirectory() as dossier:
			for modele in MODELES:
				coupe, rainage = generer_gabarit(modele, 80, 35, 118)
				chemin = ecrire_pdf(os.path.join(dossier, f"{modele}.pdf"), coupe, rainage, titre=modele)
				relu_coupe, relu_rainage = lire_trace(chemin)
				self.assertEqual(len(relu_coupe), len(coupe))
				poly = silhouette(relu_coupe, relu_rainage)
				self.assertEqual(poly.geom_type, "Polygon")
				self.assertAlmostEqual(metriques_developpe(poly)["developpe_l"], encombrement(coupe)[0], delta=0.5)

	def test_cotes_refusees(self):
		with self.assertRaises(ValueError):
			generer_gabarit(A20, 0, 40, 160)
		with self.assertRaises(ValueError):
			generer_gabarit("FEFCO", 120, 40, 160)
