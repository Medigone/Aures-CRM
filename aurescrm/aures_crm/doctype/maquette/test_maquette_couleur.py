# -*- coding: utf-8 -*-
"""
Tests unitaires pour la gestion des couleurs dans le Doctype Maquette.
"""

import frappe
import unittest
from frappe.tests.utils import FrappeTestCase


class TestMaquetteCouleur(FrappeTestCase):
    """
    Suite de tests pour la gestion des couleurs CMJN et Pantone dans les Maquettes.
    """

    def setUp(self):
        """
        Configuration initiale avant chaque test.
        """
        # Créer un client de test si nécessaire
        if not frappe.db.exists("Customer", "Test Client Maquette"):
            customer = frappe.get_doc({
                "doctype": "Customer",
                "customer_name": "Test Client Maquette",
                "customer_type": "Company"
            })
            customer.insert(ignore_permissions=True)
        
        # Créer un article de test si nécessaire
        if not frappe.db.exists("Item", "CLI-TEST-MAQUETTE"):
            item = frappe.get_doc({
                "doctype": "Item",
                "item_code": "CLI-TEST-MAQUETTE",
                "item_name": "Article Test Maquette",
                "item_group": "Products",
                "stock_uom": "Nos"
            })
            item.insert(ignore_permissions=True)

    def tearDown(self):
        """
        Nettoyage après chaque test.
        """
        # Supprimer les maquettes de test créées
        frappe.db.delete("Maquette", {"client": "Test Client Maquette"})
        frappe.db.commit()

    def test_maquette_cmjn_avec_4_canaux(self):
        """
        Test : Création d'une maquette CMJN avec 4 canaux (C, M, J, N).
        Résultat attendu : La maquette est créée avec succès, compteurs synchronisés.
        """
        maquette = frappe.get_doc({
            "doctype": "Maquette",
            "client": "Test Client Maquette",
            "article": "CLI-TEST-MAQUETTE",
            "mode_couleur": "CMJN",
            "cmjn_details": [
                {"canal": "C", "taux_max_encrage": 95},
                {"canal": "M", "taux_max_encrage": 90},
                {"canal": "J", "taux_max_encrage": 90},
                {"canal": "N", "taux_max_encrage": 95}
            ]
        })
        maquette.insert(ignore_permissions=True)
        
        # Assertions
        self.assertEqual(maquette.mode_couleur, "CMJN")
        self.assertEqual(maquette.nombre_couleurs_process, 4)
        self.assertEqual(maquette.nombre_spot_colors, 0)
        self.assertIn("CMJN (4)", maquette.resume_couleurs)
        
        frappe.db.rollback()

    def test_maquette_cmjn_sans_details_devrait_echouer(self):
        """
        Test : Tentative de créer une maquette CMJN sans aucun détail CMJN.
        Résultat attendu : Erreur bloquante (frappe.throw).
        """
        maquette = frappe.get_doc({
            "doctype": "Maquette",
            "client": "Test Client Maquette",
            "article": "CLI-TEST-MAQUETTE",
            "mode_couleur": "CMJN",
            "cmjn_details": []
        })
        
        # On s'attend à une exception
        with self.assertRaises(frappe.exceptions.ValidationError):
            maquette.insert(ignore_permissions=True)
        
        frappe.db.rollback()

    def test_maquette_pantone_uniquement_avec_2_spots(self):
        """
        Test : Création d'une maquette Pantone uniquement avec 2 couleurs spot.
        Résultat attendu : La maquette est créée avec succès, compteurs synchronisés.
        """
        maquette = frappe.get_doc({
            "doctype": "Maquette",
            "client": "Test Client Maquette",
            "article": "CLI-TEST-MAQUETTE",
            "mode_couleur": "Pantone uniquement",
            "spot_colors": [
                {
                    "code_spot": "PANTONE 186 C",
                    "nom_couleur": "Rouge vif"
                },
                {
                    "code_spot": "PANTONE 877 C",
                    "nom_couleur": "Argent métallique"
                }
            ]
        })
        maquette.insert(ignore_permissions=True)
        
        # Assertions
        self.assertEqual(maquette.mode_couleur, "Pantone uniquement")
        self.assertEqual(maquette.nombre_couleurs_process, 0)
        self.assertEqual(maquette.nombre_spot_colors, 2)
        self.assertIn("Pantone (2)", maquette.resume_couleurs)
        self.assertIn("PANTONE 186 C", maquette.resume_couleurs)
        self.assertIn("PANTONE 877 C", maquette.resume_couleurs)
        
        frappe.db.rollback()

    def test_maquette_pantone_sans_spot_devrait_echouer(self):
        """
        Test : Tentative de créer une maquette Pantone uniquement sans aucune couleur spot.
        Résultat attendu : Erreur bloquante (frappe.throw).
        """
        maquette = frappe.get_doc({
            "doctype": "Maquette",
            "client": "Test Client Maquette",
            "article": "CLI-TEST-MAQUETTE",
            "mode_couleur": "Pantone uniquement",
            "spot_colors": []
        })
        
        # On s'attend à une exception
        with self.assertRaises(frappe.exceptions.ValidationError):
            maquette.insert(ignore_permissions=True)
        
        frappe.db.rollback()

    def test_maquette_cmjn_plus_pantone(self):
        """
        Test : Création d'une maquette CMJN + Pantone avec 4 canaux CMJN et 1 spot.
        Résultat attendu : La maquette est créée avec succès, compteurs synchronisés.
        """
        maquette = frappe.get_doc({
            "doctype": "Maquette",
            "client": "Test Client Maquette",
            "article": "CLI-TEST-MAQUETTE",
            "mode_couleur": "CMJN + Pantone",
            "cmjn_details": [
                {"canal": "C"},
                {"canal": "M"},
                {"canal": "J"},
                {"canal": "N"}
            ],
            "spot_colors": [
                {
                    "code_spot": "PANTONE 877 C",
                    "nom_couleur": "Vernis argent"
                }
            ]
        })
        maquette.insert(ignore_permissions=True)
        
        # Assertions
        self.assertEqual(maquette.mode_couleur, "CMJN + Pantone")
        self.assertEqual(maquette.nombre_couleurs_process, 4)
        self.assertEqual(maquette.nombre_spot_colors, 1)
        self.assertIn("CMJN (4)", maquette.resume_couleurs)
        self.assertIn("Pantone (1)", maquette.resume_couleurs)
        self.assertIn("PANTONE 877 C", maquette.resume_couleurs)
        
        frappe.db.rollback()

    def test_nettoyage_code_spot(self):
        """
        Test : Vérifier que les codes spot sont nettoyés (majuscules, sans espaces superflus).
        Résultat attendu : Les codes sont automatiquement normalisés.
        """
        maquette = frappe.get_doc({
            "doctype": "Maquette",
            "client": "Test Client Maquette",
            "article": "CLI-TEST-MAQUETTE",
            "mode_couleur": "Pantone uniquement",
            "spot_colors": [
                {
                    "code_spot": "  pantone 186 c  ",  # Espaces et minuscules
                    "nom_couleur": "Rouge"
                }
            ]
        })
        maquette.insert(ignore_permissions=True)
        
        # Assertions : le code doit être nettoyé
        self.assertEqual(maquette.spot_colors[0].code_spot, "PANTONE 186 C")
        
        frappe.db.rollback()

    def test_resume_couleurs_generation(self):
        """
        Test : Vérifier la génération correcte du résumé couleurs dans différents scénarios.
        """
        # Scénario 1 : CMJN seul
        maquette_cmjn = frappe.get_doc({
            "doctype": "Maquette",
            "client": "Test Client Maquette",
            "article": "CLI-TEST-MAQUETTE",
            "mode_couleur": "CMJN",
            "cmjn_details": [
                {"canal": "C"},
                {"canal": "M"},
                {"canal": "J"}
            ]
        })
        maquette_cmjn.insert(ignore_permissions=True)
        self.assertEqual(maquette_cmjn.resume_couleurs, "CMJN (3)")
        frappe.db.rollback()
        
        # Scénario 2 : Pantone seul avec plusieurs couleurs
        maquette_pantone = frappe.get_doc({
            "doctype": "Maquette",
            "client": "Test Client Maquette",
            "article": "CLI-TEST-MAQUETTE",
            "mode_couleur": "Pantone uniquement",
            "spot_colors": [
                {"code_spot": "P 186 C"},
                {"code_spot": "P 877 C"},
                {"code_spot": "P 123 C"}
            ]
        })
        maquette_pantone.insert(ignore_permissions=True)
        self.assertIn("Pantone (3)", maquette_pantone.resume_couleurs)
        self.assertIn("P 186 C", maquette_pantone.resume_couleurs)
        frappe.db.rollback()

    def test_compteurs_synchronisation(self):
        """
        Test : Vérifier que les compteurs sont bien synchronisés automatiquement.
        """
        maquette = frappe.get_doc({
            "doctype": "Maquette",
            "client": "Test Client Maquette",
            "article": "CLI-TEST-MAQUETTE",
            "mode_couleur": "CMJN + Pantone",
            "cmjn_details": [
                {"canal": "C"},
                {"canal": "M"}
            ],
            "spot_colors": [
                {"code_spot": "P 186 C"},
                {"code_spot": "P 877 C"},
                {"code_spot": "P 123 C"}
            ]
        })
        maquette.insert(ignore_permissions=True)
        
        # Vérifier les compteurs
        self.assertEqual(maquette.nombre_couleurs_process, 2)
        self.assertEqual(maquette.nombre_spot_colors, 3)
        
        frappe.db.rollback()

    def test_profil_icc_et_delta_e(self):
        """
        Test : Vérifier que les champs de contrôle qualité (profil ICC et ΔE) fonctionnent.
        """
        maquette = frappe.get_doc({
            "doctype": "Maquette",
            "client": "Test Client Maquette",
            "article": "CLI-TEST-MAQUETTE",
            "mode_couleur": "CMJN",
            "cmjn_details": [
                {"canal": "C"},
                {"canal": "M"},
                {"canal": "J"},
                {"canal": "N"}
            ],
            "tolerance_delta_e": 2.5
        })
        maquette.insert(ignore_permissions=True)
        
        # Assertions
        self.assertEqual(maquette.tolerance_delta_e, 2.5)
        
        frappe.db.rollback()


def run_tests():
    """
    Fonction utilitaire pour exécuter tous les tests de cette suite.
    """
    unittest.main()


if __name__ == '__main__':
    run_tests()

