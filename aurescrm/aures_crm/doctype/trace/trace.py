# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import os
import re

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, cstr, today

EN_SERVICE = "En service"
OBSOLETE = "Obsolète"
# Études encore ouvertes : elles suivent la nouvelle version du tracé.
ETUDES_OUVERTES = ("Nouveau", "En étude")


def has_versions():
	"""Les champs de version n'existent qu'une fois la migration passée."""
	return frappe.get_meta("Trace").has_field("statut")


def current_filters(article):
	"""Filtre du tracé en service d'un article : une seule version l'est à la fois."""
	filters = {"article": article}
	if has_versions():
		filters["statut"] = EN_SERVICE
	return filters


def current_trace(article, fields="name", as_dict=False):
	if not article:
		return None
	return frappe.db.get_value("Trace", current_filters(article), fields, as_dict=as_dict, order_by="creation desc")


class Trace(Document):
	def before_insert(self):
		if has_versions():
			self.ver = cint(self.ver) or 1
			self.statut = self.statut or EN_SERVICE
			if self.statut == EN_SERVICE and not self.date_activation:
				self.date_activation = today()

	def validate(self):
		self.validate_unique_article()
	
	def after_save(self):
		"""Met à jour les points de colle de l'Etude Faisabilite liée après sauvegarde"""
		self.update_etude_faisabilite_points_colle()
		
	def validate_unique_article(self):
		"""Un article n'a qu'un tracé en service ; ses anciennes versions restent, obsolètes."""
		if not self.article or (has_versions() and self.statut == OBSOLETE):
			return
		existing_trace = frappe.db.exists("Trace", {**current_filters(self.article), "name": ["!=", self.name]})
		if existing_trace:
			frappe.throw(
				msg=_("Cet article a déjà un tracé en service : {0}. Créez-en une nouvelle version.").format(existing_trace),
				title=_("Article déjà tracé"),
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


def _resolve_attached_file(doctype, docname, fieldname, file_url):
	"""Retrouve le document File source (préférence: pièce jointe sur le document)."""
	row = frappe.db.get_value(
		"File",
		{
			"attached_to_doctype": doctype,
			"attached_to_name": docname,
			"attached_to_field": fieldname,
		},
		["name"],
		as_dict=True,
	)
	if row and row.get("name"):
		return frappe.get_doc("File", row["name"])

	if not file_url:
		return None

	name = frappe.db.get_value("File", {"file_url": file_url}, "name")
	if name:
		return frappe.get_doc("File", name)

	# file_url peut varier légèrement (slash initial)
	base = (file_url or "").rstrip("/")
	if base.startswith("/"):
		alt = base.lstrip("/")
	else:
		alt = "/" + base
	for url in {file_url, base, alt}:
		if not url:
			continue
		name = frappe.db.get_value("File", {"file_url": url}, "name")
		if name:
			return frappe.get_doc("File", name)

	return None


def _copy_and_rename_attached_file(doctype, src_docname, fieldname, file_url, new_docname, article):
	"""Copie le fichier attaché vers un nouveau File, renommé {new_docname}-{item_name}.{ext}."""
	src_file = _resolve_attached_file(doctype, src_docname, fieldname, file_url)
	if not src_file:
		return None

	try:
		content = src_file.get_content()
	except Exception:
		frappe.log_error(title=f"duplicate {doctype} lecture fichier source")
		return None

	item_name = frappe.db.get_value("Item", article, "item_name") or article
	safe_item = re.sub(r'[\\/:*?"<>|]', "_", str(item_name)).strip() or article
	_, ext = os.path.splitext(src_file.file_name or "")
	if not ext and file_url:
		_, ext = os.path.splitext(file_url.split("/")[-1])
	new_filename = f"{new_docname}-{safe_item}{ext}"

	new_file = frappe.get_doc(
		{
			"doctype": "File",
			"file_name": new_filename,
			"is_private": src_file.is_private,
			"content": content,
			"attached_to_doctype": doctype,
			"attached_to_name": new_docname,
			"attached_to_field": fieldname,
		}
	)
	new_file.save()
	return new_file.file_url


def _copy_and_rename_trace_file(src_trace_name, fichier_trace_url, new_trace_name, article):
	"""Copie le fichier liaison tracé vers un nouveau File, renommé {trace}-{item_name}.{ext}."""
	return _copy_and_rename_attached_file(
		"Trace", src_trace_name, "fichier_trace", fichier_trace_url, new_trace_name, article
	)


@frappe.whitelist()
def get_trace_for_article(article):
	"""Retourne le tracé unique lié à un article (métadonnées + nom affichable du fichier)."""
	if not article:
		return None

	row = current_trace(article, ["name", "dimensions", "points_colle", "fichier_trace"], as_dict=True)
	if not row:
		return None

	fichier_trace_name = ""
	if row.get("fichier_trace"):
		fichier_trace_name = os.path.basename(row["fichier_trace"].rstrip("/"))

	row["fichier_trace_name"] = fichier_trace_name
	row["impositions_count"] = frappe.db.count("Imposition", live_impositions_filters(row["name"]))
	return row


# Champs copiés d'une imposition source vers sa copie (defaut est recalculé par hook).
IMPOSITION_COPY_FIELDS = (
	"procede",
	"format_imp",
	"laize_pal",
	"format_laize_palette",
	"forme_decoupe",
	"nbr_poses",
	"taux_chutes",
	"format_laize",
	"format_developpement",
)


def _duplicate_impositions_for_trace(src_trace_name, new_trace_name, client, article):
	"""Duplique toutes les impositions du tracé source vers le nouveau tracé/article.

	Retourne (liste des impositions créées, nom de la copie de l'imposition idéale).
	"""
	src_impositions = frappe.get_all(
		"Imposition",
		filters=live_impositions_filters(src_trace_name),
		fields=["name"],
		order_by="creation asc",
	)

	created = []
	source_default_copy = None
	for row in src_impositions:
		src_imp = frappe.get_doc("Imposition", row.name)
		new_imp = frappe.new_doc("Imposition")
		new_imp.client = client
		new_imp.article = article
		new_imp.trace = new_trace_name
		for fieldname in IMPOSITION_COPY_FIELDS:
			new_imp.set(fieldname, src_imp.get(fieldname))
		new_imp.insert()

		file_copied = False
		if src_imp.fichier_imp:
			file_url = _copy_and_rename_attached_file(
				"Imposition", src_imp.name, "fichier_imp", src_imp.fichier_imp, new_imp.name, article
			)
			if file_url:
				new_imp.fichier_imp = file_url
				new_imp.save()
				file_copied = True

		created.append({"name": new_imp.name, "source": src_imp.name, "file_copied": file_copied})
		if src_imp.defaut:
			source_default_copy = new_imp.name

	ideale = None
	if created:
		# Le hook on_update recalcule le flag "Idéale" sur la nouvelle combinaison :
		# on lui fait confiance en priorité pour rester cohérent avec le badge UI.
		ideale = frappe.db.get_value(
			"Imposition", {"trace": new_trace_name, "defaut": 1}, "name"
		)
		if not ideale:
			ideale = source_default_copy or created[0]["name"]

	return created, ideale


@frappe.whitelist()
def duplicate_trace_from_reference(
	source_trace,
	client,
	article,
	article_reference,
	dimensions=None,
	points_colle=None,
	duplicate_impositions=0,
):
	"""
	Duplique un tracé existant vers un nouvel article (même client).
	`article` = article cible (étude en cours), `article_reference` = article source (tracé à copier).
	Si `duplicate_impositions` est vrai, les impositions du tracé source sont
	également dupliquées (nouveaux codes IMP-... générés automatiquement).
	"""
	if not article_reference:
		frappe.throw(_("Veuillez sélectionner un article de référence."))

	if not article:
		frappe.throw(_("Article cible manquant."))

	if article_reference == article:
		frappe.throw(_("L'article de référence doit être différent de l'article courant."))

	if frappe.db.exists("Trace", current_filters(article)):
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

	impositions_created = []
	imposition_ideale = None
	if cint(duplicate_impositions):
		impositions_created, imposition_ideale = _duplicate_impositions_for_trace(
			src.name, new_trace.name, client, article
		)

	return {
		"name": new_trace.name,
		"fichier_trace": new_trace.fichier_trace,
		"dimensions": new_trace.dimensions,
		"points_colle": new_trace.points_colle,
		"file_copied": bool(file_url),
		"impositions": impositions_created,
		"imposition_ideale": imposition_ideale,
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


def live_impositions_filters(trace):
	"""Impositions encore valables d'un tracé : celles d'une version remplacée sont à refaire."""
	filters = {"trace": trace}
	if frappe.get_meta("Imposition").has_field("obsolete"):
		filters["obsolete"] = 0
	return filters


def create_version(source, desc_changements, dimensions=None, points_colle=None):
	"""Met en service une nouvelle version du tracé, tout de suite, comme une maquette activée.

	L'ancienne devient obsolète, ses impositions aussi (à refaire, jamais idéales), sa forme de
	découpe est signalée à refaire, et les études encore ouvertes passent sur la nouvelle version.
	Le fichier est recopié : il reste à le remplacer si le dessin a changé.
	"""
	if not has_versions():
		frappe.throw(_("Les versions de tracé attendent la migration du site."))
	if source.statut != EN_SERVICE:
		frappe.throw(_("Seule la version en service d'un tracé reçoit une nouvelle version : {0} est obsolète.").format(source.name))
	desc = cstr(desc_changements).strip()
	if not desc:
		frappe.throw(_("Décrivez ce qui change dans cette version."))
	dimensions = cstr(dimensions).strip() or source.dimensions
	points = source.points_colle if points_colle in (None, "") else cint(points_colle)
	ver = cint(frappe.db.sql("select max(ver) from `tabTrace` where article=%s", source.article)[0][0]) + 1

	# L'ancienne sort de service d'abord : la règle d'un seul tracé en service est vérifiée à l'insertion.
	frappe.db.set_value("Trace", source.name, "statut", OBSOLETE)
	new = frappe.new_doc("Trace")
	new.update({
		"client": source.client,
		"article": source.article,
		"procede": source.procede,
		"dimensions": dimensions,
		"points_colle": points,
		"ver": ver,
		"statut": EN_SERVICE,
		"date_activation": today(),
		"version_origine": source.name,
		"desc_changements": desc,
	})
	new.insert()
	if source.fichier_trace:
		url = _copy_and_rename_trace_file(source.name, source.fichier_trace, new.name, source.article)
		if url:
			new.db_set("fichier_trace", url)
	frappe.db.set_value("Trace", source.name, "remplacee_par", new.name)

	impositions = frappe.get_all("Imposition", filters=live_impositions_filters(source.name), pluck="name")
	if impositions and frappe.get_meta("Imposition").has_field("obsolete"):
		values = {"obsolete": 1, "defaut": 0}
		if frappe.get_meta("Imposition").has_field("ideale_manuelle"):
			values["ideale_manuelle"] = 0
		for name in impositions:
			frappe.db.set_value("Imposition", name, values)
	formes = []
	if frappe.get_meta("Forme Decoupe").has_field("a_refaire"):
		formes = frappe.get_all("Forme Decoupe", filters={"trace": source.name, "a_refaire": 0}, pluck="name")
		for name in formes:
			frappe.db.set_value("Forme Decoupe", name, "a_refaire", 1)

	etudes = _move_open_studies(source, new)
	if source.procede != "Flexo" and dimensions != source.dimensions:
		from aurescrm import item_cotations

		item_cotations.apply_cotations_from_user_string(source.article, dimensions, ignore_permissions=True)

	frappe.get_doc("Trace", source.name).add_comment("Info", _("Remplacé par la version {0} : {1}").format(ver, new.name))
	return {"name": new.name, "ver": ver, "impositions": len(impositions), "formes": formes, "etudes": etudes}


def _move_open_studies(source, new):
	"""Les études pas encore conclues passent sur la nouvelle version ; leur imposition est à refaire."""
	moved = []
	for doctype in ("Etude Faisabilite", "Etude Faisabilite Flexo"):
		rows = frappe.get_all(doctype, filters={"trace": source.name, "status": ["in", ETUDES_OUVERTES]}, pluck="name")
		for name in rows:
			values = {"trace": new.name, "fichier_trace": new.fichier_trace}
			if doctype == "Etude Faisabilite":
				values.update({"imposition": None, "fichier_imp": None, "taux_chutes": 0, "nbr_feuilles": 0, "points_colle": cint(new.points_colle)})
			frappe.db.set_value(doctype, name, values)
			text = _("Tracé passé à la version {0} ({1}) : l'imposition est à refaire.") if doctype == "Etude Faisabilite" else _("Tracé passé à la version {0} ({1}).")
			frappe.get_doc(doctype, name).add_comment("Info", text.format(new.ver, new.name))
			moved.append(name)
	return moved
