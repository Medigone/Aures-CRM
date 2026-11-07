# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Études de faisabilité du poste de bureau (/bureau/etudes) : liste, fiche et décisions, Offset et Flexo réunis.

Même contrat que `bureau_demandes.py` : les listes passent par `frappe.get_list`. Offset et Flexo sont deux documents
distincts : un rôle ne reçoit que ceux qu'il peut lire, sans condition sur le procédé. Les règles restent dans
`etude_faisabilite.py` et le workflow.
"""

import re

import frappe
from frappe import _
from frappe.model.workflow import apply_workflow, get_transitions, get_workflow_name
from frappe.utils import cstr, flt, get_fullname, getdate, strip_html, today

from aurescrm.api import activity
from aurescrm.api.bureau import (
	BELL_FIELD,
	NOBODY,
	_parse,
	condition_filters,
	doctype_filter_fields,
	has_child_filter,
	page_bounds,
	require_bureau,
	row_bell,
	row_tags,
)
from aurescrm.api.bureau_articles import _customers

OFFSET = "Etude Faisabilite"
FLEXO = "Etude Faisabilite Flexo"
ETUDES = (OFFSET, FLEXO)

OPEN_STATUSES = ("Nouveau", "En étude")
URGENCE_RANK = {"U3": 0, "U2": 1, "U1": 2, "U0": 3}

COMMON_FIELDS = [
	"name",
	"modified",
	"creation",
	"status",
	"client",
	"article",
	"item_name",
	"procede",
	"quantite",
	"niveau_urgence",
	"date_echeance",
	"date_livraison",
	"date_creation",
	"demande_faisabilite",
	"commercial",
	"is_reprint",
	"trace",
	"assigne_a",
	"assigne_a_nom",
	"_user_tags",
	BELL_FIELD,
]
# Ce qui fait une étude complète : ces pièces diffèrent selon le document.
PIECES = {
	OFFSET: (("trace", "Tracé", "Trace"), ("imposition", "Imposition", "Imposition"), ("machine_prevue", "Machine", "Machine")),
	FLEXO: (("trace", "Tracé", "Trace"), ("cliche", "Cliché", "Cliche")),
}

VIEW_STATUSES = {
	"traiter": OPEN_STATUSES,
	"realisable": ("Réalisable",),
	"non_realisable": ("Non Réalisable",),
	"annulee": ("Annulée",),
}
VIEWS = ("all", "mine", "retard", *VIEW_STATUSES)
SORT_KEYS = {"name", "designation", "client_label", "procede", "quantite", "urgence", "echeance", "status", "manquantes", "assigne", "demande", "livraison", "commercial", "creation", "date", "modified"}
# Rôles à qui attribuer une étude : l'équipe de ce document.
ASSIGNABLE_ROLES = {OFFSET: ("Chargé Étude Faisabilité", "Responsable Étude Faisabilité"), FLEXO: ("Étude Flexo",)}


def readable_doctypes():
	return [doctype for doctype in ETUDES if frappe.has_permission(doctype, "read")]


def is_late(status, echeance, current_day):
	return status in OPEN_STATUSES and bool(echeance) and getdate(echeance) < getdate(current_day)


def in_view(view, row):
	if view == "all":
		return True
	if view == "retard":
		return row["retard"]
	if view == "mine":
		return row["mine"] and row["status"] in OPEN_STATUSES
	return row["status"] in VIEW_STATUSES[view]


def _day(value):
	return str(value) if value else None


def _pieces(doctype, etude):
	return [{"key": key, "label": label, "value": etude.get(key) or None} for key, label, _target in PIECES[doctype]]


def _list_row(doctype, etude, customers, current_day):
	pieces = _pieces(doctype, etude)
	client_label = (customers.get(etude.client) or {}).get("customer_name") or etude.client
	return {
		"name": etude.name,
		"doctype": doctype,
		"modified": str(etude.modified),
		"tags": row_tags(etude),
		"cloche": row_bell(etude),
		"status": etude.status,
		"client": etude.client,
		"client_label": client_label,
		"article": etude.article,
		"designation": etude.item_name or etude.article,
		"procede": etude.procede,
		"quantite": etude.quantite or 0,
		"urgence": etude.niveau_urgence or "U0",
		"echeance": _day(etude.date_echeance),
		"retard": is_late(etude.status, etude.date_echeance, current_day),
		"livraison": _day(etude.date_livraison),
		"demande": etude.demande_faisabilite,
		"commercial": etude.commercial,
		"retirage": bool(etude.is_reprint),
		"assigne": etude.get("assigne_a_nom") or None,
		"mine": bool(etude.get("assigne_a")) and etude.get("assigne_a") == frappe.session.user,
		"pieces": pieces,
		"manquantes": sum(1 for piece in pieces if not piece["value"]),
		"creation": str(etude.creation),
		"date": _day(etude.date_creation),
		# Recherche seulement : retirée avant l'envoi.
		"_search": " ".join(cstr(value) for value in (etude.name, etude.client, client_label, etude.article, etude.item_name, etude.demande_faisabilite, etude.commercial)).casefold(),
	}


def order_etudes(rows, sort=None, direction=None):
	"""Les études ouvertes d'abord, par urgence puis échéance, ensuite les plus récentes. Ou par la colonne demandée, les lignes sans valeur à la fin."""
	if sort in SORT_KEYS:
		filled = [row for row in rows if row.get(sort) not in (None, "")]
		empty = [row for row in rows if row.get(sort) in (None, "")]
		numeric = sort in ("quantite", "manquantes")
		key = (lambda row: row[sort]) if numeric else (lambda row: cstr(row[sort]).casefold())
		return sorted(filled, key=key, reverse=cstr(direction) == "desc") + empty
	opened = [row for row in rows if row["status"] in OPEN_STATUSES]
	closed = [row for row in rows if row["status"] not in OPEN_STATUSES]
	opened.sort(key=lambda row: (URGENCE_RANK.get(row["urgence"], 3), row.get("echeance") or "9999", row["name"]))
	closed.sort(key=lambda row: row["creation"], reverse=True)
	return opened + closed


