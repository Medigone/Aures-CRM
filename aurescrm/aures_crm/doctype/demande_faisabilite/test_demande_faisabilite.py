# Copyright (c) 2025, Medigo and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase


class TestDemandeFaisabilite(FrappeTestCase):
	def test_can_generate_etudes(self):
		"""Test que la méthode can_generate_etudes fonctionne correctement"""
		# Créer une demande de test
		demande = frappe.new_doc("Demande Faisabilite")
		demande.client = "Test Client"
		demande.date_livraison = "2025-12-31"
		
		# Test avec statut initial "Brouillon" - devrait retourner True
		demande.status = "Brouillon"
		self.assertTrue(demande.can_generate_etudes(), "Le statut initial 'Brouillon' devrait permettre de générer des études")
		
		# Test avec tous les autres statuts - devraient retourner False
		invalid_statuses = [
			"Confirmée", "En Cours", "Partiellement Finalisée", 
			"Finalisée", "Devis Établis", "Commandé", "Fermée", "Annulée"
		]
		
		for status in invalid_statuses:
			demande.status = status
			self.assertFalse(demande.can_generate_etudes(), 
				f"Le statut '{status}' ne devrait pas permettre de générer des études")
	
	def test_generate_etude_faisabilite_validation(self):
		"""Test que la fonction generate_etude_faisabilite valide correctement le statut"""
		# Test avec une demande dans un statut invalide
		demande = frappe.new_doc("Demande Faisabilite")
		demande.client = "Test Client"
		demande.date_livraison = "2025-12-31"
		demande.status = "Annulée"
		demande.insert()
		
		# Tenter de générer des études devrait lever une exception
		with self.assertRaises(frappe.ValidationError):
			from aurescrm.aures_crm.doctype.demande_faisabilite.demande_faisabilite import generate_etude_faisabilite
			generate_etude_faisabilite(demande.name)
