# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import hashlib

import frappe
from frappe import _
from frappe.model.document import Document

# Palette de couleurs distinctes pour les cartes site (organigramme, etc.).
SITE_COLOR_PALETTE = [
	"#0EA5E9",  # bleu ciel
	"#4C6EF5",  # bleu
	"#12B886",  # vert émeraude
	"#F59F00",  # ambre
	"#E64980",  # rose
	"#7C3AED",  # violet
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


class SiteRH(Document):
	def validate(self):
		self.validate_parent()
		self.assign_color_if_missing()

	def validate_parent(self):
		"""Empêcher un site d'être son propre parent ou de créer une boucle."""
		if not self.site_parent:
			return
		if self.site_parent == self.name:
			frappe.throw(_("Un site ne peut pas être son propre parent."))

		seen = {self.name}
		current = self.site_parent
		while current:
			if current in seen:
				frappe.throw(_("La hiérarchie des sites forme une boucle."))
			seen.add(current)
			current = frappe.db.get_value("Site RH", current, "site_parent")

	def assign_color_if_missing(self):
		"""Attribue automatiquement une couleur libre de la palette si aucune n'est définie."""
		if self.couleur:
			return
		self.couleur = pick_unused_color(exclude_name=self.name)


def pick_unused_color(exclude_name: str | None = None) -> str:
	"""Retourne la première couleur de la palette non déjà utilisée par un autre site."""
	filters = {"couleur": ["is", "set"]}
	if exclude_name:
		filters["name"] = ["!=", exclude_name]
	used = {c for c in frappe.get_all("Site RH", filters=filters, pluck="couleur") if c}
	for color in SITE_COLOR_PALETTE:
		if color not in used:
			return color
	digest = hashlib.md5((exclude_name or "").encode()).hexdigest()
	idx = int(digest, 16) % len(SITE_COLOR_PALETTE)
	return SITE_COLOR_PALETTE[idx]


def backfill_missing_colors() -> list[str]:
	"""Attribue une couleur aux sites existants qui n'en ont pas encore."""
	updated = []
	for site in frappe.get_all("Site RH", filters={"couleur": ["is", "not set"]}, pluck="name"):
		color = pick_unused_color(exclude_name=site)
		frappe.db.set_value("Site RH", site, "couleur", color)
		updated.append(site)
	frappe.db.commit()
	return updated
