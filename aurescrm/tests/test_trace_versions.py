# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Versions de tracé et choix de l'idéale. Tout est annulé en fin de test ; le commit du recalcul de l'idéale est neutralisé."""

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

import fitz

from aurescrm.api import bureau_articles, bureau_impositions, bureau_traces
from aurescrm.aures_crm.doctype.imposition.imposition import automatic_ideale, choose_ideale
from aurescrm.aures_crm.doctype.trace.trace import EN_SERVICE, OBSOLETE, create_version, current_trace


class TestTraceVersions(FrappeTestCase):
	def setUp(self):
		if not frappe.get_meta("Trace").has_field("statut") or not frappe.get_meta("Imposition").has_field("obsolete"):
			self.skipTest("Champs de version pas encore migrés.")
		self.commit = patch("frappe.db.commit")
		self.commit.start()
		self.item = frappe.db.get_value("Item", {"custom_type_article": "Client", "custom_client": ["is", "set"]}, "name")
		self.assertTrue(self.item)
		self.client = frappe.db.get_value("Item", self.item, "custom_client")
		# L'article repart sans tracé ni imposition, le temps du test.
		frappe.db.delete("Imposition", {"article": self.item})
		frappe.db.delete("Trace", {"article": self.item})
		self.v1 = frappe.get_doc({"doctype": "Trace", "client": self.client, "article": self.item, "procede": "Flexo", "dimensions": "80x40"}).insert()

	def tearDown(self):
		self.commit.stop()
		frappe.db.rollback()

	def _imposition(self, trace, taux, **extra):
		return frappe.get_doc({"doctype": "Imposition", "client": self.client, "article": self.item, "trace": trace, "procede": "Flexo", "nbr_poses": 4, "taux_chutes": taux, **extra}).insert()

	def test_premiere_version_en_service(self):
		self.assertEqual((self.v1.statut, self.v1.ver), (EN_SERVICE, 1))
		self.assertTrue(self.v1.date_activation)
		self.assertEqual(current_trace(self.item), self.v1.name)

	def test_un_seul_trace_en_service_par_article(self):
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({"doctype": "Trace", "client": self.client, "article": self.item, "procede": "Flexo", "dimensions": "90x40"}).insert()

	def test_nouvelle_version_rend_l_ancienne_et_ses_impositions_obsoletes(self):
		best = self._imposition(self.v1.name, 10)
		other = self._imposition(self.v1.name, 20)
		self.assertTrue(frappe.db.get_value("Imposition", best.name, "defaut"))
		result = create_version(frappe.get_doc("Trace", self.v1.name), "Rabat agrandi", "90x40")
		v2 = frappe.get_doc("Trace", result["name"])
		self.assertEqual((v2.ver, v2.statut, v2.version_origine, v2.desc_changements, v2.dimensions), (2, EN_SERVICE, self.v1.name, "Rabat agrandi", "90x40"))
		old = frappe.get_doc("Trace", self.v1.name)
		self.assertEqual((old.statut, old.remplacee_par), (OBSOLETE, v2.name))
		self.assertEqual(current_trace(self.item), v2.name)
		self.assertEqual(result["impositions"], 2)
		for name in (best.name, other.name):
			self.assertEqual(frappe.db.get_value("Imposition", name, ["obsolete", "defaut"]), (1, 0))

	def test_sans_copie_quand_un_nouveau_fichier_suit(self):
		self.v1.db_set("fichier_trace", "/files/ancien.png")
		with patch("aurescrm.aures_crm.doctype.trace.trace._copy_and_rename_trace_file") as copy:
			create_version(frappe.get_doc("Trace", self.v1.name), "Nouveau dessin", copy_file=0)
		copy.assert_not_called()

	def test_seule_la_version_en_service_recoit_une_version(self):
		create_version(frappe.get_doc("Trace", self.v1.name), "Première reprise")
		with self.assertRaises(frappe.ValidationError):
			create_version(frappe.get_doc("Trace", self.v1.name), "Encore")

	def test_la_description_est_exigee(self):
		with self.assertRaises(frappe.ValidationError):
			create_version(frappe.get_doc("Trace", self.v1.name), "  ")

	def test_la_forme_de_decoupe_est_signalee_a_refaire(self):
		forme = frappe.get_doc({"doctype": "Forme Decoupe", "client": self.client, "article": self.item, "trace": self.v1.name}).insert()
		result = create_version(frappe.get_doc("Trace", self.v1.name), "Nouveau couteau")
		self.assertEqual(result["formes"], [forme.name])
		self.assertTrue(frappe.db.get_value("Forme Decoupe", forme.name, "a_refaire"))

	def test_l_etude_ouverte_passe_sur_la_nouvelle_version(self):
		etude = frappe.db.get_value("Etude Faisabilite Flexo", {"status": "En étude"}, "name")
		if not etude:
			self.skipTest("Aucune étude Flexo en cours sur ce site.")
		frappe.db.set_value("Etude Faisabilite Flexo", etude, "trace", self.v1.name)
		result = create_version(frappe.get_doc("Trace", self.v1.name), "Changement de laize")
		self.assertIn(etude, result["etudes"])
		self.assertEqual(frappe.db.get_value("Etude Faisabilite Flexo", etude, "trace"), result["name"])

	def test_le_choix_a_la_main_passe_avant_le_calcul(self):
		best = self._imposition(self.v1.name, 10)
		chosen = self._imposition(self.v1.name, 30)
		choose_ideale(frappe.get_doc("Imposition", chosen.name))
		self.assertEqual(frappe.db.get_value("Imposition", chosen.name, ["defaut", "ideale_manuelle"]), (1, 1))
		self.assertEqual(frappe.db.get_value("Imposition", best.name, "defaut"), 0)
		# Une nouvelle imposition, même meilleure, ne remplace pas le choix.
		newer = self._imposition(self.v1.name, 5)
		self.assertEqual(frappe.db.get_value("Imposition", newer.name, "defaut"), 0)
		self.assertEqual(frappe.db.get_value("Imposition", chosen.name, "defaut"), 1)
		automatic_ideale(frappe.get_doc("Imposition", chosen.name))
		self.assertEqual(frappe.db.get_value("Imposition", newer.name, "defaut"), 1)
		self.assertEqual(frappe.db.get_value("Imposition", chosen.name, ["defaut", "ideale_manuelle"]), (0, 0))

	def test_une_obsolete_ne_devient_pas_ideale(self):
		row = self._imposition(self.v1.name, 10)
		create_version(frappe.get_doc("Trace", self.v1.name), "Reprise")
		with self.assertRaises(frappe.ValidationError):
			choose_ideale(frappe.get_doc("Imposition", row.name))

	def test_listes_et_fiches(self):
		row = self._imposition(self.v1.name, 10)
		result = create_version(frappe.get_doc("Trace", self.v1.name), "Reprise")
		listed = bureau_traces.get_traces("all", search=self.item)
		self.assertEqual({line["name"]: line["statut"] for line in listed["traces"]}, {self.v1.name: OBSOLETE, result["name"]: EN_SERVICE})
		self.assertEqual(bureau_traces.get_traces("service", search=self.item)["names"], [result["name"]])
		fiche = bureau_traces.get_trace(result["name"])
		self.assertEqual([version["ver"] for version in fiche["versions"]], [2, 1])
		self.assertTrue(fiche["can_version"])
		self.assertFalse(bureau_traces.get_trace(self.v1.name)["can_version"])
		self.assertIn(row.name, bureau_impositions.get_impositions("obsoletes", search=self.item)["names"])
		self.assertNotIn(row.name, bureau_impositions.get_impositions("valables", search=self.item)["names"])
		self.assertFalse(bureau_impositions.get_imposition(row.name)["can_choose"])


	def test_la_fiche_article_ne_montre_que_la_version_en_service(self):
		old = self._imposition(self.v1.name, 10)
		result = create_version(frappe.get_doc("Trace", self.v1.name), "Reprise")
		live = self._imposition(result["name"], 15)
		prepresse = bureau_articles._prepresse(self.item)
		self.assertEqual([row["name"] for row in prepresse["traces"]], [result["name"]])
		self.assertEqual(prepresse["traces"][0]["ver"], 2)
		self.assertEqual([row["name"] for row in prepresse["impositions"]], [live.name])
		self.assertNotIn(old.name, [row["name"] for row in prepresse["impositions"]])
		# Saisie à la main : pas de dessin, la carte montre le fichier joint.
		self.assertIsNone(prepresse["impositions"][0]["dessin"])


class TestTracePreview(FrappeTestCase):
	def test_l_apercu_recadre_sur_le_dessin(self):
		# Un petit dessin dans le coin d'une grande page, comme la plupart des tracés.
		with fitz.open() as document:
			page = document.new_page(width=1190, height=842)
			page.draw_rect(fitz.Rect(500, 300, 700, 500), color=(0, 0, 0))
			content = document.tobytes()
		rendered = bureau_traces.render_pdf_preview(content, width=400)
		self.assertEqual(rendered["pages"], 1)
		self.assertAlmostEqual(rendered["width"], 400, delta=2)
		# Recadré sur le carré : l'image est carrée, pas au format de la page.
		self.assertAlmostEqual(rendered["height"], rendered["width"], delta=4)
		self.assertTrue(rendered["png"].startswith(b"\x89PNG"))

	def test_un_fichier_illisible_ne_casse_rien(self):
		self.assertIsNone(bureau_traces.render_pdf_preview(b"pas un pdf"))
