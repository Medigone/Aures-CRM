# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
import json
from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from aurescrm.api import bureau, bureau_clients, bureau_demandes, bureau_postes


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
		self.assertEqual(self._keys("System Manager"), ["back_office"])

	def test_poste_ferme_n_ouvre_pas_le_bureau(self):
		self.assertEqual(self._keys("Chargé Étude Faisabilité"), [])
		with patch("frappe.get_roles", return_value=["Chargé Étude Faisabilité"]):
			self.assertFalse(bureau.can_access_bureau("x@example.com"))

	def test_poste_ouvert_compte_ses_roles(self):
		etude = {**bureau_postes.POSTES["etude"], "ouvert": True}
		with patch.dict(bureau_postes.POSTES, {"etude": etude}):
			self.assertEqual(self._keys("Étude Flexo"), ["etude"])
			self.assertEqual(self._keys("Administrateur Ventes", "Étude Flexo"), ["back_office", "etude"])
			self.assertEqual(self._keys("System Manager"), ["back_office", "etude"])

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
