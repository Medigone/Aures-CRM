# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Actions groupées communes à toutes les listes du poste de bureau : modifier un champ, supprimer, ajouter des tags.

Même usage que la sélection du Desk, avec trois différences voulues :
- le serveur recalcule les champs modifiables à chaque écriture, plutôt que de faire confiance à l'écran ;
- un champ sans droit d'écriture est refusé, là où `save` remettrait l'ancienne valeur sans rien dire ;
- chaque refus revient avec sa raison : le navigateur envoie des lots courts au lieu d'un travail en arrière-plan.

Seuls les DocTypes de `BULK_DOCTYPES` sont acceptés. Une nouvelle liste s'y déclare en une entrée.
"""

import frappe
from frappe import _
from frappe.desk.doctype.tag.tag import DocTags
from frappe.model.workflow import get_workflow_name
from frappe.utils import cint, cstr, flt, get_datetime, getdate

from aurescrm.api.bureau import TICKET, _bulk_apply, _parse, _ticket_for_write, link_search_values, require_bureau, row_tags
from aurescrm.api.bureau_articles import ITEM, _article_for_write
from aurescrm.api.bureau_clients import COMMERCIAL_FIELD, CUSTOMER, _check_commercial, _client_for_write, _set_principal

TEXT_TYPES = {"Data", "Small Text", "Text", "Long Text"}
NUMBER_TYPES = {"Float", "Currency", "Percent"}
# Les autres types du Desk (éditeur riche, fichier, signature…) n'ont pas de saisie ici : ils restent sur la fiche.
FIELD_TYPES = TEXT_TYPES | NUMBER_TYPES | {"Select", "Link", "Date", "Datetime", "Check", "Int"}

LINK_SEARCH_LIMIT = 8
TAG_LENGTH = 140


def _set_commercial(doc, commercial):
	"""Le hook du Customer recopie le principal dans le champ historique : écrire ce seul champ serait sans effet."""
	_check_commercial(commercial, doc.get(COMMERCIAL_FIELD))
	_set_principal(doc, commercial)


# load : charge un document et contrôle droits et version.
# excluded : champs dont l'écriture a ses propres règles, ailleurs que dans `save`.
# setters : champs écrits par une fonction métier. Ils sont proposés même masqués sur le formulaire, et ne se vident pas.
BULK_DOCTYPES = {
	TICKET: {
		"load": _ticket_for_write,
		"excluded": {
			"customer",
			"owner_user_name",
			# Créance et rapprochement exigent un motif ou une décision ; la liste de contrôle a son action.
			"statut_creance",
			"motif_blocage_creance",
			"commentaire_rapprochement",
			"checklist_bc_demande_faisabilite",
			"checklist_bc_devis",
			"checklist_dd_articles",
			"checklist_eb_articles",
			"checklist_eb_dossier_essai_blanc",
			"checklist_rec_photo",
			"checklist_rec_quantites",
		},
		"setters": {},
	},
	CUSTOMER: {
		"load": _client_for_write,
		"excluded": {
			"customer_name",  # propre à chaque client
			"custom_dernier_numéro_article",  # compteur de la numérotation des articles
		},
		"setters": {COMMERCIAL_FIELD: _set_commercial},
	},
	ITEM: {
		"load": _article_for_write,
		# Identité et rattachement de l'article : ils décident de son code et de sa place, ils se changent un par un.
		"excluded": {
			"item_code",
			"item_name",
			"naming_series",
			"custom_type_article",
			"custom_client",
			"custom_sous_article",
			"custom_article_parent",
			"custom_article_compose",
		},
		"setters": {},
	},
}


def _config(doctype):
	config = BULK_DOCTYPES.get(cstr(doctype))
	if not config:
		frappe.throw(_("Cette liste n'a pas d'action groupée."), frappe.PermissionError)
	return config


def _workflow_field(doctype):
	workflow = get_workflow_name(doctype)
	return frappe.get_cached_value("Workflow", workflow, "workflow_state_field") if workflow else None


def _editable_fields(doctype):
	"""Critères du Desk, plus ce que `save` refuserait ou écraserait : le champ n'est alors même pas proposé."""
	config = _config(doctype)
	meta = frappe.get_meta(doctype)
	levels = meta.get_permlevel_access("write")
	state_field = _workflow_field(doctype)

	def eligible(df):
		if df.fieldname in config["excluded"] or df.fieldname == state_field or df.fieldtype not in FIELD_TYPES:
			return False
		if df.permlevel not in levels:
			return False
		if df.fieldname in config["setters"]:
			return True
		if df.hidden or df.read_only or df.is_virtual or df.set_only_once:
			return False
		# Recopié depuis un autre document à chaque enregistrement : la valeur saisie serait perdue.
		return not (df.fetch_from and not df.fetch_if_empty)

	return [df for df in meta.fields if eligible(df)]


def _field_payload(df, doctype):
	options = [option for option in cstr(df.options).split("\n") if option] if df.fieldtype == "Select" else []
	return {
		"fieldname": df.fieldname,
		"label": _(df.label or df.fieldname),
		"fieldtype": df.fieldtype,
		"options": options,
		"required": bool(df.reqd or df.fieldname in _config(doctype)["setters"]),
	}


@frappe.whitelist()
def get_bulk_options(doctype):
	"""Ce que la barre d'actions peut proposer à cette personne sur cette liste."""
	require_bureau()
	return {
		"fields": [_field_payload(df, doctype) for df in _editable_fields(doctype)],
		"can_delete": bool(frappe.has_permission(doctype, "delete")),
	}


