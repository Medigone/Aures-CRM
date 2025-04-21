# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class DemandeFaisabilite(Document):
	def get_etudes_faisabilite(self):
		"""Récupère les études de faisabilité liées avec leurs informations d'article

		Returns:
			dict: Dictionnaire contenant les études de faisabilité et les documents de vente associés
		"""
		# Récupération des études de faisabilité liées à cette demande
		etudes = frappe.get_list(
			"Etude Faisabilite",
			filters={"demande_faisabilite": self.name},
			fields=["name", "status", "article"],
			ignore_permissions=True
		)

		# Pour chaque étude, récupérer les informations de l'article
		for etude in etudes:
			if etude.article:
				article = frappe.get_doc('Item', etude.article)
				etude.update({
					"designation_article": article.item_name,
					"code_article": article.item_code
				})

		# Récupération des documents de vente liés
		sales_documents = []

		# Récupération des devis liés
		quotations = frappe.get_list(
			"Quotation",
			filters={"custom_demande_faisabilité": self.name, "docstatus": ["!=", 2]},
			fields=["name", "status"],
			ignore_permissions=True
		)
		for qtn in quotations:
			sales_documents.append({
				"doctype": "Quotation",
				"name": qtn.name,
				"status": qtn.status
			})

		# Récupération des commandes client liées
		sales_orders = frappe.get_list(
			"Sales Order",
			filters={"custom_demande_de_faisabilité": self.name, "docstatus": ["!=", 2]},
			fields=["name", "status"],
			ignore_permissions=True
		)
		for so in sales_orders:
			sales_documents.append({
				"doctype": "Sales Order",
				"name": so.name,
				"status": so.status
			})

		return {
			"etudes": etudes,
			"sales_documents": sales_documents
		}
