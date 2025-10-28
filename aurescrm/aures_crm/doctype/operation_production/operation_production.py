# Copyright (c) 2025, Aures and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime, get_datetime, time_diff_in_hours


class OperationProduction(Document):
	def before_save(self):
		"""Calculs automatiques avant sauvegarde"""
		self.calculer_durees()
		self.calculer_taux_rebut()
		self.calculer_pourcentage_avancement()
		self.calculer_retard()
		self.mettre_a_jour_couleur_statut()
	
	def validate(self):
		"""Validations"""
		# Vérifier cohérence des dates
		if self.date_heure_debut_reelle and self.date_heure_fin_reelle:
			if get_datetime(self.date_heure_fin_reelle) < get_datetime(self.date_heure_debut_reelle):
				frappe.throw("La date de fin doit être postérieure à la date de début")
		
		# Vérifier cohérence des quantités
		if self.quantite_ok and self.quantite_rebutee:
			total = self.quantite_ok + self.quantite_rebutee
			if self.quantite_traitee and total != self.quantite_traitee:
				frappe.msgprint(
					f"Attention : Quantité traitée ({self.quantite_traitee}) différente de OK + Rebutée ({total})",
					indicator="orange"
				)
	
	def after_save(self):
		"""Actions après sauvegarde"""
		# Mettre à jour l'ordre de production parent
		self.mettre_a_jour_ordre_production()
		
		# Envoyer notifications si nécessaire
		self.envoyer_notifications()
	
	def calculer_durees(self):
		"""Calculer durée réelle, temps productif et écart"""
		if self.date_heure_debut_reelle and self.date_heure_fin_reelle:
			# Calculer durée réelle en heures
			self.duree_reelle = time_diff_in_hours(
				get_datetime(self.date_heure_fin_reelle),
				get_datetime(self.date_heure_debut_reelle)
			)
			
			# Calculer temps productif
			self.temps_productif = self.duree_reelle - (self.temps_arret or 0)
			
			# Calculer écart avec durée estimée
			if self.duree_estimee:
				self.ecart_duree = self.temps_productif - self.duree_estimee
	
	def calculer_taux_rebut(self):
		"""Calculer le taux de rebut"""
		if self.quantite_traitee and self.quantite_traitee > 0:
			self.taux_rebut = (self.quantite_rebutee or 0) / self.quantite_traitee * 100
		else:
			self.taux_rebut = 0
	
	def calculer_pourcentage_avancement(self):
		"""Calculer le pourcentage d'avancement selon le statut"""
		statut_avancement = {
			"En attente": 0,
			"Assignée": 10,
			"En cours": 50,
			"En pause": 50,
			"Bloquée": 50,
			"Terminée": 100
		}
		self.pourcentage_avancement = statut_avancement.get(self.statut, 0)
	
	def calculer_retard(self):
		"""Calculer si l'opération est en retard"""
		if self.statut != "Terminée" and self.date_heure_prevue_fin:
			now = get_datetime(now_datetime())
			prevue_fin = get_datetime(self.date_heure_prevue_fin)
			
			if now > prevue_fin:
				self.est_en_retard = 1
				self.heures_retard = time_diff_in_hours(now, prevue_fin)
			else:
				self.est_en_retard = 0
				self.heures_retard = 0
		else:
			self.est_en_retard = 0
			self.heures_retard = 0
	
	def mettre_a_jour_couleur_statut(self):
		"""Mettre à jour la couleur selon le statut"""
		couleurs = {
			"En attente": "#6c757d",  # Gris
			"Assignée": "#17a2b8",    # Bleu cyan
			"En cours": "#007bff",    # Bleu
			"Terminée": "#28a745",    # Vert
			"En pause": "#ffc107",    # Orange
			"Bloquée": "#dc3545"      # Rouge
		}
		self.couleur_statut = couleurs.get(self.statut, "#6c757d")
	
	def mettre_a_jour_ordre_production(self):
		"""Mettre à jour l'ordre de production parent"""
		if self.ordre_production:
			try:
				ordre = frappe.get_doc("Ordre de Production", self.ordre_production)
				# L'ordre se mettra à jour lui-même via before_save
				ordre.save(ignore_permissions=True)
			except Exception as e:
				frappe.log_error(f"Erreur mise à jour ordre : {str(e)}")
	
	def envoyer_notifications(self):
		"""Envoyer les notifications selon le statut"""
		# Les notifications seront configurées via Frappe Notification DocType
		# Cette méthode peut être étendue pour des notifications custom
		pass
	
	@frappe.whitelist()
	def assigner_operateur(self, operateur, date_debut=None, date_fin=None):
		"""Assigner un opérateur à l'opération"""
		self.operateur_assigne = operateur
		self.statut = "Assignée"
		
		if date_debut:
			self.date_heure_prevue_debut = date_debut
		if date_fin:
			self.date_heure_prevue_fin = date_fin
		
		self.save()
		
		frappe.msgprint(
			f"Opération assignée à {operateur}",
			indicator="green",
			alert=True
		)
		
		return True
	
	@frappe.whitelist()
	def demarrer(self):
		"""Démarrer l'opération"""
		if self.statut not in ["Assignée", "En attente"]:
			frappe.throw("L'opération n'est pas démarrable dans son état actuel")
		
		# Validation stricte : vérifier que l'opération précédente est terminée
		operation_precedente = frappe.db.get_value(
			"Operation Production",
			filters={
				"ordre_production": self.ordre_production,
				"numero_sequence": ["<", self.numero_sequence]
			},
			fieldname=["name", "statut", "nom_operation"],
			order_by="numero_sequence desc",
			as_dict=True
		)
		
		if operation_precedente and operation_precedente.statut != "Terminée":
			frappe.throw(
				f"❌ Impossible de démarrer cette opération.<br><br>"
				f"<strong>L'opération précédente doit être terminée d'abord :</strong><br>"
				f"📋 {operation_precedente.nom_operation}<br>"
				f"📊 Statut actuel : <strong>{operation_precedente.statut}</strong><br><br>"
				f"Les opérations doivent être exécutées dans l'ordre séquentiel.",
				title="Ordre Séquentiel Requis"
			)
		
		self.statut = "En cours"
		self.date_heure_debut_reelle = now_datetime()
		self.operateur_reel = frappe.session.user
		
		self.save()
		
		frappe.msgprint(
			"✅ Opération démarrée avec succès",
			indicator="green",
			alert=True
		)
		
		return True
	
	@frappe.whitelist()
	def terminer(self, quantite_ok=0, quantite_rebutee=0, observations=""):
		"""Terminer l'opération"""
		if self.statut != "En cours":
			frappe.throw("Seule une opération en cours peut être terminée")
		
		self.statut = "Terminée"
		self.date_heure_fin_reelle = now_datetime()
		self.quantite_ok = int(quantite_ok)
		self.quantite_rebutee = int(quantite_rebutee)
		self.quantite_traitee = self.quantite_ok + self.quantite_rebutee
		
		if observations:
			self.observations = (self.observations or "") + f"\n[TERMINÉ] {observations}"
		
		self.save()
		
		# Vérifier si l'ordre est complet
		self.verifier_ordre_termine()
		
		frappe.msgprint(
			"Opération terminée avec succès",
			indicator="green",
			alert=True
		)
		
		return True
	
	@frappe.whitelist()
	def mettre_en_pause(self, raison=""):
		"""Mettre l'opération en pause"""
		if self.statut != "En cours":
			frappe.throw("Seule une opération en cours peut être mise en pause")
		
		self.statut = "En pause"
		
		if raison:
			self.observations = (self.observations or "") + f"\n[PAUSE] {raison}"
		
		self.save()
		
		frappe.msgprint(
			"Opération mise en pause",
			indicator="orange",
			alert=True
		)
		
		return True
	
	@frappe.whitelist()
	def reprendre(self):
		"""Reprendre l'opération après une pause"""
		if self.statut != "En pause":
			frappe.throw("L'opération n'est pas en pause")
		
		self.statut = "En cours"
		self.observations = (self.observations or "") + "\n[REPRISE]"
		
		self.save()
		
		frappe.msgprint(
			"Opération reprise",
			indicator="blue",
			alert=True
		)
		
		return True
	
	@frappe.whitelist()
	def bloquer(self, type_probleme, description):
		"""Bloquer l'opération suite à un problème"""
		self.statut = "Bloquée"
		self.probleme_signale = 1
		self.type_probleme = type_probleme
		self.description_probleme = description
		
		self.save()
		
		# Notification urgente aux responsables
		self.notifier_blocage()
		
		frappe.msgprint(
			"Opération bloquée - Responsables notifiés",
			indicator="red",
			alert=True
		)
		
		return True
	
	def notifier_blocage(self):
		"""Envoyer notifications urgentes en cas de blocage"""
		# Notifier le responsable
		if self.responsable:
			frappe.share.add(
				"Operation Production",
				self.name,
				self.responsable,
				write=1,
				notify=1
			)
		
		# Notifier le superviseur
		if self.superviseur:
			frappe.share.add(
				"Operation Production",
				self.name,
				self.superviseur,
				write=1,
				notify=1
			)
	
	def verifier_ordre_termine(self):
		"""Vérifier si toutes les opérations de l'ordre sont terminées"""
		operations = frappe.get_all("Operation Production",
			filters={"ordre_production": self.ordre_production},
			fields=["name", "statut"]
		)
		
		if all(op.statut == "Terminée" for op in operations):
			ordre = frappe.get_doc("Ordre de Production", self.ordre_production)
			ordre.statut = "Terminé"
			ordre.date_fin_reelle = now_datetime()
			ordre.save(ignore_permissions=True)
			
			frappe.msgprint(
				f"Ordre de Production {self.ordre_production} terminé !",
				indicator="green",
				alert=True
			)
