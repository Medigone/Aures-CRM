# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import os
import re

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint


class Trace(Document):
	def validate(self):
		self.validate_unique_article()
	
	def after_save(self):
		"""Met à jour les points de colle de l'Etude Faisabilite liée après sauvegarde"""
		self.update_etude_faisabilite_points_colle()
		
	def validate_unique_article(self):
		if self.article:
			existing_trace = frappe.db.exists("Trace", {
				"article": self.article,
				"name": ["!=", self.name]
			})
			
			if existing_trace:
				frappe.throw(
					msg=f"Cet article possède déjà un trace.",
					title="Article déjà tracé",
				)
	
	def update_etude_faisabilite_points_colle(self):
		"""Met à jour les points de colle dans toutes les Etudes Faisabilite liées à ce Trace"""
		# Trouver toutes les Etudes Faisabilite qui utilisent ce Trace
		etudes = frappe.get_all(
			"Etude Faisabilite",
			filters={"trace": self.name},
			fields=["name"]
		)
		
		# Mettre à jour les points_colle pour chaque étude trouvée
		for etude in etudes:
			frappe.db.set_value(
				"Etude Faisabilite",
				etude.name,
				"points_colle",
				self.points_colle or 0,
				update_modified=False
			)


def _resolve_file_for_trace_fichier(src_trace_name, fichier_trace_url):
	"""Retrouve le document File du tracé source (préférence: pièce jointe sur Trace)."""
	row = frappe.db.get_value(
		"File",
		{
			"attached_to_doctype": "Trace",
			"attached_to_name": src_trace_name,
			"attached_to_field": "fichier_trace",
		},
		["name"],
		as_dict=True,
	)
	if row and row.get("name"):
		return frappe.get_doc("File", row["name"])

	if not fichier_trace_url:
		return None

	name = frappe.db.get_value("File", {"file_url": fichier_trace_url}, "name")
	if name:
		return frappe.get_doc("File", name)

	# file_url peut varier légèrement (slash initial)
	base = (fichier_trace_url or "").rstrip("/")
	if base.startswith("/"):
		alt = base.lstrip("/")
	else:
		alt = "/" + base
	for url in {fichier_trace_url, base, alt}:
		if not url:
			continue
		name = frappe.db.get_value("File", {"file_url": url}, "name")
		if name:
			return frappe.get_doc("File", name)

	return None


def _copy_and_rename_trace_file(src_trace_name, fichier_trace_url, new_trace_name, article):
	"""Copie le fichier liaison tracé vers un nouveau File, renommé {trace}-{item_name}.{ext}."""
	src_file = _resolve_file_for_trace_fichier(src_trace_name, fichier_trace_url)
	if not src_file:
		return None

	try:
		content = src_file.get_content()
	except Exception:
		frappe.log_error(title="duplicate_trace lecture fichier source")
		return None

	item_name = frappe.db.get_value("Item", article, "item_name") or article
	safe_item = re.sub(r'[\\/:*?"<>|]', "_", str(item_name)).strip() or article
	_, ext = os.path.splitext(src_file.file_name or "")
	if not ext and fichier_trace_url:
		_, ext = os.path.splitext(fichier_trace_url.split("/")[-1])
	new_filename = f"{new_trace_name}-{safe_item}{ext}"

	new_file = frappe.get_doc(
		{
			"doctype": "File",
			"file_name": new_filename,
			"is_private": src_file.is_private,
			"content": content,
			"attached_to_doctype": "Trace",
			"attached_to_name": new_trace_name,
			"attached_to_field": "fichier_trace",
		}
	)
	new_file.save()
	return new_file.file_url


@frappe.whitelist()
def get_trace_for_article(article):
	"""Retourne le tracé unique lié à un article (métadonnées + nom affichable du fichier)."""
	if not article:
		return None

	row = frappe.db.get_value(
		"Trace",
		{"article": article},
		["name", "dimensions", "points_colle", "fichier_trace"],
		as_dict=True,
	)
	if not row:
		return None

	fichier_trace_name = ""
	if row.get("fichier_trace"):
		fichier_trace_name = os.path.basename(row["fichier_trace"].rstrip("/"))

	row["fichier_trace_name"] = fichier_trace_name
	return row


@frappe.whitelist()
def duplicate_trace_from_reference(
	source_trace,
	client,
	article,
	article_reference,
	dimensions=None,
	points_colle=None,
):
	"""
	Duplique un tracé existant vers un nouvel article (même client).
	`article` = article cible (étude en cours), `article_reference` = article source (tracé à copier).
	"""
	if not article_reference:
		frappe.throw(_("Veuillez sélectionner un article de référence."))

	if not article:
		frappe.throw(_("Article cible manquant."))

	if article_reference == article:
		frappe.throw(_("L'article de référence doit être différent de l'article courant."))

	if frappe.db.exists("Trace", {"article": article}):
		frappe.throw(
			_("Cet article possède déjà un tracé."),
			title=_("Article déjà tracé"),
		)

	src = frappe.get_doc("Trace", source_trace)
	if src.article != article_reference:
		frappe.throw(_("Le tracé source ne correspond pas à l'article de référence."))

	if src.client != client:
		frappe.throw(_("Le tracé source n'appartient pas au même client."))

	# Cohérence article cible / client (item lié au client de l'étude)
	item_client = frappe.db.get_value("Item", article, "custom_client")
	if item_client and item_client != client:
		frappe.throw(_("L'article cible n'appartient pas au client sélectionné."))

	ref_item_client = frappe.db.get_value("Item", article_reference, "custom_client")
	if ref_item_client and ref_item_client != client:
		frappe.throw(_("L'article de référence n'appartient pas au client sélectionné."))

	new_trace = frappe.new_doc("Trace")
	new_trace.client = client
	new_trace.article = article
	new_trace.dimensions = dimensions or src.dimensions
	pc = points_colle
	if pc not in (None, ""):
		new_trace.points_colle = cint(pc)
	else:
		new_trace.points_colle = src.points_colle or 0

	new_trace.insert()

	file_url = None
	if src.fichier_trace:
		file_url = _copy_and_rename_trace_file(src.name, src.fichier_trace, new_trace.name, article)
		if file_url:
			new_trace.fichier_trace = file_url
			new_trace.save()

	return {
		"name": new_trace.name,
		"fichier_trace": new_trace.fichier_trace,
		"dimensions": new_trace.dimensions,
		"points_colle": new_trace.points_colle,
		"file_copied": bool(file_url),
	}


@frappe.whitelist()
def sync_points_colle_to_etude(trace_name, etude_faisabilite_name):
	"""
	Synchronise les points de colle du Trace vers l'Etude Faisabilite
	Cette méthode est appelée depuis le JavaScript après création/mise à jour d'un Trace
	"""
	try:
		# Récupérer le Trace
		trace = frappe.get_doc("Trace", trace_name)
		
		# Mettre à jour l'Etude Faisabilite
		frappe.db.set_value(
			"Etude Faisabilite",
			etude_faisabilite_name,
			"points_colle",
			trace.points_colle or 0,
			update_modified=False
		)
		
		return {
			"success": True,
			"points_colle": trace.points_colle or 0
		}
	except Exception as e:
		frappe.log_error(message=str(e), title="Erreur sync_points_colle_to_etude")
		return {
			"success": False,
			"error": str(e)
		}
