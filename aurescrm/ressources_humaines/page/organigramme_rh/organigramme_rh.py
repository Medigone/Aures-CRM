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


def _dept_meta_maps() -> tuple[dict[str, str], dict[str, str]]:
	"""Couleur et libellé (nom) par département RH."""
	rows = frappe.get_all("Departement RH", fields=["name", "couleur", "nom_departement"])
	color_map = {d.name: d.couleur or "" for d in rows}
	label_map = {d.name: d.nom_departement or d.name for d in rows}
	return color_map, label_map


def _site_label_map() -> dict[str, str]:
	"""Libellé (nom) par site RH."""
	return {
		s.name: s.nom_site or s.name
		for s in frappe.get_all("Site RH", fields=["name", "nom_site"])
	}


def _employee_node(
	emp: Any,
	poste_map: dict[str, dict],
	dept_color_map: dict[str, str],
	responsable_ids: set[str],
	*,
	dept_label_map: dict[str, str] | None = None,
	site_label_map: dict[str, str] | None = None,
	is_focus: bool = False,
) -> dict[str, Any]:
	poste_info = poste_map.get(emp.poste or "", {})
	dept_id = emp.departement or ""
	site_id = emp.site or ""
	dept_label_map = dept_label_map or {}
	site_label_map = site_label_map or {}
	return {
		"id": emp.name,
		"type": "employe",
		"label": emp.nom_complet or emp.name,
		"matricule": emp.matricule or "",
		"poste": emp.poste or "",
		"niveau": poste_info.get("niveau") or "",
		"departement": dept_id,
		"departement_label": dept_label_map.get(dept_id) or dept_id,
		"departement_couleur": dept_color_map.get(dept_id) or "",
		"site": site_id,
		"site_label": site_label_map.get(site_id) or site_id,
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
	dept_label_map: dict[str, str] | None = None,
	site_label_map: dict[str, str] | None = None,
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
				dept_label_map=dept_label_map,
				site_label_map=site_label_map,
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
	dept_label_map: dict[str, str] | None = None,
	site_label_map: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
	"""Construit un arbre à partir de responsable_hierarchique."""
	responsable_ids = responsable_ids or set()
	by_name: dict[str, dict] = {}
	children: dict[str, list[str]] = defaultdict(list)

	for emp in employees:
		name = emp.name
		by_name[name] = _employee_node(
			emp,
			poste_map,
			dept_color_map,
			responsable_ids,
			dept_label_map=dept_label_map,
			site_label_map=site_label_map,
		)
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
	focus_id: str | None = None,
) -> list[dict[str, Any]]:
	"""Arbre des départements uniquement (pas d'employés mélangés aux sous-départements)."""
	focus_id = (focus_id or "").strip() or None
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
			"is_focus": bool(focus_id and name == focus_id),
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


