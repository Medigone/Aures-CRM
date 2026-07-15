# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.naming import make_autoname
from frappe.model.document import Document
from frappe.utils import add_days, cint, flt, getdate, now_datetime

from aurescrm.aures_crm.doctype.demande_faisabilite.demande_faisabilite import (
	_elevated_privileges,
	create_maquette_if_not_exists,
)


FINAL_ETUDE_STATUSES = ("Réalisable", "Non Réalisable", "Annulée")

# Chaîne manuelle après commande client (workflow Desk désactivé sur ce DocType)
POST_COMMANDE_STATUS_CHAIN = {
	"Commandé": "Production à lancer",
	"Production à lancer": "En production",
	"En production": "Prêt pour livraison",
}


class DossierEssaiBlanc(Document):
	def autoname(self):
		"""Format DEB-YYYY-MM-### (compteur séquentiel par préfixe mois sur tabSeries)."""
		self.name = make_autoname("DEB-.YYYY.-.MM.-.###", doc=self)

	def before_insert(self):
		if not self.niveau_urgence:
			self.niveau_urgence = "U3"
		if self.ticket_commercial and self.niveau_urgence != "U3":
			self.niveau_urgence = (
				frappe.db.get_value("Ticket Commercial", self.ticket_commercial, "niveau_urgence")
				or "U3"
			)

	def validate(self):
		if not self.niveau_urgence:
			self.niveau_urgence = "U3"
		self.validate_ticket_type()
		self.validate_articles()

	def validate_ticket_type(self):
		if not self.ticket_commercial:
			return
		request_type = frappe.db.get_value("Ticket Commercial", self.ticket_commercial, "request_type")
		if request_type and request_type != "Essai Blanc":
			frappe.throw(_("Le dossier essai blanc doit être lié à un ticket de type Essai Blanc."))

	def validate_articles(self):
		seen = set()
		for row in self.get("articles") or []:
			if not row.article:
				continue
			item = frappe.db.get_value(
				"Item",
				row.article,
				[
					"item_name",
					"custom_essai_blanc",
					"custom_client",
					"custom_sous_article",
					"custom_article_parent",
				],
				as_dict=True,
			)
			if not item:
				frappe.throw(_("L'article {0} est introuvable.").format(row.article))
			# Après validation client, l'Item est repassé en base sans le drapeau essai blanc.
			if not cint(item.custom_essai_blanc) and row.statut_validation_client != "Validé client":
				frappe.throw(_("L'article {0} n'est pas coché Essai Blanc.").format(row.article))
			if item.custom_client and self.client and item.custom_client != self.client:
				frappe.throw(_("L'article {0} n'appartient pas au client du dossier.").format(row.article))
			if cint(item.custom_sous_article) or item.custom_article_parent:
				frappe.throw(
					_("L'article {0} est un sous-article. Sélectionnez l'article parent.").format(row.article)
				)
			if row.article in seen:
				frappe.throw(
					_("Doublon détecté : l'article {0} figure déjà dans la liste.").format(row.article)
				)
			seen.add(row.article)
			row.designation_article = item.item_name
			row.essai_blanc = 1

	def on_trash(self):
		# Appelé avant check_if_doc_is_dynamically_linked : supprime les « Workflow Action »
		# créés quand le workflow Desk était actif (reference_* en Dynamic Link vers ce dossier).
		for wa_name in frappe.get_all(
			"Workflow Action",
			filters={"reference_doctype": self.doctype, "reference_name": self.name},
			pluck="name",
		):
			frappe.delete_doc("Workflow Action", wa_name, ignore_permissions=True, force=True)

	def can_generate_etudes(self):
		return self.status == "Nouveau"


def _get_item_info(article):
	return frappe.db.get_value(
		"Item",
		article,
		["item_name", "custom_essai_blanc", "custom_client", "custom_procédé"],
		as_dict=True,
	)


