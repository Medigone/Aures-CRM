# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

"""
Script de migration pour copier le taux_chutes depuis les Etudes Faisabilite
existantes vers leurs Impositions liées.

Ce patch est nécessaire car le champ taux_chutes a été ajouté au doctype Imposition
après que des données aient déjà été créées.
"""

import frappe


def execute():
	"""
	Migre le taux_chutes depuis Etude Faisabilite vers Imposition
	pour toutes les données existantes.
	"""
	frappe.logger().info("Début de la migration du taux_chutes vers Imposition")
	
	# Récupérer toutes les Etudes Faisabilite qui ont une Imposition liée
	etudes = frappe.get_all(
		"Etude Faisabilite",
		filters={
			"imposition": ["!=", ""],  # Imposition liée existe
			"taux_chutes": ["!=", None]  # Taux de chutes est défini
		},
		fields=["name", "imposition", "taux_chutes"]
	)
	
	if not etudes:
		frappe.logger().info("Aucune Etude Faisabilite avec Imposition et taux_chutes trouvée")
		return
	
	frappe.logger().info(f"Trouvé {len(etudes)} Etude(s) Faisabilite à migrer")
	
	updated_count = 0
	skipped_count = 0
	error_count = 0
	
	for etude in etudes:
		try:
			# Vérifier si l'Imposition existe toujours
			if not frappe.db.exists("Imposition", etude.imposition):
				frappe.logger().warning(
					f"Imposition {etude.imposition} n'existe pas pour l'Etude {etude.name}"
				)
				skipped_count += 1
				continue
			
			# Récupérer le taux_chutes actuel de l'Imposition
			current_taux = frappe.db.get_value("Imposition", etude.imposition, "taux_chutes")
			
			# Si l'Imposition a déjà un taux_chutes, on le garde (ne pas écraser)
			if current_taux is not None and current_taux > 0:
				frappe.logger().info(
					f"Imposition {etude.imposition} a déjà un taux_chutes ({current_taux}%), ignoré"
				)
				skipped_count += 1
				continue
			
			# Mettre à jour l'Imposition avec le taux_chutes de l'Etude
			frappe.db.set_value(
				"Imposition",
				etude.imposition,
				"taux_chutes",
				etude.taux_chutes,
				update_modified=False  # Ne pas mettre à jour la date de modification
			)
			
			updated_count += 1
			frappe.logger().info(
				f"✓ Imposition {etude.imposition}: taux_chutes mis à jour à {etude.taux_chutes}%"
			)
			
		except Exception as e:
			error_count += 1
			frappe.logger().error(
				f"Erreur lors de la migration pour Etude {etude.name}: {str(e)}"
			)
			continue
	
	# Commit toutes les modifications
	frappe.db.commit()
	
	# Log du résumé
	frappe.logger().info("=" * 60)
	frappe.logger().info("Migration du taux_chutes terminée")
	frappe.logger().info(f"Total traité: {len(etudes)}")
	frappe.logger().info(f"Mis à jour: {updated_count}")
	frappe.logger().info(f"Ignorés (déjà défini): {skipped_count}")
	frappe.logger().info(f"Erreurs: {error_count}")
	frappe.logger().info("=" * 60)
	
	# Afficher un message dans la console
	print(f"\n✓ Migration du taux_chutes terminée: {updated_count} Imposition(s) mise(s) à jour\n")

