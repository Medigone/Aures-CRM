# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Tests de la liste des devis du poste de bureau.

Exécuter avec : bench --site [site] run-tests --module aurescrm.tests.test_bureau_devis
"""

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from aurescrm.api import bureau_devis


def _row(**values):
	row = {"name": "Q-1", "status": "Draft", "lignes": 2, "chiffrees": 1, "valable": None, "creation": "2026-11-01", "date": "2026-11-01"}
	row.update(values)
	return row


class TestVuesDevis(FrappeTestCase):
	def test_un_brouillon_se_range_selon_ses_prix(self):
		self.assertTrue(bureau_devis.in_view("chiffrer", _row()))
		self.assertFalse(bureau_devis.in_view("valider", _row()))
		self.assertTrue(bureau_devis.in_view("valider", _row(chiffrees=2)))
		self.assertFalse(bureau_devis.in_view("valider", _row(lignes=0, chiffrees=0)))
		self.assertFalse(bureau_devis.in_view("chiffrer", _row(status="Open")))

	def test_expirent_sous_sept_jours(self):
		day = "2026-11-09"
		self.assertTrue(bureau_devis.in_view("expirent", _row(status="Open", valable="2026-11-15"), day))
		self.assertFalse(bureau_devis.in_view("expirent", _row(status="Open", valable="2026-11-20"), day))
		self.assertFalse(bureau_devis.in_view("expirent", _row(status="Open", valable="2026-11-01"), day))
		self.assertFalse(bureau_devis.in_view("expirent", _row(status="Ordered", valable="2026-11-15"), day))

	def test_commandes_et_clos(self):
		self.assertTrue(bureau_devis.in_view("commandes", _row(status="Partially Ordered")))
		self.assertTrue(bureau_devis.in_view("valides", _row(status="Partially Ordered")))
		for status in ("Lost", "Expired", "Cancelled"):
			self.assertTrue(bureau_devis.in_view("clos", _row(status=status)))

	def test_tri_numerique_et_lignes_vides_a_la_fin(self):
		rows = [_row(name="A", total=900.0), _row(name="B", total=12000.0), _row(name="C", total=None)]
		self.assertEqual([row["name"] for row in bureau_devis.order_devis(rows, "total", "desc")], ["B", "A", "C"])
		self.assertEqual([row["name"] for row in bureau_devis.order_devis(rows, "total", "asc")], ["A", "B", "C"])


class TestListeDevis(FrappeTestCase):
	def test_liste_et_compteurs(self):
		frappe.set_user("Administrator")
		result = bureau_devis.get_devis_list()
		self.assertEqual(set(result["counts"]), set(bureau_devis.VIEWS))
		self.assertEqual(result["total"], len(result["names"]))
		for row in result["devis"]:
			self.assertNotIn("_search", row)
		with self.assertRaises(frappe.ValidationError):
			bureau_devis.get_devis_list(view="inconnue")

	def test_les_couts_restent_a_l_equipe_devis(self):
		frappe.set_user("Administrator")
		name = frappe.db.get_value("Quotation", {"docstatus": ["!=", 2]})
		if not name:
			self.skipTest("Aucun devis sur ce site.")
		with patch.object(bureau_devis, "voit_couts", return_value=False):
			detail = bureau_devis.get_devis(name)
		self.assertFalse(detail["couts"])
		for line in detail["lignes"]:
			self.assertNotIn("calcul", line)

	def test_filtres_declares(self):
		frappe.set_user("Administrator")
		fields = {entry["field"] for entry in bureau_devis.get_devis_options()["filter_fields"]}
		self.assertTrue({"status", "custom_id_client", "_user_tags"} <= fields)
