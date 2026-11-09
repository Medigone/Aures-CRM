# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Tests de la liste et du cycle des devis du poste de bureau.

Exécuter avec : bench --site [site] run-tests --module aurescrm.tests.test_bureau_devis
"""

import json
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

	def test_filtres_declares(self):
		frappe.set_user("Administrator")
		fields = {entry["field"] for entry in bureau_devis.get_devis_options()["filter_fields"]}
		self.assertTrue({"status", "custom_id_client", "_user_tags"} <= fields)


class TestCycleDevis(FrappeTestCase):
	"""Sur un brouillon du site, dans une transaction annulée à la fin. Aucune notification ne part."""

	def setUp(self):
		frappe.set_user("Administrator")
		self.name = frappe.db.get_value("Quotation", {"docstatus": 0}, "name", order_by="creation desc")
		if not self.name:
			self.skipTest("Aucun brouillon de devis sur ce site.")
		self.push = patch("aurescrm.push.service.enqueue_push")
		self.push.start()

	def tearDown(self):
		self.push.stop()
		frappe.set_user("Administrator")

	def _prices(self, value=12.5):
		doc = frappe.get_doc("Quotation", self.name)
		return {row.name: value for row in doc.items}

	def test_ce_qui_bloque_la_validation(self):
		doc = frappe.get_doc("Quotation", self.name)
		for row in doc.items:
			row.rate = 0
		doc.valid_till = None
		reasons = bureau_devis.blocked(doc)
		self.assertTrue(any("sans prix" in reason for reason in reasons))
		self.assertTrue(any("validité" in reason for reason in reasons))

	def test_le_prix_garde_son_auteur(self):
		user = "test.charge-devis@aures.test"
		if not frappe.db.exists("User", user):
			self.skipTest("Compte d'essai de l'équipe devis absent.")
		frappe.set_user(user)
		start = frappe.utils.now_datetime()
		detail = bureau_devis.get_devis(self.name)
		self.assertIn("prix", detail["actions"])
		result = bureau_devis.update_devis(self.name, detail["modified"], prix=json.dumps(self._prices(7.25)), valable="2099-01-01")
		self.assertTrue(all(line["prix"] == 7.25 for line in result["lignes"]))
		self.assertEqual(result["valable"], "2099-01-01")
		self.assertEqual(frappe.db.get_value("Quotation", self.name, "modified_by"), user)
		# L'historique ne doit rien laisser au nom de l'administrateur.
		self.assertFalse(frappe.get_all("Version", filters={"ref_doctype": "Quotation", "docname": self.name, "owner": "Administrator", "creation": [">=", start]}))

	def test_le_back_office_ne_change_pas_les_prix(self):
		user = "test.back-office@aures.test"
		if not frappe.db.exists("User", user):
			self.skipTest("Compte d'essai du back office absent.")
		frappe.set_user(user)
		detail = bureau_devis.get_devis(self.name)
		self.assertNotIn("prix", detail["actions"])
		with self.assertRaises(frappe.PermissionError):
			bureau_devis.update_devis(self.name, detail["modified"], prix=json.dumps(self._prices()))

	def test_valider_puis_perdre(self):
		detail = bureau_devis.get_devis(self.name)
		detail = bureau_devis.update_devis(self.name, detail["modified"], prix=json.dumps(self._prices()), valable="2099-01-01")
		self.assertEqual(detail["blocked"], [])
		detail = bureau_devis.validate_devis(self.name, detail["modified"])
		self.assertEqual(detail["docstatus"], 1)
		self.assertIn("perdu", detail["actions"])
		reason = frappe.db.get_value("Quotation Lost Reason", {}, "name")
		if not reason:
			return
		with self.assertRaises(frappe.ValidationError):
			bureau_devis.mark_lost(self.name, detail["modified"], "")
		detail = bureau_devis.mark_lost(self.name, detail["modified"], reason, concurrent="Cartonnerie Est")
		self.assertEqual(detail["status"], "Lost")
		self.assertIn("Cartonnerie Est", detail["perte"]["precisions"])

	def test_une_version_perimee_est_refusee(self):
		with self.assertRaises(frappe.TimestampMismatchError):
			bureau_devis.update_devis(self.name, "2000-01-01 00:00:00", prix=json.dumps(self._prices()))
