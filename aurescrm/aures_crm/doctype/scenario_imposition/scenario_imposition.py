# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class ScenarioImposition(Document):
	"""Ligne de proposition du moteur d'imposition, rattachée à l'Étude de Faisabilité.

	Tous les champs sont en lecture seule sauf `retenu` : l'outil propose,
	l'ingénieur décide.
	"""

	pass
