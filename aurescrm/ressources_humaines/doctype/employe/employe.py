# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class Employe(Document):
	"""Référentiel central RH.

	Les validations et la génération du nom complet sont gérées dans
	``aurescrm.rh_hooks`` (voir hooks.py > doc_events > "Employe").
	Les futurs DocTypes RH (Salaire Employe, Conge Employe, Contrat Employe,
	etc.) doivent se lier à ce DocType via un champ Link "employe" et ne
	jamais stocker leurs données ici.
	"""

	pass
