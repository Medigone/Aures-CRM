# Copyright (c) 2024, AURES Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from datetime import datetime, timedelta
import math # Importer le module math


class EtudeTechnique(Document):
	def validate(self):
		"""Valide et calcule quant_feuilles avant la sauvegarde."""
		self.calculate_quant_feuilles()
		self.set_existing_bat()

	def before_save(self):
		"""Assure que le calcul est fait avant la sauvegarde."""
		self.calculate_quant_feuilles()

	def set_existing_bat(self):
		"""Recherche et définit le BAT existant pour l'article avec le statut 'BAT-P Validé'."""
		if not self.bat and self.article:
			# Rechercher un BAT validé pour cet article
			existing_bat = frappe.get_all(
				"BAT",
				filters={
					"article": self.article,
					"status": "BAT-P Validé"
				},
				fields=["name", "date", "client"],
				order_by="date desc",  # Prendre le plus récent
				limit=1
			)
			
			if existing_bat:
				self.bat = existing_bat[0].name
				frappe.msgprint(
					f"BAT existant trouvé et associé : {existing_bat[0].name}",
					indicator="blue",
					title="BAT associé"
				)
			else:
				# Optionnel : rechercher aussi les BAT-E Validé si aucun BAT-P n'est trouvé
				existing_bat_e = frappe.get_all(
					"BAT",
					filters={
						"article": self.article,
						"status": "BAT-E Validé"
					},
					fields=["name", "date"],
					order_by="date desc",
					limit=1
				)
				
				if existing_bat_e:
					self.bat = existing_bat_e[0].name
					frappe.msgprint(
						f"BAT électronique trouvé et associé : {existing_bat_e[0].name}",
						indicator="orange",
						title="BAT électronique associé"
					)

	def calculate_quant_feuilles(self):
		"""Calcule la quantité de feuilles nécessaire."""
		if self.quantite and self.nbr_poses:
			if self.nbr_poses > 0:
				self.quant_feuilles = math.ceil(float(self.quantite) / float(self.nbr_poses))
			else:
				# Gérer le cas de la division par zéro, par exemple en mettant 0 ou en levant une erreur
				self.quant_feuilles = 0
				# Optionnel: Afficher un message d'erreur si nbr_poses est 0
				# frappe.throw("Le nombre de poses ne peut pas être zéro.")
		else:
			# Si quantite ou nbr_poses ne sont pas définis, mettre quant_feuilles à 0
			self.quant_feuilles = 0


# def create_etude_technique(doc, method):
#     if doc.custom_procédé == "Offset":
#         # Vérifiez si le client est renseigné
#         if not doc.custom_client:
#             frappe.logger().warning(f"No client linked to Item: {doc.name}")
#             return

#         # Récupérer le champ 'custom_commercial_attribué' du client
#         custom_commercial = frappe.db.get_value("Customer", doc.custom_client, "custom_commercial_attribué")

#         # Gérer le cas où le champ est vide
#         if not custom_commercial:
#             frappe.logger().warning(f"No custom_commercial_attribué found for Client: {doc.custom_client}")
#             custom_commercial = "Commercial par défaut"

#         frappe.logger().info(f"Custom Commercial for Client {doc.custom_client}: {custom_commercial}")

#         # Créez un nouveau document "Etude Technique Offset"
#         new_etude = frappe.get_doc({
#             "doctype": "Etude Technique Offset",
#             "article": doc.name,
#             "client": doc.custom_client,
#             "date_echeance": datetime.now() + timedelta(days=14),
#             "commercial": custom_commercial,
#             "status": "Nouveau"
#         })

#         new_etude.insert()
#         frappe.logger().info(f"Etude Technique Offset created for Item: {doc.name}")


@frappe.whitelist()
def update_technicien(docname, technicien_user):
	"""Met à jour les champs technicien et nom_utilisateur pour un document Etude Technique."""
	try:
		# Récupérer le nom complet de l'utilisateur
		full_name = frappe.db.get_value("User", technicien_user, "full_name")
		if not full_name:
			# Gérer le cas où l'utilisateur n'a pas de nom complet défini (peu probable mais possible)
			full_name = technicien_user # Utiliser l'email/ID comme fallback

		# Mise à jour directe des valeurs
		frappe.db.set_value("Etude Technique", docname, {
			"technicien": technicien_user,
			"nom_utilisateur": full_name
		}, update_modified=False)

		# Ligne add_comment temporairement retirée pour tester
		# frappe.get_doc("Etude Technique", docname).add_comment("Attribué", f"Technicien mis à jour via bouton: {technicien_user} ({full_name})")
		frappe.db.commit() # Assurer que la transaction est commitée immédiatement
		# Retourner le nom complet pour l'UI
		return {"status": "success", "message": "Technicien et nom mis à jour", "full_name": full_name}
	except Exception as e:
		frappe.log_error(f"Erreur dans update_technicien pour {docname}: {e}", frappe.get_traceback())
		frappe.db.rollback()
		return {"status": "error", "message": str(e)}


