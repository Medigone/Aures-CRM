# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Temps réel du poste de bureau, branché sur `on_change` / `on_trash` de tous les DocTypes (hooks « * »).

Le back office reçoit `aures_bureau_update` après le commit quand un ticket ou un document de son cycle
change. Le message ne porte que des identifiants : l'application recharge ensuite par l'API, qui applique
les droits. Rien ici ne doit bloquer une sauvegarde : une erreur est journalisée, jamais levée.
"""

import frappe

from aurescrm.api.bureau import BUREAU_ROLES, TICKET

REALTIME_EVENT = "aures_bureau_update"
_LOCAL_KEY = "aures_bureau_realtime"

# DocType → champ qui désigne le ticket (None : le document n'est pas rattaché directement à un ticket).
WATCHED = {
	TICKET: "name",
	"Demande Faisabilite": "ticket_commercial",
	"Dossier Essai Blanc": "ticket_commercial",
	"Quotation": None,
	"Sales Order": None,
	"Customer": None,
	"Item": None,
	"BAT": None,
	"Maquette": None,
}


def _muted():
	flags = frappe.flags
	return bool(flags.in_migrate or flags.in_patch or flags.in_install or flags.in_import or flags.in_test)


def _ticket_of(doc):
	"""Ticket concerné, ou None. Un fichier ne compte que s'il est joint à un ticket."""
	if doc.doctype == "File":
		return doc.attached_to_name if doc.attached_to_doctype == TICKET else None
	if doc.doctype == "Comment":
		return doc.reference_name if doc.reference_doctype == TICKET else None
	fieldname = WATCHED.get(doc.doctype)
	return doc.get(fieldname) if fieldname else None


def _is_watched(doc):
	if doc.doctype == "File":
		return doc.get("attached_to_doctype") == TICKET
	if doc.doctype == "Comment":
		return doc.get("reference_doctype") == TICKET
	return doc.doctype in WATCHED


def recipients():
	"""Comptes actifs qui ont accès au poste de bureau."""
	members = frappe.get_all(
		"Has Role", filters={"role": ["in", list(BUREAU_ROLES)], "parenttype": "User"}, pluck="parent"
	)
	return frappe.get_all("User", filters={"name": ["in", members or [""]], "enabled": 1}, pluck="name")


def announce(doc, deleted=False):
	"""Un message par document dans la requête, envoyé après le commit."""
	sent = getattr(frappe.local, _LOCAL_KEY, None)
	if sent is None:
		sent = set()
		setattr(frappe.local, _LOCAL_KEY, sent)
	key = (doc.doctype, doc.name)
	if key in sent:
		return
	sent.add(key)
	message = {
		"doctype": doc.doctype,
		"name": doc.name,
		"ticket": _ticket_of(doc),
		"by": frappe.session.user,
		"deleted": int(deleted),
	}
	for user in recipients():
		frappe.publish_realtime(REALTIME_EVENT, message, user=user, after_commit=True)


def on_change(doc, method=None):
	if not _is_watched(doc) or _muted():
		return
	try:
		announce(doc)
	except Exception:
		frappe.log_error(title=f"Poste de bureau : événement {doc.doctype}")


def on_trash(doc, method=None):
	if not _is_watched(doc) or _muted():
		return
	try:
		announce(doc, deleted=True)
	except Exception:
		frappe.log_error(title=f"Poste de bureau : suppression {doc.doctype}")