@frappe.whitelist()
def add_article(docname, article, quantite, date_livraison, avec_code_pharma=0):
	dossier = frappe.get_doc("Dossier Essai Blanc", docname)
	if dossier.status != "Nouveau":
		frappe.throw(_("Les articles ne peuvent être ajoutés qu'au statut Nouveau."))
	item = _get_item_info(article)
	if not item:
		frappe.throw(_("Article introuvable."))
	if not cint(item.custom_essai_blanc):
		frappe.throw(_("Cet article n'est pas coché Essai Blanc."))
	if item.custom_client and item.custom_client != dossier.client:
		frappe.throw(_("Cet article n'appartient pas au client du dossier."))
	if any(row.article == article for row in dossier.get("articles") or []):
		frappe.throw(_("Cet article est déjà présent dans le dossier."))
	dossier.append(
		"articles",
		{
			"article": article,
			"designation_article": item.item_name,
			"quantite": cint(quantite),
			"date_livraison": date_livraison,
			"procede_article": item.get("custom_procédé") or "",
			"essai_blanc": 1,
			"statut_validation_client": "En attente",
			"avec_code_pharma": cint(avec_code_pharma),
		},
	)
	dossier.save(ignore_permissions=True)
	return {"status": "ok"}


@frappe.whitelist()
def remove_article(docname, row_name):
	dossier = frappe.get_doc("Dossier Essai Blanc", docname)
	if dossier.status != "Nouveau":
		frappe.throw(_("Les articles ne peuvent être supprimés qu'au statut Nouveau."))
	dossier.articles = [row for row in dossier.get("articles") or [] if row.name != row_name]
	dossier.save(ignore_permissions=True)
	return {"status": "ok"}


@frappe.whitelist()
def generate_etudes_dossier(docname):
	try:
		dossier = frappe.get_doc("Dossier Essai Blanc", docname)
		if not dossier.can_generate_etudes():
			frappe.throw(_("Seul un dossier au statut Nouveau peut générer les études."))
		if not dossier.get("articles"):
			frappe.throw(_("Aucun article n'a été ajouté au dossier."))

		created = 0
		ignored = 0
		for row in dossier.get("articles") or []:
			is_compose = cint(frappe.db.get_value("Item", row.article, "custom_article_compose"))
			if is_compose:
				sous_articles = frappe.get_all(
					"Item",
					filters={"custom_article_parent": row.article},
					fields=["name", "custom_quantite_sous_article", "custom_procédé"],
				)
				if not sous_articles:
					frappe.throw(_("L'article composé {0} n'a aucun sous-article.").format(row.article))
				for sa in sous_articles:
					sa_qty = float(sa.custom_quantite_sous_article or 1)
					c, i, etude = _create_etude(
						dossier=dossier,
						article=sa.name,
						article_parent=row.article,
						quantite=int(cint(row.quantite) * sa_qty),
						date_livraison=row.date_livraison,
						procede=sa.get("custom_procédé") or "",
					)
					created += c
					ignored += i
					if etude and not row.etude_name:
						row.etude_doctype = etude.doctype
						row.etude_name = etude.name
			else:
				c, i, etude = _create_etude(
					dossier=dossier,
					article=row.article,
					article_parent="",
					quantite=row.quantite,
					date_livraison=row.date_livraison,
					procede=row.procede_article or "",
				)
				created += c
				ignored += i
				if etude:
					row.etude_doctype = etude.doctype
					row.etude_name = etude.name

		dossier.status = "Confirmée"
		dossier.save(ignore_permissions=True)
		return {"created": created, "ignored": ignored, "status": dossier.status}
	except Exception:
		frappe.log_error(frappe.get_traceback(), "Erreur generate_etudes_dossier")
		frappe.throw(_("Une erreur est survenue lors de la génération des études."))


