# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Postes du bureau (/bureau) : qui y entre, et ce que l'interface doit montrer à chacun.

Un poste choisit le menu, l'accueil et les vues par défaut. Il n'accorde aucun droit : la sécurité reste
celle de Frappe (`get_list`, `check_permission`, workflow). Ajouter une équipe revient à ajouter un poste ici
et son menu dans `bureau/src/lib/postes.ts`.
"""

import frappe

# Un poste fermé est déclaré mais n'ouvre pas encore le bureau à ses rôles.
POSTES = {
	"back_office": {
		"label": "Back office",
		"roles": {"Administrateur Ventes", "Chargé Devis", "Responsable Devis"},
		"ouvert": True,
	},
	"etude": {
		"label": "Étude",
		"roles": {"Chargé Étude Faisabilité", "Responsable Étude Faisabilité", "Étude Flexo"},
		"ouvert": False,
	},
}
ACCES_COMPLET = {"Administrator", "System Manager"}

BUREAU_ROLES = {"System Manager"}.union(*(poste["roles"] for poste in POSTES.values() if poste["ouvert"]))

# Documents dont l'interface a besoin de connaître les droits pour son menu, ses routes et sa palette.
DOCTYPES_INTERFACE = (
	"Customer",
	"Item",
	"Ticket Commercial",
	"Demande Faisabilite",
	"Etude Faisabilite",
	"Etude Faisabilite Flexo",
	"Trace",
	"Imposition",
	"Machine",
	"Quotation",
	"Sales Order",
	"Suivi Creance",
)


def get_postes(user=None):
	"""Postes ouverts de cet utilisateur, dans l'ordre de `POSTES`."""
	user = user or frappe.session.user
	if user == "Guest":
		return []
	roles = set(frappe.get_roles(user))
	complet = bool(roles & ACCES_COMPLET)
	return [
		{"key": key, "label": poste["label"]}
		for key, poste in POSTES.items()
		if poste["ouvert"] and (complet or roles & poste["roles"])
	]


def get_droits(user=None):
	"""Lecture et création par document, pour n'afficher que ce que le serveur acceptera."""
	user = user or frappe.session.user
	if user == "Guest":
		return {}
	return {
		doctype: {
			"read": bool(frappe.has_permission(doctype, "read", user=user)),
			"create": bool(frappe.has_permission(doctype, "create", user=user)),
		}
		for doctype in DOCTYPES_INTERFACE
	}
