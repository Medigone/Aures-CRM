# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.model.naming import make_autoname
from frappe.utils import add_months, cint, cstr, getdate, now, strip_html, today
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

    def before_save(self):
        """À la transition workflow Nouveau → En Cours (Démarrer), assigne le ticket à l'utilisateur courant."""
        if self.is_new() or frappe.flags.in_import:
            return
        old = self.get_doc_before_save()
        if not old:
            return
        old_status = cstr(old.get("status")) or ""
        new_status = cstr(self.status) or ""
        if old_status == "Nouveau" and new_status == "En Cours":
            user = frappe.session.user
            self.assigne_a = user
            self.assigne_a_nom = frappe.db.get_value("User", user, "full_name") or user

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


# Statuts de Demande Faisabilite considérés comme « terminés » pour éviter un doublon de création
CLOSED_DEMANDE_STATUSES = ("Annulée", "Fermée")


@frappe.whitelist()
def get_primary_open_demande_for_ticket(ticket_name):
    """
    Retourne le nom d'une Demande Faisabilite encore « ouverte » pour ce ticket
    (non Annulée / Fermée), la plus récemment modifiée.
    """
    if not ticket_name:
        return {}

    ticket = frappe.get_doc("Ticket Commercial", ticket_name)
    ticket.check_permission("read")

    rows = frappe.get_all(
        "Demande Faisabilite",
        filters={
            "ticket_commercial": ticket_name,
            "status": ["not in", list(CLOSED_DEMANDE_STATUSES)],
        },
        fields=["name"],
        order_by="modified desc",
        limit_page_length=1,
    )
    if not rows:
        return {}
    return {"name": rows[0].name}


@frappe.whitelist()
def get_cycle_documents(ticket_name):
    """
    Agrège les demandes, études, devis et commandes liés au ticket pour affichage HTML.
    """
    if not ticket_name:
        frappe.throw(_("Ticket manquant."))

    ticket = frappe.get_doc("Ticket Commercial", ticket_name)
    ticket.check_permission("read")

    from aurescrm.aures_crm.doctype.demande_faisabilite.demande_faisabilite import (
        get_linked_documents_for_demande,
    )

    demandes = frappe.get_all(
        "Demande Faisabilite",
        filters={"ticket_commercial": ticket_name},
        fields=["name", "status", "type", "modified"],
        order_by="modified desc",
    )

    out_demandes = []
    for dem in demandes:
        linked = get_linked_documents_for_demande(dem.name)
        etudes = linked.get("etudes") or []
        sales_raw = linked.get("sales_documents") or []
        sales_enriched = []
        for sd in sales_raw:
            row = dict(sd)
            if sd.get("doctype") == "Quotation":
                extra = frappe.db.get_value(
                    "Quotation",
                    sd["name"],
                    ["docstatus", "status"],
                    as_dict=True,
                )
                if extra:
                    row["docstatus"] = extra.get("docstatus")
                    if extra.get("status") is not None:
                        row["status"] = extra.get("status")
            elif sd.get("doctype") == "Sales Order":
                extra = frappe.db.get_value(
                    "Sales Order",
                    sd["name"],
                    [
                        "docstatus",
                        "status",
                        "custom_bon_de_commande_client",
                        "delivery_date",
                        "custom_devis",
                    ],
                    as_dict=True,
                )
                if extra:
                    row["docstatus"] = extra.get("docstatus")
                    if extra.get("status") is not None:
                        row["status"] = extra.get("status")
                    row["bon_de_commande_client"] = extra.get("custom_bon_de_commande_client")
                    dd = extra.get("delivery_date")
                    row["delivery_date"] = str(dd) if dd else None
                    row["devis_lie"] = extra.get("custom_devis")
            sales_enriched.append(row)
        out_demandes.append(
            {
                "name": dem.name,
                "status": dem.status,
                "type": dem.get("type"),
                "modified": str(dem.modified) if dem.get("modified") else None,
                "etudes": etudes,
                "sales_documents": sales_enriched,
            }
        )

    return {"demandes": out_demandes}


ALLOWED_DECISION_RAPPROCHEMENT = (
    "",
    "À définir",
    "Devis retenu pour commande",
    "Nouvelle demande de faisabilité",
    "Aucun candidat pertinent",
)


