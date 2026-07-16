# Copyright (c) 2026, Medigo and contributors
# License: MIT

"""Catalogue historique des guides Markdown (import initial uniquement).

La source de vérité runtime est désormais la base (DocTypes Guide Utilisation).
Cette liste sert uniquement au patch d'import depuis docs/.
"""

from __future__ import annotations

GUIDES = [
	{
		"id": "ticket-commercial",
		"title": "Ticket Commercial",
		"category": "Commercial",
		"file": "GUIDE_UTILISATEUR_TICKET_COMMERCIAL.md",
		"description": "Création et suivi des tickets commerciaux",
	},
	{
		"id": "ticket-commercial-terrain",
		"title": "Ticket Commercial — Terrain",
		"category": "Commercial",
		"file": "GUIDE_COMMERCIAL_TERRAIN_TICKET_COMMERCIAL.md",
		"description": "Enchaînement visite → saisie pour les commerciaux itinérants",
	},
	{
		"id": "pilotage-commercial",
		"title": "Pilotage commercial",
		"category": "Commercial",
		"file": "GUIDE_UTILISATEUR_PILOTAGE_COMMERCIAL.md",
		"description": "Fiche de pilotage commercial pour managers et commerciaux",
	},
	{
		"id": "accueil-client",
		"title": "Accueil Client",
		"category": "Commercial",
		"file": "GUIDE_UTILISATEUR_ACCUEIL_CLIENT.md",
		"description": "Gestion de l'accueil client",
	},
	{
		"id": "etude-technique",
		"title": "Étude Technique",
		"category": "Production",
		"file": "GUIDE_UTILISATEUR_ETUDE_TECHNIQUE.md",
		"description": "Études techniques et faisabilité",
	},
	{
		"id": "planification-production",
		"title": "Planification de la production",
		"category": "Production",
		"file": "GUIDE_UTILISATEUR_PLANIFICATION_PRODUCTION.md",
		"description": "Procédure de planification de la production",
	},
	{
		"id": "machine",
		"title": "Machine",
		"category": "Production",
		"file": "GUIDE_UTILISATEUR_MACHINE.md",
		"description": "Fiches machines et paramètres de production",
	},
	{
		"id": "bat",
		"title": "BAT (Bon À Tirer)",
		"category": "Prépresse / BAT / Maquette",
		"file": "GUIDE_UTILISATEUR_BAT.md",
		"description": "Gestion des Bons À Tirer",
	},
	{
		"id": "maquette",
		"title": "Maquette",
		"category": "Prépresse / BAT / Maquette",
		"file": "GUIDE_UTILISATEUR_MAQUETTE.md",
		"description": "Suivi des maquettes",
	},
	{
		"id": "conception-maquette",
		"title": "Conception Maquette",
		"category": "Prépresse / BAT / Maquette",
		"file": "GUIDE_UTILISATEUR_CONCEPTION_MAQUETTE.md",
		"description": "Module de conception maquette",
	},
	{
		"id": "pv-destruction-maquette",
		"title": "PV Destruction Maquette",
		"category": "Prépresse / BAT / Maquette",
		"file": "GUIDE_UTILISATEUR_PV_DESTRUCTION_MAQUETTE.md",
		"description": "Procès-verbaux de destruction de maquettes",
	},
	{
		"id": "rh",
		"title": "Ressources Humaines",
		"category": "Ressources Humaines",
		"file": "GUIDE_UTILISATEUR_RH.md",
		"description": "Employés, référentiels, organigramme",
	},
	{
		"id": "presentation-rh",
		"title": "Présentation du module RH",
		"category": "Ressources Humaines",
		"file": "PRESENTATION_MODULE_RH.md",
		"description": "Présentation complète et prérequis du module RH",
	},
	{
		"id": "meeting-interne",
		"title": "Meetings Internes",
		"category": "Meetings",
		"file": "GUIDE_UTILISATEUR_MEETING_INTERNE.md",
		"description": "Gestion des meetings internes",
	},
	{
		"id": "bareme-cout-fixe",
		"title": "Bareme Cout Fixe",
		"category": "Commercial",
		"file": "GUIDE_UTILISATEUR_BAREME_COUT_FIXE.md",
		"description": "Bibliothèque de coûts standards pour le chiffrage",
	},
	{
		"id": "calcul-devis",
		"title": "Calcul Devis",
		"category": "Commercial",
		"file": "GUIDE_UTILISATEUR_CALCUL_DEVIS.md",
		"description": "Chiffrage d'une ligne de devis : papier, postes de production et marge",
	},
	{
		"id": "methode-calcul-devis",
		"title": "Méthode fonctionnelle de calcul du devis",
		"category": "Commercial",
		"file": "METHODE_CALCUL_DEVIS.md",
		"description": "Formules et règles de calcul des montants du Calcul Devis",
	},
]


def get_guide_by_id(guide_id: str) -> dict | None:
	"""Retourne l'entrée catalogue pour un id, ou None."""
	for guide in GUIDES:
		if guide["id"] == guide_id:
			return guide
	return None


def get_guide_by_filename(filename: str) -> dict | None:
	"""Retourne l'entrée catalogue correspondant à un nom de fichier .md."""
	name = filename.rsplit("/", 1)[-1]
	for guide in GUIDES:
		if guide["file"] == name:
			return guide
	return None


def list_catalogue() -> list[dict]:
	"""Liste publique (sans chemin fichier) pour la navigation Desk."""
	return [
		{
			"id": g["id"],
			"title": g["title"],
			"category": g["category"],
			"description": g["description"],
			"file": g["file"],
		}
		for g in GUIDES
	]
