# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import hashlib

import frappe
from frappe import _
from frappe.model.document import Document

# Palette de couleurs distinctes utilisée pour les badges département (organigramme, etc.).
# Attribuée automatiquement à la création : chaque nouveau département reçoit la première
# couleur libre (non utilisée par un autre département) de cette liste.
DEPARTEMENT_COLOR_PALETTE = [
	"#4C6EF5",  # bleu
	"#12B886",  # vert émeraude
	"#F59F00",  # ambre
	"#E64980",  # rose
	"#7C3AED",  # violet
	"#0EA5E9",  # bleu ciel
	"#F97316",  # orange
	"#059669",  # vert
	"#DC2626",  # rouge
	"#0891B2",  # cyan
	"#9333EA",  # violet foncé
	"#65A30D",  # vert lime
	"#DB2777",  # magenta
	"#2563EB",  # indigo
	"#CA8A04",  # or
	"#0D9488",  # teal
]


class DepartementRH(Document):
	def validate(self):
		self.validate_parent()
		self.assign_color_if_missing()

	def validate_parent(self):
		"""Empêcher un département d'être son propre parent (structure hiérarchique simple)."""
		if self.departement_parent and self.departement_parent == self.name:
			frappe.throw(_("Un département ne peut pas être son propre parent."))

	def assign_color_if_missing(self):
		"""Attribue automatiquement une couleur libre de la palette si aucune n'est définie."""
		if self.couleur:
			return
		self.couleur = pick_unused_color(exclude_name=self.name)


def pick_unused_color(exclude_name: str | None = None) -> str:
	"""Retourne la première couleur de la palette non déjà utilisée par un autre département.

	Si toutes les couleurs de la palette sont déjà prises, retombe sur une couleur
	choisie de façon déterministe (hash du nom) pour rester stable entre deux appels.
	"""
	filters = {"couleur": ["is", "set"]}
	if exclude_name:
		filters["name"] = ["!=", exclude_name]
	used = {
		c
		for c in frappe.get_all("Departement RH", filters=filters, pluck="couleur")
		if c
	}
	for color in DEPARTEMENT_COLOR_PALETTE:
		if color not in used:
			return color
	digest = hashlib.md5((exclude_name or "").encode()).hexdigest()
	idx = int(digest, 16) % len(DEPARTEMENT_COLOR_PALETTE)
	return DEPARTEMENT_COLOR_PALETTE[idx]


def backfill_missing_colors() -> list[str]:
	"""Attribue une couleur aux départements existants qui n'en ont pas encore.

	Utilitaire de migration (ex. après ajout du champ `couleur`) : à appeler une fois via
	`bench execute aurescrm.ressources_humaines.doctype.departement_rh.departement_rh.backfill_missing_colors`.
	"""
	updated = []
	for dept in frappe.get_all("Departement RH", filters={"couleur": ["is", "not set"]}, pluck="name"):
		color = pick_unused_color(exclude_name=dept)
		frappe.db.set_value("Departement RH", dept, "couleur", color)
		updated.append(dept)
	frappe.db.commit()
	return updated