def _create_etude(dossier, article, article_parent, quantite, date_livraison, procede):
	doctype = "Etude Faisabilite Flexo" if procede == "Flexo" else "Etude Faisabilite"
	existing = frappe.db.exists(
		doctype,
		{
			"dossier_essai_blanc": dossier.name,
			"article": article,
			"quantite": cint(quantite),
		},
	)
	if existing:
		return 0, 1, frappe.get_doc(doctype, existing)

	create_maquette_if_not_exists(dossier.client, article)
	etude = frappe.new_doc(doctype)
	values = {
		"dossier_essai_blanc": dossier.name,
		"article": article,
		"article_parent": article_parent or "",
		"quantite": cint(quantite),
		"date_livraison": date_livraison,
		"client": dossier.client,
		"commercial": dossier.commercial,
		"id_commercial": dossier.id_commercial,
		"is_reprint": 0,
		"essai_blanc": 1,
		"niveau_urgence": dossier.niveau_urgence or "U3",
	}
	valid_fieldnames = {field.fieldname for field in etude.meta.fields}
	for field, value in values.items():
		if field in valid_fieldnames:
			etude.set(field, value)
	etude.insert(ignore_permissions=True)
	etude = frappe.get_doc(doctype, etude.name)
	etude.save(ignore_permissions=True)
	return 1, 0, etude


@frappe.whitelist()
def update_dossier_status_from_etudes(doc, method=None):
	"""
	Comme Demande Faisabilité : le flux réel est sur chaque étude (workflow).
	Ce hook agrège les statuts des études liées sans rétrograder le dossier.
	"""
	dossier_name = doc.get("dossier_essai_blanc")
	if not dossier_name:
		return
	dossier = frappe.get_doc("Dossier Essai Blanc", dossier_name)
	if dossier.status in [
		"Devis établi",
		"Commandé",
		"Production à lancer",
		"En production",
		"Prêt pour livraison",
		"Partiellement validé client",
		"Validé client",
		"Clôturé",
		"Annulé",
	]:
		return
	etudes = _get_all_etudes(dossier_name, fields=["status"])
	if not etudes:
		return
	statuses = [etude.status for etude in etudes]

	if any(s == "En étude" for s in statuses):
		computed_status = "En étude"
	elif all(s in FINAL_ETUDE_STATUSES for s in statuses):
		computed_status = "Étude finalisée"
	elif any(s in ("Réalisable", "Non Réalisable") for s in statuses):
		computed_status = "Étude partiellement finalisée"
	else:
		return

	status_rank = {
		"Nouveau": 0,
		"Confirmée": 1,
		"En étude": 2,
		"Étude partiellement finalisée": 3,
		"Étude finalisée": 4,
		"Devis établi": 5,
		"Commandé": 6,
		"Production à lancer": 7,
		"En production": 8,
		"Prêt pour livraison": 9,
		"Partiellement validé client": 10,
		"Validé client": 11,
		"Clôturé": 12,
		"Annulé": 12,
	}
	current_rank = status_rank.get(dossier.status, 0)
	new_rank = status_rank.get(computed_status, 0)

	if current_rank < new_rank or dossier.status == "Confirmée":
		if dossier.status == computed_status:
			return
		dossier.status = computed_status
		dossier.save(ignore_permissions=True)


def _get_all_etudes(dossier_name, fields=None):
	fields = fields or ["name", "status", "item_name", "article"]
	etudes = []
	for doctype in ("Etude Faisabilite", "Etude Faisabilite Flexo"):
		rows = frappe.get_list(
			doctype,
			filters={"dossier_essai_blanc": dossier_name},
			fields=fields,
			ignore_permissions=True,
		)
		for row in rows:
			row["doctype"] = doctype
		etudes.extend(rows)
	return etudes


def _etude_simple_realisable(dossier_name, article, quantite):
	filters = {
		"dossier_essai_blanc": dossier_name,
		"status": "Réalisable",
		"article": article,
		"article_parent": "",
		"quantite": cint(quantite),
	}
	return bool(
		frappe.db.exists("Etude Faisabilite", filters)
		or frappe.db.exists("Etude Faisabilite Flexo", filters)
	)


