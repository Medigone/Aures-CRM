# Copyright (c) 2026, Medigo and contributors
# License: MIT

"""Mise en place du module Guides Utilisation : rôles, workflow et catégories de base.

Toutes les fonctions sont idempotentes.
"""

from __future__ import annotations

import frappe

GUIDE_ROLES = ("Guide Redacteur", "Guide Validateur", "Guide Gestionnaire")

WORKFLOW_NAME = "Workflow Guide Utilisation Version"
WORKFLOW_STATES = (
	("Brouillon", "Primary"),
	("À valider", "Warning"),
	("Publié", "Success"),
	("Archivé", "Inverse"),
)
WORKFLOW_ACTIONS = (
	"Envoyer à validation",
	"Publier",
	"Rejeter",
)

DEFAULT_CATEGORIES = (
	("Commercial", 10),
	("Production", 20),
	("Prépresse / BAT / Maquette", 30),
	("Ressources Humaines", 40),
	("Meetings", 50),
)


def create_guide_roles() -> None:
	"""Créer les rôles du module Guides s'ils n'existent pas."""
	for role_name in GUIDE_ROLES:
		if frappe.db.exists("Role", role_name):
			continue
		frappe.get_doc(
			{
				"doctype": "Role",
				"role_name": role_name,
				"desk_access": 1,
				"is_custom": 1,
			}
		).insert(ignore_permissions=True)


def _ensure_workflow_state(state_name: str, style: str) -> None:
	if frappe.db.exists("Workflow State", state_name):
		return
	frappe.get_doc(
		{
			"doctype": "Workflow State",
			"workflow_state_name": state_name,
			"style": style,
		}
	).insert(ignore_permissions=True)


def _ensure_workflow_action(action_name: str) -> None:
	if frappe.db.exists("Workflow Action Master", action_name):
		return
	frappe.get_doc(
		{
			"doctype": "Workflow Action Master",
			"workflow_action_name": action_name,
		}
	).insert(ignore_permissions=True)


def create_guide_workflow() -> None:
	"""Créer le workflow de validation des versions de guide."""
	if not frappe.db.exists("DocType", "Guide Utilisation Version"):
		return

	for state_name, style in WORKFLOW_STATES:
		_ensure_workflow_state(state_name, style)

	for action_name in WORKFLOW_ACTIONS:
		_ensure_workflow_action(action_name)

	states = [
		{
			"state": "Brouillon",
			"doc_status": "0",
			"update_field": "statut",
			"update_value": "Brouillon",
			"is_optional_state": 0,
			"allow_edit": "Guide Redacteur",
		},
		{
			"state": "À valider",
			"doc_status": "0",
			"update_field": "statut",
			"update_value": "À valider",
			"is_optional_state": 0,
			"allow_edit": "Guide Validateur",
		},
		{
			"state": "Publié",
			"doc_status": "0",
			"update_field": "statut",
			"update_value": "Publié",
			"is_optional_state": 0,
			"allow_edit": "Guide Gestionnaire",
		},
		{
			"state": "Archivé",
			"doc_status": "0",
			"update_field": "statut",
			"update_value": "Archivé",
			"is_optional_state": 0,
			"allow_edit": "Guide Gestionnaire",
		},
	]

	transitions = []
	for role in ("Guide Redacteur", "Guide Validateur", "Guide Gestionnaire", "System Manager"):
		transitions.append(
			{
				"state": "Brouillon",
				"action": "Envoyer à validation",
				"next_state": "À valider",
				"allowed": role,
				"allow_self_approval": 1,
			}
		)
	for role in ("Guide Validateur", "Guide Gestionnaire", "System Manager"):
		transitions.extend(
			[
				{
					"state": "À valider",
					"action": "Publier",
					"next_state": "Publié",
					"allowed": role,
					"allow_self_approval": 1,
				},
				{
					"state": "À valider",
					"action": "Rejeter",
					"next_state": "Brouillon",
					"allowed": role,
					"allow_self_approval": 1,
				},
			]
		)

	if frappe.db.exists("Workflow", WORKFLOW_NAME):
		doc = frappe.get_doc("Workflow", WORKFLOW_NAME)
		doc.is_active = 1
		doc.document_type = "Guide Utilisation Version"
		doc.workflow_state_field = "statut"
		doc.set("states", [])
		doc.set("transitions", [])
		for state in states:
			doc.append("states", state)
		for transition in transitions:
			doc.append("transitions", transition)
		doc.save(ignore_permissions=True)
		return

	doc = frappe.get_doc(
		{
			"doctype": "Workflow",
			"workflow_name": WORKFLOW_NAME,
			"document_type": "Guide Utilisation Version",
			"is_active": 1,
			"workflow_state_field": "statut",
			"states": states,
			"transitions": transitions,
		}
	)
	doc.insert(ignore_permissions=True)


def seed_guide_categories() -> None:
	"""Créer les catégories de base si absentes."""
	if not frappe.db.exists("DocType", "Guide Categorie"):
		return

	for libelle, ordre in DEFAULT_CATEGORIES:
		if frappe.db.exists("Guide Categorie", {"libelle": libelle}):
			continue
		frappe.get_doc(
			{
				"doctype": "Guide Categorie",
				"libelle": libelle,
				"ordre_affichage": ordre,
				"actif": 1,
			}
		).insert(ignore_permissions=True)


def setup_guides_module() -> None:
	"""Point d'entrée complet du module Guides."""
	create_guide_roles()
	seed_guide_categories()
	create_guide_workflow()
