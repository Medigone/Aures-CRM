from frappe.model.document import Document
import frappe
from frappe import _
from frappe.utils import flt, get_datetime, get_fullname, now, today

from aurescrm.aures_crm.doctype.creance_client.creance_client import (
	sync_creance_client_from_movements,
	update_creance_after_visite,
)
from aurescrm.aures_crm.doctype.parametres_suivi_creances.parametres_suivi_creances import (
	is_suivi_creances_actif,
)

RECOUVREMENT_FIELDS = [
	"creance_client",
	"resultat_recouvrement",
	"solde_creance_avant_visite",
	"montant_reclame",
	"montant_encaisse",
	"montant_restant",
	"type_paiement",
	"date_paiement_negociee",
	"date_prochaine_relance",
	"numero_document_paiement",
	"photo_document_paiement",
	"motif_non_paiement",
	"commentaire_recouvrement",
]


class VisiteCommerciale(Document):
	def validate(self):
		if self.type_visite != "Recouvrement":
			self._clear_recouvrement_fields()
			return

		# Hors fin de visite : le commercial remplit au fur et à mesure (Nouveau / En Cours).
		if self.status != "Terminé":
			self._sync_recouvrement_intermediate()
			return

		self._validate_recouvrement()

	def before_save(self):
		"""Exécute les vérifications et mises à jour avant la sauvegarde."""

		# 1. Vérifier et assigner l'utilisateur actuel si non défini
		if not self.utilisateur:
			self.utilisateur = frappe.session.user

		# 1.b Enregistrer le full name de l'utilisateur dans le champ 'nom_utilisateur'
		if not self.nom_utilisateur:
			self.nom_utilisateur = get_fullname(self.utilisateur)

		# 2. Définir la date et l'heure de début si le statut est "En Cours"
		if self.status == "En Cours" and not self.heure_debut_visite:
			self.heure_debut_visite = now()
			self.date = today()

		# 3. Si la visite est "Terminée", gérer l'heure de fin et la durée
		if self.status == "Terminé":
			self.set_fin_visite_et_duree()

		# 4. Mise à jour de la date si le statut est "En Cours"
		self.set_date_when_in_progress()

	def before_submit(self):
		"""
		Exécuté juste avant la soumission du document (docstatus=0 → docstatus=1).
		Vérifie si la visite est marquée comme "Terminé" et met à jour les champs nécessaires.
		"""
		if self.status == "Terminé":
			self.set_fin_visite_et_duree()

		if self.type_visite == "Recouvrement":
			self._validate_recouvrement()

	def on_submit(self):
		if self.type_visite != "Recouvrement" or not self.creance_client:
			return

		if not is_suivi_creances_actif():
			if self._should_warn_recouvrement_skipped_on_submit():
				frappe.msgprint(
					_(
						"Suivi des créances désactivé : aucun mouvement n'a été créé et la fiche créance n'a pas été mise à jour pour cette visite."
					),
					alert=True,
					indicator="orange",
				)
			return

		update_creance_after_visite(self.creance_client, self)

		if flt(self.montant_encaisse) <= 0:
			return
		if frappe.db.exists("Mouvement Creance Client", {"source_visite": self.name}):
			return

		mouv = frappe.get_doc(
			{
				"doctype": "Mouvement Creance Client",
				"creance_client": self.creance_client,
				"date_mouvement": self.date or today(),
				"type_mouvement": "Paiement recouvré",
				"montant": flt(self.montant_encaisse),
				"source_visite": self.name,
				"type_paiement": self.type_paiement,
				"numero_document_paiement": self.numero_document_paiement,
				"photo_document_paiement": self.photo_document_paiement,
				"commentaire": (self.commentaire_recouvrement or "")[:240],
			}
		)
		mouv.flags.ignore_permissions = True
		mouv.insert()

	def _should_warn_recouvrement_skipped_on_submit(self) -> bool:
		return bool(
			self.creance_client
			or flt(self.montant_encaisse) > 0
			or (self.resultat_recouvrement or "").strip()
		)

	def on_cancel(self):
		if self.type_visite != "Recouvrement":
			return
		for mouv_name in frappe.get_all(
			"Mouvement Creance Client",
			filters={"source_visite": self.name},
			pluck="name",
		):
			frappe.delete_doc("Mouvement Creance Client", mouv_name, ignore_permissions=True, force=True)
		if self.creance_client:
			sync_creance_client_from_movements(self.creance_client)

	def _clear_recouvrement_fields(self):
		for fieldname in RECOUVREMENT_FIELDS:
			self.set(fieldname, None)

	def _sync_recouvrement_intermediate(self):
		"""Recalcule solde / reste sans imposer le résultat ni les règles de fin de visite."""
		if self.creance_client and self.client:
			cc_client = frappe.db.get_value("Creance Client", self.creance_client, "client")
			if cc_client and cc_client != self.client:
				frappe.throw(_("La créance sélectionnée ne correspond pas au client de la visite."))

			self.solde_creance_avant_visite = flt(
				frappe.db.get_value("Creance Client", self.creance_client, "solde_restant")
			)

		reclame = flt(self.montant_reclame or 0)
		encaisse = flt(self.montant_encaisse or 0)
		if encaisse < 0:
			frappe.throw(_("Le montant encaissé ne peut pas être négatif."))
		if reclame > 0 and encaisse > reclame:
			frappe.throw(_("Le montant encaissé ne peut pas dépasser le montant réclamé."))

		reste = reclame - encaisse
		self.montant_restant = reste if reste > 0 else 0

	def _validate_recouvrement(self):
		if not self.client:
			frappe.throw(_("Le client est obligatoire pour une visite de recouvrement."))

		suivi_actif = is_suivi_creances_actif()

		if suivi_actif:
			if not self.creance_client:
				frappe.throw(_("Sélectionnez une créance client."))

			cc_client = frappe.db.get_value("Creance Client", self.creance_client, "client")
			if cc_client != self.client:
				frappe.throw(_("La créance sélectionnée ne correspond pas au client de la visite."))

			self.solde_creance_avant_visite = flt(
				frappe.db.get_value("Creance Client", self.creance_client, "solde_restant")
			)
		elif self.creance_client:
			cc_client = frappe.db.get_value("Creance Client", self.creance_client, "client")
			if cc_client and cc_client != self.client:
				frappe.throw(_("La créance sélectionnée ne correspond pas au client de la visite."))
			self.solde_creance_avant_visite = flt(
				frappe.db.get_value("Creance Client", self.creance_client, "solde_restant")
			)

		if not self.resultat_recouvrement:
			frappe.throw(_("Indiquez le résultat du recouvrement."))

		reclame = flt(self.montant_reclame)

		if suivi_actif and reclame <= 0:
			frappe.throw(_("Le montant réclamé doit être supérieur à 0."))

		encaisse = flt(self.montant_encaisse)
		if encaisse < 0:
			frappe.throw(_("Le montant encaissé ne peut pas être négatif."))

		if self.resultat_recouvrement == "Paiement obtenu" and encaisse <= 0:
			frappe.throw(_("Indiquez le montant encaissé pour un paiement obtenu."))

		if reclame > 0 and encaisse > reclame:
			frappe.throw(_("Le montant encaissé ne peut pas dépasser le montant réclamé."))

		reste = reclame - encaisse
		self.montant_restant = reste if reste > 0 else 0

		if self.resultat_recouvrement in ("Promesse de paiement", "À relancer"):
			if not self.date_paiement_negociee:
				frappe.throw(_("Indiquez la date de paiement négociée."))

		if self.resultat_recouvrement in ("Refus de paiement", "Litige", "Client absent"):
			if not (self.motif_non_paiement or "").strip():
				frappe.throw(_("Le motif est obligatoire pour ce résultat."))

	def set_fin_visite_et_duree(self):
		"""
		Définit automatiquement l'heure de fin et calcule la durée de la visite
		si le statut est "Terminé".
		"""
		if not self.heure_fin_visite:
			self.heure_fin_visite = now()

		if self.heure_debut_visite and self.heure_fin_visite:
			start_time = get_datetime(self.heure_debut_visite)
			end_time = get_datetime(self.heure_fin_visite)
			self.duree_visite = round((end_time - start_time).total_seconds() / 60)

	def set_date_when_in_progress(self):
		"""
		Met à jour la date lorsque le statut est "En Cours".
		"""
		if self.status == "En Cours":
			self.date = today()


@frappe.whitelist()
def get_events(start, end, filters=None):
	"""
	Récupère les événements pour le calendrier avec des couleurs personnalisées selon le statut.
	"""
	if not frappe.has_permission("Visite Commerciale", "read"):
		return []

	conditions = [
		["date", ">=", start],
		["date", "<=", end]
	]

	if filters:
		if isinstance(filters, str):
			import json
			filters = json.loads(filters)

		if isinstance(filters, dict):
			for key, value in filters.items():
				conditions.append([key, "=", value])
		elif isinstance(filters, list):
			for filter in filters:
				conditions.append(filter)

	events = frappe.db.get_all("Visite Commerciale", filters=conditions, fields=["name", "date", "nom_client", "client", "status"])

	for event in events:
		event["start"] = event.get("date")
		event["end"] = event.get("date")
		event["title"] = event.get("nom_client") or event.get("client")

		if event["status"] == "Nouveau":
			event["color"] = "#d0ebff" # Bleu clair
		elif event["status"] == "En Cours":
			event["color"] = "#ffec99" # Orange clair
		elif event["status"] == "Terminé":
			event["color"] = "#b2f2bb" # Vert clair
		elif event["status"] == "Annulé":
			event["color"] = "#e9ecef" # Gris clair

	return events
