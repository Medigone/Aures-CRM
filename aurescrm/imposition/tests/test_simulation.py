# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""simuler_format(vars_, …) ≡ evaluer_format(poly, …) — sans Frappe."""

import os
import unittest

from aurescrm.imposition.lecture_trace import lire_trace, metriques_developpe, silhouette
from aurescrm.imposition.optimiseur import Parametres, evaluer_format, variantes
from aurescrm.imposition.service import silhouette_svg, simuler_format, simuler_grille

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")

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


class TestSimulation(unittest.TestCase):
	@classmethod
	def setUpClass(cls):
		cls.etui = _charger("trace_etui_physiophormine.pdf")
		cls.boite = _charger("trace_boite_mouchoir.pdf")

	def _params(self, **extra):
		kw = dict(MACHINE)
		kw.update(pont=2.5, grammage=270.0, quantite=1_000_000)
		kw.update(extra)
		return Parametres(**kw)

	def test_simuler_format_egal_evaluer_etui(self):
		coupe, rainage, poly, mesures = self.etui
		p = self._params()
		vars_ = variantes(poly, p)
		direct = evaluer_format(poly, p, 1020, 600)
		via_vars = evaluer_format(None, p, 1020, 600, vars_=vars_)
		self.assertIsNotNone(direct)
		self.assertEqual(
			(direct.n_col, direct.n_rang, direct.poses, direct.rotation),
			(via_vars.n_col, via_vars.n_rang, via_vars.poses, via_vars.rotation),
		)
		ligne = simuler_format(vars_, p, 1020, 600, mesures["surface_utile_mm2"])
		self.assertEqual(ligne["nb_poses"], direct.poses)
		self.assertEqual(ligne["n_col"], direct.n_col)
		self.assertEqual(ligne["n_rang"], direct.n_rang)
		self.assertAlmostEqual(ligne["taux_chutes"], 100 * (1 - mesures["surface_utile_mm2"] / direct.surface_par_pose), delta=0.15)

	def test_simuler_format_egal_evaluer_boite(self):
		coupe, rainage, poly, mesures = self.boite
		p = self._params(pont=3.0)
		vars_ = variantes(poly, p)
		direct = evaluer_format(poly, p, 1020, 720)
		ligne = simuler_format(vars_, p, 1020, 720, mesures["surface_utile_mm2"])
		self.assertIsNotNone(direct)
		self.assertEqual(ligne["nb_poses"], direct.poses)
		self.assertEqual(ligne["rotation"], direct.rotation)

	def test_simuler_grille_reproduit_la_disposition(self):
		coupe, rainage, poly, mesures = self.etui
		p = self._params()
		vars_ = variantes(poly, p)
		# 4 x 3 sur 1020 x 600, rotation 0 — dossier ingénieur.
		ligne = simuler_grille(vars_, p, 0, 4, 3, mesures["surface_utile_mm2"])
		self.assertIsNotNone(ligne)
		self.assertEqual((ligne["n_col"], ligne["n_rang"]), (4, 3))
		self.assertEqual(ligne["nb_poses"], 12)

	def test_silhouette_svg_sous_400_points(self):
		for nom, dossier in (("étui", self.etui), ("boîte", self.boite)):
			coupe, rainage, poly, _ = dossier
			svg = silhouette_svg(poly, coupe, rainage)
			self.assertIsNotNone(svg, nom)
			for rot, bloc in svg.items():
				for cle in ("path_coupe", "path_rainage"):
					path = bloc[cle]
					nb = path.count("L") + path.count("M")
					self.assertLessEqual(nb, 400, f"{nom} {rot} {cle} : {nb} points")
				self.assertGreater(bloc["l"], 0)
				self.assertGreater(bloc["d"], 0)

	def test_apercu_svg_ne_cree_pas_de_diagonales_parasites(self):
		"""Sous-échantillonnage uniforme : un rabat rectangulaire devenait un triangle.

		Le PDF mouchoir a 500+ segments (ovale Bézier). Le budget 400 points ne doit
		pas sauter les coins 90° du développé.
		"""
		import math

		from aurescrm.imposition.generateur_pdf import _poses_normalisees
		from aurescrm.imposition.service import _segments_vers_path, silhouette_svg

		def path_vers_segs(path):
			segs, cur, i = [], None, 0
			while i < len(path):
				if path[i] in "ML":
					cmd = path[i]
					j = i + 1
					while j < len(path) and path[j] not in "ML":
						j += 1
					x, y = map(float, path[i + 1 : j].split(","))
					if cmd == "L" and cur:
						segs.append((cur, (x, y)))
					cur = (x, y)
					i = j
				else:
					i += 1
			return segs

		def longs_bizarres(segs, min_len=40.0):
			out = []
			for (ax, ay), (bx, by) in segs:
				longueur = math.hypot(bx - ax, by - ay)
				if longueur < min_len:
					continue
				ang = abs(math.degrees(math.atan2(by - ay, bx - ax))) % 180
				d90 = min(ang % 90, 90 - ang % 90)
				d45 = abs((ang % 90) - 45)
				if d90 > 5 and d45 > 8:
					out.append((longueur, ang))
			return out

		chemin = (
			"/home/wezri/frappe-bench/sites/aurescrm.intrapro.net/private/files/"
			"TRA-26-09-4061-Bt mouchoir 140- 115x69x229mm.pdf"
		)
		if os.path.exists(chemin):
			from aurescrm.imposition.lecture_trace import lire_trace, silhouette

			coupe, rainage = lire_trace(chemin)
			poly = silhouette(coupe, rainage)
		else:
			coupe, rainage, poly, _ = self.boite
		coupe_n, _ = _poses_normalisees(coupe, poly, 0)
		self.assertFalse(longs_bizarres(coupe_n), "le tracé source n'a pas de longue diagonale")
		path = _segments_vers_path(coupe_n)
		self.assertFalse(
			longs_bizarres(path_vers_segs(path)),
			"l'aperçu SVG ne doit pas inventer de pans inclinés",
		)
		svg = silhouette_svg(poly, coupe, rainage)
		self.assertIsNotNone(svg)
		nb = svg["0"]["path_coupe"].count("L") + svg["0"]["path_coupe"].count("M")
		self.assertLessEqual(nb, 400)

	def test_diagnostic_bornes_intervalle_vide(self):
		from aurescrm.imposition.optimiseur import contrainte_bloquante
		from aurescrm.imposition.service import diagnostic_bornes

		bornes = {
			"laize_min": 600,
			"laize_max": 720,
			"depl_min": 720,
			"depl_max": 700,
		}
		parts = diagnostic_bornes(bornes)
		self.assertEqual(len(parts), 1)
		self.assertIn("déplacement", parts[0])
		self.assertIn("720", parts[0])
		self.assertIn("700", parts[0])

		msg = contrainte_bloquante(None, self._params(laize_min=600, depl_min=720, depl_max=700))
		self.assertIn("intersection vide", msg)
		self.assertNotIn("pose unique", msg)

	def test_preparer_sans_plafond_puis_simuler(self):
		from aurescrm.imposition.optimiseur import Variante
		from aurescrm.imposition.service import EntreeCalcul, preparer

		chemin = os.path.join(FIXTURES, "trace_etui_physiophormine.pdf")
		journal = []
		prep = preparer(EntreeCalcul(chemin=chemin, pont=2.5, quantite=1_000_000), journal)
		self.assertGreater(prep.mesures["developpe_l"], 0)
		self.assertTrue(prep.variantes)
		self.assertFalse(prep.params.laize_max)
		self.assertFalse(prep.lignes)
		self.assertTrue(any("simulation libre" in ligne for ligne in journal))
		vars_ = [Variante.depuis_dict(v) for v in prep.variantes]
		ligne = simuler_format(vars_, prep.params, 1020, 700, prep.mesures["surface_utile_mm2"])
		self.assertIsNotNone(ligne)
		self.assertGreater(ligne["nb_poses"], 0)

	def test_calculer_sur_mesure_exige_plafond(self):
		from aurescrm.imposition.service import EntreeCalcul, calculer

		chemin = os.path.join(FIXTURES, "trace_etui_physiophormine.pdf")
		with self.assertRaises(ValueError) as ctx:
			calculer(
				EntreeCalcul(chemin=chemin, pont=2.5, inclure_sur_mesure=True, mode="atelier"),
				[],
			)
		self.assertIn("maxi", str(ctx.exception).lower())

	def test_calculer_format_etudie_passe_par_preparer(self):
		from aurescrm.imposition.service import EntreeCalcul, calculer

		chemin = os.path.join(FIXTURES, "trace_etui_physiophormine.pdf")
		journal = []
		resultat = calculer(
			EntreeCalcul(
				chemin=chemin,
				pont=2.5,
				quantite=1_000_000,
				bornes=dict(MACHINE),
				formats_etudies=[{"laize": 1020, "depl": 700, "libelle": "1020 × 700"}],
				inclure_sur_mesure=False,
			),
			journal,
		)
		self.assertTrue(resultat.lignes)
		self.assertGreater(resultat.lignes[0]["nb_poses"], 0)
		self.assertTrue(resultat.variantes)

	def test_pdf_distinct_du_trace_ne_compare_pas_les_cotes_etui(self):
		"""Dépôt d'un PDF mouchoir sur un Calcul encore lié à un Tracé étui.

		Le recoupement ne s'applique que si le fichier déposé EST celui du Tracé.
		Sinon les cotes 230 × 247,2 bloquent à tort (erreur CI-2609-00246).
		"""
		from aurescrm.imposition.service import EntreeCalcul, fichier_est_celui_du_trace, preparer

		self.assertFalse(
			fichier_est_celui_du_trace(
				"/private/files/TRA-26-09-4061-Bt mouchoir 140- 115x69x229mm.pdf",
				"/private/files/TRA-26-09-4044 Etui Physiophormine 850mg90 cpm 72x46.5x107mm.pdf",
			)
		)
		self.assertTrue(
			fichier_est_celui_du_trace(
				"/private/files/TRA-26-09-4061-Bt mouchoir 140- 115x69x229mm.pdf",
				"/private/files/TRA-26-09-4061-Bt mouchoir 140- 115x69x229mm.pdf?v=1",
			)
		)
		chemin = os.path.join(FIXTURES, "trace_boite_mouchoir.pdf")
		reel = (
			"/home/wezri/frappe-bench/sites/aurescrm.intrapro.net/private/files/"
			"TRA-26-09-4061-Bt mouchoir 140- 115x69x229mm.pdf"
		)
		if os.path.exists(reel):
			chemin = reel
		with self.assertRaises(ValueError) as ctx:
			preparer(
				EntreeCalcul(
					chemin=chemin,
					pont=2.0,
					dimensions_saisies=[230.0, 247.2],
					bornes=dict(MACHINE),
				),
				[],
			)
		self.assertIn("incohérent", str(ctx.exception).lower())
		res = preparer(
			EntreeCalcul(
				chemin=chemin, pont=2.0, dimensions_saisies=None, bornes=dict(MACHINE)
			),
			[],
		)
		self.assertGreater(res.mesures["developpe_l"], 300)

	def test_calculer_sur_mesure_sans_max_si_ignorer_contraintes(self):
		"""Sans plafond machine, le sur-mesure ne doit plus lever « format maxi absent »."""
		from aurescrm.imposition.service import EntreeCalcul, calculer

		chemin = os.path.join(FIXTURES, "trace_boite_mouchoir.pdf")
		journal = []
		resultat = calculer(
			EntreeCalcul(
				chemin=chemin,
				pont=2.0,
				inclure_sur_mesure=True,
				formats_etudies=[],
				bornes={"laize_max": 0, "depl_max": 0, "lisiere": 8, "pince": 10, "marge_arriere": 15},
				lisiere_saisie=8.0,
				pince_saisie=10.0,
				marge_arriere_saisie=15.0,
				ignorer_contraintes_machine=True,
				mode="atelier",
			),
			journal,
		)
		self.assertTrue(resultat.lignes)
		self.assertTrue(any("simulation libre" in l.lower() for l in journal))

	def test_calculer_atelier_formats_sans_machine_ni_couts(self):
		from aurescrm.imposition.service import EntreeCalcul, calculer

		chemin = os.path.join(FIXTURES, "trace_etui_physiophormine.pdf")
		journal = []
		resultat = calculer(
			EntreeCalcul(
				chemin=chemin,
				pont=2.5,
				quantite=1_000_000,
				formats_etudies=[{"laize": 1020, "depl": 700, "libelle": "1020 × 700"}],
				inclure_sur_mesure=False,
				ignorer_contraintes_machine=True,
				lisiere_saisie=15.6,
				pince_saisie=10.0,
				marge_arriere_saisie=15.0,
				mode="atelier",
			),
			journal,
		)
		self.assertTrue(resultat.lignes)
		self.assertGreater(resultat.lignes[0]["nb_poses"], 0)
		self.assertEqual(resultat.lignes[0]["cout_matiere"], 0)
		self.assertEqual(resultat.lignes[0]["cout_par_1000"], 0)

	def test_calculer_atelier_bobine_coupe_sous_max(self):
		from aurescrm.imposition.service import EntreeCalcul, calculer

		chemin = os.path.join(FIXTURES, "trace_etui_physiophormine.pdf")
		journal = []
		resultat = calculer(
			EntreeCalcul(
				chemin=chemin,
				pont=2.5,
				quantite=1_000_000,
				formats_etudies=[
					{"laize": 1020, "depl": 720, "bobine": 1, "libelle": "Bobine 1020"}
				],
				inclure_sur_mesure=False,
				ignorer_contraintes_machine=True,
				lisiere_saisie=15.6,
				pince_saisie=10.0,
				marge_arriere_saisie=15.0,
				mode="atelier",
			),
			journal,
		)
		self.assertEqual(len(resultat.lignes), 1)
		ligne = resultat.lignes[0]
		self.assertEqual(ligne["origine"], "Bobine")
		self.assertAlmostEqual(ligne["laize"], 1020.0)
		self.assertLessEqual(ligne["depl"], 720.0 + 1e-6)
		self.assertIn("Bobine 1020 mm", ligne["libelle"])
		self.assertIn("coupe", ligne["libelle"])

	def test_formats_connus_stock_seul_ignore_maxi_et_impositions(self):
		from types import SimpleNamespace

		from aurescrm.imposition.service import formats_connus

		support = SimpleNamespace(
			support="GC",
			grammage=270,
			formats_feuilles=[
				SimpleNamespace(laize=1020, depl=720),
				SimpleNamespace(laize=700, depl=1000),
			],
		)
		proposes = formats_connus(
			article="ITEM-X",
			trace="TRA-X",
			bornes={"laize_max": 2000, "depl_max": 1500},
			support=support,
			stock_seul=True,
		)
		self.assertEqual(len(proposes), 2)
		self.assertTrue(all(p["origine"] == "Stock" for p in proposes))
		self.assertEqual(
			sorted((p["laize"], p["depl"]) for p in proposes),
			[(700.0, 1000.0), (1020.0, 720.0)],
		)
