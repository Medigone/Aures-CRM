# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe


def execute():
    """
    Données historiques Ticket Commercial :
    - Remet tous les champs d'urgence à l'état « repos » (U0, aucune demande).
    - Remplace request_type « Création » par « Conception » (renommage d'option).
    """
    if not frappe.db.has_table("Ticket Commercial"):
        return

    nb_creation = frappe.db.count("Ticket Commercial", {"request_type": "Création"})

    frappe.db.sql(
        """
        UPDATE `tabTicket Commercial`
        SET
            niveau_urgence = 'U0',
            niveau_urgence_demande = NULL,
            statut_demande_urgence = 'Aucune',
            descr_urgence = NULL,
            urgence_validee_par = NULL,
            urgence_validee_le = NULL,
            commentaire_validation_urgence = NULL,
            request_type = CASE
                WHEN request_type = %(old_type)s THEN %(new_type)s
                ELSE request_type
            END
        """,
        {"old_type": "Création", "new_type": "Conception"},
    )

    frappe.db.commit()

    total = frappe.db.count("Ticket Commercial", {})
    frappe.msgprint(
        frappe._(
            "Patch Ticket Commercial : urgence réinitialisée (U0 / aucune demande) sur {0} ligne(s) ; "
            "« Création » → « Conception » : {1} ligne(s)."
        ).format(total, nb_creation),
        title=frappe._("Migration Ticket Commercial"),
    )