def _filters_for(filters, doctype):
	"""Les filtres, validés sur le document principal, réécrits pour l'autre. None si l'autre n'a pas ce champ : il ne peut pas y répondre."""
	meta = frappe.get_meta(doctype)
	standard = {"name", "owner", "creation", "modified", "modified_by", "_user_tags", BELL_FIELD}
	translated = []
	for item in filters:
		if not (meta.has_field(item[1]) or item[1] in standard):
			return None
		translated.append([doctype, *item[1:]])
	return translated


def _fetch(doctype, filters, extra=()):
	# Tant que la migration n'a pas créé l'attribution, la liste reste utilisable sans elle.
	meta = frappe.get_meta(doctype)
	wanted = dict.fromkeys([*COMMON_FIELDS, *(key for key, _label, _target in PIECES[doctype]), *extra])
	fields = [field for field in wanted if not field.startswith("assigne_a") or meta.has_field(field)]
	return frappe.get_list(doctype, filters=filters, distinct=has_child_filter(filters, doctype), fields=fields, limit_page_length=0)


@frappe.whitelist()
def get_etudes(view="all", conditions=None, search=None, start=0, page_length=None, sort=None, direction=None):
	"""Une page de la liste, le total, l'ordre de toute la vue, et les compteurs de toutes les vues pour les mêmes filtres."""
	require_bureau()
	if view not in VIEWS:
		frappe.throw(_("Vue inconnue."))
	readable = readable_doctypes()
	if not readable:
		raise frappe.PermissionError
	filters = condition_filters(_parse(conditions), readable[0])
	current_day = today()
	found = []
	for doctype in readable:
		translated = _filters_for(filters, doctype)
		if translated is not None:
			found.extend((doctype, etude) for etude in _fetch(doctype, translated))
	customers = _customers(etude.client for _doctype, etude in found)
	rows = [_list_row(doctype, etude, customers, current_day) for doctype, etude in found]
	words = cstr(search).casefold().split()
	if words:
		rows = [row for row in rows if all(word in row["_search"] for word in words)]
	for row in rows:
		del row["_search"]
	ordered = order_etudes([row for row in rows if in_view(view, row)], sort, direction)
	first, length = page_bounds(len(ordered), start, page_length)
	return {
		"etudes": ordered[first : first + length],
		"counts": {name: sum(1 for row in rows if in_view(name, row)) for name in VIEWS},
		"total": len(ordered),
		"start": first,
		"page_length": length,
		"names": [row["name"] for row in ordered],
	}


