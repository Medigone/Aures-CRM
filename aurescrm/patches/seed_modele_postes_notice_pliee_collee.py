# Copyright (c) 2026, Aures Emballages and contributors
# For license information, please see license.txt

import frappe
from frappe import _

# Barèmes spécifiques à créer si absents (sites déjà seedés).
BAREMES_EXTRA = [
	(
		"Collage notice pliée",
		"Collage / Montage",
		"Application de colle (hot-melt / colle froide) sur notice pliée ou livret collé.",
	),
]

# Chaîne type : prépresse → impression 1 coul. R/V → massicot → pliage → collage → CQ → conditionnement.
NOTICE_PLIEE_COLLEE_LIBELLES = [
	"Contrôle et préparation des fichiers",
	"Imposition",
	"Épreuve couleur / BAT",
	"Gravure plaque CTP ton direct / Pantone",
	"Calage offset 1 couleur",
	"Calage impression recto-verso",
	"Massicotage",
	"Calage plieuse",
	"Pliage accordéon",
	"Collage notice pliée",
	"Contrôle qualité final",
	"Comptage et mise en paquets",
	"Mise en cartons",
	"Palettisation et filmage",
]

MODELE_LIBELLE = "Notice pliée collée"


def execute():
	"""Créer le modèle Notice pliée collée (idempotent, sans écrasement)."""
	_ensure_baremes_extra()

	if frappe.db.exists("Modele Postes Devis", {"libelle": MODELE_LIBELLE}):
		return

	postes = []
	missing = []

	for idx, libelle in enumerate(NOTICE_PLIEE_COLLEE_LIBELLES, start=1):
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
			"description": (
				"Modèle générique pour le chiffrage d'une notice pharmaceutique "
				"pliée avec collage (offset)."
			),
			"postes": postes,
		}
	)
	doc.insert()


def _ensure_baremes_extra():
	for libelle, categorie, notes in BAREMES_EXTRA:
		existing_name = frappe.db.get_value("Bareme Cout Fixe", {"libelle": libelle}, "name")
		if existing_name:
			frappe.db.set_value(
				"Bareme Cout Fixe",
				existing_name,
				{
					"categorie": categorie,
					"unite_calcul": "Forfait",
					"is_active": 1,
				},
				update_modified=False,
			)
			continue

		doc = frappe.get_doc(
			{
				"doctype": "Bareme Cout Fixe",
				"libelle": libelle,
				"categorie": categorie,
				"unite_calcul": "Forfait",
				"is_active": 1,
				"notes": notes,
			}
		)
		doc.insert()
