# Copyright (c) 2026, Medigo and contributors
# License: MIT

from aurescrm.guides_utilisation.setup import create_guide_workflow, seed_guide_categories


def execute():
	"""Créer le workflow et les catégories de base après synchronisation des DocTypes."""
	seed_guide_categories()
	create_guide_workflow()
