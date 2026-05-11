# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, get_link_to_form


class CreanceClient(Document):
	def validate(self):
		if not self.client:
			return
		existing = frappe.db.get_value("Creance Client", {"client": self.client}, "name")
		if existing and existing != self.name:
			frappe.throw(
				_("Une créance client existe déjà pour ce client : {0}").format(
					get_link_to_form("Creance Client", existing)
				),
				title=_("Doublon interdit"),
			)


def sync_creance_client_from_movements(creance_client: str, commit: bool = False) -> None:
	"""Recalcule les totaux de la fiche créance à partir des mouvements."""
	if not creance_client or not frappe.db.exists("Creance Client", creance_client):
		return

	movements = frappe.get_all(
		"Mouvement Creance Client",
		filters={"creance_client": creance_client},
		fields=["type_mouvement", "sens", "montant"],
	)

	montant_initial = flt(0)
	total_factures = flt(0)
	total_recouvre = flt(0)
	debits_ajust = flt(0)
	credits_ajust = flt(0)
	avoir_total = flt(0)

	debits_total = flt(0)
	credits_total = flt(0)

	for row in movements:
		m = flt(row.montant)
		t = row.type_mouvement
		s = row.sens

		if s == "Débit":
			debits_total += m
		else:
			credits_total += m

		if t == "Solde initial":
			montant_initial += m
		elif t == "Facture ancien ERP":
			total_factures += m
		elif t == "Paiement recouvré":
			total_recouvre += m
		elif t == "Avoir":
			avoir_total += m
		elif t == "Ajustement manuel":
			if s == "Débit":
				debits_ajust += m
			else:
				credits_ajust += m

	total_ajustements = flt(avoir_total + credits_ajust - debits_ajust)
	solde_restant = flt(debits_total - credits_total)
	if solde_restant < 0:
		solde_restant = 0

	updates = {
		"montant_initial": montant_initial,
		"total_factures_externes": total_factures,
		"total_recouvre": total_recouvre,
		"total_ajustements": total_ajustements,
		"solde_restant": solde_restant,
	}

	current_statut = frappe.db.get_value("Creance Client", creance_client, "statut")
	if current_statut not in ("Litige", "Suspendue"):
		if solde_restant <= 0 and movements:
			updates["statut"] = "Soldée"
		elif total_recouvre > 0 and solde_restant > 0:
			updates["statut"] = "Partiellement recouvrée"
		elif solde_restant > 0 and current_statut == "Soldée":
			updates["statut"] = "Ouverte"

	frappe.db.set_value("Creance Client", creance_client, updates, update_modified=False)

	if commit:
		frappe.db.commit()


def update_creance_after_visite(creance_docname: str, visit_doc) -> None:
	"""Met à jour les champs de suivi terrain sur la créance après soumission d'une visite."""
	if not creance_docname or not visit_doc:
		return

	values = {
		"dernier_resultat_recouvrement": visit_doc.resultat_recouvrement,
		"derniere_visite_recouvrement": visit_doc.name,
	}
	if getattr(visit_doc, "date_prochaine_relance", None):
		values["date_prochaine_relance"] = visit_doc.date_prochaine_relance

	frappe.db.set_value("Creance Client", creance_docname, values, update_modified=False)
