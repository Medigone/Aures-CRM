"""
Module de gestion des notifications par email pour Aures CRM
"""

import frappe
from frappe import _
from frappe.utils import get_url
from aurescrm.commercial_assignment import get_customer_commercial


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
	
	# Récupérer le commercial attribué au client via le module utilitaire
	commercial_info = get_customer_commercial(doc.party_name, doc.company)
	commercial_attribue = commercial_info.get('commercial')
	
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
	
	# Envoyer l'email
	try:
		frappe.sendmail(
			recipients=[commercial_email],
			subject=subject,
			message=message,
			reference_doctype="Quotation",
			reference_name=doc.name,
			now=True  # Envoyer immédiatement
		)
		
		# Log pour confirmation
		frappe.logger().info(
			f"Email envoyé au commercial {commercial_attribue} pour le devis {doc.name}"
		)
		
	except Exception as e:
		# Logger l'erreur sans bloquer la validation du devis
		error_message = f"Devis: {doc.name}\nCommercial: {commercial_attribue}\nErreur: {str(e)[:200]}"
		frappe.log_error(
			error_message,
			"Erreur email devis"
		)
		# Ne pas lever l'exception pour ne pas bloquer le submit


def notify_commercial_nouvelle_maquette(doc, method=None):
	"""
	Envoyer une notification au commercial attribué lorsqu'une nouvelle Maquette est créée
	
	Args:
		doc: Document Maquette
		method: Méthode appelante (utilisé par les hooks)
	"""
	# Vérifier que la maquette a un client et un article
	if not doc.client or not doc.article:
		return
	
	# Récupérer le commercial attribué au client via le module utilitaire
	commercial_info = get_customer_commercial(doc.client)
	commercial_attribue = commercial_info.get('commercial')
	
	if not commercial_attribue:
		frappe.log_error(
			f"Client: {doc.client}",
			"Pas de commercial attribué pour notification Maquette"
		)
		return
	
	# Récupérer l'email du commercial
	commercial_email = frappe.db.get_value("User", commercial_attribue, "email")
	
	if not commercial_email:
		frappe.log_error(
			f"Commercial: {commercial_attribue}",
			"Pas d'email pour commercial (notification Maquette)"
		)
		return
	
	# Récupérer le nom du commercial pour personnaliser l'email
	commercial_full_name = frappe.db.get_value("User", commercial_attribue, "full_name") or commercial_attribue
	
	# Récupérer les informations du client
	customer_name = frappe.db.get_value("Customer", doc.client, "customer_name") or doc.client
	
	# Récupérer les informations de l'article
	article_info = frappe.db.get_value("Item", doc.article, ["item_name", "item_code"], as_dict=True)
	article_name = article_info.get("item_name") if article_info else doc.article
	article_code = article_info.get("item_code") if article_info else doc.article
	
	# Utiliser les informations du document directement
	maquette_name = doc.name
	maquette_ver = doc.ver or 0
	maquette_date = doc.date_creation
	
	# Préparer le sujet de l'email
	subject = f"Nouvelle Maquette créée - {maquette_name} - {customer_name}"
	
	# Préparer le contenu de l'email
	message = f"""
	<div style="font-family: Arial, sans-serif; max-width: 600px;">
		<h2 style="color: #2c3e50;">Bonjour {commercial_full_name},</h2>
		
		<p>Une nouvelle maquette a été créée pour l'article de votre client. Veuillez y attacher le fichier maquette.</p>
		
		<div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
			<table style="width: 100%; border-collapse: collapse;">
				<tr>
					<td style="padding: 8px 0; font-weight: bold; color: #495057;">Maquette :</td>
					<td style="padding: 8px 0; color: #212529;">{maquette_name}</td>
				</tr>
				<tr>
					<td style="padding: 8px 0; font-weight: bold; color: #495057;">Version :</td>
					<td style="padding: 8px 0; color: #212529;">V{maquette_ver}</td>
				</tr>
				<tr>
					<td style="padding: 8px 0; font-weight: bold; color: #495057;">Date de création :</td>
					<td style="padding: 8px 0; color: #212529;">{maquette_date or 'N/A'}</td>
				</tr>
				<tr style="background-color: #e9ecef;">
					<td colspan="2" style="padding: 12px 0 8px 0; font-weight: bold; color: #343a40;">Client</td>
				</tr>
				<tr>
					<td style="padding: 8px 0; font-weight: bold; color: #495057;">ID Client :</td>
					<td style="padding: 8px 0; color: #212529;">{doc.client}</td>
				</tr>
				<tr>
					<td style="padding: 8px 0; font-weight: bold; color: #495057;">Nom Client :</td>
					<td style="padding: 8px 0; color: #212529;">{customer_name}</td>
				</tr>
				<tr style="background-color: #e9ecef;">
					<td colspan="2" style="padding: 12px 0 8px 0; font-weight: bold; color: #343a40;">Article</td>
				</tr>
				<tr>
					<td style="padding: 8px 0; font-weight: bold; color: #495057;">ID Article :</td>
					<td style="padding: 8px 0; color: #212529;">{doc.article}</td>
				</tr>
				<tr>
					<td style="padding: 8px 0; font-weight: bold; color: #495057;">Code Article :</td>
					<td style="padding: 8px 0; color: #212529;">{article_code}</td>
				</tr>
				<tr>
					<td style="padding: 8px 0; font-weight: bold; color: #495057;">Description :</td>
					<td style="padding: 8px 0; color: #212529;">{article_name}</td>
				</tr>
			</table>
		</div>
		
		
		<p>Vous pouvez consulter la maquette en cliquant sur le lien ci-dessous :</p>
		
		<p style="text-align: center; margin: 30px 0;">
			<a href="{get_url()}/app/maquette/{maquette_name}" 
			   style="background-color: #007bff; color: white; padding: 12px 30px; 
			          text-decoration: none; border-radius: 5px; display: inline-block;">
				Voir la maquette
			</a>
		</p>
		
		<hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
		
	</div>
	"""
	
	# Envoyer l'email
	try:
		frappe.sendmail(
			recipients=[commercial_email],
			subject=subject,
			message=message,
			reference_doctype="Maquette",
			reference_name=maquette_name,
			now=True  # Envoyer immédiatement
		)
		
		# Log pour confirmation
		frappe.logger().info(
			f"Email envoyé au commercial {commercial_attribue} pour la maquette {maquette_name}"
		)
		
	except Exception as e:
		# Logger l'erreur sans bloquer la création de la maquette
		error_message = f"Maquette: {maquette_name}\nCommercial: {commercial_attribue}\nErreur: {str(e)[:200]}"
		frappe.log_error(
			error_message,
			"Erreur email maquette"
		)
		# Ne pas lever l'exception pour ne pas bloquer la création