def _etude_composite_realisable(dossier_name, parent_article, parent_qty):
	sous_articles = frappe.get_all(
		"Item",
		filters={"custom_article_parent": parent_article},
		fields=["name", "custom_quantite_sous_article"],
	)
	if not sous_articles:
		return False
	for sa in sous_articles:
		target_qty = int(cint(parent_qty) * flt(sa.custom_quantite_sous_article or 1))
		filters = {
			"dossier_essai_blanc": dossier_name,
			"status": "Réalisable",
			"article": sa.name,
			"article_parent": parent_article,
			"quantite": target_qty,
		}
		if not frappe.db.exists("Etude Faisabilite", filters) and not frappe.db.exists(
			"Etude Faisabilite Flexo", filters
		):
			return False
	return True


def _resolve_quotation_articles(dossier_name):
	dossier = frappe.get_doc("Dossier Essai Blanc", dossier_name)
	results = []
	for row in dossier.get("articles") or []:
		if not row.article:
			continue
		is_compose = cint(frappe.db.get_value("Item", row.article, "custom_article_compose"))
		if is_compose:
			if _etude_composite_realisable(dossier_name, row.article, row.quantite):
				results.append({"article": row.article, "quantite": cint(row.quantite), "date_livraison": row.date_livraison})
		elif _etude_simple_realisable(dossier_name, row.article, row.quantite):
			results.append({"article": row.article, "quantite": cint(row.quantite), "date_livraison": row.date_livraison})
	return results


@frappe.whitelist()
def create_quotation_with_calculs(docname):
	try:
		dossier = frappe.get_doc("Dossier Essai Blanc", docname)
		if not frappe.has_permission("Dossier Essai Blanc", "read", doc=dossier):
			frappe.throw(_("Permission refusée"), frappe.PermissionError)

		quotation_items = _resolve_quotation_articles(docname)
		if not quotation_items:
			frappe.throw(_("Aucun article réalisable trouvé dans les études associées."))

		items = frappe.get_all(
			"Item",
			filters={"name": ["in", [row["article"] for row in quotation_items]]},
			fields=["name", "item_name", "stock_uom"],
		)
		item_dict = {item.name: item for item in items}

		quotation = frappe.new_doc("Quotation")
		quotation.quotation_to = "Customer"
		quotation.party_name = dossier.client
		quotation.custom_id_client = dossier.client
		quotation.company = (
			frappe.defaults.get_user_default("company")
			or frappe.db.get_single_value("Global Defaults", "default_company")
		)
		quotation.custom_dossier_essai_blanc = dossier.name
		quotation.custom_essai_blanc = 1
		quotation.custom_niveau_urgence = dossier.niveau_urgence or "U3"
		if quotation_items[0]["date_livraison"]:
			quotation.custom_date_de_livraison = quotation_items[0]["date_livraison"]
		for row in quotation_items:
			item = item_dict.get(row["article"])
			if item:
				quotation.append(
					"items",
					{
						"item_code": row["article"],
						"item_name": item.item_name,
						"uom": item.stock_uom,
						"qty": row["quantite"],
					},
				)

		# Élévation : get_party_account vérifie la permission Account
		# indépendamment de ignore_permissions sur le Quotation.
		with _elevated_privileges() as original_user:
			quotation.insert(ignore_permissions=True)
			if quotation.owner != original_user:
				frappe.db.set_value(
					"Quotation", quotation.name, "owner", original_user, update_modified=False
				)
				quotation.owner = original_user

			if not quotation.valid_till:
				default_validity = cint(frappe.db.get_single_value("CRM Settings", "default_valid_till")) or 30
				quotation.valid_till = add_days(quotation.transaction_date or getdate(), default_validity)
				quotation.save(ignore_permissions=True)

			from aurescrm.aures_crm.doctype.calcul_devis.calcul_devis import generate_calcul_devis_for_quotation

			calcul_result = generate_calcul_devis_for_quotation(quotation.name)
			if dossier.status in ("Étude finalisée", "Étude partiellement finalisée"):
				dossier.status = "Devis établi"
				dossier.save(ignore_permissions=True)

		return {
			"quotation_name": quotation.name,
			"calcul_devis_count": calcul_result.get("created", 0),
			"message": _("Devis {0} créé avec {1} Calcul(s) Devis").format(
				quotation.name, calcul_result.get("created", 0)
			),
		}
	except Exception:
		frappe.log_error(frappe.get_traceback(), "Erreur create_quotation_with_calculs_dossier")
		frappe.throw(_("Erreur lors de la création du devis depuis le dossier essai blanc."))


