import frappe
from frappe import _
from frappe.model.document import Document


class AnnuaireInterne(Document):
    def validate(self):
        self._validate_unique_user()
        self._validate_unique_email()

    def _validate_unique_user(self):
        if not self.user:
            return

        exists = frappe.db.exists(
            "Annuaire Interne",
            {
                "user": self.user,
                "name": ["!=", self.name],
            },
        )
        if exists:
            frappe.throw(
                _("Une fiche d'annuaire existe deja pour cet utilisateur."),
                frappe.DuplicateEntryError,
            )

    def _validate_unique_email(self):
        if not self.email:
            return

        exists = frappe.db.exists(
            "Annuaire Interne",
            {
                "email": self.email,
                "name": ["!=", self.name],
            },
        )
        if exists:
            frappe.throw(
                _("Une fiche d'annuaire existe deja avec cet email."),
                frappe.DuplicateEntryError,
            )
