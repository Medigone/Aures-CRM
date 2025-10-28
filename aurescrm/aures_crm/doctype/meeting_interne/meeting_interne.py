# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime, add_days, add_to_date, getdate, get_datetime
from datetime import datetime, timedelta


class MeetingInterne(Document):
	def validate(self):
		"""Validations avant sauvegarde"""
		# Extraire la date de date_heure si date_meeting est vide
		if self.date_heure and not self.date_meeting:
			self.date_meeting = getdate(self.date_heure)
		
		# Valider que la date n'est pas dans le passé pour un meeting planifié
		if self.status == "Planifié" and self.date_heure:
			if get_datetime(self.date_heure) < now_datetime():
				frappe.msgprint(
					"La date et l'heure du meeting sont dans le passé.",
					indicator="orange",
					alert=True
				)
		
		# Valider qu'il y a au moins un participant
		if not self.participants or len(self.participants) == 0:
			frappe.throw("Vous devez ajouter au moins un participant au meeting.")
		
		# Valider que l'organisateur est dans la liste des participants
		if self.organisateur:
			organisateur_in_participants = False
			for participant in self.participants:
				if participant.user_id == self.organisateur:
					organisateur_in_participants = True
					break
			
			if not organisateur_in_participants:
				frappe.msgprint(
					"L'organisateur doit être ajouté à la liste des participants.",
					indicator="orange",
					alert=True
				)
		
		# Valider la cohérence de la récurrence
		if self.recurrent:
			if not self.frequence_recurrence:
				frappe.throw("Veuillez sélectionner une fréquence de récurrence.")
			
			if self.frequence_recurrence == "Hebdomadaire" and not self.jour_semaine:
				frappe.throw("Veuillez sélectionner un jour de la semaine pour la récurrence hebdomadaire.")
			
			if self.frequence_recurrence == "Mensuel" and not self.jour_mois:
				frappe.throw("Veuillez sélectionner un jour du mois pour la récurrence mensuelle.")
			
			if self.jour_mois and (self.jour_mois < 1 or self.jour_mois > 31):
				frappe.throw("Le jour du mois doit être entre 1 et 31.")
			
			if not self.date_fin_recurrence:
				frappe.throw("Veuillez définir une date de fin pour la récurrence.")


def calculate_meeting_metrics(doc, method):
	"""Calculer les métriques du meeting avant sauvegarde"""
	# Calculer le taux de présence
	if doc.participants and len(doc.participants) > 0:
		total_participants = len(doc.participants)
		presents = sum(1 for p in doc.participants if p.present)
		doc.taux_presence = (presents / total_participants) * 100
	else:
		doc.taux_presence = 0


def generate_recurring_meetings(doc, method):
	"""Générer les occurrences récurrentes après insertion"""
	if not doc.recurrent or doc.meeting_parent:
		# Ne pas générer de récurrences si c'est déjà un meeting enfant
		return
	
	if not doc.date_fin_recurrence or not doc.frequence_recurrence:
		return
	
	current_date = get_datetime(doc.date_heure)
	end_date = getdate(doc.date_fin_recurrence)
	
	occurrences_created = 0
	max_occurrences = 100  # Limite de sécurité
	
	while occurrences_created < max_occurrences:
		# Calculer la prochaine occurrence
		if doc.frequence_recurrence == "Quotidien":
			current_date = add_days(current_date, 1)
		elif doc.frequence_recurrence == "Hebdomadaire":
			current_date = add_days(current_date, 7)
		elif doc.frequence_recurrence == "Mensuel":
			current_date = add_to_date(current_date, months=1)
		
		# Vérifier si on a dépassé la date de fin
		if getdate(current_date) > end_date:
			break
		
		# Créer le meeting récurrent
		try:
			new_meeting = frappe.copy_doc(doc)
			new_meeting.date_heure = current_date
			new_meeting.date_meeting = getdate(current_date)
			new_meeting.meeting_parent = doc.name
			new_meeting.recurrent = 0  # Les enfants ne sont pas récurrents
			new_meeting.rappel_envoye = 0
			new_meeting.date_envoi_rappel = None
			new_meeting.insert(ignore_permissions=True)
			occurrences_created += 1
		except Exception as e:
			frappe.log_error(f"Erreur lors de la création du meeting récurrent: {str(e)}")
			break
	
	if occurrences_created > 0:
		frappe.msgprint(
			f"{occurrences_created} occurrence(s) récurrente(s) créée(s) avec succès.",
			indicator="green",
			alert=True
		)


def notify_participants(doc, method):
	"""Notifier les participants après création du meeting"""
	if not doc.participants:
		return
	
	subject = f"Nouveau Meeting: {doc.titre}"
	
	for participant in doc.participants:
		if participant.user_id:
			try:
				message = f"""
				<p>Bonjour,</p>
				<p>Vous êtes invité(e) au meeting suivant:</p>
				<p><strong>{doc.titre}</strong></p>
				<p><strong>Date:</strong> {doc.date_meeting}</p>
				<p><strong>Heure:</strong> {doc.date_heure}</p>
				<p><strong>Lieu:</strong> {doc.lieu_salle or 'Non spécifié'}</p>
				<p><strong>Organisateur:</strong> {doc.nom_organisateur}</p>
				<p><strong>Rôle:</strong> {participant.role_meeting or 'Participant'}</p>
				"""
				
				if doc.description_contexte:
					message += f"<p><strong>Description:</strong><br>{doc.description_contexte}</p>"
				
				message += f'<p><a href="/app/meeting-interne/{doc.name}">Voir le meeting</a></p>'
				
				frappe.sendmail(
					recipients=[participant.user_id],
					subject=subject,
					message=message,
					reference_doctype="Meeting Interne",
					reference_name=doc.name
				)
			except Exception as e:
				frappe.log_error(f"Erreur lors de l'envoi de notification à {participant.user_id}: {str(e)}")


