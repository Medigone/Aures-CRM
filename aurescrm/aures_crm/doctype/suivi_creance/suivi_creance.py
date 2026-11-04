# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, flt, get_link_to_form, getdate, strip_html, today


class SuiviCreance(Document):
	def validate(self):
		"""Appelé avant l'enregistrement du document"""
		self._valider_un_suivi_par_client()
		self._migrer_paiement_plat_vers_table()
		self._migrer_promesse_plate_vers_table()
		self._migrer_litige_plat_vers_table()
		self._completer_meta_paiements()
		self._completer_meta_promesses()
		self._completer_meta_litiges()
		self.synchroniser_date_promesse()
		self.synchroniser_raison_litige()
		self.mettre_a_jour_montants_recouvrement()

	def _valider_un_suivi_par_client(self):
		"""Un seul dossier Suivi Creance par client (historique unique)."""
		if not self.id_client:
			return
		filters = {"id_client": self.id_client}
		if not self.is_new():
			filters["name"] = ("!=", self.name)
		existing = frappe.db.get_value("Suivi Creance", filters, "name")
		if existing:
			frappe.throw(
				_("Un suivi de créance existe déjà pour ce client : {0}").format(
					get_link_to_form("Suivi Creance", existing)
				),
				title=_("Dossier client déjà existant"),
			)

	def _migrer_paiement_plat_vers_table(self):
		"""Migre l'ancien paiement stocké en champs plats vers la table paiements."""
		if self.get("paiements"):
			return
		if not self.type_paiement or flt(self.montant_payement) <= 0:
			return
		self.append(
			"paiements",
			{
				"type_paiement": self.type_paiement,
				"date_doc_payement": self.date_doc_payement,
				"n_doc": self.n_doc,
				"montant": self.montant_payement,
				"photo": self.photo,
				"date_creation": today(),
				"responsable": frappe.utils.get_fullname(frappe.session.user),
			},
		)

	def _completer_meta_paiements(self):
		"""Renseigne date de création et responsable sur chaque ligne paiement."""
		for row in self.get("paiements") or []:
			if not row.date_creation:
				if getattr(row, "creation", None):
					row.date_creation = getdate(row.creation)
				else:
					row.date_creation = getdate(today())
			if not row.responsable:
				owner = getattr(row, "owner", None) or frappe.session.user
				row.responsable = frappe.utils.get_fullname(owner)

	def _migrer_promesse_plate_vers_table(self):
		"""Migre l'ancienne date_prom_paiement vers la table promesses."""
		if self.get("promesses"):
			return
		if not self.date_prom_paiement:
			return
		total_facture = sum(flt(row.montant_du) for row in self.get("factures") or [])
		total_paye = sum(flt(row.montant) for row in self.get("paiements") or [])
		solde = total_facture - total_paye
		montant_promis = solde if solde > 0 else total_facture
		self.append(
			"promesses",
			{
				"date_creation": today(),
				"responsable": frappe.utils.get_fullname(frappe.session.user),
				"date_promise": self.date_prom_paiement,
				"montant_promis": montant_promis or 0,
				"statut": "En cours",
				"remarques": _("Migrée depuis l'ancienne promesse"),
			},
		)

	def _completer_meta_promesses(self):
		"""Renseigne date de création et responsable sur chaque promesse."""
		for row in self.get("promesses") or []:
			if not row.date_creation:
				if getattr(row, "creation", None):
					row.date_creation = getdate(row.creation)
				else:
					row.date_creation = getdate(today())
			if not row.responsable:
				owner = getattr(row, "owner", None) or frappe.session.user
				row.responsable = frappe.utils.get_fullname(owner)
			if not row.statut:
				row.statut = "En cours"

	def synchroniser_date_promesse(self):
		"""date_prom_paiement = date de la dernière promesse En cours (compat)."""
		en_cours = [
			row
			for row in self.get("promesses") or []
			if row.statut == "En cours" and row.date_promise
		]
		if not en_cours:
			self.date_prom_paiement = None
			return
		en_cours.sort(key=lambda r: getdate(r.date_promise))
		self.date_prom_paiement = en_cours[-1].date_promise

	def _migrer_litige_plat_vers_table(self):
		"""Migre l'ancien raison_litige / statut Litige vers la table litiges."""
		if self.get("litiges"):
			return
		motif = strip_html(self.raison_litige or "").strip()
		if not motif and self.status != "Litige":
			return
		self.append(
			"litiges",
			{
				"date_creation": today(),
				"responsable": frappe.utils.get_fullname(frappe.session.user),
				"motif": motif or _("Migrée depuis l'ancien litige"),
				"statut": "Ouvert",
				"remarques": _("Migrée depuis l'ancien litige"),
			},
		)

	def _completer_meta_litiges(self):
		"""Renseigne meta et date de clôture sur chaque litige."""
		for row in self.get("litiges") or []:
			if not row.date_creation:
				if getattr(row, "creation", None):
					row.date_creation = getdate(row.creation)
				else:
					row.date_creation = getdate(today())
			if not row.responsable:
				owner = getattr(row, "owner", None) or frappe.session.user
				row.responsable = frappe.utils.get_fullname(owner)
			if not row.statut:
				row.statut = "Ouvert"
			if row.statut == "Clos":
				if not row.date_cloture:
					row.date_cloture = getdate(today())
			else:
				row.date_cloture = None

	def synchroniser_raison_litige(self):
		"""raison_litige = motif du dernier litige Ouvert (compat)."""
		ouverts = [
			row
			for row in self.get("litiges") or []
			if row.statut == "Ouvert" and row.motif
		]
		if not ouverts:
			self.raison_litige = None
			return
		ouverts.sort(key=lambda r: getdate(r.date_creation) if r.date_creation else getdate(today()))
		self.raison_litige = ouverts[-1].motif

	def a_litige_ouvert(self):
		return any(row.statut == "Ouvert" for row in self.get("litiges") or [])

	def synchroniser_champs_paiement(self):
		"""Recalcule le total et synchronise les champs plats (compatibilité)."""
		self.montant_payement = sum(flt(row.montant) for row in self.get("paiements") or [])
		if self.paiements:
			last = self.paiements[-1]
			self.type_paiement = last.type_paiement
			self.date_doc_payement = last.date_doc_payement
			self.n_doc = last.n_doc
			self.photo = last.photo
		else:
			self.type_paiement = None
			self.date_doc_payement = None
			self.n_doc = None
			self.photo = None

	def calculer_total_arrive_echeance(self):
		"""Somme des restes dus des factures dont l'échéance est passée ou aujourd'hui."""
		today_date = getdate(today())
		total = 0
		for row in self.get("factures") or []:
			if not row.date_echeance:
				continue
			if getdate(row.date_echeance) <= today_date:
				reste = flt(row.montant_du) - flt(row.montant_paiement)
				if reste > 0:
					total += reste
		self.total_arrive_echeance = total

	def mettre_a_jour_montants_recouvrement(self):
		"""Met à jour les montants dérivés du recouvrement depuis la table factures"""
		self.synchroniser_champs_paiement()
		self.montant_tot_du = sum(flt(row.montant_du) for row in self.factures)
		self.calculer_total_arrive_echeance()
		total_du = flt(self.montant_tot_du)
		paiement = flt(self.montant_payement)
		montant_restant = total_du - paiement
		self.montant_restant = montant_restant if montant_restant > 0 else 0
		self.mettre_a_jour_statut()

	def mettre_a_jour_statut(self):
		"""Recalcule le statut : Litige si Ouvert, sinon solde (sauf Obsolète)."""
		if self.status == "Obsolète":
			return

		if self.a_litige_ouvert():
			self.status = "Litige"
			return

		total_facture = flt(self.montant_tot_du)
		paiement = flt(self.montant_payement)
		solde = flt(self.montant_restant)

		if total_facture > 0 and solde <= 0:
			self.status = "Totalement réglé"
		elif paiement > 0 and solde > 0:
			self.status = "Partiellement réglé"
		else:
			self.status = "Nouveau"

	@frappe.whitelist()
	def importer_factures_excel(self, file_url, remplacer=0):
		"""Importe des factures libres depuis un fichier Excel attaché.

		N'ajoute que les n° de facture absents du dossier (sauf mode remplacer).
		"""
		if not file_url:
			frappe.throw(_("Veuillez sélectionner un fichier Excel"))

		rows = _lire_lignes_excel(file_url)
		if not rows:
			frappe.throw(_("Le fichier Excel est vide"))

		header_map = _mapper_entetes(rows[0])
		required = ("facture", "montant_du")
		missing = [col for col in required if col not in header_map]
		if missing:
			frappe.throw(
				_("Colonnes obligatoires manquantes : {0}").format(", ".join(missing))
			)

		if cint(remplacer):
			self.set("factures", [])

		existants = {
			_normalize_facture_numero(row.facture)
			for row in self.get("factures") or []
			if row.facture
		}

		imported = 0
		skipped = 0
		for raw in rows[1:]:
			if not raw or all(cell is None or str(cell).strip() == "" for cell in raw):
				continue

			facture = _cell(raw, header_map, "facture")
			montant_du = flt(_cell(raw, header_map, "montant_du"))
			if not facture:
				continue

			numero = _normalize_facture_numero(facture)
			if not numero:
				continue

			if numero in existants:
				skipped += 1
				continue

			self.append(
				"factures",
				{
					"facture": str(facture).strip(),
					"date": _parse_date(_cell(raw, header_map, "date")),
					"date_echeance": _parse_date(_cell(raw, header_map, "date_echeance")),
					"montant_du": montant_du,
					"montant_paiement": 0,
				},
			)
			existants.add(numero)
			imported += 1

		if imported == 0 and skipped == 0:
			frappe.throw(_("Aucune ligne valide trouvée dans le fichier"))

		if imported == 0 and skipped > 0:
			frappe.msgprint(
				_("Aucune nouvelle facture : {0} déjà présente(s) dans le dossier.").format(
					skipped
				)
			)
			return {
				"imported": 0,
				"skipped": skipped,
				"total_rows": len(self.factures),
			}

		self.mettre_a_jour_montants_recouvrement()
		self.save()
		return {
			"imported": imported,
			"skipped": skipped,
			"total_rows": len(self.factures),
		}