def _quotation_payload_for_bc_assistant(qname, ticket_customer):
    """Construit le dict « devis » pour l’assistant BC. Retourne None si le devis doit être exclu."""
    from aurescrm.sales_order_hooks import analyze_quotation_command_status

    qrow = frappe.db.get_value(
        "Quotation",
        qname,
        [
            "name",
            "transaction_date",
            "status",
            "docstatus",
            "grand_total",
            "currency",
            "company",
            "party_name",
            "custom_demande_faisabilité",
            "custom_commercial",
        ],
        as_dict=True,
    )
    if not qrow or qrow.get("party_name") != ticket_customer:
        return None
    if cint(qrow.get("docstatus")) == 2:
        return None

    analysis = analyze_quotation_command_status(qname)
    if analysis.get("custom_status") == "Entièrement commandé":
        return None

    user_com = qrow.get("custom_commercial")
    commercial_name = None
    if user_com:
        commercial_name = frappe.db.get_value("User", user_com, "full_name") or user_com

    items = frappe.get_all(
        "Quotation Item",
        filters={"parent": qname},
        fields=["item_code", "item_name", "qty", "uom", "rate"],
        order_by="idx asc",
        limit_page_length=100,
    )

    sales_orders = frappe.get_all(
        "Sales Order",
        filters={"custom_devis": qname, "docstatus": ["!=", 2]},
        fields=["name", "status", "docstatus"],
        order_by="modified desc",
        limit_page_length=20,
    )

    return {
        "name": qrow.name,
        "transaction_date": str(qrow.transaction_date) if qrow.get("transaction_date") else None,
        "status": qrow.status,
        "docstatus": qrow.docstatus,
        "grand_total": qrow.grand_total,
        "currency": qrow.currency,
        "company": qrow.company,
        "demande_faisabilite": qrow.get("custom_demande_faisabilité"),
        "commercial": user_com,
        "commercial_name": commercial_name,
        "command_analysis": {
            "custom_status": analysis.get("custom_status"),
            "percentage": analysis.get("percentage"),
            "has_draft_orders": analysis.get("has_draft_orders"),
            "draft_orders_count": analysis.get("draft_orders_count"),
        },
        "items": [
            {
                "item_code": it.item_code,
                "item_name": it.item_name,
                "qty": it.qty,
                "uom": it.uom,
                "rate": it.rate,
            }
            for it in items
        ],
        "sales_orders": [
            {
                "name": so.name,
                "status": so.status,
                "docstatus": so.docstatus,
            }
            for so in sales_orders
        ],
    }


def _demande_items_payload_for_bc_assistant(demande_name):
    """Retourne les articles de la demande FA pour l'assistant BC."""
    items = frappe.get_all(
        "Articles Demande Faisabilite",
        filters={
            "parent": demande_name,
            "parenttype": "Demande Faisabilite",
            "parentfield": "liste_articles",
        },
        fields=[
            "article",
            "designation_article",
            "quantite",
            "date_livraison",
            "procede_article",
            "est_creation",
            "essai_blanc",
        ],
        order_by="idx asc",
        limit_page_length=100,
    )

    return [
        {
            "article": it.article,
            "designation_article": it.designation_article,
            "quantite": it.quantite,
            "date_livraison": str(it.date_livraison) if it.get("date_livraison") else None,
            "procede_article": it.procede_article,
            "est_creation": cint(it.est_creation),
            "essai_blanc": cint(it.essai_blanc),
        }
        for it in items
    ]


