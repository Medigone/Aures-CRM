# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""API du poste de bureau (/bureau) : file de travail et traitement des tickets.

Couche mince : les règles métier restent dans les modules des DocTypes. Les listes passent par
`frappe.get_list` pour conserver les permissions ; un document est toujours contrôlé par `check_permission`,
et chaque écriture passe par `doc.save()` ou le workflow pour garder validations, hooks et historique.

Chaque action renvoie le ticket à jour. Elle reçoit la date `modified` affichée à l'écran : si le ticket a
changé entre-temps, l'action est refusée plutôt que d'écraser le travail d'un autre sans le dire.
"""

import base64
import io
import json
import re
import unicodedata

import frappe
from frappe import _
from frappe.model.workflow import apply_workflow, get_transitions
from frappe.utils import cint, cstr, escape_html, flt, get_fullname, getdate, now_datetime, strip_html, today
from openpyxl import Workbook
from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE
from openpyxl.styles import Font
from openpyxl.utils import get_column_letter

from aurescrm.api import activity
from aurescrm.api.bureau_postes import BUREAU_ROLES
from aurescrm.aures_crm.doctype.demande_faisabilite.demande_faisabilite import FAISABILITE_PROCEDES, get_expected_procede_from_ticket
from aurescrm.aures_crm.doctype.ticket_commercial.ticket_pieces import apply_pieces, dossier_pieces
from aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial import (
	CHECKLIST_TERMINE_FIELDS,
	default_niveau_urgence_pour_creation,
	get_cycle_documents,
	process_urgence_decision,
	save_ticket_rapprochement_decision,
	update_assigne_a,
)

TICKET = "Ticket Commercial"
ROLE_BACK_OFFICE = "Administrateur Ventes"

STATUS_BLOCKED = "Blocage Créance"
STATUS_PAUSED = "Pending"
CLOSED_STATUSES = ("Terminé", "Annulé")
DECIDED = (
	"Devis retenu pour commande",
	"Nouvelle demande de faisabilité",
	"Aucun candidat pertinent",
)
WANTS_NEW_DEMANDE = "Nouvelle demande de faisabilité"
NO_CANDIDATE = "Aucun candidat pertinent"
CREANCE_OK = ("OK", "Déblocage autorisé")
# Seuls ces tickets peuvent lancer une demande de faisabilité.
DEMANDE_TICKET_TYPES = ("Demande de devis", "Bon de commande")
URGENCE_RANK = {"U0": 0, "U1": 1, "U2": 2, "U3": 3}
# Le blocage passe par la carte Créance, qui exige un motif : pas de bouton de workflow pour lui.
HIDDEN_ACTIONS = {"Bloquer Créance"}

# Tailles de page : la file trie ici, sur toute la vue, puis ne calcule les étapes que de la page demandée.
DEFAULT_PAGE_LENGTH = 20
MAX_PAGE_LENGTH = 500

# Création d'un ticket.
CLIENT_COMMERCIAL_FIELD = "custom_commercial_attribué"
CLIENT_SEARCH_LIMIT = 8
COMMERCIAL_ROLES = ("Commercial Itinérant", "Commercial Sédentaire")

# Actions groupées : seulement ce qui ne demande ni saisie ni contrôle ticket par ticket, et reste réversible.
BULK_LIMIT = 100
BULK_ACTIONS = {"Démarrer", "Pause"}
BULK_SAVEPOINT = "bureau_bulk_item"

# Filtre « Cloche » : le cœur du Desk, propre à chaque personne, rangé dans `_liked_by`.
BELL_FILTER = "cloche"
BELL_FIELD = "_liked_by"

QUEUE_FIELDS = [
	"name",
	"customer",
	"customer_name",
	"request_type",
	"status",
	"echeance",
	"creation",
	"niveau_urgence",
	"niveau_urgence_demande",
	"statut_demande_urgence",
	"assigne_a",
	"assigne_a_nom",
	"modified",
	"commercial",
	"nom_commercial",
	"statut_creance",
	"_user_tags",
	BELL_FIELD,
	"creation_date",
	"decision_rapprochement",
	"devis_rapproche",
	"demande_faisabilite_rapprochee",
	*sorted({fieldname for fields in CHECKLIST_TERMINE_FIELDS.values() for fieldname in fields}),
]

# Champs lus pour trier toute la vue : peu de colonnes, car elle peut compter des milliers de lignes.
QUEUE_ORDER_FIELDS = [
	"name",
	"customer",
	"customer_name",
	"request_type",
	"status",
	"echeance",
	"creation",
	"modified",
	"niveau_urgence",
	"niveau_urgence_demande",
	"statut_demande_urgence",
	"assigne_a_nom",
	"commercial",
	"nom_commercial",
	"statut_creance",
	"creation_date",
]

# Filtres courants de chaque liste : champ → libellé. Ils passent en tête, et restent proposés quel que soit le niveau de droit du champ.
FILTER_LISTS = {
	TICKET: {
		"request_type": "Type de ticket",
		"status": "Statut",
		"niveau_urgence": "Urgence",
		"customer_name": "Client",
		"nom_commercial": "Commercial",
		"assigne_a": "Pris en charge par",
		"statut_creance": "Créance",
		"echeance": "Échéance",
		"_user_tags": "Tag",
	},
	"Item": {
		"custom_procédé": "Procédé",
		"custom_client": "Client",
		"item_group": "Groupe",
		"custom_type_article": "Type",
		"custom_support": "Papier",
		"item_name": "Désignation",
		"custom_code_client": "Réf. client",
		"_user_tags": "Tag",
	},
	"Demande Faisabilite": {
		"status": "Statut",
		"type": "Type",
		"client": "Client",
		"niveau_urgence": "Urgence",
		"commercial": "Commercial",
		"date_livraison": "Livraison souhaitée",
		"ticket_commercial": "Ticket",
		"n_bon_commande": "Bon de commande",
		"_user_tags": "Tag",
	},
	"Customer": {
		"custom_status": "Statut",
		"custom_wilaya": "Wilaya",
		"custom_commercial_attribué": "Commercial",
		"customer_group": "Catégorie",
		"custom_grand_compte": "Grand compte",
		"customer_name": "Raison sociale",
		"_user_tags": "Tag",
	},
}
# Conditions du Desk par nature de champ (`frappe/ui/filters/filter.js`), la condition par défaut en tête.
TEXT_CONDITIONS = ["like", "not like", "=", "!=", "in", "not in", "is", ">", "<", ">=", "<="]
CHOICE_CONDITIONS = ["=", "!=", "in", "not in", "is", ">", "<", ">=", "<="]
LINK_CONDITIONS = ["=", "!=", "like", "not like", "in", "not in", "is"]
TREE_CONDITIONS = ["descendants of", "descendants of (inclusive)", "not descendants of", "ancestors of", "not ancestors of"]
NUMBER_CONDITIONS = ["=", "!=", ">", "<", ">=", "<=", "is"]
DATE_CONDITIONS = ["Between", "Timespan", "=", "!=", "<", ">", "<=", ">=", "is"]
DATETIME_CONDITIONS = ["Between", "Timespan", "<", ">", "<=", ">=", "is"]
TIMESPANS = {
	"last 7 days", "last 14 days", "last 30 days", "last 90 days", "last week", "last month", "last quarter", "last 6 months", "last year",
	"yesterday", "today", "tomorrow",
	"this week", "this month", "this quarter", "this year",
	"next 7 days", "next 14 days", "next 30 days", "next week", "next month", "next quarter", "next 6 months", "next year",
}  # fmt: skip
LIST_FILTER = "List Filter"
LIST_VIEW = "Vue Liste Bureau"
LIST_VIEW_MAX_COLUMNS = 60
LIST_VIEW_WIDTHS = (56, 800)
LIST_COLUMN_KEY = re.compile(r"^\w{1,140}$")
LINK_SEARCH_LIMIT = 20
EXPORT_LINES_LIMIT = 500
NOBODY = "__nobody__"
INVALID_SHEET_CHARS = re.compile(r"[\\/*?:\[\]]")
NOT_FILTERABLE_TYPES = {"Section Break", "Column Break", "Tab Break", "HTML", "Button", "Table", "Table MultiSelect", "Password", "Fold", "Heading", "Image", "Signature", "Geolocation"}
NUMBER_TYPES = {"Int", "Float", "Currency", "Percent", "Rating", "Duration"}
DATE_TYPES = {"Date", "Datetime"}
SYSTEM_FILTER_FIELDS = [("name", "Code", "Data", None), ("owner", "Créé par", "Link", "User"), ("creation", "Créé le", "Datetime", None), ("modified_by", "Modifié par", "Link", "User"), ("modified", "Modifié le", "Datetime", None)]


def can_access_bureau(user=None):
	user = user or frappe.session.user
	if user == "Guest":
		return False
	roles = set(frappe.get_roles(user))
	return "Administrator" in roles or bool(roles & BUREAU_ROLES)


def require_bureau():
	if not can_access_bureau():
		frappe.throw(_("Votre compte n'a pas accès au poste de bureau."), frappe.PermissionError)
	return frappe.session.user


def _is_open(status):
	return cstr(status) not in CLOSED_STATUSES


def view_filters(view, user):
	"""Filtres d'une vue de la file."""
	opened = ["status", "not in", list(CLOSED_STATUSES)]
	views = {
		"todo": [opened],
		"mine": [opened, ["assigne_a", "=", user]],
		"urgent": [opened, ["statut_demande_urgence", "=", "En attente"]],
		"creance": [["status", "=", STATUS_BLOCKED]],
		"closed": [["status", "in", list(CLOSED_STATUSES)]],
		# Toute la file, pour l'export : aucune vue de la liste ne la montre en entier.
		"all": [],
	}
	if view not in views:
		frappe.throw(_("Vue inconnue."))
	return views[view]


