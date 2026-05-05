# Copyright (c) 2025, Medigo and Contributors
# See license.txt

from frappe.tests.utils import FrappeTestCase

from aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial import (
    ALLOWED_DECISION_RAPPROCHEMENT,
    STATUT_CREANCE_AUTORISES_COMMANDE,
    STATUT_CREANCE_DEFAULT,
    _urgence_motif_plain,
    is_creance_validated_for_sales_order,
)


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


class TestTicketCommercialRapprochementBc(FrappeTestCase):
    """Décisions de rapprochement BC : ensemble des valeurs attendues par l'API."""

    def test_allowed_decision_rapprochement_options(self):
        for label in (
            "",
            "À définir",
            "Devis retenu pour commande",
            "Nouvelle demande de faisabilité",
            "Aucun candidat pertinent",
        ):
            self.assertIn(label, ALLOWED_DECISION_RAPPROCHEMENT)


class TestTicketCommercialCreanceHelpers(FrappeTestCase):
    """Règle minimale : seule une créance validée permet de commander."""

    def test_creance_sales_order_allowed_statuses(self):
        for statut in STATUT_CREANCE_AUTORISES_COMMANDE:
            self.assertTrue(is_creance_validated_for_sales_order(statut))

    def test_creance_sales_order_blocked_by_default(self):
        self.assertFalse(is_creance_validated_for_sales_order(STATUT_CREANCE_DEFAULT))
        self.assertFalse(is_creance_validated_for_sales_order("Bloquée"))