def update_meeting_data(doc, method):
	"""Mettre à jour les données du meeting lors de la modification"""
	# Recalculer les métriques
	calculate_meeting_metrics(doc, method)


@frappe.whitelist()
def check_and_send_all_reminders():
	"""Vérifier et envoyer tous les rappels (appelé par le scheduler)"""
	# Récupérer tous les meetings avec rappel activé et non envoyé
	meetings = frappe.get_all(
		"Meeting Interne",
		filters={
			"envoyer_rappel": 1,
			"rappel_envoye": 0,
			"status": ["in", ["Planifié", "Confirmé"]]
		},
		fields=["name", "date_heure", "delai_rappel"]
	)
	
	for meeting_data in meetings:
		try:
			meeting = frappe.get_doc("Meeting Interne", meeting_data.name)
			
			if should_send_reminder(meeting):
				send_reminder(meeting)
		except Exception as e:
			frappe.log_error(f"Erreur lors du traitement du rappel pour {meeting_data.name}: {str(e)}")


def should_send_reminder(meeting):
	"""Vérifier si le rappel doit être envoyé maintenant"""
	if not meeting.date_heure or not meeting.delai_rappel:
		return False
	
	meeting_datetime = get_datetime(meeting.date_heure)
	current_datetime = now_datetime()
	
	# Calculer le moment d'envoi du rappel
	delai_map = {
		"15 minutes avant": timedelta(minutes=15),
		"30 minutes avant": timedelta(minutes=30),
		"1 heure avant": timedelta(hours=1),
		"2 heures avant": timedelta(hours=2),
		"1 jour avant": timedelta(days=1),
		"2 jours avant": timedelta(days=2)
	}
	
	delai = delai_map.get(meeting.delai_rappel)
	if not delai:
		return False
	
	reminder_datetime = meeting_datetime - delai
	
	# Envoyer si on a dépassé le moment du rappel
	return current_datetime >= reminder_datetime


def send_reminder(meeting):
	"""Envoyer le rappel par email aux participants"""
	if not meeting.participants:
		return
	
	subject = f"Rappel: {meeting.titre}"
	
	for participant in meeting.participants:
		if participant.user_id:
			try:
				message = f"""
				<p>Bonjour,</p>
				<p>Ceci est un rappel pour le meeting suivant:</p>
				<p><strong>{meeting.titre}</strong></p>
				<p><strong>Date:</strong> {meeting.date_meeting}</p>
				<p><strong>Heure:</strong> {meeting.date_heure}</p>
				<p><strong>Lieu:</strong> {meeting.lieu_salle or 'Non spécifié'}</p>
				<p><strong>Organisateur:</strong> {meeting.nom_organisateur}</p>
				"""
				
				if meeting.description_contexte:
					message += f"<p><strong>Description:</strong><br>{meeting.description_contexte}</p>"
				
				# Ajouter l'ordre du jour si disponible
				if meeting.ordre_du_jour:
					message += f"<p><strong>Ordre du Jour:</strong><br>{meeting.ordre_du_jour}</p>"
				
				message += f'<p><a href="/app/meeting-interne/{meeting.name}">Voir le meeting</a></p>'
				
				frappe.sendmail(
					recipients=[participant.user_id],
					subject=subject,
					message=message,
					reference_doctype="Meeting Interne",
					reference_name=meeting.name
				)
			except Exception as e:
				frappe.log_error(f"Erreur lors de l'envoi du rappel à {participant.user_id}: {str(e)}")
	
	# Marquer le rappel comme envoyé
	meeting.rappel_envoye = 1
	meeting.date_envoi_rappel = now_datetime()
	meeting.save(ignore_permissions=True)
	
	frappe.db.commit()


@frappe.whitelist()
def generate_pdf_report(meeting_name):
	"""Générer le rapport PDF du compte-rendu"""
	meeting = frappe.get_doc("Meeting Interne", meeting_name)
	
	# Utiliser le print format personnalisé
	print_format = "Compte Rendu Meeting"
	
	# Générer le PDF
	pdf = frappe.get_print(
		"Meeting Interne",
		meeting_name,
		print_format=print_format,
		as_pdf=True
	)
	
	return pdf


@frappe.whitelist()
def send_reminder_now(meeting_name):
	"""Envoyer le rappel immédiatement (bouton manuel)"""
	meeting = frappe.get_doc("Meeting Interne", meeting_name)
	send_reminder(meeting)
	
	return {
		"message": "Rappel envoyé avec succès à tous les participants.",
		"success": True
	}

