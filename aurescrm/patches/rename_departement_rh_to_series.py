# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Renomme les Departement RH (name = nom_departement) vers DRH-#### (ex. DRH-0001).

Autoname DocType : DRH-.#### (le point est requis par Frappe).
Idempotent. Met à jour le compteur Series.
frappe.rename_doc propage les liens (Employe, Poste RH, Mouvement Employe, departement_parent).
"""

from __future__ import annotations

import re

import frappe

DOCTYPE = "Departement RH"
SERIES_PREFIX = "DRH-"
TARGET_RE = re.compile(r"^DRH-\d{4}$")


def _next_name(seq: int) -> str:
	return f"{SERIES_PREFIX}{seq:04d}"


def _max_existing_seq() -> int:
	max_seq = 0
	for name in frappe.get_all(DOCTYPE, pluck="name"):
		if TARGET_RE.match(name):
			max_seq = max(max_seq, int(name[len(SERIES_PREFIX) :]))
	return max_seq


def _set_series_current(current: int) -> None:
	"""Clé Series pour autoname DRH-.#### = préfixe 'DRH-'.

	tabSeries n'a pas de colonnes standard Document : éviter frappe.db.set_value.
	"""
	exists = frappe.db.sql("SELECT name FROM `tabSeries` WHERE name=%s", (SERIES_PREFIX,))
	if exists:
		frappe.db.sql(
			"UPDATE `tabSeries` SET `current`=%s WHERE name=%s",
			(current, SERIES_PREFIX),
		)
	else:
		frappe.db.sql(
			"INSERT INTO `tabSeries` (`name`, `current`) VALUES (%s, %s)",
			(SERIES_PREFIX, current),
		)


def _sort_key(dept) -> tuple:
	"""Racines d'abord, puis ordre de création."""
	return (1 if dept.departement_parent else 0, dept.creation or "", dept.name or "")


def execute():
	if not frappe.db.exists("DocType", DOCTYPE):
		return
	if not frappe.db.table_exists(DOCTYPE):
		return

	depts = frappe.get_all(
		DOCTYPE,
		fields=["name", "departement_parent", "creation"],
		order_by="creation asc",
	)
	depts.sort(key=_sort_key)

	seq = _max_existing_seq()
	renamed = []

	for dept in depts:
		old_name = dept.name
		if TARGET_RE.match(old_name):
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
			"rename_departement_rh_to_series: %s",
			", ".join(f"{a} → {b}" for a, b in renamed),
		)
