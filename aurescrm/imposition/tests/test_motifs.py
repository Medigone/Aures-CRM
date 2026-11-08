# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Tête-bêche et quinconce : des poses qui ne se touchent jamais, et un gain réel sur la grille droite.

Sans Frappe, comme `test_moteur`. Le contrôle décisif : toutes les poses placées par `positions()`, élargies de
pont/2 chacune, ne se recouvrent pas.
"""

import itertools
import os
import tempfile
import unittest

import pymupdf
from shapely.affinity import translate

from aurescrm.imposition.generateur_pdf import generer_pdf
from aurescrm.imposition.lecture_trace import lire_trace, silhouette
from aurescrm.imposition.motifs import COLONNES, QUINCONCE, RANGS, TETE_BECHE
from aurescrm.imposition.optimiseur import (
	FAMILLE_MOTIF,
	MOTIFS_ALIGNES,
	MOTIFS_NON,
	Disposition,
	Parametres,
	_pose_tournee,
	evaluer_bobine_et_motif,
	evaluer_format,
	evaluer_format_et_motif,
	est_motif,
	motif_depuis_dict,
	positions,
	variantes,
)
from aurescrm.imposition.service import champs_motif, disposition_depuis_ligne, ligne_scenario

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")
MACHINE = {"pince": 10.0, "marge_arriere": 15.0, "lisiere": 15.6, "laize_max": 1020.0, "depl_max": 720.0}


def _charger(nom):
	coupe, rainage = lire_trace(os.path.join(FIXTURES, nom))
	return coupe, rainage, silhouette(coupe, rainage)


def _recouvrements(poly, d, jeu):
	"""Les couples de poses qui se recouvrent, chacune élargie de jeu/2."""
	formes = {}
	poses = []
	for x, y, r in positions(d):
		if r not in formes:
			formes[r] = _pose_tournee(poly, r)[0].buffer(jeu / 2, join_style=2)
		poses.append(translate(formes[r], x, y))
	return [(i, j) for i, j in itertools.combinations(range(len(poses)), 2) if poses[i].intersects(poses[j]) and poses[i].intersection(poses[j]).area > 1e-6]


def _en_grille(v, n_col, n_rang):
	return Disposition(libelle="essai", laize=2000.0, depl=2000.0, n_col=n_col, n_rang=n_rang, pas_laize=v.pas_laize, pas_depl=v.pas_depl, rotation=v.rotation, motif=v.motif, axe=v.axe, decalage_laize=v.decalage_laize, decalage_depl=v.decalage_depl, pas_paire=v.pas_paire)


class _Commun:
	nom = ""
	jeu = 2.5

	@classmethod
	def setUpClass(cls):
		cls.coupe, cls.rainage, cls.poly = _charger(cls.nom)
		cls.params = Parametres(pont=cls.jeu, grammage=300.0, quantite=100_000, **MACHINE)
		cls.vars_ = variantes(cls.poly, cls.params)
		cls.motifs = [v for v in cls.vars_ if est_motif(v)]

	def test_aucune_pose_ne_touche_sa_voisine(self):
		"""4 × 4 poses de chaque motif, nombres impairs compris : rien ne se recouvre."""
		for v in self.motifs:
			for n_col, n_rang in ((4, 4), (3, 5), (5, 3)):
				with self.subTest(rotation=v.rotation, motif=v.motif, axe=v.axe, grille=(n_col, n_rang)):
					self.assertEqual(_recouvrements(self.poly, _en_grille(v, n_col, n_rang), self.jeu), [])

	def test_le_motif_gagne_sur_la_grille_droite(self):
		droites = {v.rotation: v.pas_laize * v.pas_depl for v in self.vars_ if not est_motif(v)}
		for v in self.motifs:
			self.assertLess(v.pas_laize * v.pas_depl, droites[v.rotation] * 0.995)

	def test_motif_dans_la_feuille(self):
		"""Le motif retenu sur 1020 × 720 tient dans la zone utile, et le PDF le confirme."""
		d = evaluer_format(self.poly, self.params, 1020.0, 720.0, vars_=self.vars_, famille=FAMILLE_MOTIF)
		if not d:
			self.skipTest("aucun motif sur ce dossier")
		self.assertGreaterEqual(d.reste_laize, -1e-6)
		self.assertGreaterEqual(d.reste_depl, -1e-6)
		self.assertEqual(_recouvrements(self.poly, d, self.jeu), [])
		with tempfile.TemporaryDirectory() as rep:
			sortie = generer_pdf(os.path.join(rep, "motif.pdf"), self.coupe, self.rainage, self.poly, d, self.params)
			with pymupdf.open(sortie) as pdf:
				self.assertEqual(pdf.page_count, 1)

	def test_un_motif_de_trop_deborde(self):
		d = evaluer_format(self.poly, self.params, 1020.0, 720.0, vars_=self.vars_, famille=FAMILLE_MOTIF)
		if not d:
			self.skipTest("aucun motif sur ce dossier")
		if d.axe == RANGS:
			d.n_rang += 2
		else:
			d.n_col += 2
		with tempfile.TemporaryDirectory() as rep, self.assertRaises(ValueError):
			generer_pdf(os.path.join(rep, "faux.pdf"), self.coupe, self.rainage, self.poly, d, self.params)

	def test_aligne_et_non(self):
		alignes = variantes(self.poly, Parametres(pont=self.jeu, motifs=MOTIFS_ALIGNES, **MACHINE))
		for v in (v for v in alignes if est_motif(v)):
			self.assertEqual(v.motif, TETE_BECHE, "un quinconce aligné n'est qu'une grille droite")
			decalage = v.decalage_depl if v.axe == COLONNES else v.decalage_laize
			self.assertAlmostEqual(decalage, 0.0, places=2)
		aucun = variantes(self.poly, Parametres(pont=self.jeu, motifs=MOTIFS_NON, **MACHINE))
		self.assertFalse([v for v in aucun if est_motif(v)])

	def test_la_ligne_garde_le_motif(self):
		"""Une ligne de scénario, rangée dans la table puis relue, redonne la même disposition."""
		for d in evaluer_format_et_motif(None, self.params, 1020.0, 720.0, vars_=self.vars_):
			ligne = ligne_scenario(d.libelle, d, self.params, 30_000)
			self.assertEqual(len(ligne["poses"]), d.poses)
			relue = disposition_depuis_ligne(ligne)
			self.assertEqual(positions(relue), positions(d))
			self.assertEqual(champs_motif(relue), champs_motif(d))


class TestMotifsBoiteMouchoir(_Commun, unittest.TestCase):
	nom = "trace_boite_mouchoir.pdf"
	jeu = 3.5

	def test_tete_beche_gagne_au_moins_trois_pour_cent(self):
		"""Sur la boîte mouchoir, le tête-bêche décalé fait 1 269 cm² par pose contre 1 321 en grille droite."""
		droite = next(v for v in self.vars_ if not est_motif(v) and v.rotation == 0)
		meilleur = min((v for v in self.motifs if v.motif == TETE_BECHE), key=lambda v: v.pas_laize * v.pas_depl)
		self.assertLess(meilleur.pas_laize * meilleur.pas_depl, droite.pas_laize * droite.pas_depl * 0.97)

	def test_bobine_avec_motif(self):
		lignes = evaluer_bobine_et_motif(None, self.params, 1020.0, 0, vars_=self.vars_)
		self.assertTrue(lignes)
		self.assertFalse(est_motif(lignes[0]), "la grille droite vient d'abord")
		if len(lignes) == 2:
			self.assertLess(lignes[1].surface_par_pose, lignes[0].surface_par_pose)


class TestMotifsEtui(_Commun, unittest.TestCase):
	"""L'étui s'emboîte déjà par translation (pas de 230 à 171,6 mm) : un motif n'y fait pas mieux."""

	nom = "trace_etui_physiophormine.pdf"
	jeu = 2.5

	def test_rien_de_mieux_que_la_grille_droite(self):
		self.assertEqual(self.motifs, [])
		lignes = evaluer_format_et_motif(None, self.params, 1020.0, 600.0, vars_=self.vars_)
		self.assertEqual([(d.n_col, d.n_rang) for d in lignes], [(4, 3)])


