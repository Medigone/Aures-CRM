# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Tests de la liste des commandes du poste de bureau.

Exécuter avec : bench --site [site] run-tests --module aurescrm.tests.test_bureau_commandes
"""

import frappe
from frappe.tests.utils import FrappeTestCase

from aurescrm.api import bureau_commandes


def _row(**values):
	row = {"name": "SO-1", "status": "To Deliver and Bill", "livraison": "2026-07-14", "creation": "2026-07-01", "date": "2026-07-01"}
	row.update(values)
	return row


class TestVuesCommandes(FrappeTestCase):
	def test_retard_seulement_pour_ce_qui_reste_a_livrer(self):
		day = "2026-11-09"
		self.assertTrue(bureau_commandes.in_view("retard", _row(), day))
		self.assertFalse(bureau_commandes.in_view("retard", _row(livraison="2026-12-01"), day))
		self.assertFalse(bureau_commandes.in_view("retard", _row(status="To Bill"), day))
		self.assertFalse(bureau_commandes.in_view("retard", _row(livraison=None), day))

	def test_vues_par_statut(self):
		self.assertTrue(bureau_commandes.in_view("valider", _row(status="Draft")))
		self.assertTrue(bureau_commandes.in_view("livrer", _row(status="To Deliver")))
		self.assertTrue(bureau_commandes.in_view("facturer", _row(status="To Bill")))
		self.assertTrue(bureau_commandes.in_view("terminees", _row(status="Closed")))
		self.assertTrue(bureau_commandes.in_view("annulees", _row(status="Cancelled")))
		self.assertFalse(bureau_commandes.in_view("livrer", _row(status="Draft")))

	def test_prochaine_livraison_ignore_les_lignes_livrees(self):
		lines = [
			frappe._dict(delivery_date="2026-07-10", qty=10, delivered_qty=10),
			frappe._dict(delivery_date="2026-08-01", qty=10, delivered_qty=2),
			frappe._dict(delivery_date="2026-09-01", qty=10, delivered_qty=0),
		]
		self.assertEqual(bureau_commandes.prochaine_livraison({"delivery_date": "2026-07-01"}, lines), "2026-08-01")
		self.assertEqual(bureau_commandes.prochaine_livraison({"delivery_date": "2026-07-01"}, lines[:1]), "2026-07-01")

	def test_tri_numerique_et_lignes_vides_a_la_fin(self):
		rows = [_row(name="A", livre=40.0), _row(name="B", livre=100.0), _row(name="C", livre=None)]
		self.assertEqual([row["name"] for row in bureau_commandes.order_commandes(rows, "livre", "desc")], ["B", "A", "C"])


class TestListeCommandes(FrappeTestCase):
	def test_liste_et_compteurs(self):
		frappe.set_user("Administrator")
		result = bureau_commandes.get_commandes_list()
		self.assertEqual(set(result["counts"]), set(bureau_commandes.VIEWS))
		self.assertEqual(result["total"], len(result["names"]))
		for row in result["commandes"]:
			self.assertNotIn("_search", row)
		with self.assertRaises(frappe.ValidationError):
			bureau_commandes.get_commandes_list(view="inconnue")

	def test_filtres_declares(self):
		frappe.set_user("Administrator")
		fields = {entry["field"] for entry in bureau_commandes.get_commandes_options()["filter_fields"]}
		self.assertTrue({"status", "customer", "custom_bon_de_commande_client", "_user_tags"} <= fields)

	def test_apercu(self):
		frappe.set_user("Administrator")
		name = frappe.db.get_value("Sales Order", {"docstatus": 1}, "name", order_by="creation desc")
		if not name:
			self.skipTest("Aucune commande validée sur ce site.")
		detail = bureau_commandes.get_commande(name)
		self.assertEqual(detail["name"], name)
		self.assertTrue(detail["lignes"])
		self.assertIsNotNone(detail["total_ttc"])

	def test_montants_caches_sans_niveau_1(self):
		user = "test.charge-devis@aures.test"
		if not frappe.db.exists("User", user):
			self.skipTest("Compte d'essai de l'équipe devis absent.")
		frappe.set_user(user)
		try:
			if bureau_commandes.reads_amounts() or not frappe.has_permission("Sales Order", "read"):
				self.skipTest("Ce compte lit les montants ou ne lit pas les commandes.")
			result = bureau_commandes.get_commandes_list(page_length=5)
			self.assertTrue(all(row["total_ttc"] is None for row in result["commandes"]))
		finally:
			frappe.set_user("Administrator")