@frappe.whitelist()
def set_dossier_status_from_quotation(doc, method=None):
	dossier_name = doc.get("custom_dossier_essai_blanc")
	if not dossier_name:
		return
	dossier = frappe.get_doc("Dossier Essai Blanc", dossier_name)
	if dossier.status in ("Étude finalisée", "Étude partiellement finalisée"):
		dossier.status = "Devis établi"
		dossier.save(ignore_permissions=True)


@frappe.whitelist()
def set_dossier_status_from_sales_order(doc, method=None):
	dossier_name = doc.get("custom_dossier_essai_blanc")
	if not dossier_name:
		return
	dossier = frappe.get_doc("Dossier Essai Blanc", dossier_name)
	if dossier.status in ["Devis établi", "Étude finalisée", "Étude partiellement finalisée"]:
		dossier.status = "Commandé"
		dossier.save(ignore_permissions=True)


@frappe.whitelist()
def cancel_dossier_essai_blanc_etudes(docname):
	"""
	Annule le dossier (statut Annulé) : annule ou supprime les commandes vente et devis liés,
	puis supprime ou annule les études. Seuls les statuts Annulé et Clôturé sont exclus.
	"""
	try:
		dossier = frappe.get_doc("Dossier Essai Blanc", docname)
		if dossier.status in ("Annulé", "Clôturé"):
			frappe.throw(
				_("Impossible d'annuler ce dossier à partir du statut {0}.").format(dossier.status)
			)

		deleted_count = 0
		cancelled_count = 0
		quotation_deleted = 0
		quotation_cancelled = 0
		sales_order_deleted = 0
		sales_order_cancelled = 0

		frappe.flags.ignore_permissions = True
		try:
			sales_orders = frappe.get_all(
				"Sales Order",
				filters={"custom_dossier_essai_blanc": docname, "docstatus": ["!=", 2]},
				fields=["name", "docstatus"],
			)
			for so in sales_orders:
				if so["docstatus"] == 0:
					frappe.delete_doc("Sales Order", so["name"], ignore_permissions=True, force=True)
					sales_order_deleted += 1
				elif so["docstatus"] == 1:
					doc = frappe.get_doc("Sales Order", so["name"])
					doc.flags.ignore_permissions = True
					doc.cancel()
					sales_order_cancelled += 1

			quotations = frappe.get_all(
				"Quotation",
				filters={"custom_dossier_essai_blanc": docname, "docstatus": ["!=", 2]},
				fields=["name", "docstatus"],
			)
			for q in quotations:
				if q["docstatus"] == 0:
					frappe.delete_doc("Quotation", q["name"], ignore_permissions=True, force=True)
					quotation_deleted += 1
				elif q["docstatus"] == 1:
					doc = frappe.get_doc("Quotation", q["name"])
					doc.flags.ignore_permissions = True
					doc.cancel()
					quotation_cancelled += 1

			etudes_offset = frappe.get_all(
				"Etude Faisabilite",
				filters={"dossier_essai_blanc": docname, "docstatus": ["!=", 2]},
				fields=["name", "docstatus"],
			)
			etudes_flexo = frappe.get_all(
				"Etude Faisabilite Flexo",
				filters={"dossier_essai_blanc": docname, "docstatus": ["!=", 2]},
				fields=["name", "docstatus"],
			)

			for e in etudes_offset:
				if e["docstatus"] == 0:
					frappe.delete_doc("Etude Faisabilite", e["name"], ignore_permissions=True, force=True)
					deleted_count += 1
				elif e["docstatus"] == 1:
					doc = frappe.get_doc("Etude Faisabilite", e["name"])
					doc.flags.ignore_permissions = True
					doc.cancel()
					cancelled_count += 1
			for e in etudes_flexo:
				if e["docstatus"] == 0:
					frappe.delete_doc("Etude Faisabilite Flexo", e["name"], ignore_permissions=True, force=True)
					deleted_count += 1
				elif e["docstatus"] == 1:
					doc = frappe.get_doc("Etude Faisabilite Flexo", e["name"])
					doc.flags.ignore_permissions = True
					doc.cancel()
					cancelled_count += 1
		finally:
			frappe.flags.ignore_permissions = False

		frappe.db.sql(
			"update `tabQuotation` set `custom_dossier_essai_blanc`=NULL where `custom_dossier_essai_blanc`=%s",
			(docname,),
		)
		frappe.db.sql(
			"update `tabSales Order` set `custom_dossier_essai_blanc`=NULL where `custom_dossier_essai_blanc`=%s",
			(docname,),
		)

		for dt in ("Etude Faisabilite", "Etude Faisabilite Flexo"):
			frappe.db.sql(
				f"""
				update `tab{dt}` set dossier_essai_blanc=NULL
				where dossier_essai_blanc=%s and docstatus=2
				""",
				(docname,),
			)

		dossier = frappe.get_doc("Dossier Essai Blanc", docname)
		for row in dossier.get("articles") or []:
			row.etude_doctype = None
			row.etude_name = None
		dossier.status = "Annulé"
		dossier.save(ignore_permissions=True)

		return {
			"status": "ok",
			"deleted_count": deleted_count,
			"cancelled_count": cancelled_count,
			"quotation_deleted": quotation_deleted,
			"quotation_cancelled": quotation_cancelled,
			"sales_order_deleted": sales_order_deleted,
			"sales_order_cancelled": sales_order_cancelled,
		}
	except frappe.ValidationError:
		raise
	except Exception:
		frappe.log_error(frappe.get_traceback(), "Erreur cancel_dossier_essai_blanc_etudes")
		frappe.throw(_("Une erreur est survenue pendant l'annulation du dossier essai blanc."))