@frappe.whitelist()
def get_etude_options():
	"""Champs de filtre : avec les deux documents, seuls ceux qu'ils partagent peuvent répondre pour toute la liste."""
	require_bureau()
	readable = readable_doctypes()
	if not readable:
		raise frappe.PermissionError
	primary = readable[0]
	people = [{"value": NOBODY, "label": _("Non attribuée")}, *_assignees(primary)]
	fields = doctype_filter_fields(primary, {"assigne_a": people})
	both = len(readable) > 1
	if both:
		other = frappe.get_meta(readable[1])
		standard = {"name", "owner", "creation", "modified", "modified_by", "_user_tags", "_liked_by"}
		fields = [entry for entry in fields if entry["doctype"] == primary and (other.has_field(entry["field"]) or entry["field"] in standard or entry["field"].startswith("_"))]
	return {"doctype": primary, "both": both, "filter_fields": fields}


def _resolve(name):
	"""Le document qui porte ce numéro, parmi ceux que le rôle lit. Offset et Flexo ne partagent pas leurs numéros."""
	for doctype in readable_doctypes():
		if frappe.db.exists(doctype, name):
			return doctype
	frappe.throw(_("Étude introuvable."), frappe.DoesNotExistError)


def _piece_details(doctype, doc):
	details = []
	for key, label, target in PIECES[doctype]:
		value = doc.get(key) or None
		status = None
		if value and target == "Cliche" and frappe.has_permission(target, "read"):
			status = frappe.db.get_value(target, value, "status")
		details.append({"key": key, "label": label, "value": value, "doctype": target, "status": status})
	return details


def _assignees(doctype):
	users = frappe.get_all("Has Role", filters={"role": ["in", ASSIGNABLE_ROLES[doctype]], "parenttype": "User"}, pluck="parent", distinct=True)
	rows = frappe.get_all("User", filters={"name": ["in", users], "enabled": 1}, fields=["name", "full_name"], order_by="full_name asc")
	return [{"value": row.name, "label": row.full_name or row.name} for row in rows if row.name != "Administrator"]


def condition_fields(condition):
	"""Champs lus par la condition d'une action du workflow, dans leur ordre."""
	return list(dict.fromkeys(re.findall(r"\bdoc\.(\w+)", cstr(condition))))


def _actions(doc):
	actions = []
	for transition in get_transitions(doc):
		if transition.action not in actions:
			actions.append(transition.action)
	return actions


def _blocked_actions(doc, available):
	"""Actions permises à ce rôle dans cet état, mais dont la condition manque encore, avec ce qu'il faut renseigner."""
	workflow = get_workflow_name(doc.doctype)
	if not workflow:
		return []
	roles = set(frappe.get_roles())
	meta = frappe.get_meta(doc.doctype)
	blocked = []
	for transition in frappe.get_doc("Workflow", workflow).transitions:
		if transition.state != doc.status or transition.allowed not in roles or transition.action in available or not transition.condition:
			continue
		missing = [_(meta.get_label(field)) for field in condition_fields(transition.condition) if not doc.get(field)]
		if missing:
			blocked.append({"action": transition.action, "missing": missing})
	return blocked


