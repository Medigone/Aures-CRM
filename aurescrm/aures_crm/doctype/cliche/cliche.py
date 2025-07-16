# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _


class Cliche(Document):
	def autoname(self):
		"""
		Règle de dénomination automatique : CLF-{article}-V{version}
		"""
		if not self.article:
			frappe.throw(_("L'article est requis pour générer le nom du cliché"))
		
		# S'assurer que la version est définie
		if not getattr(self, 'version', None):
			# Déterminer la version la plus élevée existante pour cet article
			result = frappe.db.sql(
				"SELECT MAX(version) FROM `tabCliche` WHERE article=%s", 
				(self.article,),
				as_list=True
			)
			max_version = result[0][0] or 0
			self.version = max_version + 1
		
		self.name = f"CLF-{self.article}-V{self.version}"

	def validate(self):
		"""
		Validation du cliché avec versioning
		"""
		pass

	@frappe.whitelist()
	def activate_version(self):
		"""
		Active cette version du cliché et désactive les autres versions du même article
		"""
		if self.status != "Réalisé":
			frappe.throw(_("Seuls les clichés avec le statut 'Réalisé' peuvent être activés"))
		
		# Désactiver toutes les autres versions de cet article
		frappe.db.sql(
			"UPDATE `tabCliche` SET version_active = 0 WHERE article = %s AND name != %s",
			(self.article, self.name)
		)
		
		# Activer cette version
		self.version_active = 1
		self.save()
		
		return True

	@frappe.whitelist()
	def create_new_version(self, desc_changements):
		"""
		Crée une nouvelle version basée sur le cliché courant.
		- Recherche le numéro de version maximal existant pour cet article
		- Incrémente de 1
		- Crée le document avec version et laisse autoname générer le nom
		"""
		if not self.version_active:
			frappe.throw(_("Seules les versions actives peuvent créer de nouvelles versions"))
		
		# Déterminer la version la plus élevée existante pour cet article
		result = frappe.db.sql(
			"SELECT MAX(version) FROM `tabCliche` WHERE article=%s", 
			(self.article,),
			as_list=True
		)
		max_version = result[0][0] or 0
		next_version = max_version + 1

		new_doc = frappe.get_doc({
			'doctype': 'Cliche',
			'client': self.client,
			'article': self.article,
			'parent_cliche': self.name,
			'desc_changements': desc_changements,
			'version': next_version,
			'status': 'Nouveau',
			'version_active': 0,
			# Copier les champs techniques importants
			'laize': self.laize,
			'nbr_couleurs': self.nbr_couleurs,
			'site_prod': self.site_prod,
			'developpement': self.developpement,
			'hauteur_cliche': self.hauteur_cliche,
			'maquette': self.maquette
		})
		new_doc.insert(ignore_permissions=True)
		return new_doc.name
