import frappe


def create_annuaire_for_user(doc, method):
    if not frappe.db.exists("DocType", "Annuaire Interne"):
        return

    if doc.name in ("Guest", "Administrator"):
        return

    if not doc.enabled:
        return

    if frappe.db.exists("Annuaire Interne", {"user": doc.name}):
        return

    if doc.email and frappe.db.exists("Annuaire Interne", {"email": doc.email}):
        return

    full_name = doc.full_name or doc.email or doc.name
    mobile = doc.mobile_no or doc.phone

    annuaire = frappe.get_doc(
        {
            "doctype": "Annuaire Interne",
            "full_name": full_name,
            "user": doc.name,
            "email": doc.email,
            "mobile": mobile,
            "actif": 1,
        }
    )
    annuaire.insert(ignore_permissions=True)


def disable_annuaire_on_user_disable(doc, method):
    if not frappe.db.exists("DocType", "Annuaire Interne"):
        return

    if doc.name in ("Guest", "Administrator"):
        return

    previous = doc.get_doc_before_save()
    if not previous:
        return

    was_enabled = getattr(previous, "enabled", 1)
    is_enabled = doc.enabled

    if was_enabled and not is_enabled:
        frappe.db.set_value(
            "Annuaire Interne",
            {"user": doc.name},
            {"actif": 0},
            update_modified=True,
        )
