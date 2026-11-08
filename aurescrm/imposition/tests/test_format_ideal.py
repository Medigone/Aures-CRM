# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Format idéal : la feuille sur mesure qui gagne chaque critère, que l'utilisateur choisit ensuite."""

import os
import unittest

from aurescrm.imposition.lecture_trace import lire_trace, silhouette
from aurescrm.imposition.optimiseur import FIBRE_DEPL, FIBRE_LAIZE, TRACE_LIBRE, TRACE_VERTICALE, Parametres, arrondi_au_pas, encombrement, formats_sur_mesure, variantes
from aurescrm.imposition.service import CRITERE_COUT, CRITERE_FEUILLES, CRITERE_MATIERE, CRITERE_STOCK, proposer_formats

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")
MARGES = {"pince": 10.0, "marge_arriere": 15.0, "lisiere": 15.6, "laize_max": 0.0, "depl_max": 0.0}
STOCK = [{"laize": 1020, "depl": 720, "fibre": FIBRE_DEPL}, {"laize": 700, "depl": 1000}]


def _gagnant(lignes, critere):
	return next(ligne for ligne in lignes if critere in ligne["criteres"])


class TestArrondi(unittest.TestCase):
	def test_vers_le_haut(self):
		self.assertEqual(arrondi_au_pas(701.2, 10), 710)
		self.assertEqual(arrondi_au_pas(700.0, 10), 700)
		self.assertEqual(arrondi_au_pas(701.2, 5), 705)
		self.assertEqual(arrondi_au_pas(701.23, 0), 701.3)


class TestFormatIdeal(unittest.TestCase):
	@classmethod
	def setUpClass(cls):
		coupe, rainage = lire_trace(os.path.join(FIXTURES, "trace_etui_physiophormine.pdf"))
		cls.poly = silhouette(coupe, rainage)
		cls.params = Parametres(pont=2.5, grammage=300.0, quantite=10_000, prix_tonne=140_000, **MARGES)
		cls.vars_ = [v.en_dict() for v in variantes(cls.poly, cls.params)]

	def _proposer(self, fibre_trace=TRACE_LIBRE, presse=None):
		return proposer_formats(self.vars_, self.params, self.poly.area, 1020, 720, pas=10, fibre_trace=fibre_trace, stock=STOCK, presse=presse)

	def test_feuilles_sous_le_maxi_et_au_pas(self):
		dispos = formats_sur_mesure(None, self.params, 1020, 720, pas=10, vars_=variantes(self.poly, self.params))
		self.assertTrue(dispos)
		for d in dispos:
			self.assertLessEqual(d.laize, 1020)
			self.assertLessEqual(d.depl, 720)
			self.assertEqual(d.laize % 10, 0)
			self.assertEqual(d.depl % 10, 0)
			self.assertGreaterEqual(d.reste_laize, 0)
			self.assertGreaterEqual(d.reste_depl, 0)

	def test_la_plus_petite_feuille_de_chaque_grille(self):
		v = variantes(self.poly, self.params)[0]
		largeur, hauteur = encombrement(v, 2, 2)
		d = next(d for d in formats_sur_mesure(None, self.params, 1020, 720, pas=10, vars_=[v]) if (d.n_col, d.n_rang) == (2, 2))
		self.assertEqual(d.laize, arrondi_au_pas(largeur + 2 * 15.6, 10))
		self.assertEqual(d.depl, arrondi_au_pas(hauteur + 25.0, 10))

	def test_un_gagnant_par_critere(self):
		lignes = self._proposer()
		criteres = {c for ligne in lignes for c in ligne["criteres"]}
		self.assertEqual(criteres, {CRITERE_MATIERE, CRITERE_FEUILLES, CRITERE_STOCK})
		matiere, feuilles, stock = (_gagnant(lignes, c) for c in (CRITERE_MATIERE, CRITERE_FEUILLES, CRITERE_STOCK))
		self.assertEqual(stock["origine"], "Format en stock")
		self.assertLessEqual(matiere["nb_feuilles"] * matiere["laize"] * matiere["depl"], stock["nb_feuilles"] * stock["laize"] * stock["depl"])
		self.assertLessEqual(feuilles["nb_feuilles"], matiere["nb_feuilles"])
		self.assertNotIn("cout_complet", matiere)

	def test_le_stock_peut_gagner(self):
		"""Un format en stock qui consomme moins que tout sur mesure gagne la matière : pas de commande spéciale."""
		lignes = proposer_formats(self.vars_, self.params, self.poly.area, 1020, 720, pas=10, stock=[{"laize": 950, "depl": 520}])
		self.assertEqual(_gagnant(lignes, CRITERE_MATIERE)["origine"], "Format en stock")

	def test_une_bobine_en_stock(self):
		"""Une bobine du support compte comme un format en stock : sa meilleure coupe sous son maximum."""
		lignes = proposer_formats(self.vars_, self.params, self.poly.area, 1020, 720, pas=10, stock=[{"laize": 1020, "depl": 800, "bobine": 1}])
		stock = _gagnant(lignes, CRITERE_STOCK)
		self.assertEqual(stock["origine"], "Bobine")
		self.assertEqual(stock["laize"], 1020)
		self.assertLessEqual(stock["depl"], 720)

	def test_le_maxi_vaut_pour_le_stock(self):
		lignes = proposer_formats(self.vars_, self.params, self.poly.area, 1020, 720, pas=10, stock=[{"laize": 1020, "depl": 900}])
		self.assertFalse(any(CRITERE_STOCK in ligne["criteres"] for ligne in lignes))

	def test_fibre_imposee(self):
		"""Le tracé impose sa fibre : la feuille sur mesure dit dans quelle fibre la commander, la rotation suit."""
		for ligne in self._proposer(TRACE_VERTICALE):
			if ligne["origine"] != "Sur mesure":
				continue
			self.assertIn(ligne["fibre_feuille"], (FIBRE_LAIZE, FIBRE_DEPL))
			self.assertEqual(int(ligne["rotation"]) % 180, 0 if ligne["fibre_feuille"] == FIBRE_DEPL else 90)

	def test_cout_complet(self):
		lignes = self._proposer(presse={"nom": "Presse", "fixe": 5000, "par_1000": 800})
		cout = _gagnant(lignes, CRITERE_COUT)
		self.assertTrue(all(cout["cout_complet"] <= ligne["cout_complet"] for ligne in lignes))
		sans_prix = proposer_formats(self.vars_, Parametres(pont=2.5, grammage=300.0, quantite=10_000, **MARGES), self.poly.area, 1020, 720, presse={"nom": "Presse", "fixe": 0, "par_1000": 800})
		self.assertFalse(any(CRITERE_COUT in ligne["criteres"] for ligne in sans_prix))
