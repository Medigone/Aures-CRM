# Copyright (c) 2026, Medigo and contributors
# License: MIT

from aurescrm.guides_utilisation.setup import create_guide_roles


def execute():
	"""Créer les rôles Guides avant la synchronisation des DocTypes."""
	create_guide_roles()
