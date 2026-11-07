# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Accueil du poste Étude (/bureau) : où en sont les études, ce qui attend l'équipe, ce qui manque.

Lecture seule : les actions passent par `bureau_etudes.py`. Tout part des documents que le rôle peut lire, Offset,
Flexo ou les deux. La condition pour conclure est lue dans le workflow, comme sur la fiche.
"""

import frappe
from frappe import _
from frappe.model.workflow import get_workflow_name
from frappe.utils import date_diff, getdate, today

from aurescrm.api.bureau import require_bureau
from aurescrm.api.bureau_accueil import _condition, summarize_stage
from aurescrm.api.bureau_articles import _customers
from aurescrm.api.bureau_etudes import (
	FLEXO,
	OFFSET,
	OPEN_STATUSES,
	PIECES,
	_fetch,
	_list_row,
	condition_fields,
	order_etudes,
	readable_doctypes,
)

STATUS_NEW, STATUS_RUNNING = OPEN_STATUSES
STATUSES = (*OPEN_STATUSES, "Réalisable", "Non Réalisable", "Annulée")
ACTION_START = "Démarrer"
ACTION_CONCLUDE = "Réalisable"
URGENT = "U3"
GROUPS = ("urgent", "ready", "start", "missing")
PROCEDES = {OFFSET: "Offset", FLEXO: "Flexo"}
STAGE_KEYS = {OFFSET: "etudes_offset", FLEXO: "etudes_flexo"}
# Lignes montrées par groupe : au-delà, la liste des études prend le relais.
MAX_GROUP_ROWS = 10


def _transitions(doctype):
	workflow = get_workflow_name(doctype)
	return frappe.get_doc("Workflow", workflow).transitions if workflow else []


def required_fields(doctype, transitions):
	"""Ce qu'il faut pour conclure : la condition du workflow, ou à défaut toutes les pièces de l'étude."""
	for transition in transitions:
		if transition.action == ACTION_CONCLUDE and transition.condition:
			fields = condition_fields(transition.condition)
			if fields:
				return fields
	return [key for key, _label, _target in PIECES[doctype]]


def allowed_actions(transitions, roles):
	"""Les couples (état, action) permis à ces rôles. La condition reste contrôlée au moment d'agir."""
	return {(row.state, row.action) for row in transitions if row.allowed in roles}


def queue_group(status, urgence, missing):
	"""Le groupe d'une étude ouverte : l'urgence d'abord, puis ce qui la fait avancer."""
	if urgence == URGENT:
		return "urgent"
	if status == STATUS_NEW:
		return "start"
	return "missing" if missing else "ready"


def row_action(status, missing, allowed, can_write):
	"""Le bouton de la ligne. Seul Démarrer agit sur place : conclure demande de relire la fiche."""
	if status == STATUS_NEW and (status, ACTION_START) in allowed:
		return {"kind": "run", "label": _(ACTION_START), "action": ACTION_START}
	if status == STATUS_RUNNING and not missing and (status, ACTION_CONCLUDE) in allowed:
		return {"kind": "link", "label": _("Conclure")}
	if status == STATUS_RUNNING and missing and can_write:
		return {"kind": "link", "label": _("Compléter")}
	return {"kind": "open", "label": _("Ouvrir")}


def _stage(doctype, rows):
	return {
		"key": STAGE_KEYS[doctype],
		"label": _("Études {0}").format(PROCEDES[doctype]),
		"to": "Etudes",
		"href": None,
		"third_party": False,
		"late": sum(1 for row in rows if row["retard"]),
		**summarize_stage(rows, STATUSES, today()),
	}


def _watch(opened, late, assigned, gaps, primary):
	"""Ce qui mérite un regard. Une ligne n'ouvre la liste filtrée que si le premier document de la liste connaît ce champ."""
	rows = [
		{"key": "ouvertes", "label": _("Études ouvertes"), "count": opened, "total": None, "view": "traiter"},
		{"key": "retard", "label": _("Échéance dépassée"), "count": late, "total": None, "view": "retard", "alert": bool(late)},
		{"key": "attribuees", "label": _("Attribuées"), "count": assigned, "total": opened, "conditions": [_condition(primary, "assigne_a", "is", "set")]},
	]
	for doctype, field, label, count, total in gaps:
		rows.append(
			{
				"key": f"{STAGE_KEYS[doctype]}_{field}",
				"label": label,
				"count": count,
				"total": total,
				"conditions": [_condition(doctype, field)] if doctype == primary else None,
			}
		)
	return rows


def _field_label(doctype, field):
	for key, label, _target in PIECES[doctype]:
		if key == field:
			return label
	return frappe.get_meta(doctype).get_label(field)


@frappe.whitelist()
def get_etude_accueil(scope="team"):
	"""Toute la page en une réponse. `scope` ne touche que la file : « mine » garde les études attribuées à la personne."""
	require_bureau()
	if scope not in ("team", "mine"):
		frappe.throw(_("Vue inconnue."))
	readable = readable_doctypes()
	if not readable:
		raise frappe.PermissionError
	current_day = today()
	roles = set(frappe.get_roles())
	stages, opened, gaps = [], [], []
	can_conclude = False
	for doctype in readable:
		transitions = _transitions(doctype)
		required = required_fields(doctype, transitions)
		allowed = allowed_actions(transitions, roles)
		can_write = bool(frappe.has_permission(doctype, "write"))
		can_conclude = can_conclude or (STATUS_RUNNING, ACTION_CONCLUDE) in allowed
		extra = [field for field in required if field not in {key for key, _label, _target in PIECES[doctype]}]
		found = _fetch(doctype, [], extra)
		customers = _customers(etude.client for etude in found)
		rows = [_list_row(doctype, etude, customers, current_day) for etude in found]
		stages.append(_stage(doctype, rows))
		labels = {field: _(_field_label(doctype, field)) for field in required}
		open_here = []
		for etude, row in zip(found, rows):
			del row["_search"]
			if row["status"] not in OPEN_STATUSES:
				continue
			missing = [field for field in required if not etude.get(field)]
			row["manque"] = [labels[field] for field in missing]
			row["idle_days"] = date_diff(current_day, getdate(etude.modified))
			row["group"] = queue_group(row["status"], row["urgence"], missing)
			row["action"] = row_action(row["status"], missing, allowed, can_write)
			row["_values"] = etude
			open_here.append(row)
		opened.extend(open_here)
		for field in dict.fromkeys([*(key for key, _label, _target in PIECES[doctype]), *required]):
			label = _("sans {0}").format(_(_field_label(doctype, field)).lower())
			label = f"{PROCEDES[doctype]} {label}" if len(readable) > 1 else label.capitalize()
			gaps.append((doctype, field, label, sum(1 for row in open_here if not row["_values"].get(field)), len(open_here)))
	mine = [row for row in opened if row["mine"]]
	watch = _watch(len(opened), sum(1 for row in opened if row["retard"]), sum(1 for row in opened if row["assigne"]), gaps, readable[0])
	for row in opened:
		del row["_values"]
	queue = order_etudes(mine if scope == "mine" else opened)
	return {
		"stages": stages,
		"queue": [
			{"key": key, "total": len(group), "rows": group[:MAX_GROUP_ROWS]}
			for key, group in ((key, [row for row in queue if row["group"] == key]) for key in GROUPS)
		],
		"counts": {"team": len(opened), "mine": len(mine)},
		"can_conclude": can_conclude,
		"both": len(readable) > 1,
		"watch": watch,
		"max_rows": MAX_GROUP_ROWS,
	}