def _filter_conditions(fieldtype, link_doctype=None):
	"""(nature du champ, conditions permises), selon son type."""
	if fieldtype in NUMBER_TYPES:
		return "number", NUMBER_CONDITIONS
	if fieldtype == "Date":
		return "date", DATE_CONDITIONS
	if fieldtype == "Datetime":
		return "date", DATETIME_CONDITIONS
	if fieldtype == "Check":
		return "check", ["="]
	if fieldtype == "Select":
		return "choice", CHOICE_CONDITIONS
	if fieldtype == "Link":
		try:
			tree = bool(link_doctype and frappe.get_meta(link_doctype).is_tree)
		except frappe.DoesNotExistError:
			tree = False
		return "link", LINK_CONDITIONS + TREE_CONDITIONS if tree else LINK_CONDITIONS
	return "text", TEXT_CONDITIONS


def _filter_entry(doctype, fieldname, label, fieldtype, options=None, **extra):
	"""Un champ du panneau de filtres : sa nature, ses conditions et, s'il en a, ses valeurs."""
	link_doctype = options if fieldtype == "Link" else None
	kind, conditions = _filter_conditions(fieldtype, link_doctype)
	entry = {"value": f"{doctype}.{fieldname}", "doctype": doctype, "field": fieldname, "label": _(label or fieldname), "kind": kind, "operators": conditions, **extra}
	if link_doctype:
		entry["link_doctype"] = link_doctype
	if kind == "check":
		entry["choices"] = [{"value": "1", "label": _("Oui")}, {"value": "0", "label": _("Non")}]
	elif kind == "choice":
		entry["choices"] = [{"value": option, "label": _(option)} for option in cstr(options).split("\n") if option]
	return entry


def _filterable(df, permitted):
	return df.fieldtype not in NOT_FILTERABLE_TYPES and not df.is_virtual and df.fieldname in permitted


def _is_own_doctype(meta):
	"""Vrai pour un doctype de cette application : ses champs ne sont pas ceux d'ERPNext."""
	return frappe.db.get_value("Module Def", meta.module, "app_name", cache=True) == "aurescrm"


def doctype_filter_fields(doctype, choices=None):
	"""Tout ce qu'on peut filtrer sur une liste : ses filtres courants, puis les champs lisibles du doctype et de ses tables enfants."""
	meta = frappe.get_meta(doctype)
	common = FILTER_LISTS[doctype]
	permitted = set(meta.get_permitted_fieldnames())
	entries = []
	for fieldname, label in common.items():
		df = meta.get_field(fieldname)
		if df:
			entries.append(_filter_entry(doctype, fieldname, label, df.fieldtype, df.options))
		elif fieldname == "_user_tags":
			entries.append(_filter_entry(doctype, fieldname, label, "Data"))
	entries.append(
		{"value": f"{doctype}.{BELL_FILTER}", "doctype": doctype, "field": BELL_FILTER, "label": _("Cloche"), "kind": "choice", "operators": ["=", "!="], "choices": [{"value": "1", "label": _("activée")}]}
	)
	own_doctype = _is_own_doctype(meta)
	tab = section = None
	for df in meta.fields:
		if df.fieldtype == "Tab Break":
			tab, section = df.label, None
		elif df.fieldtype == "Section Break":
			section = df.label
		if df.fieldname not in common and _filterable(df, permitted):
			entries.append(_filter_entry(doctype, df.fieldname, df.label, df.fieldtype, df.options, group=_(section or tab or "Autres champs"), own=own_doctype or df.fieldname.startswith("custom_")))
	for fieldname, label, fieldtype, options in SYSTEM_FILTER_FIELDS:
		if fieldname not in common:
			entries.append(_filter_entry(doctype, fieldname, label, fieldtype, options, group=_("Suivi"), own=True))
	# `get_permitted_fieldnames` ne contient pas les tables : leur droit se lit à leur niveau d'accès.
	levels = set(meta.get_permlevel_access())
	for table in meta.get_table_fields():
		if table.fieldtype != "Table" or table.permlevel not in levels:
			continue
		child = frappe.get_meta(table.options)
		readable = set(child.get_permitted_fieldnames(parenttype=doctype))
		label = _(table.label or table.options)
		own = table.fieldname.startswith("custom_") or _is_own_doctype(child)
		entries.extend(_filter_entry(table.options, df.fieldname, df.label, df.fieldtype, df.options, group=label, table=label, own=own) for df in child.fields if _filterable(df, readable))
	for entry in entries:
		if entry["doctype"] == doctype and entry["field"] in (choices or {}):
			entry["choices"] = choices[entry["field"]]
	return entries


def _filter_catalog(doctype):
	return {(entry["doctype"], entry["field"]): entry for entry in doctype_filter_fields(doctype)}


def _require_filter_list(doctype):
	if doctype not in FILTER_LISTS:
		frappe.throw(_("Liste inconnue."))


def _filter_value(entry, op, value):
	"""La valeur attendue par `frappe.get_list`, ou None quand le filtre n'est pas complet. Une valeur mal formée est refusée."""
	text = ",".join(cstr(item) for item in value) if isinstance(value, (list, tuple)) else cstr(value).strip()
	if not text:
		return None
	if op == "is":
		if text not in ("set", "not set"):
			frappe.throw(_("Condition de filtre invalide."))
		return text
	if op == "Timespan":
		if text not in TIMESPANS:
			frappe.throw(_("Condition de filtre invalide."))
		return text
	if op == "Between":
		bounds = [part.strip() for part in text.split(",")]
		if len(bounds) != 2 or not all(bounds):
			return None
		return [str(getdate(bound)) for bound in bounds]
	if op in ("in", "not in"):
		return [part.strip() for part in text.split(",") if part.strip()] or None
	if op in ("like", "not like"):
		return text if "%" in text else f"%{text}%"
	if entry["kind"] == "number":
		return flt(text)
	if entry["kind"] == "date":
		return str(getdate(text))
	if entry["kind"] == "check":
		return cint(text)
	return text


def condition_filters(conditions, doctype):
	"""Traduit les filtres choisis dans une liste, au format du Desk. Tout ce qui n'est pas dans le catalogue de la personne est refusé."""
	if not conditions:
		return []
	_require_filter_list(doctype)
	catalog = _filter_catalog(doctype)
	filters = []
	for condition in conditions:
		table, fieldname, op = cstr(condition.get("doctype")), cstr(condition.get("field")), cstr(condition.get("op"))
		entry = catalog.get((table, fieldname))
		if not entry:
			frappe.throw(_("Filtre inconnu."))
		if op not in entry["operators"]:
			frappe.throw(_("Condition de filtre invalide."))
		if fieldname == BELL_FILTER:
			# Toujours la personne connectée : le navigateur n'envoie pas d'utilisateur.
			if cstr(condition.get("value")).strip():
				filters.append([doctype, BELL_FIELD, "like" if op == "=" else "not like", f'%"{frappe.session.user}"%'])
			continue
		value = _filter_value(entry, op, condition.get("value"))
		if value is None:
			continue
		if value == NOBODY and op in ("=", "!="):
			op, value = "is", "not set" if op == "=" else "set"
		filters.append([table, fieldname, op, value])
	return filters


