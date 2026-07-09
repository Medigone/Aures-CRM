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
