# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.model.naming import make_autoname
from frappe.utils import cstr, now, strip_html, today
from frappe.utils.html_utils import sanitize_html


ROLE_ADMIN_VENTES = "Administrateur Ventes"
NIVEAU_URGENCE_OPTIONS = ("U0", "U1", "U2", "U3")


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
        self.apply_insert_urgence_guard()
        self.validate_restricted_urgence_fields()

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

        if not self.niveau_urgence:
            self.niveau_urgence = "U0"

        if not self.statut_demande_urgence:
            self.statut_demande_urgence = "Aucune"

    def apply_insert_urgence_guard(self):
        """À la création, les champs urgence ne sont pas modifiables hors rôles privilégiés."""
        if not self.is_new() or _can_bypass_urgence_field_guard():
            return
        self.niveau_urgence = "U0"
        self.niveau_urgence_demande = None
        self.statut_demande_urgence = "Aucune"
        self.descr_urgence = None
        self.urgence_validee_par = None
        self.urgence_validee_le = None
        self.commentaire_validation_urgence = None

    def validate_restricted_urgence_fields(self):
        """Empêche la modification directe des champs urgence hors flux whitelist."""
        if getattr(frappe.flags, "ticket_urgence_whitelist", False):
            return
        if frappe.flags.in_import:
            return
        if self.is_new():
            return

        prev = frappe.db.get_value(
            "Ticket Commercial",
            self.name,
            [
                "niveau_urgence",
                "descr_urgence",
                "niveau_urgence_demande",
                "statut_demande_urgence",
                "urgence_validee_par",
                "urgence_validee_le",
                "commentaire_validation_urgence",
            ],
            as_dict=True,
        )
        if not prev:
            return

        protected = (
            "niveau_urgence",
            "descr_urgence",
            "niveau_urgence_demande",
            "statut_demande_urgence",
            "urgence_validee_par",
            "urgence_validee_le",
            "commentaire_validation_urgence",
        )

        prev_statut = cstr(prev.get("statut_demande_urgence")) or "Aucune"
        if prev_statut == "Validée":
            for field in protected:
                if cstr(self.get(field)) != cstr(prev.get(field)):
                    frappe.throw(
                        _(
                            "Une urgence déjà validée ne peut pas être modifiée ni effacée depuis le formulaire."
                        )
                    )
            return

        if _can_bypass_urgence_field_guard():
            return

        for field in protected:
            if cstr(self.get(field)) != cstr(prev.get(field)):
                frappe.throw(
                    _(
                        "Les champs d'urgence ne peuvent pas être modifiés directement. "
                        "Utilisez les actions « Demande d'urgence » ou « Valider / Refuser l'urgence »."
                    )
                )


def _can_bypass_urgence_field_guard():
    if frappe.session.user == "Administrator":
        return True
    roles = frappe.get_roles()
    if ROLE_ADMIN_VENTES in roles:
        return True
    if "System Manager" in roles:
        return True
    return False


def _assert_niveau(niveau, label=_("Niveau d'urgence")):
    if niveau not in NIVEAU_URGENCE_OPTIONS:
        frappe.throw(_("{0} invalide.").format(label))


def _urgence_motif_plain(descr_html, max_len=800):
    """Extrait un texte lisible du motif d'urgence (Text Editor HTML) pour la timeline."""
    if not descr_html:
        return ""
    plain = (strip_html(cstr(descr_html)) or "").strip()
    if len(plain) > max_len:
        return plain[: max_len - 1] + "…"
    return plain


def _add_urgence_timeline(doc, text):
    """Ajoute une entrée Info dans la timeline du ticket (rendu natif Frappe)."""
    doc.add_comment("Info", text)


def _assert_admin_ventes():
    if frappe.session.user == "Administrator":
        return
    roles = frappe.get_roles()
    if ROLE_ADMIN_VENTES in roles or "System Manager" in roles:
        return
    frappe.throw(_("Action réservée au rôle Administrateur Ventes."), frappe.PermissionError)


@frappe.whitelist()
def submit_urgence_request(docname, niveau_demande, descr_urgence_html):
    """Enregistre une demande d'urgence (niveau demandé + description), statut En attente."""
    _assert_niveau(niveau_demande, _("Niveau demandé"))
    if niveau_demande == "U0":
        frappe.throw(
            _("Le niveau U0 correspond à l'absence d'urgence ; choisissez U1, U2 ou U3 pour une demande.")
        )

    doc = frappe.get_doc("Ticket Commercial", docname)
    doc.check_permission("write")

    if doc.docstatus == 1:
        frappe.throw(_("Impossible de modifier l'urgence sur un document soumis."))

    if doc.status in ("Terminé", "Annulé"):
        frappe.throw(_("Impossible de demander une urgence sur un ticket terminé ou annulé."))

    statut = doc.statut_demande_urgence or "Aucune"
    if statut == "En attente":
        frappe.throw(_("Une demande d'urgence est déjà en attente de validation."))

    descr_safe = sanitize_html(descr_urgence_html or "", always_sanitize=True)
    if not (descr_safe or "").strip():
        frappe.throw(_("La description d'urgence est obligatoire."))

    prev_niveau = cstr(doc.niveau_urgence) or "U0"
    prev_statut = statut
    prev_niveau_demande = cstr(doc.niveau_urgence_demande) or ""

    frappe.flags.ticket_urgence_whitelist = True
    try:
        doc = frappe.get_doc("Ticket Commercial", docname)
        doc.niveau_urgence_demande = niveau_demande
        doc.descr_urgence = descr_safe
        doc.statut_demande_urgence = "En attente"
        # Nouveau cycle de demande : ne pas conserver les métadonnées de la décision précédente
        doc.urgence_validee_par = None
        doc.urgence_validee_le = None
        doc.commentaire_validation_urgence = None
        doc.save()
    finally:
        frappe.flags.ticket_urgence_whitelist = False

    doc = frappe.get_doc("Ticket Commercial", docname)
    motif_plain = _urgence_motif_plain(descr_safe)
    parts = [_("Demande d'urgence enregistrée : {0} → {1}").format(prev_niveau, niveau_demande)]
    if motif_plain:
        parts.append(_("Motif : {0}").format(motif_plain))
    _add_urgence_timeline(doc, " — ".join(parts))

    return {"status": "success"}