def _prune_empty_org_nodes(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
	"""Retire les nœuds sans employé (direct) ni descendant peuplé après élagage."""
	result: list[dict[str, Any]] = []
	for node in nodes or []:
		pruned = dict(node)
		kids = _prune_empty_org_nodes(pruned.get("children") or [])
		pruned["children"] = kids
		pruned["child_count"] = len(kids)
		direct = int(pruned.get("employee_count") or 0)
		pruned["total_employee_count"] = direct + sum(
			int(k.get("total_employee_count") or 0) for k in kids
		)
		if direct > 0 or kids:
			result.append(pruned)
	return result


def _maybe_prune_empty_org_nodes(
	tree: list[dict[str, Any]],
	employee_counts: dict[str, int],
) -> list[dict[str, Any]]:
	"""Élague les nœuds vides seulement s'il existe des effectifs correspondant au filtre.

	Sinon conserve l'arbre complet (ex. départements créés avant rattachement d'employés,
	ou aucun employé du statut sélectionné) pour ne pas afficher un organigramme vide.
	"""
	if not tree:
		return tree
	if not any(int(v or 0) > 0 for v in (employee_counts or {}).values()):
		return tree
	pruned = _prune_empty_org_nodes(tree)
	return pruned if pruned else tree


def _count_tree_nodes(nodes: list[dict[str, Any]]) -> int:
	"""Nombre total de nœuds dans un arbre."""
	total = 0
	for node in nodes or []:
		total += 1 + _count_tree_nodes(node.get("children") or [])
	return total


def _descendants_via_parent(
	doctype: str,
	parent_field: str,
	root_name: str,
) -> list[str]:
	"""Retourne le nœud et tous ses descendants via un champ parent Link."""
	root_name = (root_name or "").strip()
	if not root_name:
		return []

	rows = frappe.get_all(doctype, fields=["name", parent_field])
	children: dict[str, list[str]] = defaultdict(list)
	for row in rows:
		parent = (row.get(parent_field) or "").strip()
		if parent and parent != row.name:
			children[parent].append(row.name)

	result: list[str] = []
	stack = [root_name]
	seen: set[str] = set()
	while stack:
		current = stack.pop()
		if current in seen:
			continue
		seen.add(current)
		result.append(current)
		stack.extend(children.get(current, []))
	return result


def _department_and_descendants(dept_name: str) -> list[str]:
	"""Retourne le département et tous ses descendants (via departement_parent)."""
	return _descendants_via_parent("Departement RH", "departement_parent", dept_name)


def _ancestors_via_parent(
	doctype: str,
	parent_field: str,
	node_name: str,
) -> list[str]:
	"""Remonte la chaîne parent jusqu'à la racine (sans inclure le nœud lui-même)."""
	node_name = (node_name or "").strip()
	if not node_name:
		return []

	parent_by_name = {
		row.name: (row.get(parent_field) or "").strip()
		for row in frappe.get_all(doctype, fields=["name", parent_field])
	}

	ancestors: list[str] = []
	seen: set[str] = set()
	current = (parent_by_name.get(node_name) or "").strip()
	while current and current not in seen:
		seen.add(current)
		ancestors.append(current)
		current = (parent_by_name.get(current) or "").strip()
		if current == ancestors[-1]:
			break
	ancestors.reverse()
	return ancestors


def _department_lineage(dept_name: str) -> list[str]:
	"""Département sélectionné + parents + sous-départements (hors branches latérales)."""
	dept_name = (dept_name or "").strip()
	if not dept_name:
		return []
	ancestors = _ancestors_via_parent("Departement RH", "departement_parent", dept_name)
	descendants = _department_and_descendants(dept_name)
	# Ancêtres d'abord (racine → …), puis sélection + descendants (déjà inclus).
	seen: set[str] = set()
	result: list[str] = []
	for name in ancestors + descendants:
		if name in seen:
			continue
		seen.add(name)
		result.append(name)
	return result


def _site_and_descendants(site_name: str) -> list[str]:
	"""Retourne le site et tous ses descendants (via site_parent)."""
	return _descendants_via_parent("Site RH", "site_parent", site_name)


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
			"couleur": site.couleur or "",
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

		dept_color_map, dept_label_map = _dept_meta_maps()
		site_label_map = _site_label_map()
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
			dept_label_map=dept_label_map,
			site_label_map=site_label_map,
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
	# Vue Départements + filtre : parents + sélection + sous-départements.
	dept_lineage = (
		_department_lineage(departement) if (mode == "departements" and departement) else None
	)

	emp_filters: dict[str, Any] = {}
	if statut:
		emp_filters["statut"] = statut
	if dept_lineage:
		emp_filters["departement"] = ["in", dept_lineage]
	elif departement:
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

	dept_color_map, dept_label_map = _dept_meta_maps()
	site_label_map = _site_label_map()

	if mode == "sites":
		site_filters: dict[str, Any] = {"actif": 1}
		if site_scope:
			site_filters["name"] = ["in", site_scope]
		sites = frappe.get_all(
			"Site RH",
			filters=site_filters,
			fields=["name", "nom_site", "site_parent", "type_site", "responsable_site", "couleur"],
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

		tree = _maybe_prune_empty_org_nodes(
			_build_site_tree(sites, employee_counts, responsable_labels),
			employee_counts,
		)
		return {
			"mode": mode,
			"tree": tree,
			"orphan_employees": [],
			"meta": {
				"employee_count": len(employees),
				"site_count": _count_tree_nodes(tree),
				"root_count": len(tree),
				"orphan_count": orphan_count,
			},
		}

	if mode == "departements":
		if departement and not frappe.db.exists("Departement RH", departement):
			frappe.throw(_("Département introuvable."), frappe.DoesNotExistError)

		dept_filters: dict[str, Any] = {"actif": 1}
		if dept_lineage:
			dept_filters["name"] = ["in", dept_lineage]
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

		tree = _maybe_prune_empty_org_nodes(
			_build_department_tree(
				departments,
				employee_counts,
				responsable_labels,
				focus_id=departement,
			),
			employee_counts,
		)
		payload = {
			"mode": mode,
			"tree": tree,
			"orphan_employees": [],
			"meta": {
				"employee_count": len(employees),
				"department_count": _count_tree_nodes(tree),
				"root_count": len(tree),
				"orphan_count": orphan_count,
			},
		}
		if departement:
			payload["focus_department"] = departement
			payload["meta"]["focus_department"] = departement
		return payload

	responsable_ids = {
		d.responsable_departement
		for d in frappe.get_all(
			"Departement RH",
			filters={"actif": 1, "responsable_departement": ["is", "set"]},
			fields=["responsable_departement"],
		)
		if d.responsable_departement
	}

	tree = _build_employee_tree(
		employees,
		poste_map,
		dept_color_map,
		responsable_ids,
		dept_label_map=dept_label_map,
		site_label_map=site_label_map,
	)
	return {
		"mode": mode,
		"tree": tree,
		"orphan_employees": [],
		"meta": {
			"employee_count": len(employees),
			"root_count": len(tree),
		},
	}


_ORG_NODE_ALLOWED_FIELDS = {
	"Departement RH": (
		"nom_departement",
		"departement_parent",
		"responsable_departement",
		"couleur",
		"actif",
	),
	"Site RH": (
		"nom_site",
		"site_parent",
		"type_site",
		"responsable_site",
		"couleur",
		"actif",
	),
}


_ORG_EMP_ORDER_KEYS = frozenset(
	{"matricule", "nom_complet", "poste", "statut", "departement", "site"}
)
_ORG_EMP_PAGE_DEFAULT = 25
_ORG_EMP_PAGE_MAX = 100


def _resolve_employees_for_node_scope(
	node_type: str,
	node_name: str,
) -> tuple[dict[str, Any], str]:
	"""Valide le nœud et retourne (filtres Employe, libellé du nœud)."""
	if node_type == "departement":
		if not frappe.db.exists("Departement RH", node_name):
			frappe.throw(_("Département introuvable."), frappe.DoesNotExistError)
		if not frappe.has_permission("Departement RH", "read", node_name):
			frappe.throw(
				_("Vous n'avez pas la permission de consulter ce département."),
				frappe.PermissionError,
			)
		scope = _department_and_descendants(node_name)
		label = frappe.db.get_value("Departement RH", node_name, "nom_departement") or node_name
		return {"departement": ["in", scope]}, label

	if not frappe.db.exists("Site RH", node_name):
		frappe.throw(_("Site introuvable."), frappe.DoesNotExistError)
	if not frappe.has_permission("Site RH", "read", node_name):
		frappe.throw(
			_("Vous n'avez pas la permission de consulter ce site."),
			frappe.PermissionError,
		)
	scope = _site_and_descendants(node_name)
	label = frappe.db.get_value("Site RH", node_name, "nom_site") or node_name
	return {"site": ["in", scope]}, label


def _enrich_employee_labels(employees: list) -> None:
	"""Remplace les IDs département/site par leurs libellés et couleurs."""
	dept_ids = {e.departement for e in employees if e.departement}
	site_ids = {e.site for e in employees if e.site}
	dept_meta: dict[str, dict[str, str]] = {}
	site_meta: dict[str, dict[str, str]] = {}
	if dept_ids:
		for d in frappe.get_all(
			"Departement RH",
			filters={"name": ["in", list(dept_ids)]},
			fields=["name", "nom_departement", "couleur"],
		):
			dept_meta[d.name] = {
				"label": d.nom_departement or d.name,
				"couleur": d.couleur or "",
			}
	if site_ids:
		for s in frappe.get_all(
			"Site RH",
			filters={"name": ["in", list(site_ids)]},
			fields=["name", "nom_site", "couleur"],
		):
			site_meta[s.name] = {
				"label": s.nom_site or s.name,
				"couleur": s.couleur or "",
			}

	for emp in employees:
		dept = dept_meta.get(emp.departement or "")
		site = site_meta.get(emp.site or "")
		emp["departement_couleur"] = (dept or {}).get("couleur", "")
		emp["site_couleur"] = (site or {}).get("couleur", "")
		emp["departement"] = (dept or {}).get("label", emp.departement or "")
		emp["site"] = (site or {}).get("label", emp.site or "")


def _fetch_employees_page(
	emp_filters: dict[str, Any],
	*,
	start: int,
	page_length: int,
	order_key: str,
	order_dir: str,
) -> list:
	"""Charge une page d'employés avec tri (jointures pour libellés dept/site)."""
	from frappe.query_builder import Order

	emp = frappe.qb.DocType("Employe")
	dept = frappe.qb.DocType("Departement RH")
	site = frappe.qb.DocType("Site RH")

	query = (
		frappe.qb.from_(emp)
		.left_join(dept)
		.on(emp.departement == dept.name)
		.left_join(site)
		.on(emp.site == site.name)
		.select(
			emp.name,
			emp.matricule,
			emp.nom_complet,
			emp.statut,
			emp.poste,
			emp.departement,
			emp.site,
			emp.telephone,
		)
	)

	if "statut" in emp_filters:
		query = query.where(emp.statut == emp_filters["statut"])
	if "departement" in emp_filters:
		query = query.where(emp.departement.isin(emp_filters["departement"][1]))
	if "site" in emp_filters:
		query = query.where(emp.site.isin(emp_filters["site"][1]))

	order_map = {
		"matricule": emp.matricule,
		"nom_complet": emp.nom_complet,
		"poste": emp.poste,
		"statut": emp.statut,
		"departement": dept.nom_departement,
		"site": site.nom_site,
	}
	order_col = order_map[order_key]
	qb_order = Order.desc if order_dir == "desc" else Order.asc
	query = query.orderby(order_col, order=qb_order).orderby(emp.nom_complet, order=Order.asc)
	query = query.limit(page_length).offset(start)
	return query.run(as_dict=True)


@frappe.whitelist()
def get_employees_for_node(
	node_type: str | None = None,
	node_name: str | None = None,
	statut: str | None = None,
	start: int | str | None = 0,
	page_length: int | str | None = None,
	order_by: str | None = None,
	order: str | None = None,
):
	"""Liste paginée des employés d'un département ou site (nœud + descendants)."""
	from frappe.utils import cint

	_check_employe_read()

	node_type = (cstr(node_type) or "").strip().lower()
	node_name = (cstr(node_name) or "").strip()
	statut = (cstr(statut) or "").strip() or None

	if node_type not in ("departement", "site"):
		frappe.throw(_("Type de nœud invalide."), frappe.ValidationError)
	if not node_name:
		frappe.throw(_("Identifiant du nœud manquant."), frappe.ValidationError)

	emp_filters, label = _resolve_employees_for_node_scope(node_type, node_name)
	if statut:
		emp_filters["statut"] = statut

	start = max(0, cint(start))
	page_length = cint(page_length) or _ORG_EMP_PAGE_DEFAULT
	page_length = min(max(1, page_length), _ORG_EMP_PAGE_MAX)

	order_key = (cstr(order_by) or "nom_complet").strip()
	if order_key not in _ORG_EMP_ORDER_KEYS:
		order_key = "nom_complet"
	order_dir = "desc" if (cstr(order) or "").strip().lower() == "desc" else "asc"

	total = frappe.db.count("Employe", emp_filters)
	employees = _fetch_employees_page(
		emp_filters,
		start=start,
		page_length=page_length,
		order_key=order_key,
		order_dir=order_dir,
	)
	_enrich_employee_labels(employees)

	loaded = start + len(employees)
	return {
		"node_type": node_type,
		"node_name": node_name,
		"label": label,
		"count": total,
		"start": start,
		"page_length": page_length,
		"order_by": order_key,
		"order": order_dir,
		"has_more": loaded < total,
		"employees": employees,
	}


@frappe.whitelist()
def update_org_node(
	doctype: str | None = None,
	name: str | None = None,
	values: str | dict | None = None,
):
	"""Mise à jour rapide d'un Département RH ou Site RH depuis l'organigramme."""
	doctype = (cstr(doctype) or "").strip()
	name = (cstr(name) or "").strip()

	if doctype not in _ORG_NODE_ALLOWED_FIELDS:
		frappe.throw(_("Type de document non autorisé."), frappe.ValidationError)
	if not name:
		frappe.throw(_("Identifiant manquant."), frappe.ValidationError)
	if not frappe.db.exists(doctype, name):
		frappe.throw(_("Document introuvable."), frappe.DoesNotExistError)
	if not frappe.has_permission(doctype, "write", name):
		frappe.throw(
			_("Vous n'avez pas la permission de modifier ce document."),
			frappe.PermissionError,
		)

	if isinstance(values, str):
		values = frappe.parse_json(values) if values else {}
	if not isinstance(values, dict):
		frappe.throw(_("Valeurs invalides."), frappe.ValidationError)

	allowed = _ORG_NODE_ALLOWED_FIELDS[doctype]
	doc = frappe.get_doc(doctype, name)
	updated = False
	for field in allowed:
		if field not in values:
			continue
		new_val = values[field]
		if field == "actif":
			new_val = 1 if new_val in (1, "1", True, "true") else 0
		elif isinstance(new_val, str):
			new_val = new_val.strip() or None
		if doc.get(field) != new_val:
			doc.set(field, new_val)
			updated = True

	if updated:
		doc.save()

	return {
		"name": doc.name,
		"doctype": doctype,
		"label": doc.get("nom_departement") or doc.get("nom_site") or doc.name,
	}


@frappe.whitelist()
def create_org_node(
	doctype: str | None = None,
	values: str | dict | None = None,
):
	"""Création rapide d'un Département RH ou Site RH enfant depuis l'organigramme."""
	doctype = (cstr(doctype) or "").strip()

	if doctype not in _ORG_NODE_ALLOWED_FIELDS:
		frappe.throw(_("Type de document non autorisé."), frappe.ValidationError)
	if not frappe.has_permission(doctype, "create"):
		frappe.throw(
			_("Vous n'avez pas la permission de créer ce document."),
			frappe.PermissionError,
		)

	if isinstance(values, str):
		values = frappe.parse_json(values) if values else {}
	if not isinstance(values, dict):
		frappe.throw(_("Valeurs invalides."), frappe.ValidationError)

	allowed = _ORG_NODE_ALLOWED_FIELDS[doctype]
	parent_field = "site_parent" if doctype == "Site RH" else "departement_parent"
	label_field = "nom_site" if doctype == "Site RH" else "nom_departement"

	payload: dict[str, Any] = {"doctype": doctype}
	for field in allowed:
		if field not in values:
			continue
		val = values[field]
		if field == "actif":
			val = 1 if val in (1, "1", True, "true") else 0
		elif isinstance(val, str):
			val = val.strip() or None
		payload[field] = val

	if not payload.get(label_field):
		frappe.throw(_("Le nom est obligatoire."), frappe.ValidationError)

	parent = payload.get(parent_field)
	if not parent:
		frappe.throw(_("Le parent est obligatoire."), frappe.ValidationError)
	if not frappe.db.exists(doctype, parent):
		frappe.throw(_("Parent introuvable."), frappe.DoesNotExistError)
	if not frappe.has_permission(doctype, "read", parent):
		frappe.throw(
			_("Vous n'avez pas la permission de consulter le parent."),
			frappe.PermissionError,
		)

	if "actif" not in payload:
		payload["actif"] = 1

	doc = frappe.get_doc(payload)
	doc.insert()

	return {
		"name": doc.name,
		"doctype": doctype,
		"label": doc.get(label_field) or doc.name,
		"parent": parent,
	}


@frappe.whitelist()
def transfer_employee(
	name: str | None = None,
	departement: str | None = None,
	site: str | None = None,
	poste: str | None = None,
	motif: str | None = None,
):
	"""Transfert rapide département/site/poste depuis l'organigramme.

	Sauvegarde l'employé via doc.save() pour déclencher le hook standard
	`create_employee_movement_if_assignment_changed` (même logique que le Form).
	"""
	name = (cstr(name) or "").strip()
	if not name:
		frappe.throw(_("Identifiant employé manquant."), frappe.ValidationError)
	if not frappe.db.exists("Employe", name):
		frappe.throw(_("Employé introuvable."), frappe.DoesNotExistError)
	if not frappe.has_permission("Employe", "write", name):
		frappe.throw(
			_("Vous n'avez pas la permission de modifier cet employé."),
			frappe.PermissionError,
		)

	new_departement = (cstr(departement) or "").strip() or None
	new_site = (cstr(site) or "").strip() or None
	new_poste = (cstr(poste) or "").strip() or None
	motif = (cstr(motif) or "").strip() or None

	if new_departement and not frappe.db.exists("Departement RH", new_departement):
		frappe.throw(_("Département introuvable."), frappe.DoesNotExistError)
	if new_site and not frappe.db.exists("Site RH", new_site):
		frappe.throw(_("Site introuvable."), frappe.DoesNotExistError)
	if new_poste and not frappe.db.exists("Poste RH", new_poste):
		frappe.throw(_("Poste introuvable."), frappe.DoesNotExistError)

	doc = frappe.get_doc("Employe", name)
	changed = False

	if (doc.departement or None) != new_departement:
		doc.departement = new_departement
		changed = True
	if (doc.site or None) != new_site:
		doc.site = new_site
		changed = True
	if (doc.poste or None) != new_poste:
		doc.poste = new_poste
		changed = True

	if not changed:
		frappe.throw(
			_("Aucun changement de département, de site ou de poste."),
			frappe.ValidationError,
		)

	doc.save()

	movement_name = None
	movements = frappe.get_all(
		"Mouvement Employe",
		filters={"employe": name, "cree_automatiquement": 1},
		fields=["name"],
		order_by="creation desc",
		limit=1,
	)
	if movements:
		movement_name = movements[0].name
		if motif and frappe.has_permission("Mouvement Employe", "write", movement_name):
			frappe.db.set_value("Mouvement Employe", movement_name, "motif", motif)

	return {
		"name": doc.name,
		"label": doc.nom_complet or doc.name,
		"departement": doc.departement,
		"site": doc.site,
		"poste": doc.poste,
		"mouvement": movement_name,
	}


@frappe.whitelist()
def preview_responsable_hierarchique(
	departement: str | None = None,
	site: str | None = None,
	employe: str | None = None,
):
	"""Aperçu du responsable hiérarchique calculé (règle site puis département)."""
	from aurescrm.rh_hooks import resolve_responsable_hierarchique

	_check_employe_read()

	departement = (cstr(departement) or "").strip() or None
	site = (cstr(site) or "").strip() or None
	employe = (cstr(employe) or "").strip() or None

	resolved = resolve_responsable_hierarchique(
		departement, site, exclude_employee=employe
	)
	label = None
	if resolved:
		label = frappe.db.get_value("Employe", resolved, "nom_complet") or resolved

	source = None
	if resolved and site:
		site_resp = frappe.db.get_value("Site RH", site, "responsable_site")
		if (site_resp or "").strip() == resolved:
			source = "site"
	if resolved and not source and departement:
		dept_resp = frappe.db.get_value(
			"Departement RH", departement, "responsable_departement"
		)
		if (dept_resp or "").strip() == resolved:
			source = "departement"

	return {
		"responsable": resolved,
		"label": label,
		"source": source,
	}
