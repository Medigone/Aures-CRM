# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

from aurescrm.ressources_humaines.setup import create_rh_roles


def execute():
	"""Créer les rôles RH avant la synchronisation des DocTypes du module RH
	afin que leurs permissions référencent des rôles existants."""
	create_rh_roles()
