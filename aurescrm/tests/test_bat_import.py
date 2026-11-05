# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Sans base de données, et sur un PDF fabriqué ici : aucun document client dans ce dépôt public."""

import unittest
from unittest.mock import patch

import fitz

from aurescrm.bat_import import build_proposals, compare_colors, match_finishes, merge_pages, parse_support, read_document, read_legend

CARTOUCHE = [
	(40, 100, "Nom du client :"), (120, 100, "Client test"), (220, 100, "Réf. doc   :"), (290, 100, "AB123 - X"), (480, 100, "Date :"), (530, 100, "01/02/2026"),
	(40, 130, "Nom du projet :"), (120, 130, "Etui test"), (220, 130, "Dimension  :"), (290, 130, "60x30x116mm"), (480, 130, "Auteur :"), (530, 130, "A.Test"),
	(220, 160, "Support   :"), (290, 160, "BBTB GC1 300g/m² ± 5%"), (480, 160, "Ver. BAT :"), (530, 160, "002"),
	(220, 190, "Finitions :"), (290, 190, "Vernis Acrylique, Finition inconnue"),
	(40, 300, "PANTONE® 186 C"), (40, 320, "PANTONE® 315 C"), (40, 340, "NOIR"),
]
# Même cartouche, intitulés vectorisés : seules les valeurs sont du texte.
SANS_INTITULES = [
	(80, 100, "Client test"), (190, 100, "AB123 - X"), (340, 100, "vFr"), (420, 100, "01 / 02 / 2026"),
	(90, 115, "Notice"), (190, 115, "130x160mm"), (420, 115, "A.Test"),
	(80, 123, "Produit 20mg"), (190, 130, "Papier offset 60g/m²±5%"), (420, 130, "002"),
	(100, 600, "NOIR"),
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
				{"fieldname": "custom_recto_verso", "label": "Recto Verso", "fieldtype": "Check"},
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


def make_pages(*pages, inks=("Artios_Crease", "D#C3#A9coupe")):
	document = fitz.open()
	font = fitz.Font("helv")
	for lines in pages:
		page = document.new_page(width=504, height=826)
		writer = fitz.TextWriter(page.rect)
		for x, y, text in lines:
			writer.append((x, y), text, font=font, fontsize=9)
		writer.write_text(page)
	for ink in inks:
		document.update_object(document.get_new_xref(), f"[/Separation/{ink} /DeviceCMYK <<>>]")
	return document.tobytes()


def informations(result):
	return {item["label"]: item["value"] for item in result["informations"]}


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
		self.assertEqual([line["code"] for line in result["teintes"]], ["186 C", "N100"])
		self.assertEqual([gap["code"] for gap in result["ecarts"]], ["315 C", "314 C"])
		informations = {item["label"]: item["value"] for item in result["informations"]}
		self.assertEqual(informations["Finition non reconnue"], "Finition inconnue")
		self.assertEqual(informations["Support, précision"], "GC1")

	@patch("aurescrm.bat_import.describe", side_effect=describe_stub)
	def test_valeur_hors_liste_non_proposee(self, _describe):
		result = build_proposals(read_document(make_pdf()), SCHEMA, ["BBTB"], ["250"])
		self.assertNotIn("custom_grammage", [item["key"] for item in result["propositions"]])
		self.assertIn("BBTB GC1 300g/m² ± 5%", [item["value"] for item in result["informations"]])


class TestCartoucheSansIntitules(unittest.TestCase):
	def test_valeurs_reconnues_par_leur_place(self):
		document = read_document(make_pages(SANS_INTITULES))
		self.assertEqual(
			document["cartouche"],
			{"reference": "AB123 - X", "dimension": "130x160mm", "support": "Papier offset 60g/m²±5%", "client": "Client test", "projet": "Notice Produit 20mg", "date": "01/02/2026", "auteur": "A.Test", "version": "002"},
		)
		self.assertEqual(document["marks"], [{"page": 1, "value": "vFr"}])

	def test_sans_ancrage_rien_n_est_lu(self):
		sans_support = [line for line in SANS_INTITULES if "60g" not in line[2]]
		self.assertEqual(read_document(make_pages(sans_support))["cartouche"], {})
		ailleurs = [(500 if "60g" in text else x, y, text) for x, y, text in SANS_INTITULES]
		self.assertEqual(read_document(make_pages(ailleurs))["cartouche"], {})

	def test_cote_du_visuel_ignoree(self):
		visuel = [(40, 400, "10x20mm"), (40, 700, "Papier 90g/m²"), *SANS_INTITULES]
		self.assertEqual(read_document(make_pages(visuel))["cartouche"]["dimension"], "130x160mm")

	def test_repere_a_cote_de_la_reference_avec_intitules(self):
		lines = [(220, 100, "Réf. doc :"), (290, 100, "AB123 - X"), (420, 100, "vAr")]
		document = read_document(make_pages(lines))
		self.assertEqual(document["cartouche"]["reference"], "AB123 - X")
		self.assertEqual(document["marks"], [{"page": 1, "value": "vAr"}])

	def test_ligature_du_fichier(self):
		from aurescrm.bat_import import _LIGATURES

		self.assertEqual("Papier oﬀset".translate(_LIGATURES), "Papier offset")
		self.assertEqual(parse_support("Papier offset 60g/m²±5%", ["Papier Offset"]), {"papier": "Papier Offset", "grammage": "60", "tolerance": "5%", "reste": ""})

	def test_encres_de_decoupe_ecartees(self):
		colors = read_document(make_pages(SANS_INTITULES))["colors"]
		self.assertEqual((colors["other_inks"], colors["process"], colors["pantones"]), ([], ["n"], []))
		latin = read_document(make_pages(SANS_INTITULES, inks=("D#E9coupe",)))["colors"]
		self.assertEqual(latin["other_inks"], [])


class TestPlusieursPages(unittest.TestCase):
	def verso(self):
		return [(x, y, "vAr" if text == "vFr" else text) for x, y, text in SANS_INTITULES]

	@patch("aurescrm.bat_import.describe", side_effect=describe_stub)
	def test_recto_verso(self, _describe):
		result = build_proposals(read_document(make_pages(SANS_INTITULES, self.verso())), SCHEMA, ["Papier Offset"], ["60"])
		values = {item["key"]: item["value"] for item in result["propositions"]}
		self.assertEqual(values, {"reference": "AB123 - X", "custom_cotations_article": "130x160", "custom_support": "Papier Offset", "custom_grammage": "60", "custom_tolérance_": "5%", "custom_recto_verso": "1"})
		self.assertEqual([line["code"] for line in result["teintes"]], ["N100"])
		self.assertEqual(result["ecarts"], [])
		notes = informations(result)
		self.assertEqual((notes["Repère de la page 1"], notes["Repère de la page 2"]), ("vFr", "vAr"))
		self.assertNotIn("Pages du BAT", notes)

	@patch("aurescrm.bat_import.describe", side_effect=describe_stub)
	def test_une_page_sans_recto_verso(self, _describe):
		result = build_proposals(read_document(make_pages(SANS_INTITULES)), SCHEMA, ["Papier Offset"], ["60"])
		self.assertNotIn("custom_recto_verso", [item["key"] for item in result["propositions"]])
		self.assertEqual(informations(result)["Repère"], "vFr")

	@patch("aurescrm.bat_import.describe", side_effect=describe_stub)
	def test_deuxieme_page_sans_cartouche(self, _describe):
		result = build_proposals(read_document(make_pages(SANS_INTITULES, [(100, 300, "Texte du visuel")])), SCHEMA, ["Papier Offset"], ["60"])
		self.assertNotIn("custom_recto_verso", [item["key"] for item in result["propositions"]])
		self.assertEqual(informations(result)["Pages du BAT"], "2 pages")

	@patch("aurescrm.bat_import.describe", side_effect=describe_stub)
	def test_trois_pages(self, _describe):
		result = build_proposals(read_document(make_pages(SANS_INTITULES, self.verso(), SANS_INTITULES)), SCHEMA, ["Papier Offset"], ["60"])
		self.assertNotIn("custom_recto_verso", [item["key"] for item in result["propositions"]])
		self.assertEqual(informations(result)["Pages du BAT"], "3 pages")

	@patch("aurescrm.bat_import.describe", side_effect=describe_stub)
	def test_pages_en_desaccord(self, _describe):
		autre = [(x, y, "AB999 - Y" if text == "AB123 - X" else text) for x, y, text in SANS_INTITULES]
		result = build_proposals(read_document(make_pages(SANS_INTITULES, autre)), SCHEMA, ["Papier Offset"], ["60"])
		self.assertNotIn("reference", [item["key"] for item in result["propositions"]])
		self.assertEqual(informations(result)["Réf. doc selon les pages"], "AB123 - X / AB999 - Y")

	def test_fusion(self):
		merged = merge_pages([{"reference": "A", "support": "S"}, {"reference": "B"}, {"reference": "a", "date": "D"}, {"reference": "C"}])
		self.assertEqual(merged["cartouche"], {"support": "S", "date": "D"})
		self.assertEqual(merged["disagreements"], {"reference": ["A", "B", "C"]})