def has_child_filter(filters, doctype):
	"""Vrai si un filtre passe par une table enfant : plusieurs de ses lignes peuvent alors répondre pour un même document."""
	return any(row[0] != doctype for row in filters if len(row) == 4)


def _condition_from_stored(row, doctype, catalog):
	"""Une ligne de `List Filter`, écrite ici ou sur le Desk, relue comme une condition. None si le champ n'est plus disponible."""
	if not isinstance(row, (list, tuple)) or len(row) < 4:
		return None
	table, fieldname, op, value = row[:4]
	if fieldname == BELL_FIELD:
		if op not in ("like", "not like"):
			return None
		return {"doctype": doctype, "field": BELL_FILTER, "op": "=" if op == "like" else "!=", "value": "1"}
	entry = catalog.get((table, fieldname))
	if not entry:
		return None
	op = next((known for known in entry["operators"] if known.lower() == cstr(op).lower()), None)
	if not op:
		return None
	if isinstance(value, (list, tuple)):
		value = ",".join(cstr(item) for item in value)
	elif op in ("like", "not like"):
		value = cstr(value).strip("%")
	return {"doctype": table, "field": fieldname, "op": op, "value": cstr(value)}


def _can_share_filters():
	return "System Manager" in frappe.get_roles()


@frappe.whitelist()
def get_saved_filters(doctype):
	"""Les filtres enregistrés de la personne et ceux de tout le monde : les mêmes que dans le Desk."""
	require_bureau()
	_require_filter_list(doctype)
	user = frappe.session.user
	catalog = _filter_catalog(doctype)
	rows = frappe.get_all(LIST_FILTER, filters={"reference_doctype": doctype}, fields=["name", "filter_name", "for_user", "filters"], order_by="filter_name asc", limit_page_length=0)
	can_share = _can_share_filters()
	saved = []
	for row in rows:
		if row.for_user and row.for_user != user:
			continue
		stored = _parse(row.filters) or []
		conditions = [condition for condition in (_condition_from_stored(item, doctype, catalog) for item in stored) if condition]
		saved.append(
			{
				"name": row.name,
				"label": row.filter_name,
				"is_global": not row.for_user,
				"can_delete": bool(row.for_user) or can_share,
				"conditions": conditions,
				"dropped": len(stored) - len(conditions),
			}
		)
	return {"filters": saved, "can_share": can_share}


@frappe.whitelist(methods=["POST"])
def save_filter(doctype, label, conditions, is_global=0):
	"""Enregistre les conditions dans `List Filter`, au format du Desk. Un filtre pour tout le monde demande le rôle System Manager."""
	require_bureau()
	_require_filter_list(doctype)
	label = cstr(label).strip()
	if not label:
		frappe.throw(_("Donnez un nom à ce filtre."))
	if cint(is_global) and not _can_share_filters():
		frappe.throw(_("Seul un System Manager peut partager un filtre."), frappe.PermissionError)
	user = frappe.session.user
	existing = frappe.get_all(LIST_FILTER, filters={"reference_doctype": doctype, "filter_name": label}, fields=["for_user"], limit_page_length=0)
	if any(not row.for_user or row.for_user == user for row in existing):
		frappe.throw(_("Un filtre porte déjà ce nom."))
	filters = condition_filters(_parse(conditions), doctype)
	if not filters:
		frappe.throw(_("Ce filtre n'a aucune condition complète."))
	# Le rôle Desk User n'est pas exigé sur /bureau : les règles ci-dessus tiennent lieu de droits.
	doc = frappe.get_doc(
		{"doctype": LIST_FILTER, "reference_doctype": doctype, "filter_name": label, "for_user": "" if cint(is_global) else user, "filters": json.dumps([[*row, False] for row in filters])}
	).insert(ignore_permissions=True)
	return doc.name


@frappe.whitelist(methods=["POST"])
def delete_saved_filter(name):
	"""Retire un filtre : le sien, ou un filtre commun pour un System Manager."""
	require_bureau()
	doc = frappe.get_doc(LIST_FILTER, name)
	if doc.reference_doctype not in FILTER_LISTS:
		frappe.throw(_("Liste inconnue."))
	if doc.for_user != frappe.session.user and (doc.for_user or not _can_share_filters()):
		frappe.throw(_("Ce filtre ne vous appartient pas."), frappe.PermissionError)
	doc.delete(ignore_permissions=True)


def _list_view_default_key(doctype):
	return f"bureau_vue:{doctype}"


def _clean_list_view_config(doctype, config):
	"""Les réglages d'une vue, réduits à ce qu'on attend : le navigateur n'écrit jamais autre chose dans le document."""
	config = _parse(config)
	if not isinstance(config, dict):
		frappe.throw(_("Réglages de vue invalides."))
	catalog = _filter_catalog(doctype)
	fields = {entry["value"] for entry in catalog.values() if entry["field"] != BELL_FILTER}
	columns, seen = [], set()
	for column in config.get("columns") or []:
		key = cstr(column.get("key")) if isinstance(column, dict) else ""
		if key in seen or not (key in fields or LIST_COLUMN_KEY.match(key)):
			frappe.throw(_("Colonne inconnue : {0}").format(key))
		seen.add(key)
		cleaned = {"key": key}
		if column.get("width"):
			cleaned["width"] = min(max(cint(column["width"]), LIST_VIEW_WIDTHS[0]), LIST_VIEW_WIDTHS[1])
		columns.append(cleaned)
	if not columns or len(columns) > LIST_VIEW_MAX_COLUMNS:
		frappe.throw(_("Une vue compte de 1 à {0} colonnes.").format(LIST_VIEW_MAX_COLUMNS))
	sort = config.get("sort")
	if sort and (not isinstance(sort, dict) or sort.get("dir") not in ("asc", "desc") or not LIST_COLUMN_KEY.match(cstr(sort.get("key")))):
		frappe.throw(_("Tri invalide."))
	conditions = [
		{"doctype": cstr(item.get("doctype")), "field": cstr(item.get("field")), "op": cstr(item.get("op")), "value": cstr(item.get("value"))}
		for item in config.get("conditions") or []
		if isinstance(item, dict)
	]
	# Refuse un champ ou une condition absents du catalogue de la personne.
	condition_filters(conditions, doctype)
	return {"columns": columns, "sort": {"key": sort["key"], "dir": sort["dir"]} if sort else None, "view": cstr(config.get("view")), "conditions": conditions}


def _list_view_for_reader(row, catalog):
	"""Une vue telle que la personne peut l'ouvrir : sans les colonnes ni les filtres dont le champ ne lui est plus disponible."""
	config = _parse(row.config) or {}
	fields = {entry["value"] for entry in catalog.values() if entry["field"] != BELL_FILTER}
	stored_columns = config.get("columns") or []
	columns = [column for column in stored_columns if "." not in cstr(column.get("key")) or column.get("key") in fields]
	stored_conditions = config.get("conditions") or []
	conditions = []
	for condition in stored_conditions:
		entry = catalog.get((cstr(condition.get("doctype")), cstr(condition.get("field"))))
		if entry and cstr(condition.get("op")) in entry["operators"]:
			conditions.append(condition)
	return {
		"name": row.name,
		"label": row.label,
		"is_global": not row.for_user,
		"can_edit": bool(row.for_user) or _can_share_filters(),
		"config": {"columns": columns, "sort": config.get("sort"), "view": cstr(config.get("view")), "conditions": conditions},
		"dropped": len(stored_columns) - len(columns) + len(stored_conditions) - len(conditions),
	}


def _check_list_view_label(doctype, label, current=None):
	label = cstr(label).strip()
	if not label:
		frappe.throw(_("Donnez un nom à cette vue."))
	user = frappe.session.user
	rows = frappe.get_all(LIST_VIEW, filters={"reference_doctype": doctype, "label": label}, fields=["name", "for_user"], limit_page_length=0)
	if any(row.name != current and (not row.for_user or row.for_user == user) for row in rows):
		frappe.throw(_("Une vue porte déjà ce nom."))
	return label


def _list_view_for_write(name):
	"""La vue à modifier : la sienne, ou une vue commune pour un System Manager."""
	doc = frappe.get_doc(LIST_VIEW, name)
	if doc.for_user != frappe.session.user and (doc.for_user or not _can_share_filters()):
		frappe.throw(_("Cette vue ne vous appartient pas."), frappe.PermissionError)
	return doc


