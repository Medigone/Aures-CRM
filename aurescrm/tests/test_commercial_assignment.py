# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

"""
Tests unitaires pour le module commercial_assignment.
Exécuter avec: bench --site [site] run-tests --module aurescrm.tests.test_commercial_assignment
"""

import frappe
import unittest
from aurescrm.commercial_assignment import (
    get_current_company,
    get_customer_commercial,
    is_user_commercial_for_customer
)


class TestCommercialAssignment(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        """Configuration initiale des tests"""
        # Créer un Customer de test s'il n'existe pas
        cls.test_customer_name = "_Test Customer Commercial Assignment"
        cls.test_company = frappe.get_all("Company", limit=1, pluck="name")[0] if frappe.get_all("Company", limit=1) else None
        cls.test_user = "Administrator"
        
        if not frappe.db.exists("Customer", cls.test_customer_name):
            customer = frappe.get_doc({
                "doctype": "Customer",
                "customer_name": cls.test_customer_name,
                "customer_type": "Company"
            })
            customer.insert(ignore_permissions=True)
            frappe.db.commit()
    
    @classmethod
    def tearDownClass(cls):
        """Nettoyage après les tests"""
        # Supprimer le Customer de test
        if frappe.db.exists("Customer", cls.test_customer_name):
            frappe.delete_doc("Customer", cls.test_customer_name, force=True)
            frappe.db.commit()
    
    def test_get_current_company_with_explicit_company(self):
        """Test que get_current_company retourne la company explicite si fournie"""
        result = get_current_company("Test Company")
        self.assertEqual(result, "Test Company")
    
    def test_get_current_company_without_company(self):
        """Test que get_current_company retourne la company par défaut de l'utilisateur"""
        # Ce test dépend de la configuration de l'utilisateur
        result = get_current_company()
        # Peut être None ou une company
        self.assertTrue(result is None or isinstance(result, str))
    
    def test_get_customer_commercial_no_assignment(self):
        """Test get_customer_commercial pour un client sans commercial attribué"""
        result = get_customer_commercial(self.test_customer_name)
        
        self.assertIsInstance(result, dict)
        self.assertIn('commercial', result)
        self.assertIn('commercial_name', result)
        self.assertIn('source', result)
        # Pas de commercial attribué, donc source devrait être 'none'
        # (sauf s'il y a un fallback legacy)
    
    def test_get_customer_commercial_with_child_table(self):
        """Test get_customer_commercial avec une attribution dans la table enfant"""
        if not self.test_company:
            self.skipTest("Pas de Company configurée")
        
        # Ajouter une attribution
        customer = frappe.get_doc("Customer", self.test_customer_name)
        customer.append("custom_commercial_assignments", {
            "company": self.test_company,
            "commercial": self.test_user,
            "commercial_name": "Administrator"
        })
        customer.save(ignore_permissions=True)
        frappe.db.commit()
        
        # Tester
        result = get_customer_commercial(self.test_customer_name, self.test_company)
        
        self.assertEqual(result.get('commercial'), self.test_user)
        self.assertEqual(result.get('source'), 'child_table')
        
        # Nettoyer
        customer.reload()
        customer.custom_commercial_assignments = []
        customer.save(ignore_permissions=True)
        frappe.db.commit()
    
    def test_get_customer_commercial_legacy_fallback(self):
        """Test get_customer_commercial avec fallback sur les champs legacy"""
        # Définir le champ legacy
        frappe.db.set_value("Customer", self.test_customer_name, {
            "custom_commercial_attribué": self.test_user,
            "custom_nom_commercial": "Administrator"
        })
        frappe.db.commit()
        
        # Tester avec une company qui n'a pas d'attribution (pour forcer le fallback)
        result = get_customer_commercial(self.test_customer_name, "Nonexistent Company")
        
        self.assertEqual(result.get('commercial'), self.test_user)
        self.assertEqual(result.get('source'), 'legacy')
        
        # Nettoyer
        frappe.db.set_value("Customer", self.test_customer_name, {
            "custom_commercial_attribué": None,
            "custom_nom_commercial": None
        })
        frappe.db.commit()
    
    def test_is_user_commercial_for_customer_no_assignment(self):
        """Test is_user_commercial_for_customer quand pas d'attribution"""
        is_commercial, info = is_user_commercial_for_customer(
            self.test_user, 
            self.test_customer_name
        )
        
        # Pas de commercial attribué = tout le monde peut éditer
        self.assertTrue(is_commercial)
    
    def test_is_user_commercial_for_customer_owner(self):
        """Test is_user_commercial_for_customer quand l'utilisateur est le commercial"""
        if not self.test_company:
            self.skipTest("Pas de Company configurée")
        
        # Ajouter une attribution
        customer = frappe.get_doc("Customer", self.test_customer_name)
        customer.append("custom_commercial_assignments", {
            "company": self.test_company,
            "commercial": self.test_user,
            "commercial_name": "Administrator"
        })
        customer.save(ignore_permissions=True)
        frappe.db.commit()
        
        # Tester
        is_commercial, info = is_user_commercial_for_customer(
            self.test_user, 
            self.test_customer_name,
            self.test_company
        )
        
        self.assertTrue(is_commercial)
        self.assertEqual(info.get('commercial'), self.test_user)
        
        # Nettoyer
        customer.reload()
        customer.custom_commercial_assignments = []
        customer.save(ignore_permissions=True)
        frappe.db.commit()
    
    def test_is_user_commercial_for_customer_other_user(self):
        """Test is_user_commercial_for_customer quand l'utilisateur n'est pas le commercial"""
        if not self.test_company:
            self.skipTest("Pas de Company configurée")
        
        # Ajouter une attribution à un autre utilisateur
        customer = frappe.get_doc("Customer", self.test_customer_name)
        customer.append("custom_commercial_assignments", {
            "company": self.test_company,
            "commercial": self.test_user,
            "commercial_name": "Administrator"
        })
        customer.save(ignore_permissions=True)
        frappe.db.commit()
        
        # Tester avec un autre utilisateur
        is_commercial, info = is_user_commercial_for_customer(
            "other_user@example.com", 
            self.test_customer_name,
            self.test_company
        )
        
        self.assertFalse(is_commercial)
        
        # Nettoyer
        customer.reload()
        customer.custom_commercial_assignments = []
        customer.save(ignore_permissions=True)
        frappe.db.commit()


def run_tests():
    """Fonction pour exécuter les tests manuellement"""
    suite = unittest.TestLoader().loadTestsFromTestCase(TestCommercialAssignment)
    unittest.TextTestRunner(verbosity=2).run(suite)


if __name__ == "__main__":
    run_tests()

