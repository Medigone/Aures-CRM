# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Imposition(Document):
	def after_save(self):
		"""Actions après sauvegarde"""
		# Mettre à jour le taux de chutes dans les Etudes Faisabilite liées
		self.update_etude_faisabilite_taux_chutes()
	
	def update_etude_faisabilite_taux_chutes(self):
		"""Met à jour le taux de chutes dans toutes les Etudes Faisabilite liées à cette Imposition"""
		# Trouver toutes les Etudes Faisabilite qui utilisent cette Imposition
		etudes = frappe.get_all(
			"Etude Faisabilite",
			filters={"imposition": self.name},
			fields=["name"]
		)
		
		# Mettre à jour le taux_chutes pour chaque étude trouvée
		for etude in etudes:
			frappe.db.set_value(
				"Etude Faisabilite",
				etude.name,
				"taux_chutes",
				self.taux_chutes or 0,
				update_modified=False
			)
	
	def recalculate_imposition_ideale(self):
		"""Recalcule quelle imposition est idéale pour la combinaison Client/Article/Tracé"""
		if not self.client or not self.article or not self.trace:
			return
		
		# Trouver toutes les impositions avec la même combinaison Client/Article/Tracé
		# et qui ont un taux de chutes défini
		impositions = frappe.get_all(
			"Imposition",
			filters={
				"client": self.client,
				"article": self.article,
				"trace": self.trace,
				"taux_chutes": ["is", "set"]
			},
			fields=["name", "taux_chutes", "creation"]
		)
		
		if not impositions:
			return
		
		# Trouver le taux de chutes minimum
		taux_min = min(imp.taux_chutes for imp in impositions)
		
		# Filtrer pour ne garder que celles avec le taux minimum
		impositions_avec_taux_min = [imp for imp in impositions if imp.taux_chutes == taux_min]
		
		# Parmi celles avec le taux min, trier par date de création (décroissant = plus récent d'abord)
		# La date creation est au format: "YYYY-MM-DD HH:MM:SS.ffffff"
		# On peut trier directement par string car le format ISO est triable
		impositions_sorted = sorted(
			impositions_avec_taux_min,
			key=lambda x: x.creation,
			reverse=True  # True = ordre décroissant (plus récent d'abord)
		)
		
		# L'imposition idéale est la première (taux min + plus récente)
		imposition_ideale_name = impositions_sorted[0].name
		
		# Récupérer toutes les impositions de cette combinaison (même celles sans taux)
		all_impositions = frappe.get_all(
			"Imposition",
			filters={
				"client": self.client,
				"article": self.article,
				"trace": self.trace
			},
			fields=["name", "taux_chutes"]
		)
		
		# Mettre à jour toutes les impositions de cette combinaison
		for imp in all_impositions:
			# Seule l'imposition idéale aura defaut=1
			est_ideale = 1 if imp.name == imposition_ideale_name else 0
			
			# Ne mettre à jour que si la valeur a changé
			current_defaut = frappe.db.get_value("Imposition", imp.name, "defaut")
			if current_defaut != est_ideale:
				frappe.db.set_value(
					"Imposition",
					imp.name,
					"defaut",
					est_ideale,
					update_modified=False
				)
		
		# Commit les changements pour que les mises à jour soient persistées
		frappe.db.commit()


def on_update_recalculate_ideale(doc, method=None):
	"""
	Hook appelé après la mise à jour (sauvegarde) d'une Imposition
	Recalcule automatiquement quelle imposition est idéale pour la combinaison Client/Article/Tracé
	"""
	# Vérifier que les champs requis sont présents
	if doc.client and doc.article and doc.trace:
		doc.recalculate_imposition_ideale()


@frappe.whitelist()
def recalculate_for_combination(client, article, trace):
	"""
	Force le recalcul de l'imposition idéale pour une combinaison donnée
	Utile pour corriger les états incohérents
	"""
	try:
		# Trouver une imposition de cette combinaison
		impositions = frappe.get_all(
			"Imposition",
			filters={
				"client": client,
				"article": article,
				"trace": trace
			},
			fields=["name"],
			limit=1
		)
		
		if impositions:
			# Charger l'imposition et déclencher le recalcul
			doc = frappe.get_doc("Imposition", impositions[0].name)
			doc.recalculate_imposition_ideale()
			
			return {
				"success": True,
				"message": "Recalcul effectué avec succès"
			}
		else:
			return {
				"success": False,
				"message": "Aucune imposition trouvée pour cette combinaison"
			}
	except Exception as e:
		frappe.log_error(message=str(e), title="Erreur recalculate_for_combination")
		return {
			"success": False,
			"error": str(e)
		}


