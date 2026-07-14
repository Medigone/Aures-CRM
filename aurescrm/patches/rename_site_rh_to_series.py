# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Renomme les Site RH existants (name = nom_site) vers la série SRH-001-###.

Idempotent : ignore les sites déjà au format SRH-XXX-YYY.
Met à jour le compteur Series pour que les prochaines créations continuent la séquence.
frappe.rename_doc propage les liens (Employe.site, site_parent, Mouvement Employe, etc.).
"""

from __future__ import annotations

import re

import frappe

DOCTYPE = "Site RH"
SERIES_PREFIX = "SRH-001-"
NAME_RE = re.compile(r"^SRH-\d{3}-\d{3}$")


def _next_name(seq: int) -> str:
	return f"{SERIES_PREFIX}{seq:03d}"


def _max_existing_seq() -> int:
	"""Plus grand numéro déjà utilisé dans SRH-001-### (tous sites confondus)."""
	max_seq = 0
	for name in frappe.get_all(DOCTYPE, pluck="name"):
		if not name.startswith(SERIES_PREFIX):
			continue
		suffix = name[len(SERIES_PREFIX) :]
		if suffix.isdigit():
			max_seq = max(max_seq, int(suffix))
	return max_seq


def _set_series_current(current: int) -> None:
	"""Aligne tabSeries pour autoname SRH-001.-.### (clé = préfixe avant les #)."""
	series_key = SERIES_PREFIX  # "SRH-001-"
	if frappe.db.exists("Series", series_key):
		frappe.db.set_value("Series", series_key, "current", current)
	else:
		frappe.db.sql(
			"INSERT INTO `tabSeries` (`name`, `current`) VALUES (%s, %s)",
			(series_key, current),
		)


def execute():
	if not frappe.db.exists("DocType", DOCTYPE):
		return
	if not frappe.db.table_exists(DOCTYPE):
		return

	# Racines d'abord (site_parent vide), puis enfants ; ordre stable par création.
	sites = frappe.get_all(
		DOCTYPE,
		fields=["name", "site_parent", "creation"],
		order_by="creation asc",
	)
	sites.sort(key=lambda s: (1 if s.site_parent else 0, s.creation or "", s.name))

	seq = _max_existing_seq()
	renamed = []

	for site in sites:
		old_name = site.name
		if NAME_RE.match(old_name):
			continue

		seq += 1
		new_name = _next_name(seq)
		while frappe.db.exists(DOCTYPE, new_name):
			seq += 1
			new_name = _next_name(seq)

		frappe.rename_doc(DOCTYPE, old_name, new_name, force=True, merge=False)
		renamed.append((old_name, new_name))

	_set_series_current(_max_existing_seq())

	if renamed:
		frappe.logger().info(
			"rename_site_rh_to_series: %s",
			", ".join(f"{a} → {b}" for a, b in renamed),
		)