@frappe.whitelist()
def get_quotation_candidates_for_ticket_bc(ticket_name, from_date=None, to_date=None):
    """
    Liste des Demandes de faisabilité du client du ticket (type Bon de commande), avec pour chacune
    les devis encore commandables et les commandes liées.

    Le filtre temporel s’applique sur Demande Faisabilite.date_creation.

    Args:
        ticket_name: nom du Ticket Commercial
        from_date: date minimum de création des demandes
        to_date: date maximum de création des demandes
    """
    if not ticket_name:
        frappe.throw(_("Ticket manquant."))

    ticket = frappe.get_doc("Ticket Commercial", ticket_name)
    ticket.check_permission("read")
    _assert_ticket_bon_de_commande_for_rapprochement(ticket)

    if not ticket.customer:
        frappe.throw(_("Le client doit être renseigné pour rechercher les demandes de faisabilité."))

    if from_date or to_date:
        from_dt = getdate(from_date) if from_date else None
        to_dt = getdate(to_date) if to_date else None
    else:
        from_dt = add_months(getdate(today()), -6)
        to_dt = getdate(today())

    if from_dt and to_dt and from_dt > to_dt:
        frappe.throw(_("La date de début doit être antérieure ou égale à la date de fin."))

    filt_df = {"client": ticket.customer}
    if from_dt and to_dt:
        filt_df["date_creation"] = ["between", [from_dt, to_dt]]
    elif from_dt:
        filt_df["date_creation"] = [">=", from_dt]
    elif to_dt:
        filt_df["date_creation"] = ["<=", to_dt]

    demandes = frappe.get_all(
        "Demande Faisabilite",
        filters=filt_df,
        fields=["name", "status", "type", "date_creation", "modified", "ticket_commercial"],
        order_by="date_creation desc, modified desc",
        limit_page_length=200,
    )

    out = []
    for dem in demandes:
        quotes_meta = frappe.get_all(
            "Quotation",
            filters={
                "party_name": ticket.customer,
                "docstatus": ["!=", 2],
                "custom_demande_faisabilité": dem.name,
            },
            fields=["name"],
            order_by="transaction_date desc, modified desc",
            limit_page_length=50,
        )

        quotation_payloads = []
        for qm in quotes_meta:
            payload = _quotation_payload_for_bc_assistant(qm.name, ticket.customer)
            if payload:
                quotation_payloads.append(payload)

        # Demande avec devis liés mais tous à 100 % commandés : rien à rapprocher, ne pas afficher la carte.
        if quotes_meta and not quotation_payloads:
            continue

        out.append(
            {
                "name": dem.name,
                "demande_faisabilite": dem.name,
                "demande_status": dem.status,
                "demande_type": dem.type,
                "date_creation": str(dem.date_creation) if dem.get("date_creation") else None,
                "ticket_commercial_link": dem.ticket_commercial,
                "items": _demande_items_payload_for_bc_assistant(dem.name),
                "quotations": quotation_payloads,
            }
        )

    return {
        "candidates": out,
        "customer": ticket.customer,
        "from_date": str(from_dt) if from_dt else None,
        "to_date": str(to_dt) if to_dt else None,
    }


def _assert_ticket_bon_de_commande_for_rapprochement(ticket):
    if cstr(ticket.get("request_type")) != "Bon de commande":
        frappe.throw(
            _("L'assistant de rapprochement n'est disponible que pour le type « Bon de commande ».")
        )


@frappe.whitelist()
def save_ticket_rapprochement_decision(
    ticket_name,
    decision_rapprochement=None,
    devis_rapproche=None,
    demande_faisabilite_rapprochee=None,
    commentaire_rapprochement=None,
):
    """Enregistre la décision de rapprochement sur le ticket (champs allow_on_submit)."""
    if not ticket_name:
        frappe.throw(_("Ticket manquant."))

    doc = frappe.get_doc("Ticket Commercial", ticket_name)
    doc.check_permission("write")
    _assert_ticket_bon_de_commande_for_rapprochement(doc)

    dec = cstr(decision_rapprochement).strip() if decision_rapprochement is not None else ""
    if dec not in ALLOWED_DECISION_RAPPROCHEMENT:
        frappe.throw(_("Décision de rapprochement invalide."))

    devis = (devis_rapproche or "").strip() or None
    dem_in = (demande_faisabilite_rapprochee or "").strip() or None
    comm = (commentaire_rapprochement or "").strip() or None

    if dec in ("Nouvelle demande de faisabilité", "Aucun candidat pertinent"):
        devis = None
        dem_in = None

    if dec == "Devis retenu pour commande" and not devis:
        frappe.throw(_("Sélectionnez un devis pour la décision « Devis retenu pour commande »."))

    if devis:
        q_party = frappe.db.get_value("Quotation", devis, "party_name")
        if q_party != doc.customer:
            frappe.throw(_("Le devis choisi n'appartient pas au client du ticket."))
        dem_from_q = frappe.db.get_value("Quotation", devis, "custom_demande_faisabilité")
        doc.demande_faisabilite_rapprochee = dem_in or dem_from_q
    else:
        doc.demande_faisabilite_rapprochee = None

    doc.devis_rapproche = devis
    doc.decision_rapprochement = dec or None
    doc.commentaire_rapprochement = comm

    doc.save(ignore_permissions=False)

    parts = []
    if dec:
        parts.append(_("Décision rapprochement : {0}").format(dec))
    if devis:
        parts.append(_("Devis : {0}").format(devis))
    if doc.demande_faisabilite_rapprochee:
        parts.append(_("Demande FA : {0}").format(doc.demande_faisabilite_rapprochee))
    if comm:
        parts.append(comm)
    if parts:
        doc.add_comment("Info", " — ".join(parts))

    return {"status": "success", "name": doc.name}
