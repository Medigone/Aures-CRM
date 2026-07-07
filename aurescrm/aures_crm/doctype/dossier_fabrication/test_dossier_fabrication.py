# Copyright (c) 2026, Medigo and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from aurescrm.aures_crm.doctype.dossier_fabrication.dossier_fabrication import (
	_pick_feasibility_study,
	build_dossier_apercu_context,
)


class TestDossierFabrication(FrappeTestCase):
	def test_pick_feasibility_study_requires_trace_imposition(self):
		self.assertIsNone(_pick_feasibility_study([{"name": "X", "trace": None, "imposition": "IMP"}]))
		chosen = _pick_feasibility_study(
			[{"name": "A", "trace": "T1", "imposition": "I1", "machine_prevue": None}]
		)
		self.assertIsNotNone(chosen)
		self.assertEqual(chosen["trace"], "T1")
		self.assertEqual(chosen["imposition"], "I1")

	def test_build_dossier_apercu_context_without_sales_order(self):
		doc = frappe.get_doc({"doctype": "Dossier Fabrication", "lignes": []})
		ctx = build_dossier_apercu_context(doc)
		self.assertTrue(ctx.get("no_sales_order"))

	def test_build_dossier_apercu_html_renders_template(self):
		from aurescrm.aures_crm.doctype.dossier_fabrication.dossier_fabrication import (
			build_dossier_apercu_html,
		)

		doc = frappe.get_doc(
			{
				"doctype": "Dossier Fabrication",
				"name": "TEST-DF",
				"sales_order": "SO-TEST",
				"lignes": [
					{
						"doctype": "Dossier Fabrication Ligne",
						"article": "ITEM-TEST",
						"quantite_commandee": 100,
						"quantite_programmee": 0,
						"quantite_produite": 0,
						"quantite_restante_a_programmer": 100,
						"quantite_restante_a_produire": 100,
						"statut_article": "À programmer",
					}
				],
			}
		)
		html = build_dossier_apercu_html(doc)
		self.assertIn("dossier-apercu", html)
		self.assertIn("Récapitulatif par article", html)