@frappe.whitelist()
def get_list_views(doctype):
	"""Les vues de la personne, celles de tout le monde et sa vue par défaut."""
	require_bureau()
	_require_filter_list(doctype)
	user = frappe.session.user
	catalog = _filter_catalog(doctype)
	rows = frappe.get_all(LIST_VIEW, filters={"reference_doctype": doctype}, or_filters=[["for_user", "=", user], ["for_user", "is", "not set"]], fields=["name", "label", "for_user", "config"], order_by="label asc", limit_page_length=0)
	views = [_list_view_for_reader(row, catalog) for row in rows]
	default = frappe.defaults.get_user_default(_list_view_default_key(doctype))
	return {"views": views, "default": default if any(view["name"] == default for view in views) else None, "can_share": _can_share_filters()}


@frappe.whitelist(methods=["POST"])
def save_list_view(doctype, label, config, is_global=0, name=None):
	"""Crée une vue, ou met à jour son nom et ses réglages quand `name` est donné. Une vue pour tout le monde demande le rôle System Manager."""
	require_bureau()
	_require_filter_list(doctype)
	config = _clean_list_view_config(doctype, config)
	if name:
		doc = _list_view_for_write(name)
		if doc.reference_doctype != doctype:
			frappe.throw(_("Liste inconnue."))
		doc.label = _check_list_view_label(doctype, label, current=doc.name)
		doc.config = json.dumps(config)
		doc.save(ignore_permissions=True)
		return doc.name
	if cint(is_global) and not _can_share_filters():
		frappe.throw(_("Seul un System Manager peut partager une vue."), frappe.PermissionError)
	# Le rôle Desk User n'est pas exigé sur /bureau : les règles ci-dessus tiennent lieu de droits.
	return (
		frappe.get_doc(
			{"doctype": LIST_VIEW, "reference_doctype": doctype, "label": _check_list_view_label(doctype, label), "for_user": "" if cint(is_global) else frappe.session.user, "config": json.dumps(config)}
		)
		.insert(ignore_permissions=True)
		.name
	)


@frappe.whitelist(methods=["POST"])
def delete_list_view(name):
	"""Retire une vue : la sienne, ou une vue commune pour un System Manager."""
	require_bureau()
	doc = _list_view_for_write(name)
	if frappe.defaults.get_user_default(_list_view_default_key(doc.reference_doctype)) == doc.name:
		frappe.defaults.clear_user_default(_list_view_default_key(doc.reference_doctype))
	doc.delete(ignore_permissions=True)


@frappe.whitelist(methods=["POST"])
def set_default_list_view(doctype, name=None):
	"""Choisit la vue par défaut de la personne sur cette liste ; sans `name`, revient à la Vue standard."""
	require_bureau()
	_require_filter_list(doctype)
	key = _list_view_default_key(doctype)
	if not name:
		frappe.defaults.clear_user_default(key)
		return
	view = frappe.db.get_value(LIST_VIEW, name, ["reference_doctype", "for_user"], as_dict=True)
	if not view or view.reference_doctype != doctype or (view.for_user and view.for_user != frappe.session.user):
		frappe.throw(_("Vue inconnue."))
	frappe.defaults.set_user_default(key, name)


def _export_cell(value, fieldtype):
	"""Une valeur lisible dans un fichier : un nombre reste un nombre, et un texte mis en forme perd ses balises."""
	if value is None:
		return ""
	if isinstance(value, (int, float)):
		return value
	return strip_html(cstr(value)) if fieldtype in ("Text Editor", "HTML Editor") else cstr(value)


@frappe.whitelist(methods=["POST"])
def get_export_values(doctype, names, fields):
	"""Valeurs des champs choisis, pour des lignes que la personne peut lire. Plusieurs lignes d'une table enfant se suivent, séparées par des virgules."""
	require_bureau()
	_require_filter_list(doctype)
	names, fields = _parse(names) or [], _parse(fields) or []
	if len(names) > EXPORT_LINES_LIMIT:
		frappe.throw(_("Trop de lignes demandées."))
	catalog = _filter_catalog(doctype)
	own, children = [], {}
	for item in fields:
		table, fieldname = cstr(item.get("doctype")), cstr(item.get("field"))
		if (table, fieldname) not in catalog or fieldname == BELL_FILTER:
			frappe.throw(_("Filtre inconnu."))
		if table == doctype:
			own.append(fieldname)
		else:
			children.setdefault(table, []).append(fieldname)
	# `get_list` applique les droits : une ligne interdite ne revient pas, ni ses lignes enfants.
	rows = frappe.get_list(doctype, filters=[["name", "in", names]], fields=["name", *own], limit_page_length=0)
	readable = [row.name for row in rows]
	meta = frappe.get_meta(doctype)
	values = {}
	for row in rows:
		values[row.name] = {f"{doctype}.{fieldname}": _export_cell(row.get(fieldname), meta.get_field(fieldname).fieldtype if meta.get_field(fieldname) else "Data") for fieldname in own}
	for table, fieldnames in children.items():
		child = frappe.get_meta(table)
		for row in frappe.get_all(table, filters={"parent": ["in", readable], "parenttype": doctype}, fields=["parent", *fieldnames], order_by="idx asc", limit_page_length=0):
			for fieldname in fieldnames:
				cell = _export_cell(row.get(fieldname), child.get_field(fieldname).fieldtype)
				if cell == "":
					continue
				key = f"{table}.{fieldname}"
				current = values[row.parent].get(key)
				values[row.parent][key] = cell if current is None else f"{current}, {cell}"
	return values


def link_search_values(target, search, limit=LINK_SEARCH_LIMIT):
	"""Valeurs d'un doctype lié, avec les droits de lecture de la personne."""
	meta = frappe.get_meta(target)
	title = meta.title_field if meta.title_field and meta.has_field(meta.title_field) else None
	value = cstr(search).strip()
	or_filters = None
	if value:
		or_filters = [["name", "like", f"%{value}%"]]
		if title:
			or_filters.append([title, "like", f"%{value}%"])
	filters = []
	if meta.has_field("enabled"):
		filters.append(["enabled", "=", 1])
	if meta.has_field("disabled"):
		filters.append(["disabled", "=", 0])
	rows = frappe.get_list(target, filters=filters, or_filters=or_filters, fields=["name", title] if title else ["name"], order_by=f"{title or 'name'} asc", limit_page_length=limit)
	return [{"value": row.name, "label": cstr(row.get(title)) or row.name if title else row.name} for row in rows]


@frappe.whitelist()
def search_filter_link(list_doctype, doctype, field, search=None):
	"""Valeurs proposées pour un champ lien du panneau de filtres. Sans droit de lecture sur la cible, on saisit la valeur à la main."""
	require_bureau()
	_require_filter_list(list_doctype)
	entry = _filter_catalog(list_doctype).get((cstr(doctype), cstr(field)))
	if not entry or not entry.get("link_doctype"):
		frappe.throw(_("Filtre inconnu."))
	try:
		return link_search_values(entry["link_doctype"], search)
	except frappe.PermissionError:
		frappe.clear_messages()
		return []


def queue_level(ticket):
	"""Niveau de tri : une demande d'urgence en attente compte déjà."""
	level = URGENCE_RANK.get(cstr(ticket.get("niveau_urgence")), 0)
	if ticket.get("statut_demande_urgence") == "En attente":
		level = max(level, URGENCE_RANK.get(cstr(ticket.get("niveau_urgence_demande")), 0))
	return level


def queue_sort_key(ticket):
	return (-queue_level(ticket), cstr(ticket.get("echeance")) or "9999-12-31", cstr(ticket.get("creation")))


def _sort_text(value):
	"""Texte comparable : sans accents ni casse, pour que « Étui » se range avec les E."""
	decomposed = unicodedata.normalize("NFD", cstr(value))
	return "".join(char for char in decomposed if not unicodedata.combining(char)).casefold()


# Colonne triable → valeur de tri. L'étape n'y figure pas : elle se calcule ligne par ligne (`compute_steps`).
QUEUE_SORTS = {
	"client": lambda row: row.customer_name or row.customer,
	"type": lambda row: row.request_type,
	"status": lambda row: row.status,
	"urgence": queue_level,
	"echeance": lambda row: str(row.echeance) if row.echeance else None,
	"name": lambda row: row.name,
	"creance": lambda row: row.statut_creance,
	"commercial": lambda row: row.nom_commercial or row.commercial,
	"assigne": lambda row: row.assigne_a_nom,
	"creation": lambda row: str(row.creation),
	"date": lambda row: str(row.creation_date) if row.creation_date else None,
	"modified": lambda row: str(row.modified),
}


