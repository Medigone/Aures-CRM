import frappe
from frappe.utils import flt


def execute():
	"""Renseigne nb_passages / charge_feuilles sur les documents existants (études, dossiers)."""
	from aurescrm.passages import get_nb_passages

	cache: dict[tuple[str, str], int] = {}

	def np(article, machine):
		if not article or not machine:
			return 0
		key = (article, machine)
		if key not in cache:
			cache[key] = get_nb_passages(article, machine)
		return cache[key]

	for row in frappe.get_all(
		"Etude Faisabilite",
		filters={"machine_prevue": ["is", "set"]},
		fields=["name", "article", "machine_prevue", "nbr_feuilles"],
	):
		nb = np(row.article, row.machine_prevue)
		frappe.db.set_value(
			"Etude Faisabilite",
			row.name,
			{"nb_passages": nb, "charge_feuilles": flt(row.nbr_feuilles) * nb},
			update_modified=False,
		)

	for row in frappe.get_all(
		"Etude Technique",
		filters={"machine": ["is", "set"]},
		fields=["name", "article", "machine", "quant_feuilles"],
	):
		nb = np(row.article, row.machine)
		frappe.db.set_value(
			"Etude Technique",
			row.name,
			{"nb_passages": nb, "charge_feuilles": flt(row.quant_feuilles) * nb},
			update_modified=False,
		)

	for dt in ("Dossier Fabrication Ligne", "Dossier Fabrication Programme Livraison"):
		for row in frappe.get_all(
			dt,
			filters={"machine": ["is", "set"]},
			fields=["name", "article", "machine"],
		):
			frappe.db.set_value(dt, row.name, "nb_passages", np(row.article, row.machine), update_modified=False)
