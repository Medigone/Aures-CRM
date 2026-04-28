# Copyright (c) 2026, Medigo and Contributors
# See license.txt

from frappe.tests.utils import FrappeTestCase

from aurescrm.aures_crm.doctype.dossier_fabrication.dossier_fabrication import (
	_pick_feasibility_study,
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
