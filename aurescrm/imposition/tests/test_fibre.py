# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Fibre par format : la fibre de la feuille et celle que le tracé exige fixent la rotation, format par format."""

import os
import unittest

from aurescrm.imposition.lecture_trace import lire_trace, silhouette
from aurescrm.imposition.optimiseur import FIBRE_DEPL, FIBRE_LAIZE, TRACE_HORIZONTALE, TRACE_LIBRE, TRACE_VERTICALE, Parametres, evaluer_format_et_motif, filtrer_fibre, rotations_format, variantes
from aurescrm.imposition.service import fibre_de, simuler_formats

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")
MACHINE = {"pince": 10.0, "marge_arriere": 15.0, "lisiere": 15.6, "laize_max": 1020.0, "depl_max": 720.0}


class TestRotations(unittest.TestCase):
	def test_regle(self):
		self.assertEqual(rotations_format(TRACE_VERTICALE, FIBRE_DEPL), (0,))
		self.assertEqual(rotations_format(TRACE_VERTICALE, FIBRE_LAIZE), (90,))
		self.assertEqual(rotations_format(TRACE_HORIZONTALE, FIBRE_DEPL), (90,))
		self.assertEqual(rotations_format(TRACE_HORIZONTALE, FIBRE_LAIZE), (0,))

	def test_rien_d_impose(self):
		self.assertEqual(rotations_format(TRACE_LIBRE, FIBRE_LAIZE), (0, 90))
		self.assertEqual(rotations_format(TRACE_VERTICALE, ""), (0, 90))

	def test_fibre_d_une_feuille(self):
		self.assertEqual(fibre_de({"laize": 1020, "depl": 0, "bobine": 1}), FIBRE_DEPL)
		self.assertEqual(fibre_de({"laize": 1020, "depl": 720, "bobine": 1, "fibre": FIBRE_LAIZE}), FIBRE_LAIZE)
		self.assertEqual(fibre_de({"laize": 1020, "depl": 720}), "")


class TestFibreSurUnTrace(unittest.TestCase):
	@classmethod
	def setUpClass(cls):
		coupe, rainage = lire_trace(os.path.join(FIXTURES, "trace_etui_physiophormine.pdf"))
		cls.poly = silhouette(coupe, rainage)
		cls.params = Parametres(pont=2.5, grammage=300.0, quantite=10_000, **MACHINE)
		cls.vars_ = variantes(cls.poly, cls.params)

	def test_deux_formats_deux_rotations(self):
		"""Même boîte, même exigence : debout sur une feuille fibre en déplacement, couchée sur une fibre en laize."""
		for fibre, rotation in ((FIBRE_DEPL, 0), (FIBRE_LAIZE, 90)):
			retenues = filtrer_fibre(self.vars_, rotations_format(TRACE_VERTICALE, fibre))
			for d in evaluer_format_et_motif(None, self.params, 1020.0, 720.0, vars_=retenues):
				self.assertEqual(int(d.rotation) % 180, rotation, fibre)

	def test_essai_avec_fibre(self):
		lignes = simuler_formats(self.vars_, self.params, 1020.0, 720.0, 30_000, fibre_trace=TRACE_HORIZONTALE, fibre=FIBRE_DEPL)
		self.assertTrue(lignes)
		self.assertTrue(all(int(ligne["rotation"]) % 180 == 90 for ligne in lignes))
