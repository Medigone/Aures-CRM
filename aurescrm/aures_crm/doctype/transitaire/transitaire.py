# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.naming import make_autoname

class Transitaire(Document):
	"""
	DocType pour gérer les transitaires avec lesquels la société travaille.
	Utilise les fonctionnalités natives de Frappe pour la gestion des statuts.
	Le nommage automatique suit le format 'TRAN-####'.
	"""
	
	def autoname(self):
		"""
		Génère automatiquement un nom au format 'TRANS-###' avec des chiffres croissants
		à chaque nouvelle création de document.
		"""
		self.name = make_autoname("TRANS-.###")