def _assert_can_cancel_urgence_request(doc):
    if frappe.session.user == "Administrator":
        return
    if (doc.commercial or "") == frappe.session.user:
        return
    frappe.throw(
        _("Seul le commercial du ticket peut annuler sa demande d'urgence."),
        frappe.PermissionError,
    )


@frappe.whitelist()
def cancel_urgence_request(docname):
    """Retire une demande d'urgence (en attente ou déjà validée) et remet le ticket à U0 (commercial ou Administrator)."""
    doc = frappe.get_doc("Ticket Commercial", docname)
    doc.check_permission("write")
    _assert_can_cancel_urgence_request(doc)

    if doc.docstatus == 1:
        frappe.throw(_("Impossible de modifier l'urgence sur un document soumis."))

    if doc.status in ("Terminé", "Annulé"):
        frappe.throw(_("Impossible d'annuler la demande sur un ticket terminé ou annulé."))

    statut = doc.statut_demande_urgence or "Aucune"
    if statut not in ("En attente", "Validée"):
        frappe.throw(_("Aucune demande d'urgence en attente ou validée à annuler."))

    prev_niveau = cstr(doc.niveau_urgence) or "U0"
    prev_statut = statut

    frappe.flags.ticket_urgence_whitelist = True
    try:
        doc = frappe.get_doc("Ticket Commercial", docname)
        doc.niveau_urgence = "U0"
        doc.niveau_urgence_demande = None
        doc.statut_demande_urgence = "Aucune"
        doc.descr_urgence = None
        doc.urgence_validee_par = None
        doc.urgence_validee_le = None
        doc.commentaire_validation_urgence = None
        doc.save()
    finally:
        frappe.flags.ticket_urgence_whitelist = False

    doc = frappe.get_doc("Ticket Commercial", docname)
    msg = _("Demande d'urgence annulée ({0} {1} → U0)").format(
        prev_statut, prev_niveau
    )
    _add_urgence_timeline(doc, msg)

    return {"status": "success"}


@frappe.whitelist()
def process_urgence_decision(docname, action, niveau_valide=None, commentaire=None):
    """
    Valide ou refuse la demande d'urgence (Administrateur Ventes uniquement).
    action: 'validate' | 'refuse'
    """
    _assert_admin_ventes()

    action = (action or "").strip().lower()
    if action not in ("validate", "refuse"):
        frappe.throw(_("Action invalide."))

    doc = frappe.get_doc("Ticket Commercial", docname)
    doc.check_permission("write")

    if doc.docstatus == 1:
        frappe.throw(_("Impossible de traiter l'urgence sur un document soumis."))

    if (doc.statut_demande_urgence or "") != "En attente":
        frappe.throw(_("Aucune demande d'urgence en attente."))

    prev_niveau = cstr(doc.niveau_urgence) or "U0"
    niveau_demande = cstr(doc.niveau_urgence_demande) or ""
    motif_plain = _urgence_motif_plain(doc.descr_urgence)

    frappe.flags.ticket_urgence_whitelist = True
    try:
        doc = frappe.get_doc("Ticket Commercial", docname)
        if action == "validate":
            _assert_niveau(niveau_valide, _("Niveau validé"))
            doc.niveau_urgence = niveau_valide
            doc.statut_demande_urgence = "Validée"
            doc.urgence_validee_par = frappe.session.user
            doc.urgence_validee_le = now()
            doc.commentaire_validation_urgence = (commentaire or "").strip() or None
        else:
            comm = (commentaire or "").strip()
            if not comm:
                frappe.throw(_("Un commentaire est obligatoire pour refuser la demande d'urgence."))
            doc.statut_demande_urgence = "Refusée"
            doc.urgence_validee_par = frappe.session.user
            doc.urgence_validee_le = now()
            doc.commentaire_validation_urgence = comm

        doc.save()
    finally:
        frappe.flags.ticket_urgence_whitelist = False

    doc = frappe.get_doc("Ticket Commercial", docname)
    if action == "validate":
        comm_val = (commentaire or "").strip()
        msg = _("Urgence validée : {0} → {1}").format(prev_niveau, cstr(doc.niveau_urgence))
        if niveau_demande:
            msg += _(" (demandé : {0})").format(niveau_demande)
        if comm_val:
            msg += " — " + comm_val
        _add_urgence_timeline(doc, msg)
    else:
        comm_refus = (commentaire or "").strip()
        msg = _("Urgence refusée (demandé : {0})").format(niveau_demande or "?")
        if comm_refus:
            msg += " — " + comm_refus
        _add_urgence_timeline(doc, msg)

    return {"status": "success"}


@frappe.whitelist()
def update_assigne_a(docname, assigne_user):
    """Met à jour les champs assigne_a et assigne_a_nom pour un Ticket Commercial."""
    try:
        full_name = frappe.db.get_value("User", assigne_user, "full_name")
        if not full_name:
            full_name = assigne_user

        frappe.db.set_value(
            "Ticket Commercial",
            docname,
            {
                "assigne_a": assigne_user,
                "assigne_a_nom": full_name,
            },
            update_modified=False,
        )

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
        fields=["parent"],
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
            "page_len": page_len,
        },
        as_list=True,
    )
