# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Tests du poste de bureau : étapes de la timeline, filtres de la file et droits.

Exécuter avec : bench --site [site] run-tests --module aurescrm.tests.test_bureau
"""

from unittest.mock import patch
from urllib.parse import parse_qsl

import frappe
from frappe.tests.utils import FrappeTestCase

from frappe.desk.notifications import extract_mentions

from aurescrm.api import activity, bureau, bureau_articles, bureau_bulk, bureau_clients
from aurescrm.aures_crm.doctype.demande_faisabilite.demande_faisabilite import generate_etude_faisabilite
from aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial import update_assigne_a
from aurescrm.www import bureau as bureau_page


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
		self.assertTrue(bureau_events._is_watched(frappe._dict(doctype="Item")))
		self.assertFalse(bureau_events._is_watched(frappe._dict(doctype="Supplier")))

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


class TestPagination(FrappeTestCase):
	"""Tri et pagination se font côté serveur, sur toute la vue."""

	def _rows(self, *values):
		return [frappe._dict(name=f"T{index}", customer_name=value, request_type="Autre") for index, value in enumerate(values)]

	def test_tri_sans_accents_ni_casse(self):
		rows = bureau.order_queue(self._rows("Zeta", "étui", "Alpha"), "todo", "client", "asc")
		self.assertEqual([row.customer_name for row in rows], ["Alpha", "étui", "Zeta"])

	def test_tri_decroissant(self):
		rows = bureau.order_queue(self._rows("Alpha", "Zeta"), "todo", "client", "desc")
		self.assertEqual([row.customer_name for row in rows], ["Zeta", "Alpha"])

	def test_valeurs_vides_a_la_fin_dans_les_deux_sens(self):
		for direction in ("asc", "desc"):
			rows = bureau.order_queue(self._rows(None, "Alpha", "Zeta"), "todo", "client", direction)
			self.assertIsNone(rows[-1].customer_name)

	def test_tri_inconnu_refuse(self):
		with self.assertRaises(frappe.ValidationError):
			bureau.order_queue([], "todo", "step", "asc")

	def test_bornes_de_page(self):
		self.assertEqual(bureau.page_bounds(50, 20, 20), (20, 20))
		self.assertEqual(bureau.page_bounds(50, 60, 20), (40, 20), "une page disparue ramène à la dernière")
		self.assertEqual(bureau.page_bounds(40, 40, 20), (20, 20))
		self.assertEqual(bureau.page_bounds(0, 40, 20), (0, 20))
		self.assertEqual(bureau.page_bounds(50, -5, 9999), (0, bureau.MAX_PAGE_LENGTH))
		self.assertEqual(bureau.page_bounds(50, 0, 0), (0, bureau.DEFAULT_PAGE_LENGTH))

	def test_pages_de_la_file(self):
		frappe.set_user("Administrator")
		complete = bureau.get_queue("todo", page_length=bureau.MAX_PAGE_LENGTH)
		if complete["total"] < 3:
			self.skipTest("Moins de 3 tickets ouverts.")
		first = bureau.get_queue("todo", start=0, page_length=2)
		second = bureau.get_queue("todo", start=2, page_length=2)
		self.assertEqual(first["total"], complete["total"])
		self.assertEqual(first["names"], complete["names"])
		self.assertEqual([row["name"] for row in first["tickets"]], complete["names"][:2])
		self.assertEqual([row["name"] for row in second["tickets"]], complete["names"][2:4])
		self.assertEqual(second["start"], 2)
		self.assertTrue(all("comments" in row for row in first["tickets"]))


class TestActivite(FrappeTestCase):
	"""Le fil lit les mêmes sources que la timeline du Desk."""

	def setUp(self):
		frappe.set_user("Administrator")
		self.commit = patch("frappe.db.commit")
		self.commit.start()
		self.name = frappe.db.get_value("Ticket Commercial", {}, "name")
		if not self.name:
			self.skipTest("Aucun ticket.")

	def tearDown(self):
		self.commit.stop()
		frappe.db.rollback()
		frappe.set_user("Administrator")

	def _comments(self, feed):
		return [item for item in feed["items"] if item["kind"] == "comment"]

	def test_ecrire_modifier_supprimer(self):
		before = bureau.get_activity(self.name)["comment_count"]
		feed = bureau.add_comment(self.name, "Premier message")
		self.assertEqual(feed["comment_count"], before + 1)
		added = self._comments(feed)[0]
		self.assertEqual(added["text"], "Premier message")
		self.assertTrue(added["mine"])

		feed = bureau.update_comment(self.name, added["id"], "Message corrigé")
		self.assertEqual(self._comments(feed)[0]["text"], "Message corrigé")

		feed = bureau.delete_comment(self.name, added["id"])
		self.assertEqual(feed["comment_count"], before)

	def test_commentaire_vide_refuse(self):
		with self.assertRaises(frappe.ValidationError):
			bureau.add_comment(self.name, "   ")

	def test_html_saisi_echappe(self):
		feed = bureau.add_comment(self.name, "<img src=x onerror=alert(1)>")
		added = self._comments(feed)[0]
		self.assertEqual(added["text"], "<img src=x onerror=alert(1)>")
		self.assertNotIn("<img", frappe.db.get_value("Comment", added["id"], "content"))

	def test_mention_au_format_du_desk(self):
		html = activity.to_comment_html("Bonjour @Admin", [{"id": "Administrator", "label": "Admin"}])
		self.assertEqual(extract_mentions(html), ["Administrator"])
		parsed = activity.parse_comment(html)
		self.assertEqual(parsed["text"], "Bonjour @Admin")
		self.assertEqual(parsed["parts"], [{"text": "Bonjour ", "mention": False}, {"text": "@Admin", "mention": True}])
		self.assertEqual(parsed["mentions"], [{"id": "Administrator", "label": "Admin"}])

	def test_mention_ecrite_sur_le_desk(self):
		# Format relevé en base : le Desk range un lien HTML dans `data-value`.
		html = (
			'<div class="ql-editor read-mode"><p><span class="mention" data-id="a@example.com" '
			'data-value="&lt;a href=&quot;https://site/app/user-profile/a@example.com&quot; target=&quot;_blank&quot;&gt;Amine Melizi" '
			'data-denotation-char="@"><span contenteditable="false"><span class="ql-mention-denotation-char">@</span>Amine Melizi</span></span> '
			"manque grammage</p></div>"
		)
		parsed = activity.parse_comment(html)
		self.assertEqual(parsed["text"], "@Amine Melizi manque grammage")
		self.assertEqual(parsed["mentions"], [{"id": "a@example.com", "label": "Amine Melizi"}])

	def test_mention_d_un_compte_inconnu_ignoree(self):
		html = activity.to_comment_html("Bonjour @Personne", [{"id": "inconnu@example.com", "label": "Personne"}])
		self.assertEqual(extract_mentions(html), [])

	def test_commentaire_du_desk_lu_sans_html(self):
		html = '<div class="ql-editor read-mode"><p>Ligne <b>un</b></p><p>Ligne deux</p><script>alert(1)</script></div>'
		parsed = activity.parse_comment(html)
		self.assertIn("Ligne un\n", parsed["text"])
		self.assertIn("Ligne deux", parsed["text"])
		self.assertTrue(all("<" not in part["text"] for part in parsed["parts"]))

	def test_commentaire_d_un_autre_protege(self):
		feed = bureau.add_comment(self.name, "Message de quelqu'un")
		added = self._comments(feed)[0]
		frappe.db.set_value("Comment", added["id"], "owner", "autre@example.com", update_modified=False)
		frappe.set_user("Guest")
		frappe.local.session.user = "bo-test@example.com"
		with patch("aurescrm.api.bureau.require_bureau", return_value="bo-test@example.com"):
			with self.assertRaises(frappe.PermissionError):
				bureau.delete_comment(self.name, added["id"])

	def test_commentaire_d_un_autre_ticket_refuse(self):
		other = frappe.db.get_value("Ticket Commercial", {"name": ["!=", self.name]}, "name")
		if not other:
			self.skipTest("Un seul ticket.")
		added = self._comments(bureau.add_comment(self.name, "Message"))[0]
		with self.assertRaises(frappe.PermissionError):
			bureau.update_comment(other, added["id"], "Détourné")

	def test_fil_du_plus_recent_au_plus_ancien_avec_la_creation_en_dernier(self):
		bureau.add_comment(self.name, "Message")
		items = bureau.get_activity(self.name)["items"]
		self.assertEqual(items[-1]["kind"], "create")
		dates = [item["at"] for item in items[:-1]]
		self.assertEqual(dates, sorted(dates, reverse=True))

	def test_changement_de_valeur_en_libelle(self):
		ticket = frappe.get_doc("Ticket Commercial", self.name)
		version = frappe.get_doc(
			{
				"doctype": "Version",
				"ref_doctype": "Ticket Commercial",
				"docname": self.name,
				"data": frappe.as_json({"changed": [["status", "Nouveau", "En Cours"], ["champ_inconnu", "a", "b"]]}),
			}
		).insert(ignore_permissions=True)
		items = activity._version_items(ticket)
		change = next(item for item in items if item["id"] == version.name)
		self.assertEqual(change["changes"], [{"label": "Statut", "old": "Nouveau", "new": "En Cours"}])

	def test_fichier_sans_lien_dangereux(self):
		comment = frappe._dict(
			name="C1", comment_type="Attachment", content='<a href="javascript:alert(1)">piege.pdf</a>', comment_by="X", owner="x", creation="2026-01-01"
		)
		self.assertIsNone(activity._log_item(comment)["link"]["url"])

	def test_invite_refuse(self):
		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			bureau.get_activity(self.name)

	def test_aperçu_et_compteurs(self):
		before = activity.comment_counts("Ticket Commercial", [self.name]).get(self.name, 0)
		bureau.add_comment(self.name, "Dernier message")
		self.assertEqual(activity.comment_counts("Ticket Commercial", [self.name])[self.name], before + 1)
		summary = bureau.get_ticket(self.name)["comments"]
		self.assertEqual(summary["count"], before + 1)
		self.assertEqual(summary["last"]["parts"][0]["text"], "Dernier message")


class TestCreationTicket(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		self.commit = patch("frappe.db.commit")
		self.commit.start()
		self.customer = frappe.db.get_value("Customer", {"disabled": 0}, "name")
		self.site = frappe.db.get_value("Site Production", {}, "name")
		if not self.customer or not self.site:
			self.skipTest("Il faut un client et un site.")

	def tearDown(self):
		self.commit.stop()
		frappe.db.rollback()
		frappe.set_user("Administrator")

	def _create(self, **extra):
		values = {"customer": self.customer, "request_type": "Autre", "site": self.site, "description": "Une demande"}
		return bureau.create_ticket(**{**values, **extra})

	def test_cree_le_ticket_avec_le_commercial_du_client(self):
		assigned = frappe.db.get_value("Customer", self.customer, bureau.CLIENT_COMMERCIAL_FIELD)
		doc = frappe.get_doc("Ticket Commercial", self._create()["name"])
		self.assertEqual(doc.customer, self.customer)
		self.assertEqual(doc.commercial, assigned or "Administrator")
		self.assertEqual(doc.status, "Nouveau")
		self.assertEqual(doc.priority, "Moyenne")

	def test_urgence_fixee_par_le_type(self):
		options = {row["value"]: row["urgence"] for row in bureau.get_ticket_form_options()["types"]}
		self.assertEqual(options["Bon de commande"], "U2")
		self.assertEqual(options["Essai Blanc"], "U3")
		doc = frappe.get_doc("Ticket Commercial", self._create(request_type="Bon de commande")["name"])
		self.assertEqual(doc.niveau_urgence, "U2")

	def test_champs_obligatoires(self):
		for field in ("customer", "request_type", "site", "description"):
			with self.assertRaises(frappe.ValidationError):
				self._create(**{field: "  "})

	def test_description_echappee(self):
		doc = frappe.get_doc("Ticket Commercial", self._create(description="<img src=x>\n\nSuite\nligne")["name"])
		self.assertNotIn("<img", doc.description)
		self.assertIn("<p>Suite<br>ligne</p>", doc.description)

	def test_commercial_hors_liste_refuse(self):
		with self.assertRaises(frappe.ValidationError):
			self._create(commercial="inconnu@example.com")

	def test_invite_refuse(self):
		frappe.set_user("Guest")
		for call in (bureau.get_ticket_form_options, bureau.search_clients, self._create):
			with self.assertRaises(frappe.PermissionError):
				call()

	def test_recherche_de_clients(self):
		label = frappe.db.get_value("Customer", self.customer, "customer_name")
		results = bureau.search_clients(label[:6])
		row = next(item for item in results if item["name"] == self.customer)
		self.assertIn("open_tickets", row)
		before = row["open_tickets"]
		self._create()
		row = next(item for item in bureau.search_clients(label[:6]) if item["name"] == self.customer)
		self.assertEqual(row["open_tickets"], before + 1)


class TestClients(FrappeTestCase):
	"""Liste, fiche, création et modification des clients du poste de bureau."""

	COMMERCIAL = "bureau.commercial.test@example.com"

	def setUp(self):
		frappe.set_user("Administrator")
		frappe.db.savepoint("test_clients")
		# Sans cela, chaque client de test met en file un dossier Nextcloud, qui échoue après l'annulation et remplit l'Error Log.
		nextcloud = patch("aurescrm.integrations.nextcloud.on_customer_after_insert")
		nextcloud.start()
		self.addCleanup(nextcloud.stop)
		if not frappe.db.exists("User", self.COMMERCIAL):
			frappe.get_doc({"doctype": "User", "email": self.COMMERCIAL, "first_name": "Commercial Test", "send_welcome_email": 0, "roles": [{"role": "Commercial Sédentaire"}]}).insert(ignore_permissions=True)
		self.commune = frappe.db.get_value("Communes", {}, "name")
		self.categorie = frappe.db.get_value("Customer Group", {"is_group": 0}, "name")

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.rollback(save_point="test_clients")

	def _values(self, **changes):
		values = {
			"customer_name": frappe.generate_hash(length=12),
			"forme_juridique": "SARL",
			"categorie": self.categorie,
			"commune": self.commune,
			"commercial": self.COMMERCIAL,
			"contact": "R. Saidi",
			"telephone": "036 00 12 40",
			"email": "achats@example.com",
		}
		values.update(changes)
		return values

	def _create(self, **changes):
		return bureau_clients.create_prospect(self._values(**changes))["name"]

	def test_prospect_attribue_au_commercial_choisi(self):
		doc = frappe.get_doc("Customer", self._create(customer_name="sarl essai bureau"))
		self.assertEqual(doc.customer_name, "SARL ESSAI BUREAU")
		self.assertEqual(doc.custom_status, "Prospect")
		self.assertEqual(doc.get("custom_commercial_attribué"), self.COMMERCIAL)
		self.assertEqual([row.commercial for row in doc.custom_commercial_assignments if row.is_principal], [self.COMMERCIAL])
		self.assertEqual(doc.custom_wilaya, frappe.db.get_value("Communes", self.commune, "wilaya"))

	def test_champs_obligatoires_du_prospect(self):
		for field in ("customer_name", "forme_juridique", "categorie", "commune", "commercial"):
			with self.assertRaises(frappe.ValidationError):
				self._create(**{field: "  "})

	def test_nom_deja_pris_refuse(self):
		self._create(customer_name="doublon bureau")
		with self.assertRaisesRegex(frappe.ValidationError, "existe déjà"):
			self._create(customer_name="Doublon Bureau")

	def test_commercial_hors_liste_refuse(self):
		with self.assertRaises(frappe.ValidationError):
			self._create(commercial="inconnu@example.com")

	def test_liste_vues_et_pagination(self):
		name = self._create(customer_name="zzz vue bureau")
		result = bureau_clients.get_clients(view="prospect", search="ZZZ VUE BUREAU", page_length=20)
		self.assertEqual(result["names"], [name])
		self.assertEqual(result["clients"][0]["commercial"], "Commercial Test")
		self.assertEqual(result["counts"]["prospect"], 1)
		self.assertEqual(result["counts"]["actif"], 0)
		self.assertEqual(bureau_clients.get_clients(view="actif", search="ZZZ VUE BUREAU")["total"], 0)
		with self.assertRaises(frappe.ValidationError):
			bureau_clients.get_clients(view="inconnue")

	def test_filtres_de_la_liste(self):
		name = self._create(customer_name="zzz filtre bureau")
		conditions = [{"field": "commercial", "op": "est", "value": self.COMMERCIAL}, {"field": "grand_compte", "op": "est", "value": "0"}]
		self.assertIn(name, bureau_clients.get_clients(conditions=conditions, page_length=500)["names"])
		conditions = [{"field": "grand_compte", "op": "est", "value": "1"}]
		self.assertNotIn(name, bureau_clients.get_clients(conditions=conditions, page_length=500)["names"])

	def test_tri_sans_valeur_a_la_fin(self):
		rows = [{"client": "B", "visite": None}, {"client": "A", "visite": "2026-01-01"}, {"client": "C", "visite": "2026-06-01"}]
		self.assertEqual([row["client"] for row in bureau_clients.order_clients(rows, "visite", "asc")], ["A", "C", "B"])
		self.assertEqual([row["client"] for row in bureau_clients.order_clients(rows, "visite", "desc")], ["C", "A", "B"])
		self.assertEqual([row["client"] for row in bureau_clients.order_clients(rows)], ["A", "B", "C"])

	def test_fiche_reunit_les_documents_lies(self):
		client = bureau_clients.get_client(self._create())
		self.assertTrue(client["can_edit"])
		self.assertTrue(client["can_view_activity"])
		self.assertEqual(client["tickets"], [])
		self.assertIsNone(client["creance"])
		self.assertEqual([piece["label"] for piece in client["pieces"]], ["Nº RC", "Nº NIF", "Nº NIS", "Nº AI"])
		self.assertEqual(client["contacts"][0]["nom"], "R. Saidi")
		self.assertEqual(client["attributions"][0]["principal"], 1)
		label = frappe.db.get_value("Communes", self.commune, "commune")
		self.assertEqual(client["commune"], self.commune)
		self.assertEqual(client["commune_label"], label)
		self.assertEqual(client["adresses"][0]["commune"], label)

	def test_modification_et_conflit(self):
		name = self._create()
		client = bureau_clients.get_client(name)
		updated = bureau_clients.update_client(name, client["modified"], {"status": "Actif", "rc": "19 B 001", "contact": "K. Hamdi"})
		self.assertEqual(updated["status"], "Actif")
		self.assertEqual(updated["contact"], "K. Hamdi")
		self.assertEqual(updated["pieces"][0]["numero"], "19 B 001")
		with self.assertRaises(frappe.TimestampMismatchError):
			bureau_clients.update_client(name, client["modified"], {"status": "Dormant"})

	def test_changer_de_commercial_garde_un_seul_principal(self):
		other = "bureau.commercial2.test@example.com"
		if not frappe.db.exists("User", other):
			frappe.get_doc({"doctype": "User", "email": other, "first_name": "Autre Commercial", "send_welcome_email": 0, "roles": [{"role": "Commercial Sédentaire"}]}).insert(ignore_permissions=True)
		name = self._create()
		bureau_clients.update_client(name, None, {"commercial": other})
		doc = frappe.get_doc("Customer", name)
		self.assertEqual(doc.get("custom_commercial_attribué"), other)
		self.assertEqual(doc.custom_nom_commercial, "Autre Commercial")
		self.assertEqual([row.commercial for row in doc.custom_commercial_assignments if row.is_principal], [other])

	def test_piece_doit_etre_jointe_au_client(self):
		name = self._create()
		with self.assertRaisesRegex(frappe.ValidationError, "pas joint"):
			bureau_clients.set_client_piece(name, None, "rc", "/private/files/ailleurs.pdf")
		with self.assertRaises(frappe.ValidationError):
			bureau_clients.set_client_piece(name, None, "inconnue", "/x")

	def test_champ_hors_liste_ignore(self):
		name = self._create()
		bureau_clients.update_client(name, None, {"disabled": "1", "custom_grand_compte": "1"})
		doc = frappe.get_doc("Customer", name)
		self.assertEqual(doc.disabled, 0)
		self.assertEqual(doc.custom_grand_compte, 0)

	def test_commentaire_sur_le_client(self):
		name = self._create()
		feed = bureau_clients.add_client_comment(name, "Bonjour")
		self.assertEqual(feed["comment_count"], 1)
		self.assertEqual(bureau_clients.get_client(name)["comments"]["count"], 1)

	def test_activite_refusee_sans_droit(self):
		name = self._create()
		with patch("aurescrm.api.bureau_clients.can_view_customer_activity", return_value=False):
			for call in (lambda: bureau_clients.get_client_activity(name), lambda: bureau_clients.add_client_comment(name, "x")):
				with self.assertRaises(frappe.PermissionError):
					call()

	def test_invite_refuse(self):
		name = self._create()
		frappe.set_user("Guest")
		for call in (bureau_clients.get_clients, bureau_clients.get_client_options, bureau_clients.search_communes, lambda: bureau_clients.get_client(name), lambda: bureau_clients.update_client(name, None, {}), lambda: bureau_clients.create_prospect(self._values())):
			with self.assertRaises(frappe.PermissionError):
				call()


class TestBulkCommun(FrappeTestCase):
	"""Actions groupées communes aux listes, sur de vrais documents, annulées en fin de test."""

	def setUp(self):
		frappe.set_user("Administrator")
		self.commit = patch("frappe.db.commit")
		self.commit.start()

	def tearDown(self):
		self.commit.stop()
		frappe.db.rollback()
		frappe.set_user("Administrator")

	def _ticket(self, **filters):
		row = frappe.db.get_value("Ticket Commercial", {"docstatus": 0, **filters}, ["name", "modified"], as_dict=True)
		if not row:
			self.skipTest(f"Aucun ticket pour {filters}.")
		return {"name": row.name, "modified": str(row.modified)}

	def _client(self):
		row = frappe.db.get_value("Customer", {"disabled": 0}, ["name", "modified"], as_dict=True)
		if not row:
			self.skipTest("Aucun client.")
		return {"name": row.name, "modified": str(row.modified)}

	def _fieldnames(self, doctype):
		return {field["fieldname"] for field in bureau_bulk.get_bulk_options(doctype)["fields"]}

	def test_refuse_un_doctype_hors_registre(self):
		for call in (
			lambda: bureau_bulk.get_bulk_options("User"),
			lambda: bureau_bulk.bulk_update("User", [{"name": "Administrator"}], "enabled", 0),
			lambda: bureau_bulk.bulk_delete("User", [{"name": "Guest"}]),
			lambda: bureau_bulk.bulk_add_tags("User", [{"name": "Guest"}], ["x"]),
		):
			with self.assertRaises(frappe.PermissionError):
				call()

	def test_reserve_au_back_office(self):
		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			bureau_bulk.get_bulk_options("Customer")

	def test_champs_proposes(self):
		tickets = self._fieldnames("Ticket Commercial")
		self.assertIn("channel", tickets)
		for fieldname in ("statut_creance", "motif_blocage_creance", "checklist_bc_devis", "customer", "status", "description"):
			self.assertNotIn(fieldname, tickets)
		clients = self._fieldnames("Customer")
		self.assertIn("custom_grand_compte", clients)
		self.assertIn("custom_commercial_attribué", clients)
		for fieldname in ("customer_name", "custom_dernier_numéro_article", "custom_fichier_rc", "naming_series"):
			self.assertNotIn(fieldname, clients)

	def test_refuse_un_champ_exclu_meme_en_appel_direct(self):
		with self.assertRaises(frappe.PermissionError):
			bureau_bulk.bulk_update("Ticket Commercial", [self._ticket()], "statut_creance", "OK")
		with self.assertRaises(frappe.PermissionError):
			bureau_bulk.bulk_update("Ticket Commercial", [self._ticket()], "status", "Terminé")

	def test_refuse_un_champ_sans_droit_de_niveau(self):
		meta = frappe.get_meta("Customer")
		with patch.object(type(meta), "get_permlevel_access", return_value=[0]):
			fields = {field["fieldname"] for field in bureau_bulk.get_bulk_options("Customer")["fields"]}
			self.assertNotIn("is_frozen", fields)
			with self.assertRaises(frappe.PermissionError):
				bureau_bulk.bulk_update("Customer", [self._client()], "is_frozen", 1)

	def test_refuse_un_champ_obligatoire_vide(self):
		with self.assertRaises(frappe.ValidationError):
			bureau_bulk.bulk_update("Ticket Commercial", [self._ticket()], "site", "")

	def test_modifie_et_signale_ce_qui_est_perime(self):
		item = self._client()
		perime = {**self._client(), "modified": "2000-01-01 00:00:00"}
		autre = frappe.db.get_value("Customer", {"disabled": 0, "name": ["!=", item["name"]]}, "name")
		if not autre:
			self.skipTest("Un seul client.")
		perime["name"] = autre
		before = frappe.db.get_value("Customer", item["name"], "custom_grand_compte")
		result = bureau_bulk.bulk_update("Customer", [item, perime], "custom_grand_compte", 0 if before else 1)
		self.assertEqual(result["done"], [item["name"]])
		self.assertEqual([row["name"] for row in result["skipped"]], [autre])
		self.assertEqual(frappe.db.get_value("Customer", item["name"], "custom_grand_compte"), 0 if before else 1)

	def test_meme_valeur_sans_ecriture(self):
		item = self._client()
		value = frappe.db.get_value("Customer", item["name"], "custom_grand_compte")
		result = bureau_bulk.bulk_update("Customer", [item], "custom_grand_compte", value)
		self.assertEqual(result["done"], [item["name"]])
		self.assertEqual(str(frappe.db.get_value("Customer", item["name"], "modified")), item["modified"])

	def test_commercial_passe_par_les_attributions(self):
		commercial = next(iter(bureau._commercial_users()), None)
		if not commercial:
			self.skipTest("Aucun commercial.")
		item = self._client()
		with patch("aurescrm.api.bureau_bulk._set_principal") as principal, patch("frappe.model.document.Document.save"):
			frappe.db.set_value("Customer", item["name"], "custom_commercial_attribué", None, update_modified=False)
			bureau_bulk.bulk_update("Customer", [item], "custom_commercial_attribué", commercial.name)
		principal.assert_called_once()
		self.assertEqual(principal.call_args.args[1], commercial.name)

	def test_commercial_hors_liste_est_refuse_par_ligne(self):
		result = bureau_bulk.bulk_update("Customer", [self._client()], "custom_commercial_attribué", "Guest")
		self.assertEqual(result["done"], [])
		self.assertIn("commercial", result["skipped"][0]["reason"])

	def test_valeur_non_retenue_n_est_pas_annoncee(self):
		item = self._client()
		before = frappe.db.get_value("Customer", item["name"], "custom_grand_compte")

		def revert(doc, *args, **kwargs):
			doc.custom_grand_compte = before

		with patch("frappe.model.document.Document.save", revert):
			result = bureau_bulk.bulk_update("Customer", [item], "custom_grand_compte", 0 if before else 1)
		self.assertEqual(result["done"], [])
		self.assertIn("retenue", result["skipped"][0]["reason"])

	def test_suppression_refusee_garde_le_document(self):
		item = self._ticket()
		with patch("frappe.delete_doc", side_effect=frappe.LinkExistsError("Lié à un devis")):
			result = bureau_bulk.bulk_delete("Ticket Commercial", [item])
		self.assertEqual(result["done"], [])
		self.assertIn("Lié à un devis", result["skipped"][0]["reason"])
		self.assertTrue(frappe.db.exists("Ticket Commercial", item["name"]))

	def test_suppression_demande_le_droit(self):
		item = self._ticket()
		with patch("frappe.model.document.Document.check_permission", side_effect=[None, frappe.PermissionError("Pas de droit")]), patch("frappe.delete_doc") as delete:
			result = bureau_bulk.bulk_delete("Ticket Commercial", [item])
		delete.assert_not_called()
		self.assertEqual(result["done"], [])

	def test_tags(self):
		item = self._client()
		tag = "test-bureau-bulk"
		result = bureau_bulk.bulk_add_tags("Customer", [item], [tag, f" {tag} "])
		self.assertEqual(result["done"], [item["name"]])
		self.assertIn(tag, frappe.db.get_value("Customer", item["name"], "_user_tags"))
		self.assertEqual(str(frappe.db.get_value("Customer", item["name"], "modified")), item["modified"])
		rows = bureau_clients.get_clients(conditions=[{"field": "tag", "op": "contient", "value": tag}])
		self.assertEqual(rows["names"], [item["name"]])
		self.assertIn(tag, rows["clients"][0]["tags"])

	def test_tag_depuis_la_fiche(self):
		item = self._client()
		tag = "test-bureau-fiche"
		tags = bureau_bulk.add_doc_tag("Customer", item["name"], item["modified"], tag)["tags"]
		self.assertIn(tag, tags)
		self.assertIn(tag, bureau_clients.get_client(item["name"])["tags"])
		self.assertNotIn(tag, bureau_bulk.remove_doc_tag("Customer", item["name"], item["modified"], tag)["tags"])
		self.assertEqual(str(frappe.db.get_value("Customer", item["name"], "modified")), item["modified"])

	def test_tag_de_ticket_dans_le_detail(self):
		item = self._ticket()
		bureau_bulk.add_doc_tag("Ticket Commercial", item["name"], item["modified"], "test-bureau-fiche")
		self.assertIn("test-bureau-fiche", bureau.get_ticket(item["name"])["tags"])

	def test_tag_depuis_la_fiche_demande_le_droit(self):
		item = self._client()
		with patch("aurescrm.api.bureau_clients.get_customer_edit_status", return_value={"can_edit": False}):
			with self.assertRaises(frappe.PermissionError):
				bureau_bulk.add_doc_tag("Customer", item["name"], item["modified"], "x")
			with self.assertRaises(frappe.PermissionError):
				bureau_bulk.remove_doc_tag("Customer", item["name"], item["modified"], "x")

	def test_tag_refuse_avec_virgule_ou_vide(self):
		for tags in (["a,b"], [" "], []):
			with self.assertRaises(frappe.ValidationError):
				bureau_bulk.bulk_add_tags("Customer", [self._client()], tags)

	def test_tags_demandent_le_droit_d_ecriture(self):
		item = self._client()
		with patch("aurescrm.api.bureau_clients.get_customer_edit_status", return_value={"can_edit": False}):
			result = bureau_bulk.bulk_add_tags("Customer", [item], ["test-bureau-bulk"])
		self.assertEqual(result["done"], [])

	def test_recherche_de_lien(self):
		with self.assertRaises(frappe.ValidationError):
			bureau_bulk.search_bulk_link("Ticket Commercial", "channel")
		with self.assertRaises(frappe.PermissionError):
			bureau_bulk.search_bulk_link("Ticket Commercial", "customer")
		rows = bureau_bulk.search_bulk_link("Ticket Commercial", "site")
		for row in rows:
			self.assertEqual(set(row), {"value", "label"})


class TestConnexion(FrappeTestCase):
	"""Page de connexion du poste : qui la reçoit, et où mène la redirection."""

	def tearDown(self):
		frappe.local.flags.pop("redirect_location", None)
		frappe.form_dict.pop("redirect-to", None)
		frappe.set_user("Administrator")

	def open_page(self, path, user, query=""):
		"""Ouvre la page et renvoie la redirection demandée, ou None si la page est servie."""
		frappe.set_user(user)
		frappe.form_dict.update(parse_qsl(query))
		request = frappe._dict(path=path, full_path=f"{path}?{query}")
		with patch.object(frappe.local, "request", request, create=True):
			try:
				bureau_page.get_context()
			except frappe.Redirect:
				return frappe.local.flags.redirect_location
		return None

	def test_retour_limite_au_poste(self):
		self.assertEqual(bureau_page.safe_redirect("/bureau/clients?page=2"), "/bureau/clients?page=2")
		for target in ("https://exemple.com/bureau", "//exemple.com", "/app/customer", "/bureaux", None):
			self.assertEqual(bureau_page.safe_redirect(target), "/bureau")

	def test_retour_jamais_vers_la_connexion(self):
		self.assertEqual(bureau_page.safe_redirect("/bureau/connexion?redirect-to=/bureau"), "/bureau")

	def test_visiteur_envoye_vers_la_connexion(self):
		self.assertEqual(self.open_page("/bureau", "Guest"), "/bureau/connexion")

	def test_visiteur_garde_la_page_demandee(self):
		self.assertEqual(
			self.open_page("/bureau/ticket/TC-1", "Guest"), "/bureau/connexion?redirect-to=/bureau/ticket/TC-1"
		)

	def test_visiteur_recoit_la_page_de_connexion(self):
		self.assertIsNone(self.open_page("/bureau/connexion", "Guest", "redirect-to=/bureau/clients"))

	def test_utilisateur_connecte_quitte_la_connexion(self):
		self.assertEqual(self.open_page("/bureau/connexion", "Administrator", "redirect-to=/bureau/clients"), "/bureau/clients")


class TestArticles(FrappeTestCase):
	"""Liste, fiche, création et modification des articles du poste de bureau."""

	def setUp(self):
		frappe.set_user("Administrator")
		frappe.db.savepoint("test_articles")
		self.client = frappe.db.get_value("Customer", {"disabled": 0}, "name")
		self.groupe = frappe.db.get_value("Item Group", {"name": ["!=", bureau_articles.ROOT_ITEM_GROUP]}, "name")

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.rollback(save_point="test_articles")

	def _create(self, **changes):
		values = {"designation": f"zzz test {frappe.generate_hash(length=8)}", "client": self.client, "procede": "Offset", "groupe": self.groupe}
		values.update(changes)
		return bureau_articles.create_article(values)["name"]

	def test_libelles_selon_le_procede(self):
		offset = {"custom_procédé": "Offset", "custom_support": "BBTB", "custom_grammage": "275", "custom_cotations_article": "100x200x34"}
		self.assertEqual(bureau_articles.support_label(offset), "BBTB 275 g")
		self.assertEqual(bureau_articles.format_label(offset), "100×200×34")
		flexo = {"custom_procédé": "Flexo", "custom_support": "BBTB", "custom_type_support": "BOPP Transparent", "custom_epaisseur": "30µ", "custom_dimensions_h_x_l": "150x220"}
		self.assertEqual(bureau_articles.support_label(flexo), "BOPP Transparent 30µ")
		self.assertEqual(bureau_articles.format_label(flexo), "150×220")
		self.assertEqual(bureau_articles.format_label({"custom_procédé": "Salle Blanche Pharma", "custom_laize": "670 mm"}), "Laize 670")
		self.assertIsNone(bureau_articles.support_label({"custom_procédé": "Offset"}))

	def test_cree_un_article_client_avec_son_code(self):
		name = self._create(fiche={"custom_support": frappe.db.get_value("Type Papier", {}, "name")})
		self.assertTrue(name.startswith(f"{self.client}-"))
		article = bureau_articles.get_article(name)
		self.assertEqual(article["designation"], article["designation"].upper())
		self.assertEqual(article["client"], self.client)
		self.assertEqual(article["procede"], "Offset")
		self.assertIsNone(article["bat"])
		self.assertEqual(article["tickets"], [])

	def test_refuse_un_doublon_et_un_champ_obligatoire_absent(self):
		self._create(designation="zzz doublon bureau")
		with self.assertRaises(frappe.ValidationError):
			self._create(designation="ZZZ DOUBLON BUREAU")
		with self.assertRaises(frappe.ValidationError):
			bureau_articles.create_article({"designation": "zzz sans client", "procede": "Offset", "groupe": self.groupe})
		with self.assertRaises(frappe.ValidationError):
			self._create(procede="Inconnu")

	def test_article_general_sans_client_ni_procede(self):
		name = bureau_articles.create_article({"type": "Général", "designation": f"zzz matiere {frappe.generate_hash(length=8)}", "groupe": self.groupe})["name"]
		article = bureau_articles.get_article(name)
		self.assertEqual(article["type"], "Général")
		self.assertIsNone(article["client"])
		self.assertIsNone(article["procede"])
		self.assertNotIn(name, bureau_articles.get_articles(view="offset", page_length=500)["names"])
		self.assertIn(name, bureau_articles.get_articles(view="general", page_length=500)["names"])
		self.assertNotIn(name, bureau_articles.get_articles(view="sans_bat", page_length=500)["names"])

	def test_vues_filtres_et_recherche(self):
		designation = f"zzz vue {frappe.generate_hash(length=8)}"
		name = self._create(designation=designation, procede="Flexo")
		result = bureau_articles.get_articles(view="flexo", search=designation, page_length=20)
		self.assertEqual(result["names"], [name])
		self.assertEqual(result["counts"]["flexo"], 1)
		self.assertEqual(result["counts"]["offset"], 0)
		self.assertEqual(result["counts"]["sans_bat"], 1)
		self.assertEqual(bureau_articles.get_articles(view="offset", search=designation)["total"], 0)
		conditions = [{"field": "procede", "op": "est", "value": "Flexo"}]
		self.assertIn(name, bureau_articles.get_articles(conditions=conditions, page_length=500)["names"])
		conditions = [{"field": "procede", "op": "nest", "value": "Flexo"}]
		self.assertNotIn(name, bureau_articles.get_articles(conditions=conditions, page_length=500)["names"])
		customer_name = frappe.db.get_value("Customer", self.client, "customer_name")
		self.assertIn(name, bureau_articles.get_articles(search=customer_name, page_length=500)["names"])
		with self.assertRaises(frappe.ValidationError):
			bureau_articles.get_articles(view="inconnue")

	def test_tri_garde_les_vides_a_la_fin(self):
		rows = [{"designation": "B", "commande": None}, {"designation": "A", "commande": "2026-01-01"}, {"designation": "C", "commande": "2026-02-01"}]
		self.assertEqual([row["designation"] for row in bureau_articles.order_articles(rows, "commande", "asc")], ["A", "C", "B"])
		self.assertEqual([row["designation"] for row in bureau_articles.order_articles(rows, "commande", "desc")], ["C", "A", "B"])
		self.assertEqual([row["designation"] for row in bureau_articles.order_articles(rows)], ["A", "B", "C"])

	def test_ecart_entre_bat_valide_et_maquette_active(self):
		maquettes = [{"name": "MAQ-V2", "status": "Version Activée"}, {"name": "MAQ-V1", "status": "Obsolète"}]
		bat = {"name": "BAT-1", "status": "BAT-P Validé", "maquette": "MAQ-V1"}
		self.assertEqual(bureau_articles.bat_gap([bat], maquettes), {"bat": "BAT-1", "maquette_bat": "MAQ-V1", "maquette_active": "MAQ-V2"})
		self.assertIsNone(bureau_articles.bat_gap([{**bat, "maquette": "MAQ-V2"}], maquettes))
		self.assertIsNone(bureau_articles.bat_gap([{**bat, "maquette": None}], maquettes))
		self.assertIsNone(bureau_articles.bat_gap([{**bat, "status": "Obsolète"}], maquettes))
		self.assertIsNone(bureau_articles.bat_gap([bat], [{"name": "MAQ-V1", "status": "Obsolète"}]))

	def test_modification_et_version(self):
		name = self._create()
		article = bureau_articles.get_article(name)
		updated = bureau_articles.update_article(name, article["modified"], {"reference": "H200", "consommation": "240000", "fiche": {"custom_nombre_de_poses": "8", "custom_acrylique": "1"}})
		self.assertEqual(updated["reference"], "H200")
		self.assertEqual(updated["consommation"], 240000)
		self.assertEqual(updated["fiche"]["custom_nombre_de_poses"], 8)
		self.assertEqual(updated["fiche"]["custom_acrylique"], 1)
		with self.assertRaises(frappe.TimestampMismatchError):
			bureau_articles.update_article(name, article["modified"], {"reference": "H300"})
		with self.assertRaises(frappe.ValidationError):
			bureau_articles.update_article(name, None, {"fiche": {"item_group": "Produits"}})
		with self.assertRaises(frappe.ValidationError):
			bureau_articles.update_article(name, None, {"fiche": {"custom_pelliculage": "Inconnu"}})

	def test_fichier_doit_etre_joint_a_l_article(self):
		name = self._create()
		with self.assertRaises(frappe.ValidationError):
			bureau_articles.set_article_file(name, None, "fiche_technique", "/private/files/ailleurs.pdf")
		with self.assertRaises(frappe.ValidationError):
			bureau_articles.set_article_file(name, None, "inconnue", "/private/files/ailleurs.pdf")

	def test_article_compose_et_sous_article(self):
		name = self._create()
		article = bureau_articles.get_article(name)
		self.assertEqual(bureau_articles.make_composed(name, article["modified"])["compose"], 1)
		result = bureau_articles.add_sous_article(name, "cale", 2)
		self.assertEqual(result["name"], f"{name}-1")
		self.assertEqual([(row["name"], row["quantite"]) for row in result["article"]["sous_articles"]], [(result["name"], 2.0)])
		child = bureau_articles.get_article(result["name"])
		self.assertEqual(child["parent"], name)
		self.assertEqual(child["sous_article"], 1)
		with self.assertRaises(frappe.ValidationError):
			bureau_articles.make_composed(result["name"], None)

	def test_tags_et_commentaires(self):
		name = self._create()
		article = bureau_articles.get_article(name)
		self.assertEqual(bureau_bulk.add_doc_tag("Item", name, article["modified"], "Saisonnier")["tags"], ["Saisonnier"])
		self.assertEqual(bureau_articles.add_article_comment(name, "À vérifier")["comment_count"], 1)
		self.assertEqual(bureau_articles.get_article(name)["comments"]["count"], 1)

	def test_refus_hors_du_poste(self):
		name = self._create()
		frappe.set_user("Guest")
		for call in (lambda: bureau_articles.get_articles(), lambda: bureau_articles.get_article(name), lambda: bureau_articles.get_article_options(), lambda: bureau_articles.create_article({})):
			with self.assertRaises(frappe.PermissionError):
				call()