@frappe.whitelist()
def get_etude(name):
	"""Une étude pour l'aperçu et la fiche : champs, pièces, actions possibles pour ce rôle."""
	user = require_bureau()
	doctype = _resolve(name)
	doc = frappe.get_doc(doctype, name)
	doc.check_permission("read")
	customers = _customers([doc.client])
	actions = _actions(doc)
	can_write = bool(doc.has_permission("write"))
	can_assign = can_write and doc.status in OPEN_STATUSES and frappe.get_meta(doctype).has_field("assigne_a")
	return {
		"name": doc.name,
		"doctype": doctype,
		"modified": str(doc.modified),
		"tags": row_tags(doc) if doc.get("_user_tags") else [],
		"can_write": can_write,
		"can_assign": can_assign,
		"assigne_a": doc.get("assigne_a") or None,
		"assigne_a_nom": doc.get("assigne_a_nom") or None,
		"mine": bool(doc.get("assigne_a")) and doc.get("assigne_a") == user,
		"assignees": _assignees(doctype) if can_assign else [],
		"actions": actions,
		"blocked": _blocked_actions(doc, actions),
		"taux_chutes": flt(doc.get("taux_chutes")) if doc.meta.has_field("imposition") else None,
		"date": _day(doc.date_creation),
		"status": doc.status,
		"client": doc.client,
		"client_label": (customers.get(doc.client) or {}).get("customer_name") or doc.client,
		"article": doc.article,
		"designation": doc.item_name or doc.article,
		"procede": doc.procede,
		"quantite": doc.quantite or 0,
		"retirage": bool(doc.is_reprint),
		"urgence": doc.niveau_urgence or "U0",
		"echeance": _day(doc.date_echeance),
		"retard": is_late(doc.status, doc.date_echeance, today()),
		"livraison": _day(doc.date_livraison),
		"demande": doc.demande_faisabilite if doc.demande_faisabilite and frappe.has_permission("Demande Faisabilite", "read") else None,
		"commercial": doc.commercial,
		"pieces": _piece_details(doctype, doc),
		"observations": strip_html(cstr(doc.observations)).strip() or None,
		"comments": activity.comment_summary(doctype, doc.name),
	}


def _etude_for_action(name, modified):
	"""Étude à faire avancer : version identique à celle affichée à l'écran. Les droits sont ceux du workflow ou de l'écriture."""
	require_bureau()
	doc = frappe.get_doc(_resolve(name), name)
	doc.check_permission("read")
	if modified and cstr(modified) != str(doc.modified):
		frappe.throw(
			_("Cette étude vient d'être modifiée par ailleurs. Elle a été rechargée : vérifiez-la, puis recommencez."),
			frappe.TimestampMismatchError,
		)
	return doc


@frappe.whitelist(methods=["POST"])
def run_etude_action(name, modified, action):
	"""Lance une action du workflow. Le rôle et la condition sont contrôlés par `apply_workflow`."""
	apply_workflow(_etude_for_action(name, modified), cstr(action))
	return get_etude(name)


@frappe.whitelist(methods=["POST"])
def set_etude_assignee(name, modified, user):
	"""Attribue une étude ouverte à une personne de l'équipe, ou à soi-même."""
	doc = _etude_for_action(name, modified)
	doc.check_permission("write")
	if doc.status not in OPEN_STATUSES:
		frappe.throw(_("Une étude conclue ne s'attribue plus."))
	user = cstr(user)
	if user != frappe.session.user and user not in {row["value"] for row in _assignees(doc.doctype)}:
		frappe.throw(_("Cette personne n'appartient pas à l'équipe de cette étude."))
	doc.assigne_a = user
	doc.assigne_a_nom = get_fullname(user)
	doc.save()
	return get_etude(name)


def _doctype_of(name):
	require_bureau()
	return _resolve(name)


@frappe.whitelist()
def get_etude_activity(name):
	return activity.get_feed(_doctype_of(name), name)


@frappe.whitelist(methods=["POST"])
def add_etude_comment(name, text, mentions=None):
	return activity.add_comment(_doctype_of(name), name, text, mentions)


@frappe.whitelist(methods=["POST"])
def update_etude_comment(name, comment, text, mentions=None):
	return activity.update_comment(_doctype_of(name), name, comment, text, mentions)


@frappe.whitelist(methods=["POST"])
def delete_etude_comment(name, comment):
	return activity.delete_comment(_doctype_of(name), name, comment)