def order_queue(rows, view, sort=None, direction=None):
	"""Ordre de la vue : la colonne choisie (lignes sans valeur à la fin), sinon urgence puis échéance."""
	if sort:
		value_of = QUEUE_SORTS.get(sort)
		if not value_of:
			frappe.throw(_("Tri inconnu : {0}").format(sort))
		filled, empty = [], []
		for row in rows:
			value = value_of(row)
			(empty if value in (None, "") else filled).append((_sort_text(value) if isinstance(value, str) else value, row))
		filled.sort(key=lambda pair: pair[0], reverse=direction == "desc")
		return [row for _value, row in filled] + [row for _value, row in empty]
	if view == "closed":
		return sorted(rows, key=lambda row: cstr(row.modified), reverse=True)
	return sorted(rows, key=queue_sort_key)


def page_bounds(total, start, page_length):
	"""Début et taille valides : une page devenue vide ramène à la dernière page qui existe."""
	length = min(max(cint(page_length) or DEFAULT_PAGE_LENGTH, 1), MAX_PAGE_LENGTH)
	first = max(cint(start), 0)
	if first >= total:
		first = max(total - 1, 0) // length * length
	return first, length


def _search_filters(search):
	value = cstr(search).strip()
	if not value:
		return None
	pattern = f"%{value}%"
	return [["customer_name", "like", pattern], ["customer", "like", pattern], ["name", "like", pattern]]


def _parse(value):
	return json.loads(value) if isinstance(value, str) and value else value


def row_tags(row):
	"""Tags d'une ligne de liste : la colonne `_user_tags` les range sous la forme « ,tag1,tag2 »."""
	return [tag for tag in cstr(row.get("_user_tags")).split(",") if tag]


def row_bell(row):
	"""La cloche de la personne connectée sur une ligne de liste, lue dans le `_liked_by` du Desk."""
	return frappe.session.user in (_parse(row.get(BELL_FIELD)) or [])


def _queue_row(ticket, user, current_day, cycle=None, commande=None):
	echeance = str(ticket.echeance) if ticket.get("echeance") else None
	return {
		"name": ticket.name,
		"modified": str(ticket.modified),
		"creation": str(ticket.creation),
		"date": str(ticket.creation_date) if ticket.get("creation_date") else None,
		"tags": row_tags(ticket),
		"cloche": row_bell(ticket),
		"client": ticket.customer_name or ticket.customer,
		"commercial": ticket.nom_commercial or ticket.commercial,
		"request_type": ticket.request_type,
		"status": ticket.status,
		"statut_creance": ticket.statut_creance,
		"step": _queue_step(compute_steps(ticket, cycle, commande)),
		"echeance": echeance,
		"is_late": bool(echeance and echeance < current_day and _is_open(ticket.status)),
		"niveau_urgence": ticket.niveau_urgence or "U0",
		"urgence_en_attente": ticket.statut_demande_urgence == "En attente" and _is_open(ticket.status),
		"niveau_urgence_demande": ticket.niveau_urgence_demande,
		"assigne_a": ticket.assigne_a,
		"assigne_a_nom": ticket.assigne_a_nom,
		"mine": ticket.assigne_a == user,
	}


def _queue_step(timeline):
	"""Résumé de la timeline pour une ligne de la file."""
	steps = timeline["steps"]
	current = timeline["current"]
	return {
		"label": steps[current if current is not None else -1]["label"],
		"current": current,
		"done": sum(1 for step in steps if step["state"] == "done"),
		"total": len(steps),
	}


def _queue_documents(tickets):
	"""Documents du cycle de chaque ligne, lus en une fois : la file peut compter 500 tickets.

	Renvoie, par ticket, ce dont `compute_steps` a besoin et qui donne le même résultat que `get_cycle_documents`.
	"""
	names = [ticket.name for ticket in tickets]
	if not names:
		return {}, {}
	cycles = {name: {"demandes": [], "dossiers": []} for name in names}

	dossiers = frappe.get_all(
		"Dossier Essai Blanc",
		filters={"ticket_commercial": ["in", names]},
		fields=["name", "status", "ticket_commercial"],
		order_by="modified desc",
	)
	for dossier in dossiers:
		cycles[dossier.ticket_commercial]["dossiers"].append(dossier)

	demandes = frappe.get_all(
		"Demande Faisabilite",
		filters={"ticket_commercial": ["in", names]},
		fields=["name", "status", "ticket_commercial"],
		order_by="modified desc",
	)
	orders_by_demande = {}
	if demandes:
		orders = frappe.get_all(
			"Sales Order",
			filters={"custom_demande_de_faisabilité": ["in", [demande.name for demande in demandes]], "docstatus": ["!=", 2]},
			fields=["name", "status", "docstatus", "custom_demande_de_faisabilité as demande"],
		)
		for order in orders:
			orders_by_demande.setdefault(order.demande, []).append({**order, "doctype": "Sales Order"})
	for demande in demandes:
		cycles[demande.ticket_commercial]["demandes"].append(
			{"name": demande.name, "status": demande.status, "sales_documents": orders_by_demande.get(demande.name, [])}
		)

	devis = {ticket.name: ticket.devis_rapproche for ticket in tickets if ticket.request_type == "Bon de commande" and ticket.devis_rapproche}
	orders_by_devis = {}
	if devis:
		orders = frappe.get_all(
			"Sales Order",
			filters={"custom_devis": ["in", list(set(devis.values()))], "docstatus": ["!=", 2]},
			fields=["name", "status", "docstatus", "custom_devis"],
			order_by="modified asc",
		)
		# Tri croissant : la commande la plus récente de chaque devis reste, comme dans `_commande_for_devis`.
		orders_by_devis = {order.custom_devis: order for order in orders}
	commandes = {name: orders_by_devis.get(quotation) for name, quotation in devis.items()}
	return cycles, commandes


@frappe.whitelist()
def get_queue(view="todo", conditions=None, search=None, start=0, page_length=DEFAULT_PAGE_LENGTH, sort=None, direction=None):
	"""Une page de la file, le total et l'ordre de toute la vue, et les compteurs de toutes les vues pour les mêmes filtres."""
	user = require_bureau()
	base = condition_filters(_parse(conditions), TICKET)
	or_filters = _search_filters(search)

	counts = {}
	for name in ("todo", "mine", "urgent", "creance", "closed"):
		rows = frappe.get_list(
			TICKET,
			filters=base + view_filters(name, user),
			or_filters=or_filters,
			fields=["count(name) as total"],
			limit_page_length=0,
		)
		counts[name] = rows[0].total if rows else 0

	ordered = order_queue(
		frappe.get_list(
			TICKET,
			filters=base + view_filters(view, user),
			or_filters=or_filters,
			fields=QUEUE_ORDER_FIELDS,
			limit_page_length=0,
		),
		view,
		sort,
		direction,
	)
	names = [row.name for row in ordered]
	first, length = page_bounds(len(names), start, page_length)
	page_names = names[first : first + length]

	# Les étapes coûtent cher : seules les lignes de la page les calculent.
	tickets = frappe.get_list(TICKET, filters=[["name", "in", page_names]], fields=QUEUE_FIELDS, limit_page_length=0) if page_names else []
	position = {name: index for index, name in enumerate(page_names)}
	tickets.sort(key=lambda ticket: position[ticket.name])

	current_day = today()
	cycles, commandes = _queue_documents(tickets)
	comments = activity.comment_counts(TICKET, page_names)
	return {
		"tickets": [
			{
				**_queue_row(ticket, user, current_day, cycles.get(ticket.name), commandes.get(ticket.name)),
				"comments": comments.get(ticket.name, 0),
			}
			for ticket in tickets
		],
		"counts": counts,
		"total": len(names),
		"start": first,
		"page_length": length,
		# Toute la vue, pour aller au ticket voisin depuis la fiche, au-delà de la page affichée.
		"names": names,
	}


def _select_options(fieldname):
	return [option for option in (frappe.get_meta(TICKET).get_field(fieldname).options or "").split("\n") if option]


