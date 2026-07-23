# Copyright (c) 2026, Aures Emballages and contributors
# For license information, please see license.txt

import frappe

CATEGORY_MIGRATION = {
	"Vernis / Finition": "Ennoblissement",
	"Pelliculage": "Ennoblissement",
	"Découpe forme": "Découpe",
}

CATALOGUE = [
	# Prépresse
	("Contrôle et préparation des fichiers", "Prépresse"),
	("Correction et normalisation des fichiers", "Prépresse"),
	("Imposition", "Prépresse"),
	("Épreuve couleur / BAT", "Prépresse"),
	("Gravure plaques CTP CMJN", "Prépresse"),
	("Gravure plaque CTP ton direct / Pantone", "Prépresse"),
	# Impression
	("Calage offset 1 couleur", "Impression"),
	("Calage offset 2 couleurs", "Impression"),
	("Calage offset CMJN", "Impression"),
	("Calage couleur Pantone supplémentaire", "Impression"),
	("Calage impression recto-verso", "Impression"),
	# Ennoblissement
	("Vernis Acrylique", "Ennoblissement"),
	("Vernis UV total", "Ennoblissement"),
	("Vernis UV sélectif", "Ennoblissement"),
	("Fabrication écran / cliché de vernis", "Ennoblissement"),
	("Pelliculage mat", "Ennoblissement"),
	("Pelliculage brillant", "Ennoblissement"),
	("Pelliculage soft touch", "Ennoblissement"),
	("Fabrication cliché de dorure", "Ennoblissement"),
	("Dorure à chaud", "Ennoblissement"),
	("Fabrication cliché de gaufrage", "Ennoblissement"),
	("Gaufrage / embossage", "Ennoblissement"),
	("Gaufrage Braille", "Ennoblissement"),
	# Découpe
	("Massicotage", "Découpe"),
	("Fabrication forme de découpe", "Découpe"),
	("Calage platine de découpe", "Découpe"),
	("Découpe à la forme", "Découpe"),
	("Rainage", "Découpe"),
	("Perforation", "Découpe"),
	("Éjection / décorticage", "Découpe"),
	("Découpe mi-chair", "Découpe"),
	# Pliage
	("Calage plieuse", "Pliage"),
	("Pliage simple / roulé", "Pliage"),
	("Pliage accordéon", "Pliage"),
	("Pliage croisé / cahiers", "Pliage"),
	# Assemblage / Reliure
	("Assemblage de cahiers", "Assemblage / Reliure"),
	("Encartage", "Assemblage / Reliure"),
	("Piqûre à cheval", "Assemblage / Reliure"),
	("Piqûre à boucle", "Assemblage / Reliure"),
	("Dos carré collé EVA", "Assemblage / Reliure"),
	("Dos carré collé PUR", "Assemblage / Reliure"),
	("Reliure cousue", "Assemblage / Reliure"),
	("Reliure spirale / Wire-O", "Assemblage / Reliure"),
	# Collage / Montage
	("Calage plieuse-colleuse", "Collage / Montage"),
	("Pliage-collage d'étuis", "Collage / Montage"),
	("Collage notice pliée", "Collage / Montage"),
	("Pose de fenêtre", "Collage / Montage"),
	("Contrecollage sur carton", "Collage / Montage"),
	("Collage manuel / montage", "Collage / Montage"),
	("Montage PLV / chevalet", "Collage / Montage"),
	# Contrôle
	("Contrôle qualité final", "Contrôle"),
	("Tri / inspection", "Contrôle"),
	# Conditionnement
	("Comptage et mise en paquets", "Conditionnement"),
	("Mise sous film", "Conditionnement"),
	("Mise en cartons", "Conditionnement"),
	("Cerclage", "Conditionnement"),
	("Palettisation et filmage", "Conditionnement"),
	("Étiquetage et préparation d'expédition", "Conditionnement"),
	("Mise sous pli / routage", "Conditionnement"),
]


def execute():
	"""Migrer les catégories et créer le catalogue offset (idempotent)."""
	_migrate_categories()
	_force_forfait_all()
	_seed_catalogue()


def _migrate_categories():
	for old_category, new_category in CATEGORY_MIGRATION.items():
		rows = frappe.get_all(
			"Bareme Cout Fixe",
			filters={"categorie": old_category},
			pluck="name",
		)
		for name in rows:
			frappe.db.set_value(
				"Bareme Cout Fixe",
				name,
				"categorie",
				new_category,
				update_modified=False,
			)


def _force_forfait_all():
	rows = frappe.get_all(
		"Bareme Cout Fixe",
		filters={"unite_calcul": ("!=", "Forfait")},
		pluck="name",
	)
	for name in rows:
		frappe.db.set_value(
			"Bareme Cout Fixe",
			name,
			"unite_calcul",
			"Forfait",
			update_modified=False,
		)


def _seed_catalogue():
	for libelle, categorie in CATALOGUE:
		existing_name = frappe.db.get_value("Bareme Cout Fixe", {"libelle": libelle}, "name")
		if existing_name:
			frappe.db.set_value(
				"Bareme Cout Fixe",
				existing_name,
				{
					"categorie": categorie,
					"unite_calcul": "Forfait",
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
			}
		)
		doc.insert()
