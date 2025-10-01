"""
Module de gestion des notifications par email pour Aures CRM
"""

import frappe
from frappe import _
from frappe.utils import get_url


def notify_commercial_devis_valide(doc, method=None):
	"""
	Envoyer une notification au commercial attribué lorsqu'un devis est validé (soumis)
	
	Args:
		doc: Document Quotation
		method: Méthode appelante (utilisé par les hooks)
	"""
	# Vérifier que le devis a un client
	if not doc.party_name:
		return
	
	# Récupérer le commercial attribué au client
	commercial_attribue = frappe.db.get_value(
		"Customer",
		doc.party_name,
		"custom_commercial_attribué"
	)
	
	if not commercial_attribue:
		frappe.log_error(
			f"Client: {doc.party_name}",
			"Pas de commercial attribué"
		)
		return
	
	# Récupérer l'email du commercial
	commercial_email = frappe.db.get_value("User", commercial_attribue, "email")
	
	if not commercial_email:
		frappe.log_error(
			f"Commercial: {commercial_attribue}",
			"Pas d'email pour commercial"
		)
		return
	
	# Récupérer le nom du commercial pour personnaliser l'email
	commercial_full_name = frappe.db.get_value("User", commercial_attribue, "full_name") or commercial_attribue
	
	# Préparer le sujet de l'email
	subject = f"Devis validé - {doc.name} - {doc.party_name}"
	
	# Préparer le contenu de l'email
	message = f"""
	<div style="font-family: Arial, sans-serif; max-width: 600px;">
		<h2 style="color: #2c3e50;">Bonjour {commercial_full_name},</h2>
		
		<p>Un devis que vous suivez a été validé :</p>
		
		<div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
			<table style="width: 100%; border-collapse: collapse;">
				<tr>
					<td style="padding: 8px 0; font-weight: bold; color: #495057;">Numéro de devis :</td>
					<td style="padding: 8px 0; color: #212529;">{doc.name}</td>
				</tr>
				<tr>
					<td style="padding: 8px 0; font-weight: bold; color: #495057;">Client :</td>
					<td style="padding: 8px 0; color: #212529;">{doc.customer_name}</td>
				</tr>
				<tr>
					<td style="padding: 8px 0; font-weight: bold; color: #495057;">Date :</td>
					<td style="padding: 8px 0; color: #212529;">{doc.transaction_date}</td>
				</tr>
				<tr>
					<td style="padding: 8px 0; font-weight: bold; color: #495057;">Date de validité :</td>
					<td style="padding: 8px 0; color: #212529;">{doc.valid_till or 'Non spécifiée'}</td>
				</tr>
				<tr>
					<td style="padding: 8px 0; font-weight: bold; color: #495057;">Montant total HT :</td>
					<td style="padding: 8px 0; color: #212529;">{frappe.format_value(doc.net_total, {'fieldtype': 'Currency'})} </td>
				</tr>
				<tr>
					<td style="padding: 8px 0; font-weight: bold; color: #495057;">Montant total TTC :</td>
					<td style="padding: 8px 0; font-weight: bold; color: #28a745; font-size: 16px;">{frappe.format_value(doc.grand_total, {'fieldtype': 'Currency'})}</td>


				</tr>
			</table>
		</div>
		
		<p>Vous pouvez consulter le devis en cliquant sur le lien ci-dessous :</p>
		
		<p style="text-align: center; margin: 30px 0;">
			<a href="{get_url()}/app/quotation/{doc.name}" 
			   style="background-color: #007bff; color: white; padding: 12px 30px; 
			          text-decoration: none; border-radius: 5px; display: inline-block;">
				Voir le devis
			</a>
		</p>
		
		<hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
		
	</div>
	"""
	
	# Envoyer l'email avec le PDF du devis en pièce jointe
	try:
		# Créer l'objet email avec le PDF attaché
		frappe.sendmail(
			recipients=[commercial_email],
			subject=subject,
			message=message,
			reference_doctype="Quotation",
			reference_name=doc.name,
			attachments=[
				frappe.attach_print(
					"Quotation",
					doc.name,
					print_format=None  # None = utiliser le format par défaut
				)
			],
			now=True  # Envoyer immédiatement
		)
		
		# Log pour confirmation
		frappe.logger().info(
			f"Email avec PDF envoyé au commercial {commercial_attribue} pour le devis {doc.name}"
		)
		
	except Exception as e:
		# Logger l'erreur sans bloquer la validation du devis
		error_message = f"Devis: {doc.name}\nCommercial: {commercial_attribue}\nErreur: {str(e)[:200]}"
		frappe.log_error(
			error_message,
			"Erreur email devis"
		)
		# Ne pas lever l'exception pour ne pas bloquer le submit

