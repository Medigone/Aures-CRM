# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Hooks du module Ressources Humaines.

Toute la logique serveur du DocType "Employe" est centralisée ici
(voir hooks.py > doc_events > "Employe").

Le DocType "Employe" est le référentiel maître RH : les futurs DocTypes
(Salaire Employe, Conge Employe, Pointage Employe, Contrat Employe,
Evaluation Employe, Formation Employe...) devront se lier à lui via un
champ Link "employe" sans jamais stocker leurs données ici.
"""

import frappe
from frappe import _
from frappe.utils import getdate, today

# Champs d'affectation dont le changement doit générer un Mouvement Employe.
ASSIGNMENT_FIELDS = ("departement", "poste", "site", "responsable_hierarchique", "statut")

# Champs administratifs devant rester uniques s'ils sont renseignés.
UNIQUE_FIELDS = {
	"matricule": "Matricule",
	"nin": "NIN",
	"numero_cnas": "Numéro CNAS",
}


def _normalize_spaces(value):
	"""Nettoyer les espaces superflus d'une chaîne."""
	return " ".join((value or "").split())


def set_employee_full_name(doc, method=None):
	"""Normaliser nom/prénom et générer nom_complet = prénom + nom."""
	doc.nom = _normalize_spaces(doc.nom).upper()
	doc.prenom = _normalize_spaces(doc.prenom).title()
	doc.nom_complet = " ".join(part for part in (doc.prenom, doc.nom) if part)


def validate_employee_required_fields(doc, method=None):
	"""Valider les champs obligatoires selon le statut et la cohérence des dates."""
	if doc.statut == "Actif":
		required = {
			"date_entree": _("Date d'entrée"),
			"departement": _("Département"),
			"poste": _("Poste"),
			"site": _("Site"),
			"type_contrat": _("Type de contrat"),
		}
		missing = [label for field, label in required.items() if not doc.get(field)]
		if missing:
			frappe.throw(
				_("Pour un employé Actif, les champs suivants sont obligatoires : {0}").format(
					", ".join(missing)
				)
			)

	if doc.statut == "Sorti":
		if not doc.date_sortie:
			frappe.throw(_("Pour un employé Sorti, la date de sortie est obligatoire."))
		if not doc.motif_sortie:
			frappe.throw(_("Pour un employé Sorti, le motif de sortie est obligatoire."))

	if doc.date_entree and doc.date_sortie and getdate(doc.date_sortie) < getdate(doc.date_entree):
		frappe.throw(_("La date de sortie ne peut pas être antérieure à la date d'entrée."))

	if doc.responsable_hierarchique and doc.responsable_hierarchique == doc.name:
		frappe.throw(_("Un employé ne peut pas être son propre responsable hiérarchique."))


def validate_employee_unique_admin_ids(doc, method=None):
	"""Vérifier l'unicité de matricule / NIN / numéro CNAS s'ils sont renseignés."""
	for field, label in UNIQUE_FIELDS.items():
		value = doc.get(field)
		if not value:
			continue
		existing = frappe.db.exists("Employe", {field: value, "name": ("!=", doc.name)})
		if existing:
			frappe.throw(
				_("Le champ {0} « {1} » est déjà utilisé par l'employé {2}.").format(
					label, value, existing
				),
				frappe.DuplicateEntryError,
			)


def set_employee_operation_status(doc, method=None):
	"""Calculer actif_pour_operations depuis le statut et dater la dernière affectation."""
	doc.actif_pour_operations = 1 if doc.statut == "Actif" else 0

	if doc.is_new():
		if not doc.date_derniere_affectation and (doc.departement or doc.poste or doc.site):
			doc.date_derniere_affectation = today()
		return

	previous = doc.get_doc_before_save()
	if previous and _get_assignment_changes(doc, previous):
		doc.date_derniere_affectation = today()


def _get_assignment_changes(doc, previous):
	"""Retourner {champ: (ancienne_valeur, nouvelle_valeur)} pour les champs d'affectation modifiés."""
	changes = {}
	for field in ASSIGNMENT_FIELDS:
		old_value = previous.get(field)
		new_value = doc.get(field)
		if (old_value or None) != (new_value or None):
			changes[field] = (old_value, new_value)
	return changes


