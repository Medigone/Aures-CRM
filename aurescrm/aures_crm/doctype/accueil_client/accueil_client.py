# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now, get_datetime, get_fullname, today


class AccueilClient(Document):
	def autoname(self):
		"""Générer automatiquement le nom du document"""
		from frappe.model.naming import make_autoname
		self.name = make_autoname("AC-.YYYY.-.#####")
	
	def before_insert(self):
		"""Exécuté avant l'insertion du document dans la base de données"""
		# Assigner l'utilisateur créateur
		if not self.utilisateur_createur:
			self.utilisateur_createur = frappe.session.user
		
		# Fetch automatique du nom créateur
		if not self.nom_createur and self.utilisateur_createur:
			self.nom_createur = get_fullname(self.utilisateur_createur)
	
	def before_save(self):
		"""Exécuté avant la sauvegarde du document"""
		# Assigner l'utilisateur créateur si non défini
		if not self.utilisateur_createur:
			self.utilisateur_createur = frappe.session.user
		
		# Fetch automatique du nom créateur
		if self.utilisateur_createur and not self.nom_createur:
			self.nom_createur = get_fullname(self.utilisateur_createur)
		
		# Fetch automatique du nom receveur
		if self.utilisateur_receveur:
			self.nom_receveur = get_fullname(self.utilisateur_receveur)
		
		# Gérer le changement de statut
		if self.status == "En Cours":
			self.set_debut_visite()
		elif self.status == "Terminée":
			self.set_fin_visite_et_duree()
	
	def before_submit(self):
		"""Exécuté juste avant la soumission du document"""
		if self.status in ["Terminée", "Validé"]:
			self.set_fin_visite_et_duree()
	
	def set_debut_visite(self):
		"""Définit automatiquement l'heure d'arrivée et la date réelle si le statut est 'En Cours'"""
		if not self.heure_arrivee:
			self.heure_arrivee = now()
		
		if not self.date_visite_reelle:
			self.date_visite_reelle = today()
	
	def set_fin_visite_et_duree(self):
		"""Définit automatiquement l'heure de fin et calcule la durée de la visite si le statut est 'Terminée'"""
		if not self.heure_depart:
			self.heure_depart = now()
		
		# Calculer la durée si les deux heures sont disponibles
		if self.heure_arrivee and self.heure_depart:
			start_time = get_datetime(self.heure_arrivee)
			end_time = get_datetime(self.heure_depart)
			
			if start_time and end_time and end_time > start_time:
				duration_seconds = (end_time - start_time).total_seconds()
				self.duree_visite = round(duration_seconds / 60)  # Durée en minutes

