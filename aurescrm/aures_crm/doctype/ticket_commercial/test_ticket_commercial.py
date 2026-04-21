# Copyright (c) 2025, Medigo and Contributors
# See license.txt

from frappe.tests.utils import FrappeTestCase

from aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial import _urgence_motif_plain


class TestTicketCommercialUrgenceHelpers(FrappeTestCase):
    """Tests ciblés sur les utilitaires d'urgence (sans dépendre de données métier complètes)."""

    def test_urgence_motif_plain_strips_html(self):
        html = "<p>Hello <b>world</b></p>"
        self.assertEqual(_urgence_motif_plain(html), "Hello world")

    def test_urgence_motif_plain_truncates_long_text(self):
        long_plain = "x" * 900
        html = f"<p>{long_plain}</p>"
        out = _urgence_motif_plain(html, max_len=100)
        self.assertEqual(len(out), 100)
        self.assertTrue(out.endswith("…"))