@frappe.whitelist()
def export_xlsx(title, headers, rows):
	"""Classeur Excel des lignes que la liste a déjà lues, en base 64. Un nombre reste un nombre, et tout le reste du texte : rien ne s'exécute à l'ouverture."""
	require_bureau()
	workbook = Workbook()
	sheet = workbook.active
	sheet.title = INVALID_SHEET_CHARS.sub(" ", cstr(title))[:31] or "Export"
	rows = _parse(rows) or []
	headers = _parse(headers) or []
	for row_index, values in enumerate([headers, *rows], start=1):
		for column_index, value in enumerate(values, start=1):
			if isinstance(value, (int, float)):
				cell = sheet.cell(row=row_index, column=column_index, value=value)
			else:
				cell = sheet.cell(row=row_index, column=column_index, value=ILLEGAL_CHARACTERS_RE.sub("", cstr(value)))
				cell.data_type = "s"
			if row_index == 1:
				cell.font = Font(bold=True)
	sheet.freeze_panes = "A2"
	for column_index, header in enumerate(headers, start=1):
		longest = max((len(cstr(row[column_index - 1])) for row in rows if len(row) >= column_index), default=0)
		sheet.column_dimensions[get_column_letter(column_index)].width = min(max(longest, len(cstr(header))) + 2, 60)
	output = io.BytesIO()
	workbook.save(output)
	return base64.b64encode(output.getvalue()).decode()


@frappe.whitelist()
def get_references():
	"""Valeurs proposées dans les filtres de la file."""
	require_bureau()
	users = _back_office_users()
	return {
		"types": _select_options("request_type"),
		"statuses": _select_options("status"),
		"urgences": _select_options("niveau_urgence"),
		"creances": _select_options("statut_creance"),
		"assignees": [{"value": user.name, "label": user.full_name or user.name} for user in users],
		"nobody": NOBODY,
		"filter_fields": doctype_filter_fields(TICKET, {"assigne_a": [{"value": NOBODY, "label": _("Non attribué")}, *[{"value": user.name, "label": user.full_name or user.name} for user in users]]}),
	}


def _format_day(value):
	return getdate(value).strftime("%d/%m/%Y") if value else ""


def _active_demandes(cycle):
	return [demande for demande in cycle.get("demandes") or [] if demande.get("status") != "Annulée"]


def _commande_from_cycle(cycle):
	"""Commande non annulée parmi les documents de vente du cycle."""
	for group in (cycle.get("demandes") or []) + (cycle.get("dossiers") or []):
		for document in group.get("sales_documents") or []:
			if document.get("doctype") == "Sales Order" and cint(document.get("docstatus")) != 2:
				return document
	return None


def _reference(document):
	return f"{document.get('name')} · {document.get('status')}" if document else ""


def compute_steps(ticket, cycle=None, commande=None):
	"""Étapes de la timeline, selon le type de ticket et l'état réel de ses documents.

	Source unique du calcul : la file, l'écran et les futurs rapports donnent ainsi la même réponse.
	La timeline guide sans imposer d'ordre : seules les règles du serveur bloquent une action.
	"""
	cycle = cycle or {}
	status = cstr(ticket.get("status"))
	request_type = cstr(ticket.get("request_type"))
	closed = status in CLOSED_STATUSES
	checks = CHECKLIST_TERMINE_FIELDS.get(request_type, ())
	checked = sum(1 for fieldname in checks if cint(ticket.get(fieldname)))

	received = {"key": "recu", "label": "Ticket reçu", "done": True, "detail": _format_day(ticket.get("creation_date"))}
	started = {
		"key": "charge",
		"label": "Pris en charge",
		"done": status != "Nouveau",
		"detail": cstr(ticket.get("assigne_a_nom")),
	}
	finish = {
		"key": "fin",
		"label": "Annulé" if status == "Annulé" else "Terminé",
		"done": closed,
		"detail": f"Pièces {checked}/{len(checks)}" if checks else "",
	}
	demandes = _active_demandes(cycle)

	if request_type == "Bon de commande":
		decision = cstr(ticket.get("decision_rapprochement"))
		devis = cstr(ticket.get("devis_rapproche"))
		order = commande or _commande_from_cycle(cycle)
		if decision == WANTS_NEW_DEMANDE:
			demande_name = cstr(ticket.get("demande_faisabilite_rapprochee"))
			demande = next((d for d in demandes if d.get("name") == demande_name), None) or (demandes[0] if demandes else None)
			document = {"key": "doc", "label": "Demande de faisabilité", "done": bool(demande), "detail": _reference(demande)}
		else:
			document = {
				"key": "doc",
				"label": "Commande" if devis else "Commande ou demande",
				"done": bool(order),
				"detail": _reference(order),
			}
		decision_detail = devis or {WANTS_NEW_DEMANDE: "Nouvelle demande", NO_CANDIDATE: "Aucun candidat"}.get(decision, "")
		steps = [
			received,
			started,
			{
				"key": "creance",
				"label": "Créance vérifiée",
				"done": cstr(ticket.get("statut_creance")) in CREANCE_OK,
				"blocked": status == STATUS_BLOCKED,
				"detail": cstr(ticket.get("statut_creance")) or "Non vérifiée",
			},
			{"key": "rappro", "label": "Rapprochement", "done": decision in DECIDED, "detail": decision_detail},
			document,
			finish,
		]
	elif request_type == "Demande de devis":
		steps = [
			received,
			started,
			{"key": "check", "label": "Articles vérifiés", "done": bool(cint(ticket.get("checklist_dd_articles")))},
			{
				"key": "doc",
				"label": "Demande de faisabilité",
				"done": bool(demandes),
				"detail": _reference(demandes[0]) if demandes else "",
			},
			{
				"key": "confirm",
				"label": "Demande confirmée",
				"done": any(d.get("status") != "Brouillon" for d in demandes),
			},
			finish,
		]
	elif request_type == "Essai Blanc":
		dossiers = cycle.get("dossiers") or []
		steps = [
			received,
			started,
			{"key": "check", "label": "Articles vérifiés", "done": bool(cint(ticket.get("checklist_eb_articles")))},
			{
				"key": "doc",
				"label": "Dossier essai à blanc",
				"done": bool(dossiers),
				"detail": _reference(dossiers[0]) if dossiers else "",
			},
			finish,
		]
	elif request_type == "Réclamation":
		steps = [
			received,
			started,
			{"key": "check", "label": "Photo", "done": bool(cint(ticket.get("checklist_rec_photo")))},
			{"key": "check", "label": "Quantités impactées", "done": bool(cint(ticket.get("checklist_rec_quantites")))},
			finish,
		]
	else:
		steps = [received, started, finish]

	current = None if closed else next((index for index, step in enumerate(steps) if not step["done"]), None)
	output = []
	for index, step in enumerate(steps):
		if step["done"]:
			state = "done"
		elif step.get("blocked"):
			state = "blocked"
		elif index == current:
			state = "paused" if status == STATUS_PAUSED else "current"
		else:
			state = "todo"
		detail = "En pause" if state == "paused" else cstr(step.get("detail"))
		output.append({"key": step["key"], "label": step["label"], "state": state, "detail": detail})
	return {"steps": output, "current": current}


def _ticket_documents(name, user, is_open=True):
	"""Fichiers joints au ticket. Le droit de lecture sur le ticket est contrôlé par l'appelant, comme sur le Desk."""
	files = frappe.get_all(
		"File",
		filters={"attached_to_doctype": TICKET, "attached_to_name": name, "is_folder": 0},
		fields=["name", "file_name", "file_url", "owner", "creation"],
		order_by="creation asc",
	)
	return [
		{
			"name": file.name,
			"file_name": file.file_name or file.file_url,
			"file_url": file.file_url,
			"owner_name": get_fullname(file.owner),
			"creation": str(file.creation),
			"can_remove": bool(is_open and file.owner == user),
		}
		for file in files
	]


def _commande_for_devis(devis):
	"""Commande issue du devis retenu : ce devis peut venir d'une demande non liée à ce ticket."""
	if not devis:
		return None
	rows = frappe.get_all(
		"Sales Order",
		filters={"custom_devis": devis, "docstatus": ["!=", 2]},
		fields=["name", "status", "docstatus"],
		order_by="modified desc",
		limit_page_length=1,
	)
	return rows[0] if rows else None


def _site_title(site):
	if not site:
		return None
	title_field = frappe.get_meta("Site Production").title_field
	return (frappe.db.get_value("Site Production", site, title_field) if title_field else None) or site


def _available_actions(doc):
	"""Actions du workflow que cet utilisateur peut lancer sur ce ticket, dans leur ordre de définition."""
	actions = []
	for transition in get_transitions(doc):
		if transition.action not in actions and transition.action not in HIDDEN_ACTIONS:
			actions.append(transition.action)
	return actions


