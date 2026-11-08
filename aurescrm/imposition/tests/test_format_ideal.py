# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Format idéal : la meilleure feuille qu'on peut obtenir des formats standards du support, selon le critère choisi.

Aures achète des palettes et des bobines de formats standards, et refend lui-même ses bobines. Rien n'est inventé :
chaque feuille vient d'une palette, d'une bobine entière ou d'une bobine refendue, et les chutes comptent toute la
laize achetée.
"""

import os
import unittest

from aurescrm.imposition.lecture_trace import lire_trace, silhouette
from aurescrm.imposition.optimiseur import FIBRE_DEPL, FIBRE_LAIZE, TRACE_VERTICALE, Parametres, variantes
from aurescrm.imposition.service import CRITERE_COUT, CRITERE_FEUILLES, CRITERE_MATIERE, CRITERE_SANS_REFENTE, SOURCE_BOBINE, SOURCE_PALETTE, SOURCE_REFENTE, Refente, proposer_formats

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")
MARGES = {"pince": 10.0, "marge_arriere": 15.0, "lisiere": 15.6, "laize_max": 0.0, "depl_max": 0.0}
REFENTE = Refente(rive=5, bandes_max=3, laize_min=300)


def _gagnant(lignes, critere):
	return next(ligne for ligne in lignes if critere in ligne["criteres"])


class TestRefente(unittest.TestCase):
	def test_bandes_egales_apres_les_rives(self):
		self.assertEqual(REFENTE.bandes(1310), [(2, 650.0), (3, 1300 / 3)])

	def test_laize_mini(self):
		self.assertEqual(Refente(rive=5, bandes_max=4, laize_min=400).bandes(1310), [(2, 650.0), (3, 1300 / 3)])

	def test_sans_reglage_pas_de_refente(self):
		self.assertEqual(Refente().bandes(1310), [])
		self.assertEqual(Refente(bandes_max=1).bandes(1310), [])


class TestFormatIdeal(unittest.TestCase):
	@classmethod
	def setUpClass(cls):
		coupe, rainage = lire_trace(os.path.join(FIXTURES, "trace_etui_physiophormine.pdf"))
		cls.poly = silhouette(coupe, rainage)
		cls.params = Parametres(pont=2.5, grammage=300.0, quantite=10_000, prix_tonne=140_000, **MARGES)
		cls.vars_ = [v.en_dict() for v in variantes(cls.poly, cls.params)]

	def _proposer(self, stock, refente=REFENTE, fibre_trace="Libre", presse=None, params=None):
		return proposer_formats(self.vars_, params or self.params, self.poly.area, 1020, 720, fibre_trace=fibre_trace, stock=stock, refente=refente, presse=presse)

	def test_rien_que_des_formats_standards(self):
		"""Chaque feuille vient d'une palette, d'une bobine entière ou d'une bobine refendue du support."""
		stock = [{"laize": 1020, "depl": 0, "bobine": 1}, {"laize": 1310, "depl": 0, "bobine": 1}, {"laize": 700, "depl": 1000}]
		for ligne in self._proposer(stock):
			self.assertIn(ligne["origine"], (SOURCE_PALETTE, SOURCE_BOBINE, SOURCE_REFENTE))
			if ligne["origine"] == SOURCE_BOBINE:
				self.assertEqual(ligne["laize"], 1020)
			if ligne["origine"] == SOURCE_REFENTE:
				self.assertIn(ligne["laize"], (650.0, round(1300 / 3, 1)))

	def test_une_bobine_trop_large_se_refend(self):
		"""Une bobine de 1310 ne passe pas en presse 1020 ; refendue en deux, elle donne des bandes de 650."""
		lignes = self._proposer([{"laize": 1310, "depl": 0, "bobine": 1}])
		self.assertTrue(lignes)
		self.assertTrue(all(ligne["origine"] == SOURCE_REFENTE for ligne in lignes))
		self.assertFalse(self._proposer([{"laize": 1310, "depl": 0, "bobine": 1}], refente=Refente()))

	def test_la_rive_est_une_chute(self):
		"""Les chutes et le tonnage se comptent sur la laize achetée par feuille, rives comprises."""
		ligne = _gagnant(self._proposer([{"laize": 1310, "depl": 0, "bobine": 1}]), CRITERE_MATIERE)
		self.assertAlmostEqual(ligne["laize_achat"], 1310 / round(1310 / ligne["laize_achat"]), places=2)
		sans_rive = _gagnant(self._proposer([{"laize": 1310, "depl": 0, "bobine": 1}], refente=Refente(rive=0, bandes_max=3, laize_min=300)), CRITERE_MATIERE)
		self.assertGreater(ligne["taux_chutes"], sans_rive["taux_chutes"] - 1e-9)
		attendu = ligne["nb_feuilles"] * ligne["laize_achat"] * ligne["depl"] * 300 / 1e12
		self.assertAlmostEqual(ligne["tonnage"], round(attendu, 3), places=3)

	def test_une_palette_entre_dans_les_deux_sens(self):
		"""Une palette 700 × 1000 dépasse 720 en déplacement : elle entre en 1000 × 700, sa fibre tourne avec elle."""
		lignes = self._proposer([{"laize": 700, "depl": 1000, "fibre": FIBRE_DEPL}], refente=Refente())
		ligne = _gagnant(lignes, CRITERE_SANS_REFENTE)
		self.assertEqual((ligne["laize"], ligne["depl"]), (1000.0, 700.0))
		self.assertEqual(ligne["fibre_feuille"], FIBRE_LAIZE)
		self.assertIn("passée en 1000 × 700", ligne["libelle"])

	def test_le_maxi_de_la_presse(self):
		lignes = self._proposer([{"laize": 1100, "depl": 800}, {"laize": 1100, "depl": 0, "bobine": 1}], refente=Refente())
		self.assertEqual(lignes, [])

	def test_sans_refente_seulement_palettes_et_bobines_entieres(self):
		lignes = self._proposer([{"laize": 1310, "depl": 0, "bobine": 1}, {"laize": 520, "depl": 720}])
		self.assertEqual(_gagnant(lignes, CRITERE_SANS_REFENTE)["origine"], SOURCE_PALETTE)

	def test_a_egalite_sans_refente(self):
		"""Une bande de 650 et une bobine de 650 font la même feuille : la bobine entière gagne, sans débobinage."""
		lignes = self._proposer([{"laize": 650, "depl": 0, "bobine": 1}, {"laize": 1300, "depl": 0, "bobine": 1}], refente=Refente(rive=0, bandes_max=2))
		self.assertEqual(_gagnant(lignes, CRITERE_MATIERE)["origine"], SOURCE_BOBINE)

	def test_fibre_imposee(self):
		"""Le tracé impose sa fibre : la bobine a la sienne en déplacement, la pose reste droite."""
		for ligne in self._proposer([{"laize": 1020, "depl": 0, "bobine": 1}], fibre_trace=TRACE_VERTICALE):
			self.assertEqual(int(ligne["rotation"]) % 180, 0)

	def test_cout_complet(self):
		stock = [{"laize": 1020, "depl": 0, "bobine": 1}, {"laize": 1310, "depl": 0, "bobine": 1}, {"laize": 520, "depl": 720}]
		lignes = self._proposer(stock, presse={"nom": "Presse", "fixe": 5000, "par_1000": 800})
		cout = _gagnant(lignes, CRITERE_COUT)
		self.assertTrue(all(cout["cout_complet"] <= ligne["cout_complet"] for ligne in lignes))
		sans_prix = self._proposer(stock, presse={"nom": "Presse", "fixe": 0, "par_1000": 800}, params=Parametres(pont=2.5, grammage=300.0, quantite=10_000, **MARGES))
		self.assertFalse(any(CRITERE_COUT in ligne["criteres"] for ligne in sans_prix))

	def test_feuilles(self):
		lignes = self._proposer([{"laize": 1020, "depl": 0, "bobine": 1}, {"laize": 520, "depl": 720}])
		feuilles = _gagnant(lignes, CRITERE_FEUILLES)
		self.assertTrue(all(feuilles["nb_feuilles"] <= ligne["nb_feuilles"] for ligne in lignes))
