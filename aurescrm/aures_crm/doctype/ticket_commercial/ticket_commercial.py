# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.model.naming import make_autoname
from frappe.utils import today


class TicketCommercial(Document):
    def autoname(self):
        """Génère le nom du ticket au format TC-YY-MM-#####"""
        self.name = make_autoname("TC-.YY.-.MM.-.#####")

    def before_insert(self):
        """Définit les valeurs par défaut avant l'insertion"""
        if not self.commercial:
            self.commercial = frappe.session.user

    def validate(self):
        """Validations avant sauvegarde"""
        self.validate_required_fields()
        self.set_defaults()

    def validate_required_fields(self):
        """Vérifie les champs requis"""
        if not self.customer:
            frappe.throw(_("Le champ Client est obligatoire"))
        
        if not self.request_type:
            frappe.throw(_("Le champ Type de demande est obligatoire"))
        
        if not self.priority:
            frappe.throw(_("Le champ Priorité est obligatoire"))

    def set_defaults(self):
        """Définit les valeurs par défaut"""
        if not self.owner_user:
            self.owner_user = frappe.session.user
        
        if not self.creation_date:
            self.creation_date = today()
        
        # Définir le commercial avec l'utilisateur créateur si non renseigné
        if not self.commercial:
            self.commercial = frappe.session.user


@frappe.whitelist()
def update_assigne_a(docname, assigne_user):
    """Met à jour les champs assigne_a et assigne_a_nom pour un Ticket Commercial."""
    try:
        full_name = frappe.db.get_value("User", assigne_user, "full_name")
        if not full_name:
            full_name = assigne_user

        frappe.db.set_value("Ticket Commercial", docname, {
            "assigne_a": assigne_user,
            "assigne_a_nom": full_name
        }, update_modified=False)

        frappe.db.commit()
        return {"status": "success", "message": "Assignation mise à jour", "full_name": full_name}
    except Exception as e:
        frappe.log_error(f"Erreur update_assigne_a pour {docname}: {e}", frappe.get_traceback())
        frappe.db.rollback()
        return {"status": "error", "message": str(e)}


@frappe.whitelist()
def get_admin_ventes_users(doctype, txt, searchfield, start, page_len, filters):
    """Retourne les utilisateurs actifs ayant le rôle Administrateur Ventes."""
    users_with_role = frappe.get_all(
        "Has Role",
        filters={"role": "Administrateur Ventes", "parenttype": "User"},
        fields=["parent"]
    )
    user_list = [d.parent for d in users_with_role]

    if not user_list:
        return []

    search_condition = ""
    if txt:
        search_condition = "AND (`name` LIKE %(txt)s OR `full_name` LIKE %(txt)s)"

    return frappe.db.sql(
        f"""
            SELECT `name`, `full_name` FROM `tabUser`
            WHERE `name` IN %(user_list)s
            AND `enabled` = 1
            {search_condition}
            ORDER BY `full_name`
            LIMIT %(start)s, %(page_len)s
        """,
        {
            "user_list": tuple(user_list),
            "txt": f"%{txt}%",
            "start": start,
            "page_len": page_len
        },
        as_list=True
    )
