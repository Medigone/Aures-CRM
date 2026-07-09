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


def _employee_node(
	emp: Any,
	poste_map: dict[str, dict],
	dept_color_map: dict[str, str],
	responsable_ids: set[str],
	*,
	is_focus: bool = False,
) -> dict[str, Any]:
	poste_info = poste_map.get(emp.poste or "", {})
	return {
		"id": emp.name,
		"type": "employe",
		"label": emp.nom_complet or emp.name,
		"matricule": emp.matricule or "",
		"poste": emp.poste or "",
		"niveau": poste_info.get("niveau") or "",
		"departement": emp.departement or "",
		"departement_couleur": dept_color_map.get(emp.departement or "") or "",
		"site": emp.site or "",
		"photo": _photo_url(emp.photo),
		"statut": emp.statut or "",
		"is_responsable_departement": emp.name in responsable_ids,
		"is_focus": is_focus,
		"children": [],
		"child_count": 0,
	}


def _fetch_employees_by_names(names: set[str]) -> dict[str, Any]:
	"""Charge des employés par identifiant (hors filtres statut/département/site)."""
	if not names:
		return {}
	rows = frappe.get_all(
		"Employe",
		filters={"name": ["in", list(names)]},
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
	)
	return {r.name: r for r in rows}


def _resolve_hierarchy_chain(focus_id: str) -> list[str]:
	"""
	Remonte la chaîne responsable_hierarchique depuis l'employé jusqu'à la racine (PDG).
	Retourne la liste [racine, ..., focus].
	"""
	focus_id = (focus_id or "").strip()
	if not focus_id:
		return []

	chain_up: list[str] = []
	seen: set[str] = set()
	current = focus_id

	while current and current not in seen:
		seen.add(current)
		chain_up.append(current)
		parent = frappe.db.get_value("Employe", current, "responsable_hierarchique")
		parent = (parent or "").strip()
		if not parent or parent == current:
			break
		current = parent

	chain_up.reverse()
	return chain_up


def _build_employee_chain_tree(
	chain_ids: list[str],
	employees_by_name: dict[str, Any],
	poste_map: dict[str, dict],
	dept_color_map: dict[str, str],
	responsable_ids: set[str],
	focus_id: str,
) -> list[dict[str, Any]]:
	"""Construit un arbre linéaire racine → … → employé sélectionné."""
	if not chain_ids:
		return []

	nodes = []
	for emp_id in chain_ids:
		emp = employees_by_name.get(emp_id)
		if not emp:
			continue
		nodes.append(
			_employee_node(
				emp,
				poste_map,
				dept_color_map,
				responsable_ids,
				is_focus=(emp_id == focus_id),
			)
		)

	if not nodes:
		return []

	# Chaîne : chaque nœud n'a qu'un enfant (le suivant vers le focus).
	for i in range(len(nodes) - 1):
		nodes[i]["children"] = [nodes[i + 1]]
		nodes[i]["child_count"] = 1
	nodes[-1]["children"] = []
	nodes[-1]["child_count"] = 0
	return [nodes[0]]


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
		by_name[name] = _employee_node(emp, poste_map, dept_color_map, responsable_ids)
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


def _site_and_descendants(site_name: str) -> list[str]:
	"""Retourne le site et tous ses descendants (via site_parent)."""
	site_name = (site_name or "").strip()
	if not site_name:
		return []

	rows = frappe.get_all("Site RH", fields=["name", "site_parent"])
	children: dict[str, list[str]] = defaultdict(list)
	for row in rows:
		parent = (row.site_parent or "").strip()
		if parent and parent != row.name:
			children[parent].append(row.name)

	result: list[str] = []
	stack = [site_name]
	seen: set[str] = set()
	while stack:
		current = stack.pop()
		if current in seen:
			continue
		seen.add(current)
		result.append(current)
		stack.extend(children.get(current, []))
	return result