@frappe.whitelist()
def get_ticket(name):
	"""Ticket complet pour l'écran de traitement : champs, étapes, actions, documents et cycle."""
	user = require_bureau()
	doc = frappe.get_doc(TICKET, name)
	doc.check_permission("read")

	cycle = get_cycle_documents(doc.name)
	commande = _commande_for_devis(doc.devis_rapproche) if doc.request_type == "Bon de commande" else None
	# Les documents font foi, même sur un ticket pas encore réenregistré : un ticket clos garde ce qu'il avait.
	pieces = dossier_pieces(doc, cycle, commande)
	if _is_open(doc.status):
		apply_pieces(doc, pieces)
	timeline = compute_steps(doc.as_dict(), cycle, commande)
	meta = frappe.get_meta(TICKET)
	echeance = str(doc.echeance) if doc.echeance else None
	can_write = bool(doc.has_permission("write"))

	return {
		"name": doc.name,
		"modified": str(doc.modified),
		"tags": row_tags(doc.as_dict()),
		"can_write": can_write,
		"actions": _available_actions(doc) if can_write else [],
		"request_type": doc.request_type,
		"status": doc.status,
		"customer": doc.customer,
		"client": doc.customer_name or doc.customer,
		"commercial": doc.nom_commercial or doc.commercial,
		"site": _site_title(doc.site),
		"priority": doc.priority,
		"echeance": echeance,
		"is_late": bool(echeance and echeance < today() and _is_open(doc.status)),
		"creation_date": str(doc.creation_date) if doc.creation_date else None,
		"assigne_a": doc.assigne_a,
		"assigne_a_nom": doc.assigne_a_nom,
		"mine": doc.assigne_a == user,
		"description": doc.description,
		"niveau_urgence": doc.niveau_urgence or "U0",
		"niveau_urgence_demande": doc.niveau_urgence_demande,
		"statut_demande_urgence": doc.statut_demande_urgence,
		"descr_urgence": doc.descr_urgence,
		"commentaire_validation_urgence": doc.commentaire_validation_urgence,
		"statut_creance": doc.statut_creance,
		"motif_blocage_creance": doc.motif_blocage_creance,
		"creance_verifiee_par": get_fullname(doc.creance_verifiee_par) if doc.creance_verifiee_par else None,
		"decision_rapprochement": doc.decision_rapprochement,
		"commentaire_rapprochement": doc.commentaire_rapprochement,
		"devis_rapproche": doc.devis_rapproche,
		"demande_faisabilite_rapprochee": doc.demande_faisabilite_rapprochee,
		"pieces": pieces,
		"steps": timeline["steps"],
		"current_step": timeline["current"],
		"documents": _ticket_documents(doc.name, user, _is_open(doc.status)),
		"cycle": cycle,
		"commande": commande,
		"comments": activity.comment_summary(TICKET, doc.name),
		"demande_creation": ticket_demande_state(doc),
	}


def ticket_demande_state(doc):
	"""Une demande de faisabilité peut-elle partir de ce ticket ? Contrôlé aussi à la création."""
	procede = get_expected_procede_from_ticket(doc.name)

	def state(key, reason=None):
		return {"state": key, "reason": reason, "procede": procede}

	if doc.status in CLOSED_STATUSES:
		return state("closed", _("Ce ticket est clos."))
	if doc.request_type == "Essai Blanc":
		return state("essai_blanc", _("Ce type de ticket passe par un dossier d'essai, pas par une demande de faisabilité."))
	if doc.request_type not in DEMANDE_TICKET_TYPES:
		return state("other_type", _("Une demande de faisabilité ne part que d'une demande de devis ou d'un bon de commande."))
	if doc.status != "En Cours":
		return state("not_started", _("La demande se crée quand le ticket est En Cours."))
	if not frappe.has_permission("Demande Faisabilite", "create"):
		return state("no_right", _("Votre rôle ne permet pas de créer une demande de faisabilité."))
	if not doc.customer:
		return state("no_client", _("Renseignez le client du ticket."))
	if procede not in FAISABILITE_PROCEDES:
		return state("no_procede", _("Le site de ce ticket n'a pas de procédé Offset ou Flexo. Renseignez le site du ticket pour pouvoir ajouter des articles."))
	return state("ready")


def _ticket_for_write(name, modified):
	"""Ticket à modifier : droit d'écriture, et version identique à celle affichée à l'écran."""
	require_bureau()
	doc = frappe.get_doc(TICKET, name)
	doc.check_permission("write")
	if modified and cstr(modified) != str(doc.modified):
		frappe.throw(
			_("Ce ticket vient d'être modifié par ailleurs. Il a été rechargé : vérifiez-le, puis recommencez."),
			frappe.TimestampMismatchError,
		)
	return doc


@frappe.whitelist(methods=["POST"])
def run_action(name, modified, action):
	"""Lance une action du workflow (Démarrer, Pause, Reprendre, Débloquer Créance, Terminer, Annuler)."""
	apply_workflow(_ticket_for_write(name, modified), cstr(action))
	return get_ticket(name)


@frappe.whitelist(methods=["POST"])
def set_creance(name, modified, statut, motif=None):
	"""Statut créance d'un bon de commande. `Bloquée` exige un motif et passe le ticket en Blocage Créance."""
	doc = _ticket_for_write(name, modified)
	if doc.request_type != "Bon de commande":
		frappe.throw(_("La créance ne concerne que les tickets de type Bon de commande."))
	doc.statut_creance = cstr(statut)
	if motif is not None:
		doc.motif_blocage_creance = cstr(motif).strip() or None
	doc.save()
	return get_ticket(name)


@frappe.whitelist(methods=["POST"])
def set_articles_verified(name, modified, verified=1):
	"""Signe ou retire la vérification des articles, quand aucune demande ne les porte."""
	doc = _ticket_for_write(name, modified)
	if not any(piece["key"] == "articles" for piece in dossier_pieces(doc)):
		frappe.throw(_("Cette pièce n'existe pas pour ce type de ticket."))
	doc.articles_verifies_par = frappe.session.user if cint(verified) else None
	doc.articles_verifies_le = now_datetime() if cint(verified) else None
	doc.save()
	return get_ticket(name)


@frappe.whitelist(methods=["POST"])
def set_quantites_impactees(name, modified, value):
	"""Quantités impactées d'une réclamation : une valeur, et plus une case."""
	doc = _ticket_for_write(name, modified)
	if doc.request_type != "Réclamation":
		frappe.throw(_("Cette pièce n'existe pas pour ce type de ticket."))
	quantity = flt(value)
	if quantity < 0:
		frappe.throw(_("La quantité ne peut pas être négative."))
	doc.quantites_impactees = quantity
	doc.save()
	return get_ticket(name)


@frappe.whitelist(methods=["POST"])
def decide_urgence(name, modified, action, niveau=None, commentaire=None):
	"""Valide ou refuse la demande d'urgence, selon les règles de `process_urgence_decision`."""
	_ticket_for_write(name, modified)
	process_urgence_decision(name, action, niveau, commentaire)
	return get_ticket(name)


@frappe.whitelist(methods=["POST"])
def decide_rapprochement(name, modified, decision=None, devis=None, commentaire=None):
	"""Enregistre la décision de rapprochement, selon les règles de `save_ticket_rapprochement_decision`."""
	_ticket_for_write(name, modified)
	save_ticket_rapprochement_decision(name, decision or "", devis, None, commentaire)
	return get_ticket(name)


def _back_office_users():
	members = frappe.get_all("Has Role", filters={"role": ROLE_BACK_OFFICE, "parenttype": "User"}, pluck="parent")
	return frappe.get_all(
		"User",
		filters={"name": ["in", members or [""]], "enabled": 1},
		fields=["name", "full_name"],
		order_by="full_name asc",
	)


def _check_assignable(user):
	if user != frappe.session.user and user not in {row.name for row in _back_office_users()}:
		frappe.throw(_("Ce ticket ne peut être attribué qu'à une personne du back office."))


def _assign(doc, user):
	"""Attribue le ticket. Renvoie le message d'échec, ou None."""
	result = update_assigne_a(doc.name, user)
	if result.get("status") != "success":
		return result.get("message") or _("Attribution impossible.")
	# `update_assigne_a` écrit sans déclencher `on_change` : les collègues doivent quand même le voir.
	from aurescrm.bureau_events import on_change  # bureau_events importe ce module

	on_change(doc)
	return None


@frappe.whitelist(methods=["POST"])
def set_assignee(name, user):
	"""Attribue le ticket à une personne du back office."""
	require_bureau()
	_check_assignable(user)
	doc = frappe.get_doc(TICKET, name)
	failure = _assign(doc, user)
	if failure:
		frappe.throw(failure)
	return get_ticket(name)