@frappe.whitelist()
def get_techniciens_prepresse(doctype, txt, searchfield, start, page_len, filters):
	# Récupère les utilisateurs ayant le rôle "Technicien Prepresse"
	users_with_role = frappe.get_all("Has Role",
									 filters={"role": "Technicien Prepresse", "parenttype": "User"},
									 fields=["parent"])
	user_list = [d.parent for d in users_with_role]

	if not user_list:
		return []

	# Condition pour la recherche textuelle (si l'utilisateur tape dans le champ Link)
	search_condition = ""
	if txt:
		# Assurez-vous que searchfield est un champ valide de User, comme 'name' ou 'full_name'
		# Utilisons 'name' ou 'full_name' pour la recherche
		search_condition = f"AND (`name` LIKE %(txt)s OR `full_name` LIKE %(txt)s)"


	# Requête pour récupérer les utilisateurs correspondants, actifs et filtrés
	return frappe.db.sql(f"""
		SELECT `name`, `full_name` FROM `tabUser`
		WHERE `name` IN %(user_list)s
		AND `enabled` = 1
		{search_condition}
		ORDER BY `full_name`
		LIMIT %(start)s, %(page_len)s
	""", {
		"user_list": tuple(user_list),
		"txt": f"%{txt}%",
		"start": start,
		"page_len": page_len
	}, as_list=True)


@frappe.whitelist()
def create_new_bat_from_etude(docname):
	try:
		etude = frappe.get_doc("Etude Technique", docname)
		
		# Marquer l'ancien BAT comme obsolète s'il existe
		if etude.bat:
			old_bat = frappe.get_doc("BAT", etude.bat)
			old_bat.status = "Obsolète"
			old_bat.obsolete_par = frappe.session.user
			old_bat.save()

		# Créer le nouveau BAT
		new_bat = frappe.get_doc({
			"doctype": "BAT",
			"client": etude.client,
			"article": etude.article,
			"trace": etude.trace,
			"maquette": etude.maquette,
			"etude_tech": etude.name,
			"status": "Nouveau"
		})
		new_bat.insert()

		# Mettre à jour l'étude technique avec le nouveau BAT
		etude.bat = new_bat.name
		etude.save()

		return {
			"status": "success",
			"message": "Nouveau BAT créé avec succès",
			"bat_name": new_bat.name
		}
	except Exception as e:
		frappe.log_error(f"Erreur lors de la création du nouveau BAT: {str(e)}")
		return {"status": "error", "message": str(e)}


@frappe.whitelist()
def search_existing_bat(article_code):
	"""
	Recherche un BAT existant pour un article donné.
	Retourne les BAT trouvés avec leurs informations.
	"""
	try:
		if not article_code:
			return {"status": "error", "message": "Code article requis"}
		
		# Rechercher tous les BAT pour cet article, triés par statut et date
		bats = frappe.get_all(
			"BAT",
			filters={"article": article_code},
			fields=["name", "status", "date", "client", "valide_par_nom", "echantillon_par_nom"],
			order_by="status desc, date desc"
		)
		
		if bats:
			return {
				"status": "success",
				"bats": bats,
				"message": f"{len(bats)} BAT trouvé(s) pour l'article {article_code}"
			}
		else:
			return {
				"status": "info",
				"bats": [],
				"message": f"Aucun BAT trouvé pour l'article {article_code}"
			}
			
	except Exception as e:
		frappe.log_error(f"Erreur lors de la recherche de BAT pour {article_code}: {str(e)}")
		return {"status": "error", "message": str(e)}


@frappe.whitelist()
def link_existing_bat_to_etude(etude_name, bat_name):
	"""
	Lie un BAT existant à une étude technique.
	"""
	try:
		etude = frappe.get_doc("Etude Technique", etude_name)
		bat = frappe.get_doc("BAT", bat_name)
		
		# Vérifier que le BAT correspond à l'article de l'étude
		if bat.article != etude.article:
			return {
				"status": "error",
				"message": f"Le BAT {bat_name} ne correspond pas à l'article {etude.article}"
			}
		
		# Lier le BAT à l'étude
		etude.bat = bat_name
		etude.save()
		
		return {
			"status": "success",
			"message": f"BAT {bat_name} lié avec succès à l'étude technique",
			"bat_name": bat_name
		}
		
	except Exception as e:
		frappe.log_error(f"Erreur lors de la liaison du BAT {bat_name} à l'étude {etude_name}: {str(e)}")
		return {"status": "error", "message": str(e)}
