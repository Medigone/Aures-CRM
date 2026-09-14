# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import json

import frappe
from frappe.model.document import Document
from frappe.utils import cint

from aurescrm.imposition.optimiseur import Variante
from aurescrm.imposition.service import params_depuis_dict


class CalculImposition(Document):
	def validate(self):
		self._resoudre_article_trace()
		self._valider_scenario_unique()

	def before_save(self):
		if self.flags.get("ecrire_cache"):
			return
		if not self.is_new() and self._cache_invalide():
			self.variantes_json = None
			self.bornes_json = None
			self.silhouette_svg = None
			self.empreinte_trace = None
			if self.statut_calcul == "Terminé":
				self.statut_calcul = "Non lancé"

	def _resoudre_article_trace(self):
		if self.trace and not self.fichier_trace:
			self.fichier_trace = frappe.db.get_value("Trace", self.trace, "fichier_trace")
		if self.trace and not self.article:
			self.article = frappe.db.get_value("Trace", self.trace, "article")
		if self.article and not self.client:
			self.client = frappe.db.get_value("Item", self.article, "custom_client")

	def _valider_scenario_unique(self):
		retenus = [s.libelle or f"ligne {s.idx}" for s in (self.scenarios or []) if cint(s.retenu)]
		if len(retenus) > 1:
			frappe.throw(
				"Un seul scénario d'imposition peut être retenu à la fois "
				f"({', '.join(retenus)})."
			)

	def _cache_invalide(self):
		if self.is_new():
			return False
		avant = self.get_doc_before_save()
		if not avant:
			return False
		for champ in ("pont", "sens_fibre", "trait_commun_autorise"):
			if self.get(champ) != avant.get(champ):
				return True
		return False

	def charge_variantes(self):
		if not self.variantes_json:
			return []
		try:
			brut = json.loads(self.variantes_json)
		except (TypeError, ValueError):
			return []
		return [Variante.depuis_dict(v) for v in brut]

	def charge_parametres(self, quantite=None):
		if not self.bornes_json:
			return None
		try:
			d = json.loads(self.bornes_json)
		except (TypeError, ValueError):
			return None
		if quantite is not None:
			d["quantite"] = int(quantite)
		return params_depuis_dict(d)

	def ecrire_resultat(self, resultat, journal, duree=None):
		self.set("scenarios", [])
		for ligne in resultat.lignes:
			self.append("scenarios", ligne)
		self._appliquer_preparation(resultat, journal, duree)
		self.statut_calcul = "Terminé"
		self.flags.ecrire_cache = True
		self.flags.ignore_version = True
		self.save()

	def ecrire_preparation(self, resultat, journal, duree=None):
		"""Cache géométrie + développé, sans toucher aux scénarios déjà retenus."""
		self._appliquer_preparation(resultat, journal, duree)
		if self.statut_calcul == "Échec":
			self.statut_calcul = "Non lancé"
		self.flags.ecrire_cache = True
		self.flags.ignore_version = True
		self.save()

	def _appliquer_preparation(self, resultat, journal, duree=None):
		mesures = resultat.mesures
		self.developpe_l = mesures["developpe_l"]
		self.developpe_d = mesures["developpe_d"]
		self.surface_utile = mesures["surface_utile"]
		self.surface_utile_mm2 = mesures["surface_utile_mm2"]
		self.remplissage_bbox = mesures["remplissage_bbox"]
		self.log_calcul = "\n".join(journal)
		self.variantes_json = json.dumps(resultat.variantes)
		from aurescrm.imposition.service import params_en_dict

		self.bornes_json = json.dumps(params_en_dict(resultat.params))
		self.silhouette_svg = json.dumps(resultat.silhouette) if resultat.silhouette else None
		self.empreinte_trace = resultat.empreinte
		if duree is not None:
			self.duree_calcul = round(float(duree), 2)
