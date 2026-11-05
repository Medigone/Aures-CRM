# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Sans base de données, et sur un PDF fabriqué ici : aucun document client dans ce dépôt public."""

import unittest
from unittest.mock import patch

import fitz

from aurescrm.bat_import import build_proposals, compare_colors, match_finishes, parse_support, read_document, read_legend

CARTOUCHE = [
	(40, 100, "Nom du client :"), (120, 100, "Client test"), (220, 100, "Réf. doc   :"), (290, 100, "AB123 - X"), (480, 100, "Date :"), (530, 100, "01/02/2026"),
	(40, 130, "Nom du projet :"), (120, 130, "Etui test"), (220, 130, "Dimension  :"), (290, 130, "60x30x116mm"), (480, 130, "Auteur :"), (530, 130, "A.Test"),
	(220, 160, "Support   :"), (290, 160, "BBTB GC1 300g/m² ± 5%"), (480, 160, "Ver. BAT :"), (530, 160, "002"),
	(220, 190, "Finitions :"), (290, 190, "Vernis Acrylique, Finition inconnue"),
	(40, 300, "PANTONE® 186 C"), (40, 320, "PANTONE® 315 C"), (40, 340, "NOIR"),
]
SCHEMA = {
	"groups": [
		{
			"label": "Offset",
			"fields": [
				{"fieldname": "custom_cotations_article", "label": "Cotations Article", "fieldtype": "Data"},
				{"fieldname": "custom_support", "label": "Papier", "fieldtype": "Link"},
				{"fieldname": "custom_grammage", "label": "Grammage", "fieldtype": "Link"},
				{"fieldname": "custom_tolérance_", "label": "Tolérance", "fieldtype": "Data"},
				{"fieldname": "custom_acrylique", "label": "Acrylique", "fieldtype": "Check"},
				{"fieldname": "custom_uv", "label": "UV", "fieldtype": "Check"},
				{"fieldname": "custom_braille", "label": "Braille", "fieldtype": "Check"},
				{"fieldname": "custom_pelliculage", "label": "Pelliculage", "fieldtype": "Select", "options": ["Sans", "Brillant", "Mat"]},
			],
		}
	]
}


def make_pdf(lines=CARTOUCHE, inks=("PANTONE#20186#20C", "PANTONE#20314#20C", "Cut", "Braille")):
	document = fitz.open()
	page = document.new_page(width=700, height=800)
	for x, y, text in lines:
		page.insert_text((x, y), text, fontsize=9, fontname="helv")
	for ink in inks:
		page.parent.update_object(page.parent.get_new_xref(), f"[/Separation/{ink} /DeviceCMYK <<>>]")
	return document.tobytes()


def describe_stub(codes):
	return {code: {"code": code, "label": f"PANTONE {code}", "hex": None, "approximative": 0, "needs_suffix": 0} for code in codes}


class TestLecture(unittest.TestCase):
	def test_cartouche(self):
		cartouche = read_document(make_pdf())["cartouche"]
		self.assertEqual(cartouche["reference"], "AB123 - X")
		self.assertEqual(cartouche["dimension"], "60x30x116mm")
		self.assertEqual(cartouche["support"], "BBTB GC1 300g/m² ± 5%")
		self.assertEqual(cartouche["client"], "Client test")
		self.assertEqual(cartouche["version"], "002")

	def test_intitule_sans_valeur(self):
		lines = [line for line in CARTOUCHE if line[2] != "60x30x116mm"]
		self.assertNotIn("dimension", read_document(make_pdf(lines))["cartouche"])

	def test_pdf_sans_texte(self):
		document = read_document(make_pdf([], ()))
		self.assertEqual(document["cartouche"], {})
		self.assertEqual(document["colors"]["pantones"], [])

	def test_legende(self):
		pantones, process = read_legend("NOIR\nPANTONE®\n314 C\nPANTONE®\nCool gray\n11 C\nPANTONE®\n186 C\nComposition")
		self.assertEqual(pantones, ["314 C", "COOL GRAY 11 C", "186 C"])
		self.assertEqual(process, {"n"})

	def test_ecart_et_encres_techniques(self):
		colors = read_document(make_pdf())["colors"]
		self.assertEqual(colors["pantones"], ["186 C"])
		self.assertEqual(colors["gaps"], [{"code": "315 C", "source": "legende"}, {"code": "314 C", "source": "fichier"}])
		self.assertEqual(colors["process"], ["n"])
		self.assertEqual(colors["other_inks"], [])
		self.assertTrue(read_document(make_pdf())["braille"])

	def test_couleurs_d_une_seule_source(self):
		self.assertEqual(compare_colors(["186 C"], {"n"}, [])["pantones"], ["186 C"])
		from_file = compare_colors([], set(), ["PANTONE 186 C", "Black", "Vernis"])
		self.assertEqual((from_file["pantones"], from_file["process"], from_file["gaps"], from_file["other_inks"]), (["186 C"], ["n"], [], ["Vernis"]))

	def test_quadri_complete(self):
		self.assertEqual(compare_colors([], {"c", "m", "j", "n"}, [])["process"], ["c", "m", "j", "n"])


class TestPropositions(unittest.TestCase):
	def test_support(self):
		self.assertEqual(parse_support("BBTB GC1 300g/m² ± 5%", ["BB", "BBTB", "BBTB FSC"]), {"papier": "BBTB", "grammage": "300", "tolerance": "5%", "reste": "GC1"})
		self.assertEqual(parse_support("BBTB FSC 275 g/m2", ["BBTB", "BBTB FSC"])["papier"], "BBTB FSC")
		self.assertIsNone(parse_support("Inconnu 90g", ["BBTB"])["papier"])

	def test_finitions(self):
		fields = SCHEMA["groups"][0]["fields"]
		found, unknown = match_finishes("Vernis UV, Pelliculage mat, Dorure", fields)
		self.assertEqual([(item["field"]["fieldname"], item["value"]) for item in found], [("custom_uv", "1"), ("custom_pelliculage", "Mat")])
		self.assertEqual(unknown, ["Dorure"])

	@patch("aurescrm.bat_import.describe", side_effect=describe_stub)
	def test_propositions(self, _describe):
		result = build_proposals(read_document(make_pdf()), SCHEMA, ["BBTB"], ["300"])
		values = {item["key"]: item["value"] for item in result["propositions"]}
		self.assertEqual(values, {"reference": "AB123 - X", "custom_cotations_article": "60x30x116", "custom_support": "BBTB", "custom_grammage": "300", "custom_tolérance_": "5%", "custom_acrylique": "1", "custom_braille": "1"})
		self.assertEqual([line["code"] for line in result["teintes"]], ["186 C", "C0 M0 J0 N100"])
		self.assertEqual([gap["code"] for gap in result["ecarts"]], ["315 C", "314 C"])
		informations = {item["label"]: item["value"] for item in result["informations"]}
		self.assertEqual(informations["Finition non reconnue"], "Finition inconnue")
		self.assertEqual(informations["Support, précision"], "GC1")

	@patch("aurescrm.bat_import.describe", side_effect=describe_stub)
	def test_valeur_hors_liste_non_proposee(self, _describe):
		result = build_proposals(read_document(make_pdf()), SCHEMA, ["BBTB"], ["250"])
		self.assertNotIn("custom_grammage", [item["key"] for item in result["propositions"]])
		self.assertIn("BBTB GC1 300g/m² ± 5%", [item["value"] for item in result["informations"]])
