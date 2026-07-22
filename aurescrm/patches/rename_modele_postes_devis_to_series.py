# Copyright (c) 2026, Aures Emballages and contributors
# For license information, please see license.txt

"""Renomme les Modele Postes Devis (name = libelle) vers MPOD-###### (ex. MPOD-000001).

Autoname DocType : MPOD-.###### (le point est requis par Frappe).
Idempotent. Met à jour le compteur Series.
"""

from __future__ import annotations

import re

import frappe

DOCTYPE = "Modele Postes Devis"
SERIES_PREFIX = "MPOD-"
TARGET_RE = re.compile(r"^MPOD-\d{6}$")


def _next_name(seq: int) -> str:
	return f"{SERIES_PREFIX}{seq:06d}"


def _max_existing_seq() -> int:
	max_seq = 0
	for name in frappe.get_all(DOCTYPE, pluck="name"):
		if TARGET_RE.match(name):
			max_seq = max(max_seq, int(name[len(SERIES_PREFIX) :]))
	return max_seq


def _set_series_current(current: int) -> None:
	"""Clé Series pour autoname MPOD-.###### = préfixe 'MPOD-'."""
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


def execute():
	if not frappe.db.exists("DocType", DOCTYPE):
		return
	if not frappe.db.table_exists(DOCTYPE):
		return

	modeles = frappe.get_all(
		DOCTYPE,
		fields=["name", "creation"],
		order_by="creation asc",
	)

	seq = _max_existing_seq()
	renamed = []

	for modele in modeles:
		old_name = modele.name
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
			"rename_modele_postes_devis_to_series: %s",
			", ".join(f"{a} → {b}" for a, b in renamed),
		)
