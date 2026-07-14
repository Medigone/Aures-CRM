# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Passe les Site RH de SRH-001-### (ou anciens noms) vers SRH-#### (ex. SRH-0001).

Autoname DocType : SRH-.#### (le point est requis par Frappe ; le name vaut SRH-0001).
Idempotent. Met à jour le compteur Series et retire l'ancienne clé SRH-001-.
"""

from __future__ import annotations

import re

import frappe

DOCTYPE = "Site RH"
SERIES_PREFIX = "SRH-"
OLD_SERIES_KEY = "SRH-001-"
TARGET_RE = re.compile(r"^SRH-\d{4}$")
OLD_TRIPLE_RE = re.compile(r"^SRH-\d{3}-\d{3}$")


def _next_name(seq: int) -> str:
	return f"{SERIES_PREFIX}{seq:04d}"


def _max_existing_seq() -> int:
	max_seq = 0
	for name in frappe.get_all(DOCTYPE, pluck="name"):
		if TARGET_RE.match(name):
			max_seq = max(max_seq, int(name[len(SERIES_PREFIX) :]))
	return max_seq


def _set_series_current(current: int) -> None:
	"""Clé Series pour autoname SRH-.#### = préfixe 'SRH-'.

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


def _cleanup_old_series() -> None:
	if frappe.db.exists("Series", OLD_SERIES_KEY):
		frappe.db.sql("DELETE FROM `tabSeries` WHERE name=%s", (OLD_SERIES_KEY,))


def _sort_key(site) -> tuple:
	"""Conserve l'ordre logique : racines d'abord, puis ancien numéro SRH-001-xxx, puis création."""
	name = site.name or ""
	old_seq = 0
	m = OLD_TRIPLE_RE.match(name)
	if m:
		old_seq = int(name.rsplit("-", 1)[-1])
	elif TARGET_RE.match(name):
		old_seq = int(name[len(SERIES_PREFIX) :])
	return (1 if site.site_parent else 0, old_seq, site.creation or "", name)


def execute():
	if not frappe.db.exists("DocType", DOCTYPE):
		return
	if not frappe.db.table_exists(DOCTYPE):
		return

	sites = frappe.get_all(
		DOCTYPE,
		fields=["name", "site_parent", "creation"],
		order_by="creation asc",
	)
	sites.sort(key=_sort_key)

	seq = _max_existing_seq()
	renamed = []

	for site in sites:
		old_name = site.name
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
	_cleanup_old_series()

	if renamed:
		frappe.logger().info(
			"rename_site_rh_series_to_srh_hash: %s",
			", ".join(f"{a} → {b}" for a, b in renamed),
		)