def _get_movement_type(changes):
	"""Déterminer le type de mouvement selon le changement principal."""
	if "statut" in changes:
		old_status, new_status = changes["statut"]
		if new_status == "Actif" and old_status == "Pré-intégré":
			return "Entrée"
		if new_status == "Sorti":
			return "Sortie"
		if new_status == "Actif" and old_status in ("Sorti", "Inactif"):
			return "Réintégration"

	if "poste" in changes:
		return "Changement de poste"
	if "departement" in changes:
		return "Changement de département"
	if "site" in changes:
		return "Changement de site"
	if "responsable_hierarchique" in changes:
		return "Changement de responsable"

	return "Correction administrative"


def create_employee_movement_if_assignment_changed(doc, method=None):
	"""Créer un seul Mouvement Employe regroupant tous les changements d'affectation.

	Ne s'applique qu'aux documents existants (pas à la création) et ignore
	les modifications sans lien avec l'affectation (téléphone, email, etc.).
	"""
	previous = doc.get_doc_before_save()
	if not previous:
		# Document nouvellement créé : pas de mouvement automatique.
		return

	changes = _get_assignment_changes(doc, previous)
	if not changes:
		return

	movement = frappe.new_doc("Mouvement Employe")
	movement.employe = doc.name
	movement.type_mouvement = _get_movement_type(changes)
	movement.date_mouvement = today()
	movement.cree_automatiquement = 1

	if "departement" in changes:
		movement.ancien_departement, movement.nouveau_departement = changes["departement"]
	if "poste" in changes:
		movement.ancien_poste, movement.nouveau_poste = changes["poste"]
	if "site" in changes:
		movement.ancien_site, movement.nouveau_site = changes["site"]
	if "responsable_hierarchique" in changes:
		movement.ancien_responsable, movement.nouveau_responsable = changes[
			"responsable_hierarchique"
		]
	if "statut" in changes:
		movement.ancien_statut, movement.nouveau_statut = changes["statut"]

	movement.flags.ignore_permissions = True
	movement.insert()


# ---------------------------------------------------------------------------
# Responsable hiérarchique automatique (priorité site, sinon département)
# ---------------------------------------------------------------------------


def resolve_responsable_hierarchique(
	departement: str | None = None,
	site: str | None = None,
	exclude_employee: str | None = None,
) -> str | None:
	"""Résoudre le responsable hiérarchique : site d'abord, sinon département."""
	exclude_employee = (exclude_employee or "").strip() or None
	site = (site or "").strip() or None
	departement = (departement or "").strip() or None

	if site:
		site_resp = frappe.db.get_value("Site RH", site, "responsable_site")
		site_resp = (site_resp or "").strip() or None
		if site_resp and site_resp != exclude_employee:
			return site_resp

	if departement:
		dept_resp = frappe.db.get_value("Departement RH", departement, "responsable_departement")
		dept_resp = (dept_resp or "").strip() or None
		if dept_resp and dept_resp != exclude_employee:
			return dept_resp

	return None


def ensure_site_manager_reports_to_dept_manager(site_manager_id: str | None) -> None:
	"""Le responsable de site remonte vers le responsable de son propre département."""
	site_manager_id = (site_manager_id or "").strip() or None
	if not site_manager_id:
		return
	if frappe.flags.get("ensuring_site_manager_chain"):
		return

	dept = frappe.db.get_value("Employe", site_manager_id, "departement")
	dept = (dept or "").strip() or None
	if not dept:
		return

	dept_manager = frappe.db.get_value("Departement RH", dept, "responsable_departement")
	dept_manager = (dept_manager or "").strip() or None
	if not dept_manager or dept_manager == site_manager_id:
		return

	current = frappe.db.get_value("Employe", site_manager_id, "responsable_hierarchique")
	if (current or None) == dept_manager:
		return

	frappe.flags.ensuring_site_manager_chain = True
	try:
		manager = frappe.get_doc("Employe", site_manager_id)
		manager.responsable_hierarchique = dept_manager
		manager.flags.skip_auto_responsable = True
		manager.save()
	finally:
		frappe.flags.ensuring_site_manager_chain = False


