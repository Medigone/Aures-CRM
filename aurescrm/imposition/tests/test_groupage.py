# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Groupage : deux articles sur une feuille, sans qu'une pose touche une autre, pont compris.

Sans trait commun, pour que le contrôle porte sur toutes les poses : deux poses au pont exact se touchent seulement,
d'où la tolérance d'un centième de mm² sur l'aire commune.
"""

import itertools
import os
import tempfile
import unittest

import pymupdf
from shapely.affinity import translate

from aurescrm.imposition.groupage import SENS_DEPL, SENS_LAIZE, ArticleGroupe, feuilles, generer_pdf_groupe, grouper, positions_groupe, taux_chutes_feuille
from aurescrm.imposition.lecture_trace import lire_trace, silhouette
from aurescrm.imposition.optimiseur import Parametres, _pose_tournee, variantes

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")
MACHINE = {"pince": 10.0, "marge_arriere": 15.0, "lisiere": 15.6, "laize_max": 1020.0, "depl_max": 720.0}
JEU = 3.0


def _charger(nom):
	coupe, rainage = lire_trace(os.path.join(FIXTURES, nom))
	return coupe, rainage, silhouette(coupe, rainage)


class TestGroupage(unittest.TestCase):
	@classmethod
	def setUpClass(cls):
		cls.p = Parametres(pont=JEU, grammage=300.0, trait_commun=False, **MACHINE)
		cls.geometries = [_charger("trace_boite_mouchoir.pdf"), _charger("trace_etui_physiophormine.pdf")]
		cls.vars_ = [variantes(g[2], cls.p) for g in cls.geometries]

	def _articles(self, poses, quantites=(10_000, 30_000)):
		return [ArticleGroupe(variantes=v, poses=n, quantite=q, surface_utile_mm2=g[2].area) for v, n, q, g in zip(self.vars_, poses, quantites, self.geometries)]

	def _recouvrements(self, g):
		formes = {}
		poses = []
		for article, x, y, r in positions_groupe(g):
			if (article, r) not in formes:
				formes[(article, r)] = _pose_tournee(self.geometries[article][2], r)[0].buffer(JEU / 2, join_style=2)
			poses.append(translate(formes[(article, r)], x, y))
		return [(i, j) for i, j in itertools.combinations(range(len(poses)), 2) if poses[i].intersection(poses[j]).area > 0.01]

	def test_deux_articles_sur_une_feuille(self):
		articles = self._articles((2, 4))
		g = grouper(articles, self.p, 1020.0, 720.0)
		self.assertIsNotNone(g)
		self.assertIn(g.sens, (SENS_LAIZE, SENS_DEPL))
		self.assertEqual([b.disposition.poses for b in g.blocs], [2, 4])
		self.assertEqual(len(positions_groupe(g)), 6)
		self.assertEqual(self._recouvrements(g), [])
		self.assertGreaterEqual(g.reste_laize, -1e-6)
		self.assertGreaterEqual(g.reste_depl, -1e-6)

	def test_feuilles_et_surproduction(self):
		articles = self._articles((2, 4))
		g = grouper(articles, self.p, 1020.0, 720.0)
		tirage, besoins, surplus = feuilles(g, articles)
		self.assertEqual(besoins, [5000, 7500])
		self.assertEqual(tirage, 7500)
		self.assertEqual(surplus, [5000, 0])
		self.assertTrue(0 < taux_chutes_feuille(g, articles) < 100)

	def test_pdf_sans_debord(self):
		g = grouper(self._articles((2, 4)), self.p, 1020.0, 720.0)
		with tempfile.TemporaryDirectory() as rep:
			chemin = generer_pdf_groupe(os.path.join(rep, "groupe.pdf"), self.geometries, g, self.p, titre="essai")
			with pymupdf.open(chemin) as pdf:
				self.assertEqual(pdf.page_count, 1)
			relu, _ = lire_trace(chemin)
			self.assertGreater(len(relu), len(self.geometries[0][0]) * 2)

	def test_trop_de_poses(self):
		self.assertIsNone(grouper(self._articles((6, 12)), self.p, 1020.0, 720.0))
		self.assertIsNone(grouper(self._articles((0, 2)), self.p, 1020.0, 720.0))