@frappe.whitelist()
def get_all_impositions_for_trace(client, article, trace):
	"""
	Récupère toutes les impositions pour une combinaison Client/Article/Tracé
	Retourne une liste triée par taux de chutes croissant (meilleur taux en premier)
	"""
	try:
		# Récupérer toutes les impositions avec la même combinaison
		impositions = frappe.get_all(
			"Imposition",
			filters={
				"client": client,
				"article": article,
				"trace": trace
			},
			fields=["name", "taux_chutes", "format_imp", "nbr_poses", "defaut"]
		)
		
		# Convertir en liste de dictionnaires avec valeurs par défaut
		result = []
		for imp in impositions:
			taux_chutes = imp.get("taux_chutes")
			result.append({
				"name": imp.get("name") or "",
				"taux_chutes": taux_chutes,  # Garder None pour le tri
				"format_imp": imp.get("format_imp") or "",
				"nbr_poses": imp.get("nbr_poses") or 0,
				"defaut": imp.get("defaut") or 0
			})
		
		# Trier par taux de chutes croissant (None/null en dernier)
		# Utiliser une clé de tri qui met None à la fin
		result.sort(key=lambda x: (x["taux_chutes"] is None, x["taux_chutes"] if x["taux_chutes"] is not None else float('inf')))
		
		return result
	except Exception as e:
		frappe.log_error(message=str(e), title="Erreur get_all_impositions_for_trace")
		return []


@frappe.whitelist()
def get_imposition_ideale(client, article, trace, current_imposition=None):
	"""
	Récupère l'imposition idéale pour une combinaison Client/Article/Tracé
	Retourne None si c'est déjà l'imposition idéale ou si aucune autre n'existe
	"""
	try:
		# Trouver toutes les impositions avec la même combinaison
		impositions = frappe.get_all(
			"Imposition",
			filters={
				"client": client,
				"article": article,
				"trace": trace,
				"defaut": 1
			},
			fields=["name", "taux_chutes", "format_imp", "laize_pal", "format_laize_palette", "nbr_poses"],
			limit=1
		)
		
		if not impositions:
			return None
		
		imposition_ideale = impositions[0]
		
		# Si l'imposition actuelle est déjà l'idéale, retourner None
		if current_imposition and imposition_ideale.get("name") == current_imposition:
			return None
		
		# Retourner les informations de l'imposition idéale
		return {
			"name": imposition_ideale.get("name") or "",
			"taux_chutes": imposition_ideale.get("taux_chutes") or 0,
			"format_imp": imposition_ideale.get("format_imp") or "",
			"laize_pal": imposition_ideale.get("laize_pal") or "",
			"format_laize_palette": imposition_ideale.get("format_laize_palette") or "",
			"nbr_poses": imposition_ideale.get("nbr_poses") or 0
		}
	except Exception as e:
		frappe.log_error(message=str(e), title="Erreur get_imposition_ideale")
		return None


@frappe.whitelist()
def sync_taux_chutes_to_etude(imposition_name, etude_faisabilite_name):
	"""
	Synchronise le taux de chutes de l'Imposition vers l'Etude Faisabilite
	Cette méthode est appelée depuis le JavaScript après création/mise à jour d'une Imposition
	"""
	try:
		# Récupérer l'Imposition
		imposition = frappe.get_doc("Imposition", imposition_name)
		
		# Mettre à jour l'Etude Faisabilite
		frappe.db.set_value(
			"Etude Faisabilite",
			etude_faisabilite_name,
			"taux_chutes",
			imposition.taux_chutes or 0,
			update_modified=False
		)
		
		return {
			"success": True,
			"taux_chutes": imposition.taux_chutes or 0
		}
	except Exception as e:
		frappe.log_error(message=str(e), title="Erreur sync_taux_chutes_to_etude")
		return {
			"success": False,
			"error": str(e)
		}


def recalculate_all_impositions_ideales():
	"""
	Fonction utilitaire pour recalculer toutes les impositions idéales
	Peut être appelée manuellement ou via un job planifié
	"""
	# Récupérer toutes les combinaisons uniques Client/Article/Tracé
	impositions = frappe.get_all(
		"Imposition",
		fields=["client", "article", "trace"],
		group_by="client, article, trace"
	)
	
	for imp in impositions:
		if imp.client and imp.article and imp.trace:
			# Trouver toutes les impositions pour cette combinaison
			docs = frappe.get_all(
				"Imposition",
				filters={
					"client": imp.client,
					"article": imp.article,
					"trace": imp.trace
				},
				fields=["name"],
				limit=1
			)
			
			if docs:
				# Charger et déclencher le recalcul
				doc = frappe.get_doc("Imposition", docs[0].name)
				doc.recalculate_imposition_ideale()
	
	frappe.db.commit()
