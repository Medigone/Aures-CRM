# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Tests de non-régression du moteur d'imposition.

Les deux dossiers réels du §8 du cahier des charges sont la condition d'entrée du
moteur en production : l'ingénieur n'utilisera l'outil que s'il y retrouve d'abord
ses propres résultats. Toute modification du moteur doit repasser ces tests.

Les fixtures sont les tracés des deux dossiers, reconstruits à partir des PDF
d'imposition validés par l'ingénieur (les poses y sont des copies translatées
d'un même tracé).

Ces tests ne dépendent pas de Frappe : ils peuvent tourner via
`bench --site <site> run-tests --app aurescrm` ou directement en unittest.
"""

import os
import tempfile
import unittest

from shapely.geometry import Polygon

from aurescrm.imposition.generateur_pdf import generer_pdf
from aurescrm.imposition.geometrie import contact_droit, pas_minimal, pas_retenus
from aurescrm.imposition.lecture_trace import (
	lire_trace,
	metriques_developpe,
	silhouette,
)
from aurescrm.imposition.optimiseur import (
	Parametres,
	chiffrer,
	dispositions,
	evaluer_format,
	trois_scenarios,
)

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")

# Paramètres machine communs aux deux dossiers.
MACHINE = {
	"pince": 10.0,
	"marge_arriere": 15.0,
	"lisiere": 15.6,
	"laize_max": 1020.0,
	"depl_max": 720.0,
}


def _charger(nom):
	chemin = os.path.join(FIXTURES, nom)
	coupe, rainage = lire_trace(chemin)
	poly = silhouette(coupe, rainage)
	return coupe, rainage, poly, metriques_developpe(poly)


class TestGeometrie(unittest.TestCase):
	def test_silhouette_sans_chemin_exploitable(self):
		"""Garde-fou : pas de résultat approximatif sur une convention de couleurs fausse."""
		with self.assertRaises(ValueError):
			silhouette([], [])

	def test_pas_minimal_carre(self):
		carre = Polygon([(0, 0), (100, 0), (100, 100), (0, 100)])
		self.assertAlmostEqual(pas_minimal(carre, "x", 3.0), 103.00, places=2)
		self.assertAlmostEqual(pas_minimal(carre, "y", 3.0), 103.00, places=2)

	def test_contact_droit_rectangle(self):
		rect = Polygon([(0, 0), (80, 0), (80, 120), (0, 120)])
		zones, longueur = contact_droit(rect, "x", 80.0)
		self.assertEqual(zones, 1)
		self.assertAlmostEqual(longueur, 120.0, delta=0.5)

	def test_formule_de_grille_un_plus(self):
		"""Encombrement 100, pas 100, utile 100 -> 1 pose. Ni 0, ni 2."""
		carre = Polygon([(0, 0), (100, 0), (100, 100), (0, 100)])
		p = Parametres(
			pince=0, marge_arriere=0, lisiere=0, pont=0, trait_commun=False,
			laize_max=1000, depl_max=1000,
		)
		d = evaluer_format(carre, p, 100.0, 100.0)
		self.assertIsNotNone(d)
		self.assertEqual((d.n_col, d.n_rang, d.poses), (1, 1, 1))


class TestEtuiPhysiophormine(unittest.TestCase):
	"""Étui Physiophormine 850 mg 90 cpm, 72 x 46,5 x 107 mm, 270 g/m², pont 2,5."""

	@classmethod
	def setUpClass(cls):
		cls.coupe, cls.rainage, cls.poly, cls.mesures = _charger("trace_etui_physiophormine.pdf")
		cls.params = Parametres(pont=2.5, grammage=270.0, quantite=1_000_000, **MACHINE)

	def test_developpe(self):
		self.assertAlmostEqual(self.mesures["developpe_l"], 247.2, delta=0.2)
		self.assertAlmostEqual(self.mesures["developpe_d"], 230.1, delta=0.2)
		self.assertAlmostEqual(self.mesures["surface_utile"], 393.7, delta=1.0)
		self.assertAlmostEqual(self.mesures["remplissage_bbox"], 69.2, delta=0.5)

	def test_trait_commun_et_pas(self):
		px, py, tc_x, tc_y = pas_retenus(self.poly, 2.5, True)
		self.assertTrue(tc_x, "trait commun attendu en laize (1 zone de 101,7 mm sur 230)")
		self.assertFalse(tc_y, "pas de trait commun en déplacement (2 zones de 52,5 mm)")
		self.assertAlmostEqual(px, 247.2, delta=0.2)
		# L'emboîtement en déplacement fait passer le pas de 230 à 171,6 mm, soit -25 %.
		self.assertAlmostEqual(py, 171.55, delta=0.2)

	def test_pont_non_additif(self):
		"""Le pont ne s'ajoute pas au pas : sur bords inclinés 2,5 mm coûtent ~3 mm."""
		ecart = pas_minimal(self.poly, "y", 2.5) - pas_minimal(self.poly, "y", 0.0)
		self.assertGreater(ecart, 2.8)
		self.assertNotAlmostEqual(ecart, 2.5, places=1)

	def test_reference_1020x600(self):
		"""12 poses en 4 x 3 — identique au fichier de l'ingénieur."""
		d = evaluer_format(self.poly, self.params, 1020.0, 600.0)
		self.assertIsNotNone(d)
		self.assertEqual((d.n_col, d.n_rang, d.poses), (4, 3, 12))
		chiffrage = chiffrer(d, self.params, self.mesures["surface_utile_mm2"])
		self.assertEqual(chiffrage["nb_feuilles"], 83_334)
		self.assertAlmostEqual(chiffrage["tonnage"], 13.77, delta=0.02)
		self.assertAlmostEqual(chiffrage["taux_chutes"], 22.8, delta=0.2)

	def test_scenarios(self):
		dispos = dispositions(self.poly, self.params)
		self.assertTrue(dispos)
		scenarios = trois_scenarios(dispos, self.params)
		a = scenarios["A — Matière minimale"]
		# Le moteur doit faire au moins aussi bien que la référence de l'ingénieur.
		self.assertLessEqual(a.surface_par_pose, 1020 * 600 / 12)
		self.assertIsNotNone(scenarios["B — Charge machine minimale"])
		self.assertIsNone(scenarios["C — Format en stock"], "aucun format de stock fourni")

	def test_generation_pdf(self):
		d = evaluer_format(self.poly, self.params, 1020.0, 600.0)
		with tempfile.TemporaryDirectory() as rep:
			sortie = generer_pdf(
				os.path.join(rep, "imposition.pdf"),
				self.coupe,
				self.rainage,
				self.poly,
				d,
				self.params,
				"Etui Physiophormine",
			)
			import pymupdf

			page = pymupdf.open(sortie)[0]
			self.assertAlmostEqual(page.rect.width / (72 / 25.4), 1020.0, delta=0.1)
			self.assertAlmostEqual(page.rect.height / (72 / 25.4), 600.0, delta=0.1)

	def test_controle_geometrique_post_generation(self):
		"""Une grille trop grande pour la feuille doit lever, pas produire un PDF faux."""
		d = evaluer_format(self.poly, self.params, 1020.0, 600.0)
		d.n_col += 2
		with tempfile.TemporaryDirectory() as rep, self.assertRaises(ValueError):
			generer_pdf(
				os.path.join(rep, "faux.pdf"),
				self.coupe,
				self.rainage,
				self.poly,
				d,
				self.params,
			)


class TestBoiteMouchoir(unittest.TestCase):
	"""Boîte mouchoir 140, 115 x 70 x 230 mm, B Gris 400 g/m², pont 3,5.

	Test de robustesse de l'extraction : les lignes noires seules n'y ferment
	aucun contour, une partie du bord du développé est portée par des rainages.
	"""

	@classmethod
	def setUpClass(cls):
		cls.coupe, cls.rainage, cls.poly, cls.mesures = _charger("trace_boite_mouchoir.pdf")
		cls.params = Parametres(pont=3.5, grammage=400.0, quantite=1_000_000, **MACHINE)

	def test_developpe(self):
		self.assertAlmostEqual(self.mesures["developpe_l"], 384.5, delta=0.2)
		self.assertAlmostEqual(self.mesures["developpe_d"], 340.0, delta=0.2)
		self.assertAlmostEqual(self.mesures["surface_utile"], 1165.6, delta=2.0)
		self.assertAlmostEqual(self.mesures["remplissage_bbox"], 89.1, delta=0.5)

	def test_extraction_robuste(self):
		"""Extraction par rastérisation : un contour ouvert ou porté par du rouge passe.

		Sur ce dossier, une partie du bord du développé est portée par des rainages.
		L'extraction prend donc noir ET rouge en entrée, et le passage par le bitmap
		tolère les fentes ouvertes entre rabats — un simple polygonize échouerait.
		"""
		self.assertTrue(self.poly.is_valid)
		self.assertEqual(self.poly.geom_type, "Polygon")
		self.assertEqual(len(self.poly.interiors), 0)

	def test_trait_commun_et_pas(self):
		px, py, tc_x, tc_y = pas_retenus(self.poly, 3.5, True)
		self.assertTrue(tc_x, "trait commun attendu en laize (contact 222,4 mm sur 340)")
		self.assertFalse(tc_y, "contact de 88,5 mm sur 384,5 : sous le seuil de 40 %")
		self.assertAlmostEqual(px, 384.55, delta=0.1)
		self.assertAlmostEqual(py, 343.55, delta=0.1)
		# Aucun emboîtement en déplacement : pas serré = encombrement.
		self.assertAlmostEqual(pas_minimal(self.poly, "y", 0.0), 340.0, delta=0.1)

	def test_meilleure_disposition(self):
		dispos = dispositions(self.poly, self.params)
		self.assertTrue(dispos)
		a = trois_scenarios(dispos, self.params)["A — Matière minimale"]
		self.assertEqual((a.n_col, a.n_rang, a.poses), (2, 2, 4))
		self.assertAlmostEqual(a.laize, 800.3, delta=0.2)
		self.assertAlmostEqual(a.depl, 708.5, delta=0.2)
		self.assertAlmostEqual(a.surface_par_pose / 100.0, 1417.5, delta=2.0)
		chiffrage = chiffrer(a, self.params, self.mesures["surface_utile_mm2"])
		self.assertAlmostEqual(chiffrage["taux_chutes"], 17.8, delta=0.3)

	def test_format_stock_1020x720(self):
		"""4 poses également, mais 1 836 cm² par pose — 36,5 % de chute."""
		d = evaluer_format(self.poly, self.params, 1020.0, 720.0)
		self.assertIsNotNone(d)
		self.assertEqual(d.poses, 4)
		self.assertAlmostEqual(d.surface_par_pose / 100.0, 1836.0, delta=2.0)
		chiffrage = chiffrer(d, self.params, self.mesures["surface_utile_mm2"])
		self.assertAlmostEqual(chiffrage["taux_chutes"], 36.5, delta=0.3)


if __name__ == "__main__":
	unittest.main()
