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


class TestDatesDeLaDemande(FrappeTestCase):
	def test_chaque_ligne_prend_la_date_de_son_article(self):
		from aurescrm.quotation import _apply_demande_delivery_dates

		frappe.set_user("Administrator")
		row = frappe.db.sql(
			"""select parent, article, date_livraison from `tabArticles Demande Faisabilite`
			where parenttype = 'Demande Faisabilite' and date_livraison is not null and article is not null limit 1""",
			as_dict=True,
		)
		if not row:
			self.skipTest("Aucune demande avec une date de livraison par article.")
		row = row[0]
		so = frappe.new_doc("Sales Order")
		so.set("custom_demande_de_faisabilité", row.parent)
		so.append("items", {"item_code": row.article, "qty": 1})
		so.append("items", {"item_code": "__absent__", "qty": 1})
		_apply_demande_delivery_dates(so)
		self.assertEqual(str(so.items[0].delivery_date), str(row.date_livraison))
		self.assertFalse(so.items[1].get("delivery_date"))
		self.assertEqual(str(so.delivery_date), str(row.date_livraison))


class TestCycleCommande(FrappeTestCase):
	"""Sur un brouillon du site, dans une transaction annulée à la fin. Aucune notification ne part."""

	def setUp(self):
		from unittest.mock import patch

		frappe.set_user("Administrator")
		self.name = frappe.db.get_value("Sales Order", {"docstatus": 0}, "name", order_by="creation desc")
		if not self.name:
			self.skipTest("Aucune commande en brouillon sur ce site.")
		self.push = patch("aurescrm.push.service.enqueue_push")
		self.push.start()

	def tearDown(self):
		self.push.stop()
		frappe.set_user("Administrator")

	def test_le_bon_de_commande_bloque_la_validation(self):
		doc = frappe.get_doc("Sales Order", self.name)
		doc.custom_bon_de_commande_client = None
		doc.custom_date_bon_de_commande = None
		reasons = bureau_commandes.blocked(doc)
		self.assertTrue(any("n° du bon" in reason for reason in reasons))
		self.assertTrue(any("date du bon" in reason for reason in reasons))

	def test_une_date_de_bon_future_est_refusee(self):
		detail = bureau_commandes.get_commande(self.name)
		with self.assertRaises(frappe.ValidationError):
			bureau_commandes.update_commande(self.name, detail["modified"], date_bon="2999-01-01")

	def test_le_back_office_saisit_mais_ne_valide_pas(self):
		user = "test.back-office@aures.test"
		if not frappe.db.exists("User", user):
			self.skipTest("Compte d'essai du back office absent.")
		if "Administrateur Ventes" in frappe.get_roles(user):
			self.skipTest("Ce compte est Administrateur Ventes.")
		frappe.set_user(user)
		if not frappe.has_permission("Sales Order", "read"):
			self.skipTest("Ce compte ne lit pas les commandes.")
		detail = bureau_commandes.get_commande(self.name)
		self.assertNotIn("valider", detail["actions"])
		with self.assertRaises(frappe.PermissionError):
			bureau_commandes.validate_commande(self.name, detail["modified"])

	def test_valider_puis_annuler(self):
		detail = bureau_commandes.get_commande(self.name)
		detail = bureau_commandes.update_commande(self.name, detail["modified"], bon_commande="BC-TEST", date_bon=frappe.utils.today())
		self.assertEqual(detail["bon_commande"], "BC-TEST")
		if detail["blocked"]:
			self.skipTest("Brouillon incomplet : " + " ".join(detail["blocked"]))
		detail = bureau_commandes.validate_commande(self.name, detail["modified"])
		self.assertEqual(detail["docstatus"], 1)
		self.assertIn("annuler", detail["actions"])
		with self.assertRaises(frappe.ValidationError):
			bureau_commandes.cancel_commande(self.name, detail["modified"], "  ")
		if detail["annulation_bloquee"]:
			return
		detail = bureau_commandes.cancel_commande(self.name, detail["modified"], "Erreur de saisie")
		self.assertEqual(detail["docstatus"], 2)
		self.assertTrue(frappe.db.exists("Comment", {"reference_doctype": "Sales Order", "reference_name": self.name, "content": ["like", "%Erreur de saisie%"]}))

	def test_le_scan_se_range_dans_la_commande(self):
		if not bureau_commandes.scan_pret():
			self.skipTest("Champ du scan pas encore migré.")
		url = frappe.db.get_value("File", {"is_folder": 0, "is_private": 0, "file_url": ["like", "/files/%.pdf"]}, "file_url")
		if not url:
			self.skipTest("Aucun PDF public sur ce site.")
		detail = bureau_commandes.get_commande(self.name)
		with self.assertRaises(frappe.ValidationError):
			bureau_commandes.set_bon_scan(self.name, detail["modified"], url)
		frappe.get_doc({"doctype": "File", "file_url": url, "attached_to_doctype": "Sales Order", "attached_to_name": self.name}).insert(ignore_permissions=True)
		detail = bureau_commandes.set_bon_scan(self.name, detail["modified"], url)
		self.assertEqual(detail["scan"]["url"], url)
		self.assertTrue(frappe.db.exists("File", {"file_url": url, "attached_to_name": self.name, "attached_to_field": bureau_commandes.SCAN_FIELD}))