def _editable_field(doctype, fieldname):
	for df in _editable_fields(doctype):
		if df.fieldname == fieldname:
			return df
	frappe.throw(_("Ce champ ne se modifie pas sur plusieurs lignes."), frappe.PermissionError)


def _clean_value(df, value, required):
	"""Valeur saisie au format du champ. Une erreur de saisie refuse toute la demande, avant d'écrire quoi que ce soit."""
	empty = value is None or cstr(value).strip() == ""
	if df.fieldtype == "Check":
		return cint(value)
	if empty:
		if required:
			frappe.throw(_("Le champ {0} est obligatoire.").format(_(df.label)))
		return None
	if df.fieldtype == "Int" or df.fieldtype in NUMBER_TYPES:
		try:
			return int(value) if df.fieldtype == "Int" else float(value)
		except (TypeError, ValueError):
			frappe.throw(_("Le champ {0} attend un nombre.").format(_(df.label)))
	try:
		if df.fieldtype == "Date":
			return str(getdate(value))
		if df.fieldtype == "Datetime":
			return str(get_datetime(value))
	except Exception:
		frappe.throw(_("Le champ {0} attend une date.").format(_(df.label)))
	return cstr(value).strip()


def _same(df, left, right):
	if df.fieldtype == "Check" or df.fieldtype == "Int" or df.fieldtype in NUMBER_TYPES:
		return flt(left) == flt(right)
	return cstr(left) == cstr(right)


@frappe.whitelist(methods=["POST"])
def bulk_update(doctype, items, fieldname, value=None):
	"""Donne la même valeur à un champ de plusieurs documents, avec les validations et les hooks de `save`."""
	require_bureau()
	config = _config(doctype)
	df = _editable_field(doctype, cstr(fieldname))
	setter = config["setters"].get(df.fieldname)
	value = _clean_value(df, value, bool(df.reqd or setter))

	def apply(doc):
		if doc.docstatus == 2:
			return _("Document annulé.")
		before = doc.get(df.fieldname)
		if _same(df, before, value):
			return None
		if setter:
			setter(doc, value)
		else:
			doc.set(df.fieldname, value)
		doc.save()
		# Un hook peut remettre l'ancienne valeur : ne pas annoncer une modification qui n'a pas eu lieu.
		if _same(df, doc.get(df.fieldname), before):
			return _("Cette valeur n'a pas été retenue.")
		return None

	return _bulk_apply(items, apply, config["load"])


@frappe.whitelist(methods=["POST"])
def bulk_delete(doctype, items):
	"""Supprime plusieurs documents. Un document soumis ou lié à d'autres est refusé, avec la raison."""
	require_bureau()
	config = _config(doctype)

	def apply(doc):
		doc.check_permission("delete")
		frappe.delete_doc(doc.doctype, doc.name)
		return None

	return _bulk_apply(items, apply, config["load"])


def _clean_tags(tags):
	cleaned = []
	for tag in _parse(tags) or []:
		tag = cstr(tag).strip()
		if "," in tag:
			frappe.throw(_("Un tag ne peut pas contenir de virgule."))
		if len(tag) > TAG_LENGTH:
			frappe.throw(_("Un tag compte au plus {0} caractères.").format(TAG_LENGTH))
		if tag and tag not in cleaned:
			cleaned.append(tag)
	if not cleaned:
		frappe.throw(_("Saisissez au moins un tag."))
	return cleaned


@frappe.whitelist(methods=["POST"])
def bulk_add_tags(doctype, items, tags):
	"""Ajoute des tags à plusieurs documents. La date `modified` ne change pas, comme sur le Desk."""
	require_bureau()
	config = _config(doctype)
	tags = _clean_tags(tags)

	def apply(doc):
		for tag in tags:
			DocTags(doc.doctype).add(doc.name, tag)
		return None

	return _bulk_apply(items, apply, config["load"])


def _current_tags(doctype, name):
	return {"tags": row_tags({"_user_tags": frappe.db.get_value(doctype, name, "_user_tags")})}


@frappe.whitelist(methods=["POST"])
def add_doc_tag(doctype, name, modified, tag):
	"""Ajoute un tag depuis le tiroir ou la fiche. Renvoie les tags du document."""
	require_bureau()
	doc = _config(doctype)["load"](cstr(name), modified)
	for cleaned in _clean_tags([tag]):
		DocTags(doc.doctype).add(doc.name, cleaned)
	return _current_tags(doc.doctype, doc.name)


@frappe.whitelist(methods=["POST"])
def remove_doc_tag(doctype, name, modified, tag):
	"""Retire un tag depuis le tiroir ou la fiche. Renvoie les tags du document."""
	require_bureau()
	doc = _config(doctype)["load"](cstr(name), modified)
	DocTags(doc.doctype).remove(doc.name, cstr(tag))
	return _current_tags(doc.doctype, doc.name)


@frappe.whitelist()
def get_bulk_tags(search=None):
	"""Tags existants, pour les proposer à la saisie."""
	require_bureau()
	return frappe.get_list(
		"Tag",
		filters=[["name", "like", f"%{cstr(search).strip()}%"]],
		pluck="name",
		order_by="name asc",
		limit_page_length=LINK_SEARCH_LIMIT,
	)


@frappe.whitelist()
def search_bulk_link(doctype, fieldname, search=None):
	"""Valeurs possibles d'un champ lien, avec les droits de lecture de la personne sur leur DocType."""
	require_bureau()
	df = _editable_field(doctype, cstr(fieldname))
	if df.fieldtype != "Link":
		frappe.throw(_("Ce champ n'est pas un lien."))
	return link_search_values(df.options, search, LINK_SEARCH_LIMIT)
