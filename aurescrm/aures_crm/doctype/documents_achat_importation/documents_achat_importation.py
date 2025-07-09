# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class DocumentsAchatImportation(Document):
	"""
	Table enfant pour gérer les documents d'achat importation.
	Récupère automatiquement le statut du document lié dynamiquement.
	"""
	
	def validate(self):
		"""
		Récupère et met à jour le statut du document lié dynamiquement.
		"""
		self.fetch_document_status()  
	
	def check_custom_status_fields(self, doc):
		"""
		Recherche des champs personnalisés qui pourraient contenir un statut.
		
		Args:
			doc: Le document à analyser
		
		Returns:
			str: Le statut trouvé ou None si aucun statut n'est trouvé
		"""
		# Liste des noms de champs possibles qui pourraient contenir un statut
		status_field_names = [
			'etat', 'état', 'statut', 'status', 
			'etat_document', 'état_document', 'statut_document',
			'etat_validation', 'état_validation', 'statut_validation',
			'phase', 'etape', 'étape'
		]
		
		# Vérifier les champs personnalisés
		for field in doc.meta.fields:
			field_name = field.fieldname.lower()
			
			# Vérifier si le nom du champ contient un mot-clé lié au statut
			if any(status_name in field_name for status_name in status_field_names):
				if hasattr(doc, field.fieldname) and getattr(doc, field.fieldname):
					return getattr(doc, field.fieldname)
					
		# Vérifier également les champs personnalisés (custom fields)
		for field_name in doc.as_dict():
			if field_name.startswith('custom_') and any(status_name in field_name.lower() for status_name in status_field_names):
				if getattr(doc, field_name):
					return getattr(doc, field_name)
					
		return None

	def get_doctype_specific_status(self, doc):
		"""
		Gère les cas spécifiques pour certains DocTypes standards de Frappe/ERPNext.
		
		Args:
			doc: Le document à analyser
		
		Returns:
			str: Le statut spécifique au DocType ou None si non applicable
		"""
		doctype = self.lien_doctype
		
		# Cas spécifiques pour les DocTypes standards
		if doctype == "Sales Order":
			if doc.status == "Closed":
				return "Fermé"
			elif doc.status == "On Hold":
				return "En attente"
			elif doc.status == "Completed":
				return "Terminé"
			elif doc.per_delivered == 100:
				return "Livré"
			elif doc.per_delivered > 0:
				return f"Livré partiellement ({doc.per_delivered}%)"
			elif doc.per_billed == 100:
				return "Facturé"
			elif doc.per_billed > 0:
				return f"Facturé partiellement ({doc.per_billed}%)"
			
		elif doctype == "Purchase Order":
			if doc.status == "Closed":
				return "Fermé"
			elif doc.status == "On Hold":
				return "En attente"
			elif doc.status == "Completed":
				return "Terminé"
			elif doc.per_received == 100:
				return "Reçu"
			elif doc.per_received > 0:
				return f"Reçu partiellement ({doc.per_received}%)"
			elif doc.per_billed == 100:
				return "Facturé"
			elif doc.per_billed > 0:
				return f"Facturé partiellement ({doc.per_billed}%)"
			
		elif doctype == "Quotation":
			if doc.status == "Lost":
				return "Perdu"
			elif doc.status == "Ordered":
				return "Commandé"
			elif doc.status == "Expired":
				return "Expiré"
			
		elif doctype == "Payment Entry":
			if doc.docstatus == 1:
				if doc.payment_type == "Receive":
					return "Paiement reçu"
				elif doc.payment_type == "Pay":
					return "Paiement effectué"
				elif doc.payment_type == "Internal Transfer":
					return "Transfert interne"
					
		elif doctype == "Delivery Note":
			if doc.status == "Return Issued":
				return "Retour émis"
			elif doc.status == "Completed":
				return "Terminé"
			elif doc.status == "Closed":
				return "Fermé"
			
		elif doctype == "Purchase Receipt":
			if doc.status == "Return Issued":
				return "Retour émis"
			elif doc.status == "Completed":
				return "Terminé"
			elif doc.status == "Closed":
				return "Fermé"
			
		return None

	def fetch_document_status(self):
		"""
		Récupère le statut du document référencé dans le champ dynamique.
		Priorise les statuts textuels comme 'Brouillon', 'Validé', 'Expiré', etc.
		"""
		if self.lien_doctype and self.document:
			try:
				# Récupération du document lié
				doc = frappe.get_doc(self.lien_doctype, self.document)
				
				# Ordre de priorité pour récupérer le statut
				# 1. Traitement spécifique selon le type de document
				specific_status = self.get_doctype_specific_status(doc)
				if specific_status:
					self.statut = specific_status
					return
				
				# Dictionnaire de traduction pour les statuts en anglais
				status_translations = {
					# Statuts génériques
					"Draft": "Brouillon",
					"Submitted": "Soumis",
					"Cancelled": "Annulé",
					"Completed": "Terminé",
					"Closed": "Fermé",
					"On Hold": "En attente",
					"Pending": "En attente",
					"Open": "Ouvert",
					"Expired": "Expiré",
					"Approved": "Approuvé",
					"Rejected": "Rejeté",
					"Partially Paid": "Partiellement payé",
					"Unpaid": "Non payé",
					"Paid": "Payé",
					"Return": "Retour",
					"Debit Note Issued": "Note de débit émise",
					"Credit Note Issued": "Note de crédit émise",
					"Return Issued": "Retour émis",
					"Partly Delivered": "Partiellement livré",
					"Delivered": "Livré",
					"Not Delivered": "Non livré",
					"Partly Received": "Partiellement reçu",
					"Received": "Reçu",
					"Not Received": "Non reçu",
					"Ordered": "Commandé",
					"To Bill": "À facturer",
					"Billed": "Facturé",
					"Not Billed": "Non facturé",
					"Lost": "Perdu",
					"To Deliver": "À livrer",
					"To Receive": "À recevoir",
					"In Transit": "En transit",
					"Partly Billed": "Partiellement facturé",
					"Unpaid and Discounted": "Non payé et remisé",
					"Overdue and Discounted": "En retard et remisé",
					"Overdue": "En retard",
					"Internal Transfer": "Transfert interne",
					"Partially Delivered": "Partiellement livré",
					"Partially Received": "Partiellement reçu",
					"Partially Billed": "Partiellement facturé",
					"Partially Paid": "Partiellement payé"
				}
				
				# 2. Workflow state (statut de workflow)
				if hasattr(doc, 'workflow_state') and doc.workflow_state:
					# Traduire si une traduction existe, sinon garder la valeur originale
					self.statut = status_translations.get(doc.workflow_state, doc.workflow_state)
					return
					
				# 3. Champ status (statut standard)
				if hasattr(doc, 'status') and doc.status:
					# Traduire si une traduction existe, sinon garder la valeur originale
					self.statut = status_translations.get(doc.status, doc.status)
					return
					
				# 4. Champ état (utilisé dans certains doctypes)
				if hasattr(doc, 'etat') and doc.etat:
					self.statut = doc.etat
					return
					
				# 5. Champ état_document (parfois utilisé)
				if hasattr(doc, 'etat_document') and doc.etat_document:
					self.statut = doc.etat_document
					return
					
				# 6. Champ statut_document (parfois utilisé)
				if hasattr(doc, 'statut_document') and doc.statut_document:
					self.statut = doc.statut_document
					return
					
				# 7. Recherche dans les champs personnalisés
				custom_status = self.check_custom_status_fields(doc)
				if custom_status:
					self.statut = custom_status
					return
					
				# 8. Fallback sur docstatus avec conversion en texte explicite
				if hasattr(doc, 'docstatus'):
					if doc.docstatus == 0:
						self.statut = "Brouillon"
					elif doc.docstatus == 1:
						# Pour les documents soumis, on vérifie s'il y a un champ 'is_cancelled' ou similaire
						if hasattr(doc, 'is_cancelled') and doc.is_cancelled:
							self.statut = "Annulé"
						elif hasattr(doc, 'is_expired') and doc.is_expired:
							self.statut = "Expiré"
						elif hasattr(doc, 'is_completed') and doc.is_completed:
							self.statut = "Terminé"
						elif hasattr(doc, 'is_validated') and doc.is_validated:
							self.statut = "Validé"
						else:
							self.statut = "Soumis"
					elif doc.docstatus == 2:
						self.statut = "Annulé"
					return
					
				# Si aucun statut n'est trouvé
				self.statut = "Statut non disponible"
				
			except frappe.DoesNotExistError:
				self.statut = "Document non trouvé"
			except Exception as e:
				frappe.log_error(f"Erreur lors de la récupération du statut: {str(e)}", "Documents Achat Importation")
				self.statut = "Erreur"
		else:
			self.statut = ""
