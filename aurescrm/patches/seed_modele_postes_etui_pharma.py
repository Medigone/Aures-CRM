# Copyright (c) 2026, Aures Emballages and contributors
# For license information, please see license.txt

import frappe
from frappe import _

ETUI_PHARMA_LIBELLES = [
	"Contrôle et préparation des fichiers",
	"Imposition",
	"Épreuve couleur / BAT",
	"Gravure plaques CTP CMJN",
	"Calage offset CMJN",
	"Vernis Acrylique",
	"Fabrication cliché de gaufrage",
	"Gaufrage Braille",
	"Fabrication forme de découpe",
	"Calage platine de découpe",
	"Découpe à la forme",
	"Rainage",
	"Éjection / décorticage",
	"Calage plieuse-colleuse",
	"Pliage-collage d'étuis",
	"Contrôle qualité final",
	"Mise en cartons",
	"Palettisation et filmage",
]

MODELE_LIBELLE = "Étui Pharma"


def execute():
	"""Créer le modèle de postes Étui Pharma (idempotent, sans écrasement)."""
	if frappe.db.exists("Modele Postes Devis", {"libelle": MODELE_LIBELLE}):
		return

	postes = []
	missing = []

	for idx, libelle in enumerate(ETUI_PHARMA_LIBELLES, start=1):
		bareme_name = frappe.db.get_value("Bareme Cout Fixe", {"libelle": libelle}, "name")
		if not bareme_name:
			missing.append(libelle)
			continue

		postes.append(
			{
				"ordre": idx,
				"bareme": bareme_name,
				"nombre_passages": 1,
			}
		)

	if missing:
		frappe.throw(
			_(
				"Impossible de créer le modèle « {0} » : barème(s) manquant(s) : {1}"
			).format(MODELE_LIBELLE, ", ".join(missing))
		)

	doc = frappe.get_doc(
		{
			"doctype": "Modele Postes Devis",
			"libelle": MODELE_LIBELLE,
			"is_active": 1,
			"description": "Modèle générique pour le chiffrage d'un étui pharmaceutique offset.",
			"postes": postes,
		}
	)
	doc.insert()
