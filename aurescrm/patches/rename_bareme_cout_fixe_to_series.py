# Copyright (c) 2026, Aures Emballages and contributors
# For license information, please see license.txt

"""Renomme les Bareme Cout Fixe (BAR-{libelle}-{#####}) vers BAR-##### (ex. BAR-00241).

Autoname DocType : BAR-.##### (le point est requis par Frappe).
Conserve le numéro de séquence existant quand possible.
Idempotent. Met à jour le compteur Series.
"""

from __future__ import annotations

import re

import frappe

DOCTYPE = "Bareme Cout Fixe"
SERIES_PREFIX = "BAR-"
TARGET_RE = re.compile(r"^BAR-\d{5}$")
LEGACY_RE = re.compile(r"^BAR-.+-(\d{5})$")


def _next_name(seq: int) -> str:
	return f"{SERIES_PREFIX}{seq:05d}"


def _max_existing_seq() -> int:
	max_seq = 0
	for name in frappe.get_all(DOCTYPE, pluck="name"):
		if TARGET_RE.match(name):
			max_seq = max(max_seq, int(name[len(SERIES_PREFIX) :]))
			continue
		match = LEGACY_RE.match(name)
		if match:
			max_seq = max(max_seq, int(match.group(1)))
	return max_seq


def _set_series_current(current: int) -> None:
	"""Clé Series pour autoname BAR-.##### = préfixe 'BAR-'."""
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


def _preferred_name(old_name: str) -> str | None:
	match = LEGACY_RE.match(old_name)
	if not match:
		return None
	return _next_name(int(match.group(1)))


def execute():
	if not frappe.db.exists("DocType", DOCTYPE):
		return
	if not frappe.db.table_exists(DOCTYPE):
		return

	baremes = frappe.get_all(
		DOCTYPE,
		fields=["name", "creation"],
		order_by="creation asc",
	)

	seq = _max_existing_seq()
	renamed = []

	for bareme in baremes:
		old_name = bareme.name
		if TARGET_RE.match(old_name):
			continue

		preferred = _preferred_name(old_name)
		if preferred and preferred != old_name and not frappe.db.exists(DOCTYPE, preferred):
			new_name = preferred
		else:
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
			"rename_bareme_cout_fixe_to_series: %s",
			", ".join(f"{a} → {b}" for a, b in renamed),
		)
