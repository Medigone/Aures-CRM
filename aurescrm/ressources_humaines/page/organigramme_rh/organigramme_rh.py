# Copyright (c) 2026, Medigo and contributors
# License: MIT

from __future__ import annotations

from collections import defaultdict
from typing import Any

import frappe
from frappe import _
from frappe.utils import cstr


def _check_employe_read() -> None:
	if not frappe.has_permission("Employe", "read"):
		frappe.throw(_("Vous n'avez pas la permission de consulter les employés."), frappe.PermissionError)


def _photo_url(photo: str | None) -> str | None:
	"""Retourne le chemin relatif de la photo (utilisable tel quel dans le Desk)."""
	return (photo or "").strip() or None


def _build_employee_tree(
	employees: list[dict],
	poste_map: dict[str, dict],
	dept_color_map: dict[str, str],
	responsable_ids: set[str] | None = None,
) -> list[dict[str, Any]]:
	"""Construit un arbre à partir de responsable_hierarchique."""
	responsable_ids = responsable_ids or set()
	by_name: dict[str, dict] = {}
	children: dict[str, list[str]] = defaultdict(list)

	for emp in employees:
		name = emp.name
		poste_info = poste_map.get(emp.poste or "", {})
		by_name[name] = {
			"id": name,
			"type": "employe",
			"label": emp.nom_complet or name,
			"matricule": emp.matricule or "",
			"poste": emp.poste or "",
			"niveau": poste_info.get("niveau") or "",
			"departement": emp.departement or "",
			"departement_couleur": dept_color_map.get(emp.departement or "") or "",
			"site": emp.site or "",
			"photo": _photo_url(emp.photo),
			"statut": emp.statut or "",
			"is_responsable_departement": name in responsable_ids,
			"children": [],
			"child_count": 0,
		}
		parent = (emp.responsable_hierarchique or "").strip()
		if parent and parent != name:
			children[parent].append(name)

	active_ids = set(by_name.keys())

	def attach(node_id: str, seen: set[str]) -> dict:
		node = dict(by_name[node_id])
		if node_id in seen:
			node["children"] = []
			node["child_count"] = 0
			return node
		seen = seen | {node_id}
		kids = []
		for child_id in children.get(node_id, []):
			if child_id in active_ids:
				kids.append(attach(child_id, seen))
		kids.sort(key=lambda n: (n.get("label") or "").lower())
		node["children"] = kids
		node["child_count"] = len(kids)
		return node

	roots: list[dict] = []
	for emp in employees:
		parent = (emp.responsable_hierarchique or "").strip()
		# Racine si pas de responsable, ou responsable hors périmètre (inactif / filtré)
		if not parent or parent not in active_ids or parent == emp.name:
			roots.append(attach(emp.name, set()))

	roots.sort(key=lambda n: (n.get("label") or "").lower())
	return roots


def _build_department_tree(
	departments: list[dict],
	employee_counts: dict[str, int],
	responsable_labels: dict[str, str],
) -> list[dict[str, Any]]:
	"""Arbre des départements uniquement (pas d'employés mélangés aux sous-départements)."""
	by_name: dict[str, dict] = {}
	children: dict[str, list[str]] = defaultdict(list)

	for dept in departments:
		name = dept.name
		resp = dept.responsable_departement or ""
		by_name[name] = {
			"id": name,
			"type": "departement",
			"label": dept.nom_departement or name,
			"couleur": dept.couleur or "",
			"responsable": resp,
			"responsable_label": responsable_labels.get(resp, resp),
			"children": [],
			"child_count": 0,
			"employee_count": int(employee_counts.get(name, 0) or 0),
			"total_employee_count": 0,
		}
		parent = (dept.departement_parent or "").strip()
		if parent and parent != name:
			children[parent].append(name)

	active_ids = set(by_name.keys())

	def attach(node_id: str, seen: set[str]) -> dict:
		node = dict(by_name[node_id])
		if node_id in seen:
			node["children"] = []
			node["child_count"] = 0
			node["total_employee_count"] = node["employee_count"]
			return node
		seen = seen | {node_id}
		kids = []
		for child_id in children.get(node_id, []):
			if child_id in active_ids:
				kids.append(attach(child_id, seen))
		kids.sort(key=lambda n: (n.get("label") or "").lower())
		node["children"] = kids
		node["child_count"] = len(kids)
		# Effectif direct + effectifs des sous-départements (récursif).
		node["total_employee_count"] = node["employee_count"] + sum(
			(k.get("total_employee_count") or 0) for k in kids
		)
		return node

	roots: list[dict] = []
	for dept in departments:
		parent = (dept.departement_parent or "").strip()
		if not parent or parent not in active_ids or parent == dept.name:
			roots.append(attach(dept.name, set()))

	roots.sort(key=lambda n: (n.get("label") or "").lower())
	return roots