def _reassign_employee_responsable(emp_name: str) -> None:
	"""Recalculer et enregistrer le responsable hiérarchique d'un employé."""
	emp_name = (emp_name or "").strip()
	if not emp_name or not frappe.db.exists("Employe", emp_name):
		return

	emp = frappe.get_doc("Employe", emp_name)
	resolved = resolve_responsable_hierarchique(
		emp.departement, emp.site, exclude_employee=emp.name
	)
	if (emp.responsable_hierarchique or None) == (resolved or None):
		return

	emp.responsable_hierarchique = resolved
	emp.flags.skip_auto_responsable = True
	site_resp = None
	if emp.site:
		site_resp = frappe.db.get_value("Site RH", emp.site, "responsable_site")
		site_resp = (site_resp or "").strip() or None
	if resolved and site_resp and resolved == site_resp:
		emp.flags._sync_site_manager_chain = resolved
	emp.save()


def assign_responsable_hierarchique(doc, method=None):
	"""before_save Employé : recalculer le responsable si département/site change."""
	if getattr(doc.flags, "skip_auto_responsable", False):
		return

	should_assign = False
	if doc.is_new():
		should_assign = bool(doc.departement or doc.site)
	else:
		previous = doc.get_doc_before_save()
		if previous and (
			(previous.departement or None) != (doc.departement or None)
			or (previous.site or None) != (doc.site or None)
		):
			should_assign = True

	if not should_assign:
		return

	resolved = resolve_responsable_hierarchique(
		doc.departement, doc.site, exclude_employee=doc.name
	)
	doc.responsable_hierarchique = resolved

	# Mémoriser pour sync chaîne après save (évite save imbriqué pendant before_save).
	site_resp = None
	if doc.site:
		site_resp = frappe.db.get_value("Site RH", doc.site, "responsable_site")
		site_resp = (site_resp or "").strip() or None
	if resolved and site_resp and resolved == site_resp:
		doc.flags._sync_site_manager_chain = resolved


def sync_site_manager_chain_after_employee_update(doc, method=None):
	"""on_update Employé : faire remonter le responsable de site vers le dept."""
	manager = getattr(doc.flags, "_sync_site_manager_chain", None)
	if manager:
		ensure_site_manager_reports_to_dept_manager(manager)
		return

	if getattr(doc.flags, "skip_auto_responsable", False):
		return

	previous = doc.get_doc_before_save()
	if previous and (previous.departement or None) != (doc.departement or None):
		is_site_manager = frappe.db.exists(
			"Site RH", {"responsable_site": doc.name, "actif": 1}
		)
		if is_site_manager:
			ensure_site_manager_reports_to_dept_manager(doc.name)


def sync_hierarchy_on_site_update(doc, method=None):
	"""on_update Site RH : sync chaîne du responsable + employés actifs du site."""
	previous = doc.get_doc_before_save()
	resp_changed = True
	if previous:
		resp_changed = (previous.responsable_site or None) != (doc.responsable_site or None)

	if not resp_changed:
		return

	if doc.responsable_site:
		ensure_site_manager_reports_to_dept_manager(doc.responsable_site)

	employees = frappe.get_all(
		"Employe",
		filters={"site": doc.name, "statut": "Actif"},
		pluck="name",
	)
	for emp_name in employees:
		_reassign_employee_responsable(emp_name)


def sync_hierarchy_on_department_update(doc, method=None):
	"""on_update Département RH : sync managers de site + employés sans chef de site."""
	previous = doc.get_doc_before_save()
	if previous and (previous.responsable_departement or None) == (
		doc.responsable_departement or None
	):
		return

	# Responsables de sites dont le département personnel = ce département.
	site_manager_ids = frappe.get_all(
		"Site RH",
		filters={"actif": 1, "responsable_site": ["is", "set"]},
		pluck="responsable_site",
	)
	for manager_id in {m for m in site_manager_ids if m}:
		manager_dept = frappe.db.get_value("Employe", manager_id, "departement")
		if manager_dept == doc.name:
			ensure_site_manager_reports_to_dept_manager(manager_id)

	# Employés actifs du département sans responsable de site exploitable.
	employees = frappe.get_all(
		"Employe",
		filters={"departement": doc.name, "statut": "Actif"},
		fields=["name", "site"],
	)
	for emp in employees:
		site_resp = None
		if emp.site:
			site_resp = frappe.db.get_value("Site RH", emp.site, "responsable_site")
			site_resp = (site_resp or "").strip() or None
		if site_resp and site_resp != emp.name:
			continue
		_reassign_employee_responsable(emp.name)