@frappe.whitelist()
def advance_dossier_essai_blanc_step(docname):
	"""Avance le dossier d'une étape dans la phase post-commande (plan : transitions manuelles)."""
	dossier = frappe.get_doc("Dossier Essai Blanc", docname)
	next_status = POST_COMMANDE_STATUS_CHAIN.get(dossier.status)
	if not next_status:
		frappe.throw(
			_(
				"Aucune étape suivante définie pour le statut « {0} ». "
				"Les transitions automatiques s'arrêtent à « Prêt pour livraison » (puis validation client)."
			).format(dossier.status)
		)
	user = frappe.session.user
	ts = now_datetime()
	if next_status == "Production à lancer":
		dossier.prod_a_lancer_par = user
		dossier.prod_a_lancer_le = ts
	elif next_status == "En production":
		dossier.en_production_par = user
		dossier.en_production_le = ts
	elif next_status == "Prêt pour livraison":
		dossier.pret_livraison_par = user
		dossier.pret_livraison_le = ts
	dossier.status = next_status
	dossier.save(ignore_permissions=True)
	return {"status": dossier.status}


_ITEM_SUPPORT_FIELDS = ("custom_support", "custom_grammage")


def _validate_item_support_grammage_values(custom_support, custom_grammage):
	from aurescrm.item_paper_options import is_valid_grammage_papier, is_valid_type_papier

	s = (custom_support or "").strip()
	g = (custom_grammage or "").strip()
	if not s or not g:
		frappe.throw(_("Le support et le grammage validés par le client sont obligatoires."))
	if not is_valid_type_papier(s):
		frappe.throw(_("Valeur de support invalide."))
	if not is_valid_grammage_papier(g):
		frappe.throw(_("Valeur de grammage invalide."))
	return s, g


