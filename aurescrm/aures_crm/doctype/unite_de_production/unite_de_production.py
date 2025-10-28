# Copyright (c) 2025, AURES Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime, get_url
import qrcode
import io
import base64
import os


class UnitedeProduction(Document):
	def autoname(self):
		"""Générer le nom selon le format ISO: {ordre}-P-{###}-{YYMMDD}"""
		# Le naming est géré par autoname format dans le JSON
		pass
	
	def after_insert(self):
		"""Générer le QR code automatiquement après insertion"""
		self.generer_qr_code()
		self.numero_unique = self.name
		self.code_barres = self.name
		self.save()
	
	def generer_qr_code(self):
		"""Générer le QR code avec l'URL du document"""
		if not self.name:
			return
		
		try:
			# URL du document
			doc_url = get_url(f"/app/unite-de-production/{self.name}")
			
			# Créer le QR code
			qr = qrcode.QRCode(
				version=1,
				error_correction=qrcode.constants.ERROR_CORRECT_L,
				box_size=10,
				border=4,
			)
			qr.add_data(doc_url)
			qr.make(fit=True)
			
			# Créer l'image
			img = qr.make_image(fill_color="black", back_color="white")
			
			# Convertir en bytes
			buffer = io.BytesIO()
			img.save(buffer, format='PNG')
			buffer.seek(0)
			
			# Sauvegarder comme fichier attaché
			filename = f"qr_code_{self.name}.png"
			file_doc = frappe.get_doc({
				"doctype": "File",
				"file_name": filename,
				"attached_to_doctype": self.doctype,
				"attached_to_name": self.name,
				"content": buffer.getvalue(),
				"is_private": 0
			})
			file_doc.save(ignore_permissions=True)
			
			# Mettre à jour le champ qr_code
			self.qr_code = file_doc.file_url
			
		except Exception as e:
			frappe.log_error(f"Erreur génération QR code: {str(e)}", "Unite de Production")
	
	@frappe.whitelist()
	def scan_entree_etape(self, etape, operateur=None):
		"""Enregistrer l'entrée dans une étape via scan QR"""
		if not operateur:
			operateur = frappe.session.user
		
		# Ajouter à l'historique
		self.append('historique', {
			'etape': etape,
			'date_heure_entree': now_datetime(),
			'operateur': operateur,
			'scan_timestamp': now_datetime()
		})
		
		# Mettre à jour l'étape actuelle
		self.etape_actuelle = etape
		self.operateur_actuel = operateur
		
		self.save()
		frappe.msgprint(f"Entrée enregistrée pour l'étape: {etape}", indicator="blue")
		return True
	
	@frappe.whitelist()
	def scan_sortie_etape(self, etape, quantite_ok=0, quantite_rebut=0, observations=""):
		"""Enregistrer la sortie d'une étape via scan QR"""
		# Trouver la dernière entrée pour cette étape
		historique_etape = None
		for h in reversed(self.historique):
			if h.etape == etape and not h.date_heure_sortie:
				historique_etape = h
				break
		
		if not historique_etape:
			frappe.throw(f"Aucune entrée trouvée pour l'étape: {etape}")
		
		# Mettre à jour l'historique
		historique_etape.date_heure_sortie = now_datetime()
		historique_etape.quantite_ok = quantite_ok
		historique_etape.quantite_rebut = quantite_rebut
		historique_etape.quantite_traitee = quantite_ok + quantite_rebut
		historique_etape.observations = observations
		
		# Mettre à jour les totaux
		self.quantite_ok = (self.quantite_ok or 0) + quantite_ok
		self.quantite_defectueuse = (self.quantite_defectueuse or 0) + quantite_rebut
		
		self.save()
		frappe.msgprint(f"Sortie enregistrée pour l'étape: {etape}", indicator="green")
		return True
	
	@frappe.whitelist()
	def get_qr_code_url(self):
		"""Retourner l'URL du QR code"""
		return self.qr_code or ""
	
	@frappe.whitelist()
	def imprimer_etiquette(self):
		"""Préparer les données pour l'impression d'étiquette"""
		return {
			"numero": self.name,
			"ordre_production": self.ordre_production,
			"article": self.article,
			"quantite": self.quantite,
			"type_unite": self.type_unite,
			"qr_code": self.qr_code,
			"date_creation": self.date_heure_creation
		}

