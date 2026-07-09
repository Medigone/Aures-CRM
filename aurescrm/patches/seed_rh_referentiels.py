# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

from aurescrm.ressources_humaines.setup import seed_rh_referentiels


def execute():
	"""Insérer les valeurs de base des référentiels RH (idempotent)."""
	seed_rh_referentiels()
