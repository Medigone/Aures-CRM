# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Lecture d'un PDF de tracé : cotations du titre recoupées avec les cotes, développé mesuré sur la coupe."""

import pymupdf
from frappe.tests.utils import FrappeTestCase

from aurescrm import trace_import
from aurescrm.imposition.lecture_trace import PT


def _pdf(title, cotes=(), coupe=True, couleur=None):
	"""Un tracé de 100 × 50 mm : contour noir, un rainage rouge, des cotes en bleu."""
	with pymupdf.open() as document:
		page = document.new_page(width=600, height=400)
		x0, y0 = 50, 50
		rect = pymupdf.Rect(x0, y0, x0 + 100 * PT, y0 + 50 * PT)
		if coupe:
			page.draw_rect(rect, color=(0, 0, 0))
		page.draw_line((x0 + 30 * PT, y0), (x0 + 30 * PT, y0 + 50 * PT), color=(1, 0, 0))
		if couleur:
			page.draw_line((x0, y0 + 10), (x0 + 20, y0 + 10), color=couleur)
		for index, cote in enumerate(cotes):
			page.insert_text((x0 + 40 * index, y0 + 60 * PT), str(cote), color=(0, 0, 1))
		document.set_metadata({"title": title})
		return document.tobytes()


class TestTraceImport(FrappeTestCase):
	def test_cotations_du_titre_confirmees_par_les_cotes(self):
		result = trace_import.analyze(_pdf("TRA-26-11-4607-Etui Novaspry 33x33x110mm.pdf", cotes=(33, 33, 32.5, 110, 142.5)), "x.pdf")
		self.assertEqual(result["cotations"], "33x33x110")
		self.assertTrue(result["confirmees"])
		self.assertEqual(result["reference"], "TRA-26-11-4607")
		self.assertEqual(result["designation"], "Etui Novaspry")
		self.assertEqual(result["developpe"], (100.0, 50.0))
		self.assertTrue(result["atelier"])
		self.assertTrue(result["rainage"])

	def test_cotations_absentes_du_dessin_a_verifier(self):
		result = trace_import.analyze(_pdf("Etui 72x46.5x107mm", cotes=(72, 107)), "x.pdf")
		self.assertEqual(result["cotations"], "72x46.5x107")
		self.assertFalse(result["confirmees"])

	def test_sans_titre_le_nom_du_fichier_sert(self):
		result = trace_import.analyze(_pdf("", cotes=(115, 69, 229)), "Bt mouchoir 115x69x229mm.pdf")
		self.assertEqual(result["cotations"], "115x69x229")
		self.assertTrue(result["confirmees"])

	def test_sans_coupe_l_atelier_ne_peut_pas_lire(self):
		result = trace_import.analyze(_pdf("Etui", coupe=False), "x.pdf")
		self.assertFalse(result["atelier"])
		self.assertIsNone(result["cotations"])

	def test_couleur_hors_convention_signalee(self):
		self.assertEqual(trace_import.analyze(_pdf("Etui", couleur=(0, 0.6, 0)), "x.pdf")["autres_couleurs"], 1)

	def test_fichier_illisible(self):
		self.assertFalse(trace_import.analyze(b"pas un pdf", "x.pdf")["lisible"])

	def test_cotations_a_deux_cotes(self):
		self.assertEqual(trace_import.title_cotations("Etiquette 75 x 40 mm"), "75x40")
		self.assertIsNone(trace_import.title_cotations("Etui sans cotes"))
