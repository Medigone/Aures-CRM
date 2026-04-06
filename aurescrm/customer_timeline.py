# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

"""
Surcharges du chargement docinfo / communications pour masquer le fil Activité
sur Customer lorsque les mêmes règles que l'édition (commercial itinérant non attribué) s'appliquent.
"""

import frappe
from frappe import _
from frappe.desk.form.load import get_communications as frappe_get_communications
from frappe.desk.form.load import get_docinfo as frappe_get_docinfo

from aurescrm.custom_permissions import can_view_customer_activity

_TIMELINE_DOCINFO_KEYS = (
    "communications",
    "automated_messages",
    "comments",
    "versions",
    "assignments",
    "views",
    "energy_point_logs",
    "additional_timeline_content",
    "milestones",
    "document_email",
    "attachment_logs",
    "info_logs",
    "like_logs",
    "workflow_logs",
    "assignment_logs",
    "share_logs",
)


def _strip_customer_activity_from_docinfo(docinfo):
    for key in _TIMELINE_DOCINFO_KEYS:
        if key == "document_email":
            docinfo[key] = None
        elif key == "additional_timeline_content":
            docinfo[key] = []
        else:
            docinfo[key] = []


@frappe.whitelist()
def get_docinfo(doc=None, doctype=None, name=None):
    frappe_get_docinfo(doc=doc, doctype=doctype, name=name)
    docinfo = frappe.response.get("docinfo")
    if not docinfo:
        return
    if docinfo.get("doctype") != "Customer" or not docinfo.get("name"):
        return
    if not can_view_customer_activity(frappe.session.user, docinfo.name):
        _strip_customer_activity_from_docinfo(docinfo)


@frappe.whitelist()
def get_communications(doctype, name, start=0, limit=20):
    if doctype == "Customer" and not can_view_customer_activity(frappe.session.user, name):
        return []
    return frappe_get_communications(doctype, name, start=start, limit=limit)


def validate_customer_timeline_comment(doc, method=None):
    if doc.doctype != "Comment" or doc.comment_type != "Comment":
        return
    if doc.reference_doctype != "Customer" or not doc.reference_name:
        return
    if can_view_customer_activity(frappe.session.user, doc.reference_name):
        return
    frappe.throw(
        _("Vous ne pouvez pas ajouter ou modifier de commentaire sur ce client."),
        frappe.PermissionError,
    )