def _normalize_header(value):
	import unicodedata

	if value is None:
		return ""
	text = str(value).strip().lower()
	text = unicodedata.normalize("NFKD", text)
	text = "".join(ch for ch in text if not unicodedata.combining(ch))
	for ch in (" ", "-", "_", ".", "/", "°", "º", "'", "’", "º"):
		text = text.replace(ch, "")
	return text


def _normalize_facture_numero(value):
	"""Normalise un n° de facture pour la détection de doublons."""
	if value is None:
		return ""
	return " ".join(str(value).strip().upper().split())


_HEADER_ALIASES = {
	"facture": {
		"facture",
		"nfacture",
		"nofacture",
		"numerofacture",
		"numfacture",
		"invoice",
		"invoiceno",
	},
	"date": {"date", "datedocument", "datefacture", "postingdate"},
	"date_echeance": {
		"dateecheance",
		"echeance",
		"datedecheance",
		"duedate",
	},
	"montant_du": {
		"montantdu",
		"montant",
		"amount",
		"outstanding",
	},
}


def _mapper_entetes(header_row):
	mapping = {}
	for idx, cell in enumerate(header_row or []):
		norm = _normalize_header(cell)
		if not norm:
			continue
		for fieldname, aliases in _HEADER_ALIASES.items():
			if norm in aliases and fieldname not in mapping:
				mapping[fieldname] = idx
				break
	return mapping


def _cell(row, header_map, fieldname):
	idx = header_map.get(fieldname)
	if idx is None or idx >= len(row):
		return None
	return row[idx]


def _parse_date(value):
	if value in (None, ""):
		return None
	try:
		return getdate(value)
	except Exception:
		frappe.throw(_("Date invalide : {0}").format(value))


def _lire_lignes_excel(file_url):
	from frappe.utils.xlsxutils import read_xlsx_file_from_attached_file

	rows = read_xlsx_file_from_attached_file(file_url=file_url)
	if rows is None:
		frappe.throw(_("Impossible de lire le fichier Excel"))
	return rows


@frappe.whitelist()
def telecharger_modele_factures_excel():
	"""Télécharge un modèle Excel vide pour l'import de factures."""
	from frappe.utils.xlsxutils import build_xlsx_response

	data = [
		["facture", "date", "date_echeance", "montant_du"],
		["FAC-001", "2026-01-15", "2026-02-15", 10000],
	]
	build_xlsx_response(data, "modele_factures_creances")