class TestPositions(unittest.TestCase):
	def test_grille_droite_inchangee(self):
		d = Disposition(laize=1020, depl=720, n_col=3, n_rang=2, pas_laize=100.0, pas_depl=50.0, rotation=90)
		self.assertEqual(positions(d), [(0.0, 0.0, 90), (0.0, 50.0, 90), (100.0, 0.0, 90), (100.0, 50.0, 90), (200.0, 0.0, 90), (200.0, 50.0, 90)])

	def test_tete_beche_en_colonnes(self):
		d = Disposition(laize=1020, depl=720, n_col=3, n_rang=1, pas_laize=60.0, pas_depl=80.0, rotation=0, motif=TETE_BECHE, axe=COLONNES, decalage_laize=55.0, decalage_depl=-10.0, pas_paire=120.0)
		self.assertEqual(positions(d), [(0.0, 10.0, 0), (55.0, 0.0, 180), (120.0, 10.0, 0)])

	def test_quinconce_en_rangs(self):
		d = Disposition(laize=1020, depl=720, n_col=1, n_rang=3, pas_laize=60.0, pas_depl=40.0, rotation=90, motif=QUINCONCE, axe=RANGS, decalage_laize=30.0, decalage_depl=45.0, pas_paire=80.0)
		self.assertEqual(positions(d), [(0.0, 0.0, 90), (30.0, 45.0, 90), (0.0, 80.0, 90)])

	def test_champs_des_tables(self):
		m = motif_depuis_dict({"motif": "Tête-bêche", "axe_motif": "Rangs", "decalage_laize": 4, "decalage_depl": 8, "pas_paire": 300})
		self.assertEqual((m["motif"], m["axe"]), (TETE_BECHE, RANGS))
		self.assertEqual(motif_depuis_dict({"motif": "Grille droite"})["motif"], "droite")
		self.assertEqual(motif_depuis_dict({})["motif"], "droite")


if __name__ == "__main__":
	unittest.main()
