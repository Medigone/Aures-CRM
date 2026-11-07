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

from aurescrm.imposition.generateur_cf2 import generer_cff2
from aurescrm.imposition.generateur_pdf import generer_pdf, generer_pdf_pages
from aurescrm.imposition.geometrie import contact_droit, pas_minimal, pas_retenus
from aurescrm.imposition.lecture_trace import (
	couleurs_inattendues,
	lire_trace,
	metriques_developpe,
	silhouette,
	PT,
)
from aurescrm.imposition.optimiseur import (
	Parametres,
	alertes,
	chiffrer,
	coupes_bobine,
	dispositions,
	evaluer_bobine,
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

	def test_coupe_quasi_noire_lue_et_verte_signalee(self):
		"""Un trait quasi noir est une coupe ; une couleur hors convention est signalée."""
		import pymupdf

		doc = pymupdf.open()
		page = doc.new_page(width=100 * PT, height=100 * PT)
		page.draw_line(
			pymupdf.Point(10 * PT, 10 * PT),
			pymupdf.Point(90 * PT, 10 * PT),
			color=(0.01, 0.0, 0.0),
			width=0.4,
		)
		page.draw_line(
			pymupdf.Point(10 * PT, 40 * PT),
			pymupdf.Point(90 * PT, 40 * PT),
			color=(0.0, 0.8, 0.0),
			width=0.4,
		)
		with tempfile.TemporaryDirectory() as rep:
			chemin = os.path.join(rep, "couleurs.pdf")
			doc.save(chemin)
			doc.close()
			coupe, rainage = lire_trace(chemin)
			self.assertTrue(coupe, "le trait quasi noir doit être lu comme une coupe")
			self.assertFalse(rainage)
			inattendues = dict(couleurs_inattendues(chemin))
			self.assertTrue(inattendues, "le trait vert doit être signalé")
			for col in inattendues:
				self.assertGreater(
					max(abs(c - k) for c, k in zip(col, (0.0, 0.0, 0.0))),
					0.02,
					"le quasi-noir ne doit pas apparaître dans les couleurs inattendues",
				)


	def test_pdf_esko_physiophormine_reel_si_present(self):
		"""Le PDF Esko de production (pas la fixture reconstruite) doit donner coupe + rainage."""
		chemin = (
			"/home/wezri/frappe-bench/sites/aurescrm.intrapro.net/private/files/"
			"TRA-26-09-4044 Etui Physiophormine 850mg90 cpm 72x46.5x107mm.pdf"
		)
		if not os.path.exists(chemin):
			self.skipTest("PDF de production absent de ce site")
		coupe, rainage = lire_trace(chemin)
		self.assertGreater(len(coupe), 0)
		self.assertGreater(len(rainage), 0)
		mesures = metriques_developpe(silhouette(coupe, rainage))
		self.assertAlmostEqual(mesures["developpe_l"], 247.2, delta=0.3)
		self.assertAlmostEqual(mesures["developpe_d"], 230.1, delta=0.3)


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

	def test_generation_pdf_multipages(self):
		d1 = evaluer_format(self.poly, self.params, 1020.0, 600.0)
		d2 = evaluer_format(self.poly, self.params, 1020.0, 700.0)
		with tempfile.TemporaryDirectory() as rep:
			sortie = generer_pdf_pages(
				os.path.join(rep, "simulations.pdf"),
				self.coupe,
				self.rainage,
				self.poly,
				[(d1, "1020 × 600"), (d2, "1020 × 700")],
				self.params,
			)
			import pymupdf

			doc = pymupdf.open(sortie)
			self.assertEqual(len(doc), 2)
			self.assertAlmostEqual(doc[0].rect.width / (72 / 25.4), 1020.0, delta=0.1)
			self.assertAlmostEqual(doc[0].rect.height / (72 / 25.4), 600.0, delta=0.1)
			self.assertAlmostEqual(doc[1].rect.width / (72 / 25.4), 1020.0, delta=0.1)
			self.assertAlmostEqual(doc[1].rect.height / (72 / 25.4), 700.0, delta=0.1)

	def test_generation_cff2(self):
		d = evaluer_format(self.poly, self.params, 1020.0, 600.0)
		with tempfile.TemporaryDirectory() as rep:
			sortie = generer_cff2(
				os.path.join(rep, "1020x600_4x3.cf2"),
				self.coupe,
				self.rainage,
				self.poly,
				d,
				self.params,
			)
			texte = open(sortie, encoding="ascii").read()
			self.assertIn("$BOF", texte)
			self.assertIn("CUT", texte)
			self.assertIn("CREASE", texte)
			self.assertIn("L,1,", texte)
			self.assertIn("L,2,", texte)

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


class TestSaisieIngenieur(unittest.TestCase):
	"""Lisière / pince / marge saisies, et simulation sans min/max machine."""

	def test_lisiere_reduite_rapproche_la_feuille_ingenieur(self):
		"""2×2 avec lisière 8 mm : ~782 × 699, pas 797 avec 15,6 mm machine."""
		rect = Polygon([(0, 0), (382, 0), (382, 336), (0, 336)])
		p = Parametres(
			pince=10.0,
			marge_arriere=15.0,
			lisiere=8.0,
			pont=2.0,
			trait_commun=False,
			laize_min=360,
			laize_max=1020,
			depl_min=400,
			depl_max=720,
		)
		dispos = dispositions(rect, p)
		d22 = next(d for d in dispos if d.n_col == 2 and d.n_rang == 2 and d.rotation == 0)
		self.assertAlmostEqual(d22.laize, 382 + 384 + 16, delta=0.2)
		self.assertAlmostEqual(d22.depl, 336 + 338 + 10 + 15, delta=0.2)

	def test_sans_plafond_machine_les_dispositions_existent(self):
		rect = Polygon([(0, 0), (100, 0), (100, 80), (0, 80)])
		p = Parametres(
			pince=0,
			marge_arriere=0,
			lisiere=0,
			pont=0,
			trait_commun=False,
			laize_min=0,
			laize_max=0,
			depl_min=0,
			depl_max=0,
		)
		dispos = dispositions(rect, p)
		self.assertTrue(dispos)
		self.assertTrue(any(d.n_col == 2 and d.n_rang == 2 for d in dispos))

	def test_saisie_vers_bornes_annule_min_max(self):
		from aurescrm.imposition.service import saisie_vers_bornes

		b = saisie_vers_bornes(
			{"laize_max": 1020, "depl_max": 720, "lisiere": 15.6, "pince": 10},
			lisiere=8,
			ignorer=True,
		)
		self.assertEqual(b["laize_max"], 0)
		self.assertEqual(b["depl_max"], 0)
		self.assertEqual(b["lisiere"], 8)

	def test_alerte_sans_maxi_ne_signale_pas_un_depassement(self):
		p = Parametres(laize_max=0, depl_max=0, lisiere=0, pince=0, marge_arriere=0)
		d = evaluer_format(
			Polygon([(0, 0), (100, 0), (100, 80), (0, 80)]), p, 2000.0, 1500.0
		)
		self.assertIsNotNone(d)
		msgs = alertes(d, p)
		self.assertFalse(any("dépasse le format maxi" in m for m in msgs))


class TestBobine(unittest.TestCase):
	"""Palette = format imposé ; bobine = coupe calculée sous un max."""

	def setUp(self):
		self.rect = Polygon([(0, 0), (100, 0), (100, 80), (0, 80)])
		self.libre = Parametres(
			pince=0,
			marge_arriere=0,
			lisiere=0,
			pont=0,
			trait_commun=False,
			sens_fibre="0°",
			laize_min=0,
			laize_max=0,
			depl_min=0,
			depl_max=0,
		)

	def test_coupes_une_par_rang_sous_le_plafond(self):
		coupes = coupes_bobine(self.rect, self.libre, 250.0, 350.0)
		self.assertEqual([(d.n_rang, d.depl) for d in coupes], [(1, 80.0), (2, 160.0), (3, 240.0), (4, 320.0)])

	def test_coupes_sans_plafond_jusqu_au_maximum_de_rangs(self):
		coupes = coupes_bobine(self.rect, self.libre, 250.0, 0)
		self.assertEqual(max(d.n_rang for d in coupes), 12)

	def test_bobine_garde_la_meilleure_des_coupes(self):
		rect = Polygon([(0, 0), (100, 0), (100, 80), (0, 80)])
		p = Parametres(pince=10, marge_arriere=15, lisiere=0, pont=0, trait_commun=False, sens_fibre="0°", laize_min=0, laize_max=0, depl_min=0, depl_max=0)
		coupes = coupes_bobine(rect, p, 250.0, 350.0)
		meilleure = min(coupes, key=lambda d: d.surface_par_pose)
		self.assertEqual(evaluer_bobine(rect, p, 250.0, 350.0).n_rang, meilleure.n_rang)

	def test_coupes_laize_trop_etroite(self):
		self.assertEqual(coupes_bobine(self.rect, self.libre, 50.0, 0), [])

	def test_palette_impose_laize_et_depl(self):
		d = evaluer_format(self.rect, self.libre, 250.0, 400.0)
		self.assertIsNotNone(d)
		self.assertEqual((d.n_col, d.n_rang), (2, 5))
		self.assertAlmostEqual(d.laize, 250.0)
		self.assertAlmostEqual(d.depl, 400.0)

	def test_bobine_max_rangs_sous_plafond(self):
		"""2 colonnes, 5 rangs (80×5 = 400), coupe = 400."""
		d = evaluer_bobine(self.rect, self.libre, 250.0, 400.0)
		self.assertIsNotNone(d)
		self.assertEqual(d.n_col, 2)
		self.assertEqual(d.n_rang, 5)
		self.assertAlmostEqual(d.depl, 400.0)
		self.assertAlmostEqual(d.laize, 250.0)

	def test_bobine_coupe_plus_courte_que_le_max(self):
		"""Palette 250×350 : depl imposé 350. Bobine max 350 : coupe 320 (4×80)."""
		palette = evaluer_format(self.rect, self.libre, 250.0, 350.0)
		bobine = evaluer_bobine(self.rect, self.libre, 250.0, 350.0)
		self.assertEqual(palette.n_rang, 4)
		self.assertAlmostEqual(palette.depl, 350.0)
		self.assertEqual(bobine.n_rang, 4)
		self.assertAlmostEqual(bobine.depl, 320.0)

	def test_bobine_un_rang_depasse_le_max(self):
		p = Parametres(
			pince=10,
			marge_arriere=15,
			lisiere=0,
			pont=0,
			trait_commun=False,
			sens_fibre="0°",
			laize_max=0,
			depl_max=0,
		)
		self.assertIsNone(evaluer_bobine(self.rect, p, 250.0, 100.0))

	def test_bobine_plus_de_rangs_reduit_les_chutes(self):
		p = Parametres(
			pince=10,
			marge_arriere=15,
			lisiere=0,
			pont=0,
			trait_commun=False,
			sens_fibre="0°",
			laize_max=0,
			depl_max=0,
		)
		d = evaluer_bobine(self.rect, p, 250.0, 2000.0)
		self.assertIsNotNone(d)
		self.assertEqual(d.n_col, 2)
		self.assertEqual(d.n_rang, 12)

	def test_bobine_sans_plafond_coupe_au_besoin(self):
		"""Déplacement vide : 12 rangs, coupe = 80×12."""
		d = evaluer_bobine(self.rect, self.libre, 250.0, 0)
		self.assertIsNotNone(d)
		self.assertEqual((d.n_col, d.n_rang), (2, 12))
		self.assertAlmostEqual(d.depl, 960.0)

	def test_formats_connus_bobine_sans_max(self):
		from types import SimpleNamespace

		from aurescrm.imposition.service import formats_connus

		support = SimpleNamespace(
			support="GC",
			grammage="270",
			formats_feuilles=[SimpleNamespace(laize=1020, depl=0, bobine=1)],
		)
		proposes = formats_connus(support=support, stock_seul=True)
		self.assertEqual(len(proposes), 1)
		self.assertEqual(proposes[0]["bobine"], 1)
		self.assertIn("Bobine 1020 mm", proposes[0]["libelle"])
		self.assertNotIn("max", proposes[0]["libelle"])

	def test_formats_connus_palette_et_bobine_coexistent(self):
		from types import SimpleNamespace

		from aurescrm.imposition.service import formats_connus

		support = SimpleNamespace(
			support="GC",
			grammage="270",
			formats_feuilles=[
				SimpleNamespace(laize=250, depl=400, bobine=0),
				SimpleNamespace(laize=250, depl=400, bobine=1),
			],
		)
		proposes = formats_connus(support=support, stock_seul=True)
		self.assertEqual(len(proposes), 2)
		palette = next(p for p in proposes if not p["bobine"])
		bobine = next(p for p in proposes if p["bobine"])
		self.assertIn("250 × 400", palette["libelle"])
		self.assertIn("Bobine 250 mm (max 400)", bobine["libelle"])


if __name__ == "__main__":
	unittest.main()