@frappe.whitelist()
def get_item_support_grammage_for_prompt(item_code):
	from aurescrm.item_paper_options import get_grammage_papier_options, get_type_papier_options

	if not item_code:
		frappe.throw(_("Article manquant."))
	if not frappe.db.exists("Item", item_code):
		frappe.throw(_("Article introuvable."))
	row = frappe.db.get_value("Item", item_code, list(_ITEM_SUPPORT_FIELDS), as_dict=True)
	return {
		"custom_support": row.get("custom_support") or "",
		"custom_grammage": row.get("custom_grammage") or "",
		"support_options": get_type_papier_options(),
		"grammage_options": get_grammage_papier_options(),
	}


def _update_validation_status(dossier):
	rows = [row for row in dossier.get("articles") or [] if row.article]
	if not rows:
		return
	validated_count = sum(1 for row in rows if row.statut_validation_client == "Validé client")
	if validated_count == len(rows):
		dossier.status = "Validé client"
	elif validated_count > 0:
		dossier.status = "Partiellement validé client"


@frappe.whitelist()
def set_article_validation(
	docname,
	row_name,
	validation_status,
	commentaire=None,
	custom_support=None,
	custom_grammage=None,
):
	if validation_status not in ("Validé client", "Refusé client"):
		frappe.throw(_("Statut de validation invalide."))
	dossier = frappe.get_doc("Dossier Essai Blanc", docname)
	if dossier.status not in ("Prêt pour livraison", "Partiellement validé client"):
		frappe.throw(
			_(
				"La validation client par article n'est possible qu'à partir du statut « Prêt pour livraison » "
				"(avancez le dossier via les boutons « Flux dossier » après la commande)."
			)
		)
	row = next((item for item in dossier.get("articles") or [] if item.name == row_name), None)
	if not row:
		frappe.throw(_("Ligne article introuvable."))
	if validation_status == "Validé client":
		support_ok, grammage_ok = _validate_item_support_grammage_values(custom_support, custom_grammage)
	else:
		support_ok = grammage_ok = None
	row.statut_validation_client = validation_status
	row.commentaire_validation = commentaire or row.commentaire_validation
	row.date_validation_client = now_datetime()
	_update_validation_status(dossier)
	dossier.save(ignore_permissions=True)
	if validation_status == "Validé client":
		frappe.db.set_value(
			"Item",
			row.article,
			{
				"custom_support": support_ok,
				"custom_grammage": grammage_ok,
				"custom_essai_blanc": 0,
			},
		)
	return {"status": dossier.status}


@frappe.whitelist()
def get_linked_documents_for_dossier(dossier_name):
	etudes = _get_all_etudes(dossier_name)
	sales_documents = []
	for qtn in frappe.get_list(
		"Quotation",
		filters={"custom_dossier_essai_blanc": dossier_name, "docstatus": ["!=", 2]},
		fields=["name", "status"],
		ignore_permissions=True,
	):
		sales_documents.append({"doctype": "Quotation", "name": qtn.name, "status": qtn.status})
	for so in frappe.get_list(
		"Sales Order",
		filters={"custom_dossier_essai_blanc": dossier_name, "docstatus": ["!=", 2]},
		fields=["name", "status"],
		ignore_permissions=True,
	):
		sales_documents.append({"doctype": "Sales Order", "name": so.name, "status": so.status})
	return {"etudes": etudes, "sales_documents": sales_documents}
