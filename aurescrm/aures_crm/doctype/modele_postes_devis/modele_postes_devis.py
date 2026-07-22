# Copyright (c) 2026, Aures Emballages and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, get_datetime, now_datetime


class ModelePostesDevis(Document):
	def validate(self):
		self._sync_status_from_is_active()
		self._sync_dates()

		if not self.postes:
			frappe.throw(_("Le modèle doit contenir au moins un poste."))

		seen_baremes = set()
		for row in self.postes:
			if cint(row.nombre_passages) < 1:
				frappe.throw(
					_("Le nombre de passages doit être au moins 1 (ligne {0}).").format(
						row.ordre or row.idx
					)
				)

			if not row.bareme:
				frappe.throw(_("Chaque poste doit référencer un barème de coût fixe."))

			if row.bareme in seen_baremes:
				frappe.throw(
					_("Le barème « {0} » est déjà présent dans le modèle.").format(row.bareme)
				)
			seen_baremes.add(row.bareme)

	def _sync_status_from_is_active(self):
		self.status = "Actif" if cint(self.is_active) else "Inactif"

	def _sync_dates(self):
		if not self.date_creation:
			if self.creation:
				self.date_creation = get_datetime(self.creation)
			else:
				self.date_creation = now_datetime()
		self.date_modification = now_datetime()


@frappe.whitelist()
def get_postes_from_modele(modele_name):
	"""
	Retourne les postes d'un modèle actif, enrichis avec les valeurs courantes
	des barèmes actifs, triés par ordre.
	"""
	if not modele_name:
		frappe.throw(_("Veuillez sélectionner un modèle de postes."))

	modele = frappe.get_doc("Modele Postes Devis", modele_name)
	if not modele.is_active:
		frappe.throw(_("Le modèle « {0} » est inactif.").format(modele.libelle))

	if not modele.postes:
		frappe.throw(_("Le modèle « {0} » ne contient aucun poste.").format(modele.libelle))

	result = []
	for row in sorted(modele.postes, key=lambda r: (cint(r.ordre) or 0, r.idx or 0)):
		bareme = frappe.get_doc("Bareme Cout Fixe", row.bareme)
		if not bareme.is_active:
			frappe.throw(
				_("Le barème « {0} » du modèle est inactif.").format(bareme.libelle)
			)

		result.append(
			{
				"ordre": cint(row.ordre) or 0,
				"bareme": bareme.name,
				"libelle": bareme.libelle,
				"machine": bareme.machine or "",
				"nombre_passages": cint(row.nombre_passages) or 1,
				"cout_fixe": bareme.cout_fixe or 0,
				"gache_feuilles": cint(bareme.gache_feuilles) or 0,
				"unite_calcul": bareme.unite_calcul or "Forfait",
				"cout_variable_unitaire": bareme.cout_variable_unitaire or 0,
				"description": bareme.notes or "",
			}
		)

	return {"modele": modele.name, "libelle": modele.libelle, "postes": result}