def _bulk_apply(items, apply, load=None):
	"""Applique une écriture à chaque document, séparément : un refus n'empêche pas de traiter les autres.

	`items` : [{name, modified}] tels qu'affichés dans la liste. `load(name, modified)` charge le document et contrôle
	droits et version (un ticket par défaut). `apply(doc)` renvoie la raison de ne pas le traiter, ou None. Chaque
	document est validé à part, pour qu'une requête interrompue garde ce qui est déjà fait.
	"""
	load = load or _ticket_for_write
	rows = _parse(items) or []
	if not rows:
		frappe.throw(_("Aucune ligne sélectionnée."))
	if len(rows) > BULK_LIMIT:
		frappe.throw(_("Sélectionnez au plus {0} lignes à la fois.").format(BULK_LIMIT))

	done, skipped = [], []
	for row in rows:
		name = cstr(row.get("name"))
		frappe.db.savepoint(BULK_SAVEPOINT)
		try:
			reason = apply(load(name, row.get("modified")))
		except (frappe.ValidationError, frappe.PermissionError) as error:
			frappe.db.rollback(save_point=BULK_SAVEPOINT)
			reason = strip_html(cstr(error)) or _("Action refusée.")
		except Exception:
			frappe.db.rollback(save_point=BULK_SAVEPOINT)
			frappe.log_error(title=f"Poste de bureau : action groupée sur {name}")
			reason = _("Erreur inattendue.")
		# Les messages d'un document ne doivent pas remonter comme une erreur de toute la requête.
		frappe.clear_messages()
		if reason:
			skipped.append({"name": name, "reason": reason})
		else:
			done.append(name)
		frappe.db.commit()
	return {"done": done, "skipped": skipped}


@frappe.whitelist(methods=["POST"])
def bulk_assign(items, user):
	"""Attribue plusieurs tickets ouverts à une personne du back office."""
	require_bureau()
	_check_assignable(user)

	def apply(doc):
		return _("Ticket clos.") if not _is_open(doc.status) else _assign(doc, user)

	return _bulk_apply(items, apply)


@frappe.whitelist(methods=["POST"])
def bulk_action(items, action):
	"""Lance une même action du workflow sur plusieurs tickets. Seuls ceux à qui elle s'applique sont traités."""
	require_bureau()
	action = cstr(action)
	if action not in BULK_ACTIONS:
		frappe.throw(_("Cette action ne se lance pas sur plusieurs tickets."))

	def apply(doc):
		if action not in _available_actions(doc):
			return _("Action non disponible pour ce ticket.")
		apply_workflow(doc, action)
		return None

	return _bulk_apply(items, apply)


@frappe.whitelist(methods=["POST"])
def remove_document(name, file):
	"""Retire un fichier que l'utilisateur a lui-même joint à ce ticket, tant que le ticket est ouvert."""
	user = require_bureau()
	doc = frappe.get_doc(TICKET, name)
	doc.check_permission("write")
	row = frappe.db.get_value(
		"File", file, ["attached_to_doctype", "attached_to_name", "owner"], as_dict=True
	)
	if not row or row.attached_to_doctype != TICKET or row.attached_to_name != doc.name:
		frappe.throw(_("Ce fichier n'est pas joint à ce ticket."))
	if row.owner != user:
		frappe.throw(_("Seule la personne qui a joint ce fichier peut le retirer."), frappe.PermissionError)
	if not _is_open(doc.status):
		frappe.throw(_("Les fichiers d'un ticket clos ne peuvent plus être retirés."))
	# Droits contrôlés ci-dessus : le rôle n'a pas forcément de droit direct sur le DocType File.
	frappe.delete_doc("File", file, ignore_permissions=True)
	return get_ticket(name)


def _commercial_users():
	members = frappe.get_all("Has Role", filters={"role": ["in", list(COMMERCIAL_ROLES)], "parenttype": "User"}, pluck="parent")
	return frappe.get_all(
		"User",
		filters={"name": ["in", members or [""]], "enabled": 1, "user_type": "System User"},
		fields=["name", "full_name"],
		order_by="full_name asc",
	)


@frappe.whitelist()
def get_ticket_form_options():
	"""Listes de la fenêtre de création. L'urgence de chaque type reprend la règle appliquée à l'enregistrement."""
	require_bureau()
	return {
		"types": [{"value": value, "urgence": default_niveau_urgence_pour_creation(value)} for value in _select_options("request_type")],
		"channels": _select_options("channel"),
		"sites": [
			{"value": site.name, "label": site.title or site.name}
			for site in frappe.get_list("Site Production", fields=["name", "title"], order_by="title asc", limit_page_length=0)
		],
		"commercials": [{"value": user.name, "label": user.full_name or user.name} for user in _commercial_users()],
	}


@frappe.whitelist()
def search_clients(search=None):
	"""Clients proposés à la création, avec leur commercial et leurs tickets ouverts pour repérer un doublon."""
	require_bureau()
	value = cstr(search).strip()
	pattern = f"%{value}%"
	clients = frappe.get_list(
		"Customer",
		filters={"disabled": 0},
		or_filters=[["customer_name", "like", pattern], ["name", "like", pattern], ["custom_wilaya", "like", pattern]] if value else None,
		fields=["name", "customer_name", "custom_wilaya", CLIENT_COMMERCIAL_FIELD],
		order_by="customer_name asc",
		limit_page_length=CLIENT_SEARCH_LIMIT,
	)
	names = [client.name for client in clients]
	open_tickets = {}
	if names:
		rows = frappe.get_list(
			TICKET,
			filters={"customer": ["in", names], "status": ["not in", CLOSED_STATUSES]},
			fields=["customer", "count(name) as total"],
			group_by="customer",
			limit_page_length=0,
		)
		open_tickets = {row.customer: row.total for row in rows}
	return [
		{
			"name": client.name,
			"label": client.customer_name or client.name,
			"wilaya": client.custom_wilaya,
			"commercial": client.get(CLIENT_COMMERCIAL_FIELD),
			"commercial_name": get_fullname(client.get(CLIENT_COMMERCIAL_FIELD)) if client.get(CLIENT_COMMERCIAL_FIELD) else None,
			"open_tickets": open_tickets.get(client.name, 0),
		}
		for client in clients
	]


def _description_html(text):
	paragraphs = [escape_html(paragraph.strip()).replace("\n", "<br>") for paragraph in cstr(text).split("\n\n") if paragraph.strip()]
	return "".join(f"<p>{paragraph}</p>" for paragraph in paragraphs)


@frappe.whitelist(methods=["POST"])
def create_ticket(customer=None, request_type=None, site=None, description=None, commercial=None, channel=None, echeance=None):
	"""Crée un ticket. Le commercial est par défaut celui du client : le ticket apparaît ainsi dans son suivi."""
	require_bureau()
	for value, label in ((customer, _("Le client")), (request_type, _("Le type de demande")), (site, _("Le site de production"))):
		if not cstr(value).strip():
			frappe.throw(_("{0} est obligatoire.").format(label))
	if not cstr(description).strip():
		frappe.throw(_("Décrivez la demande."))
	assigned = frappe.db.get_value("Customer", customer, CLIENT_COMMERCIAL_FIELD)
	if commercial and commercial != assigned and commercial not in {user.name for user in _commercial_users()}:
		frappe.throw(_("Choisissez un commercial de la liste."))
	doc = frappe.get_doc(
		{
			"doctype": TICKET,
			"customer": customer,
			"request_type": request_type,
			"site": site,
			"priority": "Moyenne",
			# Sans cela, un rôle exempté de la règle d'urgence garderait la valeur par défaut du champ (U0).
			"niveau_urgence": default_niveau_urgence_pour_creation(request_type),
			"channel": channel or None,
			"echeance": echeance or None,
			"description": _description_html(description),
			"commercial": commercial or assigned or frappe.session.user,
		}
	)
	doc.insert()
	return {"name": doc.name}


@frappe.whitelist()
def get_activity(name):
	"""Commentaires et activité du ticket : les mêmes que sur le Desk."""
	require_bureau()
	return activity.get_feed(TICKET, name)


@frappe.whitelist()
def get_mention_candidates():
	require_bureau()
	return activity.mention_candidates()


@frappe.whitelist(methods=["POST"])
def add_comment(name, text, mentions=None):
	require_bureau()
	return activity.add_comment(TICKET, name, text, mentions)


@frappe.whitelist(methods=["POST"])
def update_comment(name, comment, text, mentions=None):
	require_bureau()
	return activity.update_comment(TICKET, name, comment, text, mentions)


@frappe.whitelist(methods=["POST"])
def delete_comment(name, comment):
	require_bureau()
	return activity.delete_comment(TICKET, name, comment)