@frappe.whitelist()
def get_organigramme(
	mode: str | None = None,
	statut: str | None = None,
	departement: str | None = None,
	site: str | None = None,
):
	"""Données d'organigramme RH (hiérarchie employés ou départements)."""
	_check_employe_read()

	mode = (cstr(mode) or "hierarchie").strip().lower()
	if mode not in ("hierarchie", "departements"):
		mode = "hierarchie"

	statut = (cstr(statut) or "Actif").strip()
	departement = (cstr(departement) or "").strip() or None
	site = (cstr(site) or "").strip() or None

	emp_filters: dict[str, Any] = {}
	if statut:
		emp_filters["statut"] = statut
	if departement:
		emp_filters["departement"] = departement
	if site:
		emp_filters["site"] = site

	employees = frappe.get_all(
		"Employe",
		filters=emp_filters,
		fields=[
			"name",
			"nom_complet",
			"matricule",
			"photo",
			"poste",
			"departement",
			"site",
			"statut",
			"responsable_hierarchique",
		],
		order_by="nom_complet asc",
	)

	poste_names = {e.poste for e in employees if e.poste}
	poste_map: dict[str, dict] = {}
	if poste_names:
		for p in frappe.get_all(
			"Poste RH",
			filters={"name": ["in", list(poste_names)]},
			fields=["name", "niveau", "intitule_poste"],
		):
			poste_map[p.name] = {"niveau": p.niveau or "", "intitule": p.intitule_poste or p.name}

	dept_color_map: dict[str, str] = {
		d.name: d.couleur or ""
		for d in frappe.get_all("Departement RH", fields=["name", "couleur"])
	}

	if mode == "departements":
		dept_filters: dict[str, Any] = {"actif": 1}
		departments = frappe.get_all(
			"Departement RH",
			filters=dept_filters,
			fields=["name", "nom_departement", "departement_parent", "responsable_departement", "couleur"],
			order_by="nom_departement asc",
		)

		employee_counts: dict[str, int] = defaultdict(int)
		orphan_count = 0
		for emp in employees:
			if emp.departement:
				employee_counts[emp.departement] += 1
			else:
				orphan_count += 1

		resp_ids = {d.responsable_departement for d in departments if d.responsable_departement}
		responsable_labels: dict[str, str] = {}
		if resp_ids:
			for r in frappe.get_all(
				"Employe",
				filters={"name": ["in", list(resp_ids)]},
				fields=["name", "nom_complet"],
			):
				responsable_labels[r.name] = r.nom_complet or r.name

		tree = _build_department_tree(departments, employee_counts, responsable_labels)
		return {
			"mode": mode,
			"tree": tree,
			"orphan_employees": [],
			"meta": {
				"employee_count": len(employees),
				"department_count": len(departments),
				"root_count": len(tree),
				"orphan_count": orphan_count,
			},
		}

	responsable_ids = {
		d.responsable_departement
		for d in frappe.get_all(
			"Departement RH",
			filters={"actif": 1, "responsable_departement": ["is", "set"]},
			fields=["responsable_departement"],
		)
		if d.responsable_departement
	}

	tree = _build_employee_tree(employees, poste_map, dept_color_map, responsable_ids)
	return {
		"mode": mode,
		"tree": tree,
		"orphan_employees": [],
		"meta": {
			"employee_count": len(employees),
			"root_count": len(tree),
		},
	}
