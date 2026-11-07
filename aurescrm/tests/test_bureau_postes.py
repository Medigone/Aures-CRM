# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
import json
from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from aurescrm.api import bureau, bureau_clients, bureau_demandes, bureau_etudes, bureau_etudes_accueil, bureau_postes


class TestPostes(FrappeTestCase):
	def _keys(self, *roles):
		with patch("frappe.get_roles", return_value=list(roles)):
			return [poste["key"] for poste in bureau_postes.get_postes("x@example.com")]

	def test_invite_sans_poste(self):
		self.assertEqual(bureau_postes.get_postes("Guest"), [])
		self.assertEqual(bureau_postes.get_droits("Guest"), {})

	def test_roles_back_office(self):
		for role in ("Administrateur Ventes", "Chargé Devis", "Responsable Devis"):
			self.assertEqual(self._keys(role), ["back_office"])

	def test_acces_complet_voit_les_postes_ouverts(self):
		self.assertEqual(self._keys("System Manager"), ["back_office", "etude"])

	def test_poste_ouvert_compte_ses_roles(self):
		self.assertEqual(self._keys("Étude Flexo"), ["etude"])
		self.assertEqual(self._keys("Administrateur Ventes", "Étude Flexo"), ["back_office", "etude"])
		with patch("frappe.get_roles", return_value=["Chargé Étude Faisabilité"]):
			self.assertTrue(bureau.can_access_bureau("x@example.com"))

	def test_poste_ferme_ne_compte_pas(self):
		etude = {**bureau_postes.POSTES["etude"], "ouvert": False}
		with patch.dict(bureau_postes.POSTES, {"etude": etude}):
			self.assertEqual(self._keys("Étude Flexo"), [])

	def test_droits_de_l_administrateur(self):
		droits = bureau_postes.get_droits("Administrator")
		self.assertEqual(set(droits), set(bureau_postes.DOCTYPES_INTERFACE))
		self.assertTrue(all(droit["read"] for droit in droits.values()))


class TestDroitsEtude(FrappeTestCase):
	def _fixture(self, name):
		with open(frappe.get_app_path("aurescrm", "fixtures", name), encoding="utf-8") as handle:
			return json.load(handle)

	def test_fixture_responsable_lit_le_referentiel(self):
		rows = [row for row in self._fixture("custom_docperm.json") if row["role"] == "Responsable Étude Faisabilité" and row["parent"] in ("Customer", "Item")]
		self.assertEqual(sorted(row["parent"] for row in rows), ["Customer", "Item"])
		self.assertTrue(all(row["read"] == 1 and row["write"] == 0 and row["create"] == 0 for row in rows))

	def test_fixture_workflow_flexo(self):
		workflow = next(row for row in self._fixture("workflow.json") if row["name"] == "Etude Faisabilite Flexo")
		self.assertEqual({row["allowed"] for row in workflow["transitions"]}, {"Étude Flexo"})

	def test_sans_droit_pas_de_solde(self):
		with patch.object(bureau_clients, "_readable", return_value=False):
			self.assertEqual(bureau_clients._soldes(), {})
			self.assertEqual(bureau_clients._last_visits(), {})
			self.assertEqual(bureau_clients._open_tickets(), {})
			self.assertEqual(bureau_clients._tickets("CLI-X"), [])

	def test_etudes_d_une_demande_selon_le_droit(self):
		with patch.object(bureau_demandes.frappe, "has_permission", return_value=False), patch.object(bureau_demandes.frappe, "get_all", side_effect=AssertionError("lecture sans droit")):
			self.assertEqual(bureau_demandes._etudes("DF-X"), [])


