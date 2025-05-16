# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class GenerationSuiviCreance(Document):
	pass

@frappe.whitelist()
def generer_suivis_creances():
	"""Génère les suivis de créances pour tous les clients ayant des factures impayées"""
	# Récupérer tous les clients ayant des factures impayées
	clients_avec_impayes = frappe.db.sql("""
		SELECT DISTINCT customer
		FROM `tabSales Invoice`
		WHERE docstatus = 1 
		AND outstanding_amount > 0
	""", as_dict=1)

	# Compteur pour les nouveaux suivis créés
	nb_suivis_crees = 0

	# Pour chaque client
	for client in clients_avec_impayes:
		# Marquer les suivis existants comme obsolètes
		frappe.db.sql("""
			UPDATE `tabSuivi Creance`
			SET status = 'Obsolète'
			WHERE id_client = %s AND status = 'Nouveau'
		""", (client.customer,))

		# Créer un nouveau suivi pour chaque client
		nouveau_suivi = frappe.get_doc({
			"doctype": "Suivi Creance",
			"id_client": client.customer
		})
		nouveau_suivi.insert()
		nb_suivis_crees += 1

	frappe.db.commit()
	return nb_suivis_crees