def _build_site_tree(
	sites: list[dict],
	employee_counts: dict[str, int],
	responsable_labels: dict[str, str],
) -> list[dict[str, Any]]:
	"""Arbre des sites uniquement (site_parent), avec effectifs employés."""
	by_name: dict[str, dict] = {}
	children: dict[str, list[str]] = defaultdict(list)

	for site in sites:
		name = site.name
		resp = site.responsable_site or ""
		by_name[name] = {
			"id": name,
			"type": "site",
			"label": site.nom_site or name,
			"type_site": site.type_site or "",
			"responsable": resp,
			"responsable_label": responsable_labels.get(resp, resp),
			"children": [],
			"child_count": 0,
			"employee_count": int(employee_counts.get(name, 0) or 0),
			"total_employee_count": 0,
		}
		parent = (site.site_parent or "").strip()
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
		node["total_employee_count"] = node["employee_count"] + sum(
			(k.get("total_employee_count") or 0) for k in kids
		)
		return node

	roots: list[dict] = []
	for site in sites:
		parent = (site.site_parent or "").strip()
		if not parent or parent not in active_ids or parent == site.name:
			roots.append(attach(site.name, set()))

	roots.sort(key=lambda n: (n.get("label") or "").lower())
	return roots


@frappe.whitelist()
def get_organigramme(
	mode: str | None = None,
	statut: str | None = None,
	departement: str | None = None,
	site: str | None = None,
	employe: str | None = None,
):
	"""Données d'organigramme RH (hiérarchie employés, départements ou sites)."""
	_check_employe_read()

	mode = (cstr(mode) or "hierarchie").strip().lower()
	if mode not in ("hierarchie", "departements", "sites"):
		mode = "hierarchie"

	statut = (cstr(statut) or "Actif").strip()
	departement = (cstr(departement) or "").strip() or None
	site = (cstr(site) or "").strip() or None
	employe = (cstr(employe) or "").strip() or None

	# Filtre employé : chaîne hiérarchique jusqu'à la racine (uniquement en vue Hiérarchie).
	if employe and mode == "hierarchie":
		if not frappe.db.exists("Employe", employe):
			frappe.throw(_("Employé introuvable."), frappe.DoesNotExistError)

		chain_ids = _resolve_hierarchy_chain(employe)
		employees_by_name = _fetch_employees_by_names(set(chain_ids))
		employees = [employees_by_name[i] for i in chain_ids if i in employees_by_name]

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
		responsable_ids = {
			d.responsable_departement
			for d in frappe.get_all(
				"Departement RH",
				filters={"actif": 1, "responsable_departement": ["is", "set"]},
				fields=["responsable_departement"],
			)
			if d.responsable_departement
		}

		tree = _build_employee_chain_tree(
			chain_ids,
			employees_by_name,
			poste_map,
			dept_color_map,
			responsable_ids,
			employe,
		)
		return {
			"mode": mode,
			"tree": tree,
			"orphan_employees": [],
			"focus_employee": employe,
			"meta": {
				"employee_count": len(employees),
				"root_count": len(tree),
				"chain_length": len(chain_ids),
				"focus_employee": employe,
			},
		}

	# Filtre site : inclure le site et tous ses sites enfants.
	site_scope = _site_and_descendants(site) if site else None

	emp_filters: dict[str, Any] = {}
	if statut:
		emp_filters["statut"] = statut
	if departement:
		emp_filters["departement"] = departement
	if site_scope:
		emp_filters["site"] = ["in", site_scope]

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

	if mode == "sites":
		site_filters: dict[str, Any] = {"actif": 1}
		if site_scope:
			site_filters["name"] = ["in", site_scope]
		sites = frappe.get_all(
			"Site RH",
			filters=site_filters,
			fields=["name", "nom_site", "site_parent", "type_site", "responsable_site"],
			order_by="nom_site asc",
		)

		employee_counts: dict[str, int] = defaultdict(int)
		orphan_count = 0
		for emp in employees:
			if emp.site:
				employee_counts[emp.site] += 1
			else:
				orphan_count += 1

		resp_ids = {s.responsable_site for s in sites if s.responsable_site}
		responsable_labels: dict[str, str] = {}
		if resp_ids:
			for r in frappe.get_all(
				"Employe",
				filters={"name": ["in", list(resp_ids)]},
				fields=["name", "nom_complet"],
			):
				responsable_labels[r.name] = r.nom_complet or r.name

		tree = _build_site_tree(sites, employee_counts, responsable_labels)
		return {
			"mode": mode,
			"tree": tree,
			"orphan_employees": [],
			"meta": {
				"employee_count": len(employees),
				"site_count": len(sites),
				"root_count": len(tree),
				"orphan_count": orphan_count,
			},
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