class TestEtudes(FrappeTestCase):
	def _row(self, name, status="En étude", urgence="U0", echeance=None, creation="2026-01-01"):
		return {"name": name, "status": status, "urgence": urgence, "echeance": echeance, "creation": creation, "retard": False}

	def test_retard_seulement_sur_une_etude_ouverte(self):
		self.assertTrue(bureau_etudes.is_late("En étude", "2026-01-01", "2026-01-02"))
		self.assertFalse(bureau_etudes.is_late("En étude", "2026-01-02", "2026-01-02"))
		self.assertFalse(bureau_etudes.is_late("Réalisable", "2026-01-01", "2026-01-02"))
		self.assertFalse(bureau_etudes.is_late("En étude", None, "2026-01-02"))

	def test_ordre_par_defaut(self):
		rows = [
			self._row("C", status="Réalisable", creation="2026-03-01"),
			self._row("D", status="Annulée", creation="2026-04-01"),
			self._row("B", urgence="U0", echeance="2026-01-01"),
			self._row("A", urgence="U3", echeance="2026-06-01"),
		]
		self.assertEqual([row["name"] for row in bureau_etudes.order_etudes(rows)], ["A", "B", "D", "C"])

	def test_tri_numerique_et_valeur_vide_a_la_fin(self):
		rows = [{"name": "A", "quantite": 9}, {"name": "B", "quantite": 100}, {"name": "C", "quantite": ""}]
		self.assertEqual([row["name"] for row in bureau_etudes.order_etudes(rows, "quantite", "desc")], ["B", "A", "C"])

	def test_filtre_reecrit_pour_l_autre_document(self):
		filters = [[bureau_etudes.OFFSET, "status", "=", "En étude"]]
		self.assertEqual(bureau_etudes._filters_for(filters, bureau_etudes.FLEXO), [[bureau_etudes.FLEXO, "status", "=", "En étude"]])
		self.assertIsNone(bureau_etudes._filters_for([[bureau_etudes.OFFSET, "imposition", "=", "X"]], bureau_etudes.FLEXO))

	def test_administrateur_voit_les_deux_documents(self):
		response = bureau_etudes.get_etudes(page_length=500)
		self.assertEqual({row["doctype"] for row in response["etudes"]} - set(bureau_etudes.ETUDES), set())
		self.assertEqual(response["counts"]["all"], response["total"])
		self.assertGreaterEqual(response["counts"]["traiter"], response["counts"]["retard"])

	def test_vue_mes_etudes_seulement_ouvertes(self):
		self.assertTrue(bureau_etudes.in_view("mine", {"mine": True, "status": "En étude"}))
		self.assertFalse(bureau_etudes.in_view("mine", {"mine": True, "status": "Réalisable"}))
		self.assertFalse(bureau_etudes.in_view("mine", {"mine": False, "status": "En étude"}))

	def test_champs_d_une_condition(self):
		self.assertEqual(bureau_etudes.condition_fields("doc.trace and doc.imposition and doc.taux_chutes"), ["trace", "imposition", "taux_chutes"])
		self.assertEqual(bureau_etudes.condition_fields(""), [])

	def test_sans_droit_pas_de_liste(self):
		with patch.object(bureau_etudes, "readable_doctypes", return_value=[]), self.assertRaises(frappe.PermissionError):
			bureau_etudes.get_etudes()


class TestAccueilEtude(FrappeTestCase):
	def _transition(self, state, action, allowed, condition=None):
		return frappe._dict(state=state, action=action, allowed=allowed, condition=condition)

	def test_conclure_exige_la_condition_du_workflow(self):
		transitions = [self._transition("En étude", "Réalisable", "R", "doc.trace and doc.imposition and doc.taux_chutes > 0")]
		self.assertEqual(bureau_etudes_accueil.required_fields(bureau_etudes.OFFSET, transitions), ["trace", "imposition", "taux_chutes"])

	def test_sans_condition_toutes_les_pieces_comptent(self):
		self.assertEqual(bureau_etudes_accueil.required_fields(bureau_etudes.FLEXO, []), ["trace", "cliche"])

	def test_groupes_de_la_file(self):
		group = bureau_etudes_accueil.queue_group
		self.assertEqual(group("Nouveau", "U3", ["trace"]), "urgent")
		self.assertEqual(group("Nouveau", "U0", ["trace"]), "start")
		self.assertEqual(group("En étude", "U1", ["trace"]), "missing")
		self.assertEqual(group("En étude", "U1", []), "ready")

	def test_action_selon_le_role(self):
		action = bureau_etudes_accueil.row_action
		responsable = {("En étude", "Réalisable")}
		self.assertEqual(action("Nouveau", [], {("Nouveau", "Démarrer")}, True)["kind"], "run")
		self.assertEqual(action("Nouveau", [], set(), True)["kind"], "open")
		self.assertEqual(action("En étude", [], responsable, True)["label"], "Conclure")
		self.assertEqual(action("En étude", [], set(), True)["label"], "Ouvrir")
		self.assertEqual(action("En étude", ["trace"], responsable, True)["label"], "Compléter")
		self.assertEqual(action("En étude", ["trace"], set(), False)["label"], "Ouvrir")

	def test_accueil_limite_aux_documents_lisibles(self):
		with patch.object(bureau_etudes, "readable_doctypes", return_value=[bureau_etudes.FLEXO]), patch.object(bureau_etudes_accueil, "readable_doctypes", return_value=[bureau_etudes.FLEXO]):
			response = bureau_etudes_accueil.get_etude_accueil()
		self.assertEqual([stage["key"] for stage in response["stages"]], ["etudes_flexo"])
		self.assertEqual({row["doctype"] for group in response["queue"] for row in group["rows"]} - {bureau_etudes.FLEXO}, set())
		self.assertFalse(response["both"])
