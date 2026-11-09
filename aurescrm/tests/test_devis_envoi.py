# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Tests de l'envoi d'un devis au client.

Exécuter avec : bench --site [site] run-tests --module aurescrm.tests.test_devis_envoi
"""

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from aurescrm import devis_envoi
from aurescrm.api import commercial_affaires
from aurescrm.api import devis_envoi as api


class TestEnvoiDevis(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		self.name = frappe.db.get_value("Quotation", {"docstatus": 1, "status": ["in", devis_envoi.A_ENVOYER]}, "name", order_by="creation desc")
		self.push = patch("aurescrm.push.service.enqueue_push")
		self.push.start()

	def tearDown(self):
		self.push.stop()
		frappe.set_user("Administrator")

	def test_sans_migration_rien_ne_se_propose(self):
		if devis_envoi.champs_prets():
			self.skipTest("Champs d'envoi déjà migrés.")
		if self.name:
			self.assertFalse(devis_envoi.peut_envoyer(frappe.get_doc("Quotation", self.name)))
		self.assertEqual(devis_envoi.a_relancer(), [])
		for row in commercial_affaires.page_devis("Administrator", 0, 5):
			self.assertNotIn("envoye_le", row)

	def _ready(self):
		if not devis_envoi.champs_prets():
			self.skipTest("Champs d'envoi pas encore migrés.")
		if not self.name:
			self.skipTest("Aucun devis validé et ouvert sur ce site.")

	def test_marquer_envoye_note_le_fil(self):
		self._ready()
		result = api.mark_devis_sent(self.name, "WhatsApp")["envoi"]
		self.assertEqual(result["canal"], "WhatsApp")
		self.assertEqual(result["par"], "Administrator")
		comment = frappe.get_all("Comment", filters={"reference_doctype": "Quotation", "reference_name": self.name, "comment_type": "Info"}, pluck="content", order_by="creation desc", limit=1)
		self.assertIn("WhatsApp", comment[0])
		with self.assertRaises(frappe.ValidationError):
			api.mark_devis_sent(self.name, "Pigeon voyageur")

	def test_email_avec_pdf_joint(self):
		self._ready()
		with patch.object(devis_envoi, "pdf", return_value=b"%PDF-1.4"), patch("frappe.sendmail") as sendmail:
			result = api.send_devis_email(self.name, "client@example.com", "Bonjour")["envoi"]
		self.assertEqual(result["canal"], "Email")
		kwargs = sendmail.call_args.kwargs
		self.assertEqual(kwargs["recipients"], ["client@example.com"])
		self.assertEqual(kwargs["attachments"][0]["fname"], f"{self.name}.pdf")
		with self.assertRaises(frappe.ValidationError):
			api.send_devis_email(self.name, "pas-une-adresse")

	def test_un_brouillon_ne_part_pas(self):
		self._ready()
		draft = frappe.db.get_value("Quotation", {"docstatus": 0}, "name")
		if draft:
			with self.assertRaises(frappe.PermissionError):
				api.mark_devis_sent(draft, "Email")

	def test_le_back_office_marque_envoye_depuis_le_bureau(self):
		self._ready()
		from aurescrm.api import bureau_devis

		user = "test.back-office@aures.test"
		if not frappe.db.exists("User", user):
			self.skipTest("Compte d'essai du back office absent.")
		frappe.db.set_value("Quotation", self.name, devis_envoi.CHAMP_LE, None)
		frappe.set_user(user)
		detail = bureau_devis.get_devis(self.name)
		self.assertIn("envoye", detail["actions"])
		detail = bureau_devis.mark_sent(self.name, detail["modified"], "Remis en main propre", le="2026-11-09")
		self.assertEqual(detail["envoi"]["canal"], "Remis en main propre")
		self.assertNotIn("envoye", detail["actions"])
