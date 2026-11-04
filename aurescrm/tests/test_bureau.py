# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Tests du poste de bureau : étapes de la timeline, filtres de la file et droits.

Exécuter avec : bench --site [site] run-tests --module aurescrm.tests.test_bureau
"""

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from aurescrm.api import bureau
from aurescrm.aures_crm.doctype.demande_faisabilite.demande_faisabilite import generate_etude_faisabilite
from aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial import update_assigne_a


def states(result):
	return [step["state"] for step in result["steps"]]


def labels(result):
	return [step["label"] for step in result["steps"]]


class TestSteps(FrappeTestCase):
	def test_nouveau_bon_de_commande(self):
		result = bureau.compute_steps({"request_type": "Bon de commande", "status": "Nouveau", "creation_date": "2026-11-03"})
		self.assertEqual(
			labels(result),
			["Ticket reçu", "Pris en charge", "Créance vérifiée", "Rapprochement", "Commande ou demande", "Terminé"],
		)
		self.assertEqual(states(result), ["done", "current", "todo", "todo", "todo", "todo"])
		self.assertEqual(result["steps"][0]["detail"], "03/11/2026")
		self.assertEqual(result["current"], 1)

	def test_creance_bloquee_en_rouge(self):
		result = bureau.compute_steps(
			{"request_type": "Bon de commande", "status": "Blocage Créance", "statut_creance": "Bloquée"}
		)
		self.assertEqual(result["steps"][2]["state"], "blocked")
		self.assertEqual(result["steps"][2]["detail"], "Bloquée")

	def test_etape_en_pause(self):
		result = bureau.compute_steps({"request_type": "Réclamation", "status": "Pending"})
		self.assertEqual(states(result), ["done", "done", "paused", "todo", "todo"])
		self.assertEqual(result["steps"][2]["detail"], "En pause")

	def test_commande_du_devis_retenu(self):
		result = bureau.compute_steps(
			{
				"request_type": "Bon de commande",
				"status": "En Cours",
				"statut_creance": "OK",
				"decision_rapprochement": "Devis retenu pour commande",
				"devis_rapproche": "DEV-1",
			},
			{},
			{"name": "CMD-1", "status": "Draft"},
		)
		self.assertEqual(result["steps"][3]["detail"], "DEV-1")
		self.assertEqual(result["steps"][4]["label"], "Commande")
		self.assertEqual(result["steps"][4]["state"], "done")
		self.assertEqual(result["steps"][4]["detail"], "CMD-1 · Draft")
		self.assertEqual(result["steps"][5]["state"], "current")

	def test_decision_nouvelle_demande(self):
		ticket = {
			"request_type": "Bon de commande",
			"status": "En Cours",
			"statut_creance": "OK",
			"decision_rapprochement": "Nouvelle demande de faisabilité",
			"demande_faisabilite_rapprochee": "DF-2",
		}
		cycle = {"demandes": [{"name": "DF-1", "status": "Annulée"}, {"name": "DF-2", "status": "Brouillon"}]}
		document = bureau.compute_steps(ticket, cycle)["steps"][4]
		self.assertEqual(document["label"], "Demande de faisabilité")
		self.assertEqual(document["state"], "done")
		self.assertEqual(document["detail"], "DF-2 · Brouillon")

	def test_demande_de_devis(self):
		ticket = {"request_type": "Demande de devis", "status": "En Cours", "checklist_dd_articles": 1}
		brouillon = bureau.compute_steps(ticket, {"demandes": [{"name": "DF-1", "status": "Brouillon"}]})
		self.assertEqual(states(brouillon), ["done", "done", "done", "done", "current", "todo"])
		confirmee = bureau.compute_steps(ticket, {"demandes": [{"name": "DF-1", "status": "Confirmée"}]})
		self.assertEqual(states(confirmee), ["done", "done", "done", "done", "done", "current"])

	def test_demande_annulee_ne_compte_pas(self):
		ticket = {"request_type": "Demande de devis", "status": "En Cours", "checklist_dd_articles": 1}
		result = bureau.compute_steps(ticket, {"demandes": [{"name": "DF-1", "status": "Annulée"}]})
		self.assertEqual(result["steps"][3]["state"], "current")

	def test_essai_blanc(self):
		result = bureau.compute_steps(
			{"request_type": "Essai Blanc", "status": "En Cours", "checklist_eb_articles": 1},
			{"dossiers": [{"name": "DEB-1", "status": "Brouillon"}]},
		)
		self.assertEqual(labels(result), ["Ticket reçu", "Pris en charge", "Articles vérifiés", "Dossier essai à blanc", "Terminé"])
		self.assertEqual(result["steps"][3]["detail"], "DEB-1 · Brouillon")
		self.assertEqual(result["steps"][4]["state"], "current")

	def test_autre_type(self):
		result = bureau.compute_steps({"request_type": "Mise à jour données", "status": "Nouveau"})
		self.assertEqual(labels(result), ["Ticket reçu", "Pris en charge", "Terminé"])

	def test_ticket_clos_sans_etape_en_cours(self):
		result = bureau.compute_steps({"request_type": "Bon de commande", "status": "Terminé"})
		self.assertIsNone(result["current"])
		self.assertEqual(states(result), ["done", "done", "todo", "todo", "todo", "done"])

	def test_ticket_annule(self):
		result = bureau.compute_steps({"request_type": "Autre", "status": "Annulé"})
		self.assertEqual(result["steps"][-1]["label"], "Annulé")


class TestQueueRules(FrappeTestCase):
	def test_urgence_en_attente_compte_dans_le_tri(self):
		rows = [
			{"name": "normal", "niveau_urgence": "U1", "echeance": "2026-01-01", "creation": "1"},
			{
				"name": "en_attente",
				"niveau_urgence": "U0",
				"niveau_urgence_demande": "U3",
				"statut_demande_urgence": "En attente",
				"echeance": "2026-06-01",
				"creation": "2",
			},
			{
				"name": "refusee",
				"niveau_urgence": "U0",
				"niveau_urgence_demande": "U3",
				"statut_demande_urgence": "Refusée",
				"echeance": "2026-01-01",
				"creation": "3",
			},
		]
		rows.sort(key=bureau.queue_sort_key)
		self.assertEqual([row["name"] for row in rows], ["en_attente", "normal", "refusee"])

	def test_sans_echeance_en_dernier(self):
		rows = [
			{"name": "sans", "niveau_urgence": "U1", "creation": "1"},
			{"name": "avec", "niveau_urgence": "U1", "echeance": "2030-01-01", "creation": "2"},
		]
		rows.sort(key=bureau.queue_sort_key)
		self.assertEqual(rows[0]["name"], "avec")

	def test_traduction_des_filtres(self):
		filters = bureau.condition_filters(
			[
				{"field": "type", "op": "est", "value": "Bon de commande"},
				{"field": "creance", "op": "nest", "value": "OK"},
				{"field": "client", "op": "contient", "value": " laiterie "},
				{"field": "commercial", "op": "exclut", "value": "ali"},
				{"field": "echeance", "op": "avant", "value": "2026-11-10"},
				{"field": "echeance", "op": "apres", "value": "2026-11-01"},
				{"field": "echeance", "op": "vide"},
				{"field": "assigne", "op": "est", "value": bureau.NOBODY},
				{"field": "assigne", "op": "nest", "value": bureau.NOBODY},
			]
		)
		self.assertEqual(
			filters,
			[
				["request_type", "=", "Bon de commande"],
				["statut_creance", "!=", "OK"],
				["customer_name", "like", "%laiterie%"],
				["nom_commercial", "not like", "%ali%"],
				["echeance", "<", "2026-11-10"],
				["echeance", ">", "2026-11-01"],
				["echeance", "is", "not set"],
				["assigne_a", "is", "not set"],
				["assigne_a", "is", "set"],
			],
		)

	def test_filtre_sans_valeur_ignore(self):
		self.assertEqual(bureau.condition_filters([{"field": "type", "op": "est", "value": ""}]), [])

	def test_filtre_inconnu_refuse(self):
		with self.assertRaises(frappe.ValidationError):
			bureau.condition_filters([{"field": "owner", "op": "est", "value": "x"}])

	def test_operateur_inadapte_refuse(self):
		with self.assertRaises(frappe.ValidationError):
			bureau.condition_filters([{"field": "type", "op": "like", "value": "x"}])

	def test_vue_inconnue_refusee(self):
		with self.assertRaises(frappe.ValidationError):
			bureau.view_filters("toutes", "x@example.com")


class TestPermissions(FrappeTestCase):
	def tearDown(self):
		frappe.set_user("Administrator")

	def test_invite_refuse(self):
		frappe.set_user("Guest")
		self.assertFalse(bureau.can_access_bureau())
		with self.assertRaises(frappe.PermissionError):
			bureau.get_queue()
		with self.assertRaises(frappe.PermissionError):
			bureau.get_references()
		with self.assertRaises(frappe.PermissionError):
			bureau.get_ticket("inconnu")

	def test_roles_autorises(self):
		for role in ("Administrateur Ventes", "System Manager"):
			with patch("frappe.get_roles", return_value=[role]):
				self.assertTrue(bureau.can_access_bureau("x@example.com"))

	def test_role_commercial_refuse(self):
		with patch("frappe.get_roles", return_value=["Commercial Itinérant"]):
			self.assertFalse(bureau.can_access_bureau("x@example.com"))

	def test_lecture_administrateur(self):
		queue = bureau.get_queue(view="todo", conditions='[{"field": "type", "op": "est", "value": "Bon de commande"}]')
		self.assertEqual(set(queue["counts"]), {"todo", "mine", "urgent", "creance", "closed"})
		self.assertTrue(all(row["request_type"] == "Bon de commande" for row in queue["tickets"]))

	def test_attribution_exige_les_droits(self):
		name = frappe.db.get_value("Ticket Commercial", {}, "name")
		if not name:
			self.skipTest("Aucun ticket sur ce site.")
		before = frappe.db.get_value("Ticket Commercial", name, "assigne_a")
		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			update_assigne_a(name, "Administrator")
		frappe.set_user("Administrator")
		self.assertEqual(frappe.db.get_value("Ticket Commercial", name, "assigne_a"), before)

	def test_attribution_refusee_au_commercial(self):
		name = frappe.db.get_value("Ticket Commercial", {}, "name")
		if not name:
			self.skipTest("Aucun ticket sur ce site.")
		doc = frappe.get_doc("Ticket Commercial", name)
		frappe.set_user("x@example.com")
		with patch("frappe.get_roles", return_value=["Commercial Itinérant"]), patch(
			"frappe.get_doc", return_value=doc
		), patch.object(doc, "check_permission"):
			with self.assertRaises(frappe.PermissionError):
				update_assigne_a(name, "Administrator")

	def test_generation_des_etudes_exige_les_droits(self):
		name = frappe.db.get_value("Demande Faisabilite", {}, "name")
		if not name:
			self.skipTest("Aucune demande sur ce site.")
		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			generate_etude_faisabilite(name)


class TestActions(FrappeTestCase):
	"""Actions sur un vrai ticket, annulées en fin de test. Les commits internes sont neutralisés."""

	def setUp(self):
		frappe.set_user("Administrator")
		self.commit = patch("frappe.db.commit")
		self.commit.start()

	def tearDown(self):
		self.commit.stop()
		frappe.db.rollback()
		frappe.set_user("Administrator")

	def _ticket(self, **filters):
		name = frappe.db.get_value("Ticket Commercial", filters, "name")
		if not name:
			self.skipTest(f"Aucun ticket pour {filters}.")
		return bureau.get_ticket(name)

	def _bc_en_cours(self):
		return self._ticket(request_type="Bon de commande", status="En Cours", docstatus=0)

	def test_version_perimee_refusee(self):
		ticket = self._bc_en_cours()
		with self.assertRaises(frappe.TimestampMismatchError):
			bureau.set_creance(ticket["name"], "2000-01-01 00:00:00", "OK")

	def test_actions_proposees_sans_blocage_direct(self):
		ticket = self._bc_en_cours()
		self.assertIn("Terminer", ticket["actions"])
		self.assertIn("Pause", ticket["actions"])
		self.assertNotIn("Bloquer Créance", ticket["actions"])

	def test_pause_puis_reprise(self):
		ticket = self._bc_en_cours()
		paused = bureau.run_action(ticket["name"], ticket["modified"], "Pause")
		self.assertEqual(paused["status"], "Pending")
		self.assertEqual(paused["actions"], ["Reprendre"])
		resumed = bureau.run_action(ticket["name"], paused["modified"], "Reprendre")
		self.assertEqual(resumed["status"], "En Cours")

	def test_demarrer_attribue_le_ticket(self):
		ticket = self._ticket(status="Nouveau", docstatus=0)
		started = bureau.run_action(ticket["name"], ticket["modified"], "Démarrer")
		self.assertEqual(started["status"], "En Cours")
		self.assertEqual(started["assigne_a"], "Administrator")

	def test_terminer_exige_la_liste_de_controle(self):
		ticket = self._bc_en_cours()
		for item in ticket["checklist"]:
			ticket = bureau.set_checklist(ticket["name"], ticket["modified"], item["fieldname"], 0)
		with self.assertRaises(frappe.ValidationError):
			bureau.run_action(ticket["name"], ticket["modified"], "Terminer")

	def test_blocage_creance_exige_un_motif(self):
		ticket = self._bc_en_cours()
		with self.assertRaises(frappe.ValidationError):
			bureau.set_creance(ticket["name"], ticket["modified"], "Bloquée", "  ")

	def test_blocage_puis_deblocage(self):
		ticket = self._bc_en_cours()
		blocked = bureau.set_creance(ticket["name"], ticket["modified"], "Bloquée", "Facture impayée")
		self.assertEqual(blocked["status"], "Blocage Créance")
		self.assertEqual(blocked["steps"][2]["state"], "blocked")
		# Le workflow ne propose le déblocage qu'une fois la créance autorisée.
		self.assertEqual(blocked["actions"], [])
		allowed = bureau.set_creance(blocked["name"], blocked["modified"], "OK")
		self.assertEqual(allowed["status"], "Blocage Créance")
		self.assertEqual(allowed["actions"], ["Débloquer Créance"])
		released = bureau.run_action(allowed["name"], allowed["modified"], "Débloquer Créance")
		self.assertEqual(released["status"], "En Cours")

	def test_creance_refusee_hors_bon_de_commande(self):
		ticket = self._ticket(request_type="Demande de devis", status="En Cours", docstatus=0)
		with self.assertRaises(frappe.ValidationError):
			bureau.set_creance(ticket["name"], ticket["modified"], "OK")

	def test_liste_de_controle_limitee_au_type(self):
		ticket = self._bc_en_cours()
		with self.assertRaises(frappe.ValidationError):
			bureau.set_checklist(ticket["name"], ticket["modified"], "checklist_rec_photo", 1)
		with self.assertRaises(frappe.ValidationError):
			bureau.set_checklist(ticket["name"], ticket["modified"], "status", 1)

	def test_coche_liste_de_controle(self):
		ticket = self._bc_en_cours()
		field = ticket["checklist"][0]["fieldname"]
		checked = bureau.set_checklist(ticket["name"], ticket["modified"], field, 1)
		self.assertTrue(checked["checklist"][0]["checked"])
		cleared = bureau.set_checklist(ticket["name"], checked["modified"], field, 0)
		self.assertFalse(cleared["checklist"][0]["checked"])

	def test_rapprochement(self):
		ticket = self._bc_en_cours()
		decided = bureau.decide_rapprochement(ticket["name"], ticket["modified"], "Aucun candidat pertinent", None, "Rien de proche")
		self.assertEqual(decided["decision_rapprochement"], "Aucun candidat pertinent")
		self.assertEqual(decided["commentaire_rapprochement"], "Rien de proche")
		self.assertEqual(decided["steps"][3]["state"], "done")
		with self.assertRaises(frappe.ValidationError):
			bureau.decide_rapprochement(decided["name"], decided["modified"], "Devis retenu pour commande")

	def test_refus_urgence_exige_un_commentaire(self):
		ticket = self._bc_en_cours()
		frappe.db.set_value(
			"Ticket Commercial",
			ticket["name"],
			{"statut_demande_urgence": "En attente", "niveau_urgence_demande": "U2", "descr_urgence": "<p>Motif</p>"},
			update_modified=False,
		)
		with self.assertRaises(frappe.ValidationError):
			bureau.decide_urgence(ticket["name"], ticket["modified"], "refuse", None, " ")
		frappe.db.rollback()
		frappe.db.set_value(
			"Ticket Commercial",
			ticket["name"],
			{"statut_demande_urgence": "En attente", "niveau_urgence_demande": "U2", "descr_urgence": "<p>Motif</p>"},
			update_modified=False,
		)
		validated = bureau.decide_urgence(ticket["name"], ticket["modified"], "validate", "U1")
		self.assertEqual(validated["statut_demande_urgence"], "Validée")
		self.assertEqual(validated["niveau_urgence"], "U1")

	def test_attribution_hors_back_office_refusee(self):
		ticket = self._bc_en_cours()
		with self.assertRaises(frappe.ValidationError):
			bureau.set_assignee(ticket["name"], "Guest")

	def test_attribution_a_soi(self):
		ticket = self._bc_en_cours()
		result = bureau.set_assignee(ticket["name"], "Administrator")
		self.assertEqual(result["assigne_a"], "Administrator")
		self.assertTrue(result["mine"])

	def test_retrait_document(self):
		ticket = self._bc_en_cours()
		attached = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": "test-bureau.txt",
				"attached_to_doctype": "Ticket Commercial",
				"attached_to_name": ticket["name"],
				"content": "test",
				"is_private": 1,
			}
		).insert()
		listed = bureau.get_ticket(ticket["name"])["documents"]
		self.assertTrue(next(doc for doc in listed if doc["name"] == attached.name)["can_remove"])
		after = bureau.remove_document(ticket["name"], attached.name)
		self.assertFalse(any(doc["name"] == attached.name for doc in after["documents"]))

	def test_retrait_document_d_un_autre_refuse(self):
		ticket = self._bc_en_cours()
		attached = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": "test-bureau-autre.txt",
				"attached_to_doctype": "Ticket Commercial",
				"attached_to_name": ticket["name"],
				"content": "autre",
				"is_private": 1,
			}
		).insert()
		frappe.db.set_value("File", attached.name, "owner", "Guest", update_modified=False)
		with self.assertRaises(frappe.PermissionError):
			bureau.remove_document(ticket["name"], attached.name)


class TestQueueSteps(FrappeTestCase):
	"""La file lit les cycles en une fois : elle doit donner la même étape que la fiche."""

	def test_meme_etape_que_la_fiche(self):
		frappe.set_user("Administrator")
		names = frappe.get_all("Ticket Commercial", pluck="name", limit_page_length=200)
		if not names:
			self.skipTest("Aucun ticket.")
		rows = {}
		for view in ("todo", "closed"):
			rows.update({row["name"]: row for row in bureau.get_queue(view)["tickets"]})
		for name, row in rows.items():
			ticket = bureau.get_ticket(name)
			current = ticket["current_step"]
			expected = ticket["steps"][current if current is not None else -1]["label"]
			self.assertEqual(row["step"]["label"], expected, name)
			self.assertEqual(row["step"]["current"], current, name)
			self.assertEqual(row["step"]["total"], len(ticket["steps"]), name)
			self.assertEqual(row["modified"], ticket["modified"], name)

	def test_ligne_sans_document(self):
		row = bureau._queue_step(bureau.compute_steps({"request_type": "Autre", "status": "Terminé"}))
		self.assertEqual(row, {"label": "Terminé", "current": None, "done": 3, "total": 3})


class TestBulk(FrappeTestCase):
	"""Actions groupées sur de vrais tickets, annulées en fin de test."""

	def setUp(self):
		frappe.set_user("Administrator")
		self.commit = patch("frappe.db.commit")
		self.commit.start()

	def tearDown(self):
		self.commit.stop()
		frappe.db.rollback()
		frappe.set_user("Administrator")

	def _item(self, **filters):
		row = frappe.db.get_value("Ticket Commercial", filters, ["name", "modified"], as_dict=True)
		if not row:
			self.skipTest(f"Aucun ticket pour {filters}.")
		return {"name": row.name, "modified": str(row.modified)}

	def test_attribue_les_ouverts_et_ignore_les_clos(self):
		ouvert = self._item(status="En Cours", docstatus=0)
		clos = self._item(status="Terminé")
		result = bureau.bulk_assign([ouvert, clos], "Administrator")
		self.assertEqual(result["done"], [ouvert["name"]])
		self.assertEqual(result["skipped"], [{"name": clos["name"], "reason": "Ticket clos."}])
		self.assertEqual(frappe.db.get_value("Ticket Commercial", ouvert["name"], "assigne_a"), "Administrator")

	def test_une_version_perimee_ne_bloque_pas_les_autres(self):
		perime = {**self._item(status="En Cours", docstatus=0), "modified": "2000-01-01 00:00:00"}
		autre = self._item(status="Nouveau", docstatus=0)
		result = bureau.bulk_action([perime, autre], "Démarrer")
		self.assertEqual(result["done"], [autre["name"]])
		self.assertEqual(result["skipped"][0]["name"], perime["name"])
		self.assertIn("modifié par ailleurs", result["skipped"][0]["reason"])
		self.assertEqual(frappe.db.get_value("Ticket Commercial", autre["name"], "status"), "En Cours")

	def test_action_non_disponible_ignoree(self):
		item = self._item(status="Terminé")
		result = bureau.bulk_action([item], "Pause")
		self.assertEqual(result["done"], [])
		self.assertEqual(result["skipped"][0]["reason"], "Action non disponible pour ce ticket.")

	def test_action_non_autorisee_en_groupe(self):
		with self.assertRaises(frappe.ValidationError):
			bureau.bulk_action([self._item(status="En Cours", docstatus=0)], "Terminer")

	def test_limite_et_selection_vide(self):
		with self.assertRaises(frappe.ValidationError):
			bureau.bulk_assign([], "Administrator")
		with self.assertRaises(frappe.ValidationError):
			bureau.bulk_assign([{"name": "x"}] * (bureau.BULK_LIMIT + 1), "Administrator")

	def test_attribution_hors_back_office_refusee(self):
		with self.assertRaises(frappe.ValidationError):
			bureau.bulk_assign([self._item(status="En Cours", docstatus=0)], "Guest")


class TestEvents(FrappeTestCase):
	def test_filtrage_des_documents(self):
		from aurescrm import bureau_events

		self.assertTrue(bureau_events._is_watched(frappe._dict(doctype="Ticket Commercial")))
		self.assertTrue(bureau_events._is_watched(frappe._dict(doctype="File", attached_to_doctype="Ticket Commercial")))
		self.assertFalse(bureau_events._is_watched(frappe._dict(doctype="File", attached_to_doctype="Customer")))
		self.assertFalse(bureau_events._is_watched(frappe._dict(doctype="Item")))

	def test_message_sans_donnees_metier(self):
		from aurescrm import bureau_events

		doc = frappe._dict(doctype="Demande Faisabilite", name="DF-1", ticket_commercial="TC-1")
		doc.get = lambda key, default=None: dict(doc).get(key, default)
		setattr(frappe.local, bureau_events._LOCAL_KEY, set())
		with patch("frappe.publish_realtime") as publish, patch.object(bureau_events, "recipients", return_value=["a@x", "b@x"]):
			bureau_events.announce(doc)
			bureau_events.announce(doc)
		self.assertEqual(publish.call_count, 2)
		message = publish.call_args.args[1]
		self.assertEqual(message, {"doctype": "Demande Faisabilite", "name": "DF-1", "ticket": "TC-1", "by": frappe.session.user, "deleted": 0})
