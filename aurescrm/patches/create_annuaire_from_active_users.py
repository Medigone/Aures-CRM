# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""
Patch de migration: creer les fiches Annuaire Interne a partir des User actifs.
Execution idempotente (ne cree pas de doublons).
"""

import frappe


def execute():
    if not frappe.db.exists("DocType", "Annuaire Interne"):
        frappe.log_error(
            "DocType 'Annuaire Interne' n'existe pas",
            "Migration Annuaire Interne",
        )
        return

    users = frappe.get_all(
        "User",
        filters=[
            ["enabled", "=", 1],
            ["name", "not in", ["Guest", "Administrator"]],
        ],
        fields=["name", "full_name", "email", "mobile_no", "phone"],
    )

    if not users:
        frappe.logger("patches").info("Aucun User actif a migrer vers l'annuaire")
        return

    created = 0
    skipped = 0
    errors = []

    for user in users:
        if frappe.db.exists("Annuaire Interne", {"user": user.name}):
            skipped += 1
            continue

        if user.email and frappe.db.exists("Annuaire Interne", {"email": user.email}):
            skipped += 1
            errors.append(f"{user.name}: email deja utilise ({user.email})")
            continue

        full_name = user.full_name or user.email or user.name
        mobile = user.mobile_no or user.phone

        try:
            annuaire = frappe.get_doc(
                {
                    "doctype": "Annuaire Interne",
                    "full_name": full_name,
                    "user": user.name,
                    "email": user.email,
                    "mobile": mobile,
                    "actif": 1,
                }
            )
            annuaire.insert(ignore_permissions=True)
            created += 1
        except Exception as exc:
            errors.append(f"{user.name}: {str(exc)[:120]}")

    frappe.db.commit()

    log_message = f"""
Migration Annuaire Interne terminee:
- Users actifs: {len(users)}
- Crees: {created}
- Ignores: {skipped}
- Erreurs: {len(errors)}
"""

    if errors:
        log_message += "\nDetail des erreurs:\n" + "\n".join(errors[:20])
        if len(errors) > 20:
            log_message += f"\n... et {len(errors) - 20} autres erreurs"

    frappe.logger("patches").info(log_message)
    if errors:
        frappe.log_error(log_message, "Migration Annuaire Interne - Erreurs")
