# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt

from aurescrm.aures_crm.doctype.creance_client.creance_client import sync_creance_client_from_movements
from aurescrm.aures_crm.doctype.parametres_suivi_creances.parametres_suivi_creances import (
	assert_suivi_creances_actif,
)


class MouvementCreanceClient(Document):
	def validate(self):
		if not getattr(self.flags, "ignore_suivi_creances_check", False):
			assert_suivi_creances_actif()
		if flt(self.montant) <= 0:
			frappe.throw(_("Le montant doit être supérieur à 0."))

		self._apply_sens_for_type()
		self._validate_paiement_fields()

	def before_save(self):
		if not self.is_new():
			self._previous_creance_client = frappe.db.get_value(
				self.doctype, self.name, "creance_client"
			)

	def _apply_sens_for_type(self):
		t = self.type_mouvement
		if t == "Ajustement manuel":
			if not self.sens:
				frappe.throw(_("Indiquez le sens pour un ajustement manuel."))
			return
		if t in ("Solde initial", "Facture ancien ERP"):
			self.sens = "Débit"
		elif t in ("Paiement recouvré", "Avoir"):
			self.sens = "Crédit"
		else:
			frappe.throw(_("Type de mouvement non reconnu."))

	def _validate_paiement_fields(self):
		if self.type_mouvement != "Paiement recouvré":
			return
		if not self.type_paiement:
			frappe.throw(_("Le type de paiement est obligatoire pour un paiement recouvré."))
		if self.type_paiement in ("Chèque", "Virement"):
			if not self.numero_document_paiement:
				frappe.throw(_("Le numéro de chèque/virement est obligatoire."))
			if not self.photo_document_paiement:
				frappe.throw(_("La photo du document est obligatoire pour chèque ou virement."))

	def after_insert(self):
		sync_creance_client_from_movements(self.creance_client)

	def on_update(self):
		sync_creance_client_from_movements(self.creance_client)
		prev = getattr(self, "_previous_creance_client", None)
		if prev and prev != self.creance_client:
			sync_creance_client_from_movements(prev)

	def after_delete(self):
		creance = self.creance_client
		if creance:
			sync_creance_client_from_movements(creance)
