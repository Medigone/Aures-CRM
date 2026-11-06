# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Pièces du dossier d'un ticket : ce qui existe réellement, lu dans les documents liés.

Source unique de la carte de /bureau et de la règle de Terminer. Les champs `checklist_*` du ticket ne se cochent
plus à la main : ils recopient ce calcul, pour le contrôle de Terminer et pour les étapes de la file.
"""

from collections import Counter
from os.path import splitext

import frappe
from frappe import _
from frappe.utils import cint, cstr, flt, format_datetime, get_fullname

TICKET = "Ticket Commercial"
CLOSED = ("Terminé", "Annulé")
RETAINED = "Devis retenu pour commande"
DEMANDE_CANCELLED = "Annulée"
DEMANDE_DRAFT = "Brouillon"
# La demande vit encore : ses études ne sont pas toutes rendues.
DEMANDE_RUNNING = ("Confirmée", "En Cours")
DOSSIER_CANCELLED = "Annulé"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".bmp", ".tif", ".tiff"}
# Une pièce dans l'un de ces états ne bloque pas Terminer.
SATISFIED = ("ok", "wait", "skip")


def _document(doctype, row):
	return {"doctype": doctype, "name": row.get("name"), "status": row.get("status")}


def _piece(key, label, state, required, documents=None, detail="", field=None, **extra):
	return {"key": key, "label": _(label), "state": state, "required": required, "documents": documents or [], "detail": detail, "field": field, **extra}


def _study_summary(etudes):
	counts = Counter(cstr(etude.get("status")).lower() or _("sans statut") for etude in etudes)
	return ", ".join(f"{count} {status}" for status, count in counts.items())


def _article_lines(demandes):
	names = [demande["name"] for demande in demandes]
	if not names:
		return []
	return frappe.get_all("Articles Demande Faisabilite", filters={"parent": ["in", names], "parenttype": "Demande Faisabilite"}, pluck="designation_article", order_by="idx asc")


def _demande_details(demande):
	"""« 2 articles · Études : 1 réalisable, 1 en étude »."""
	count = len(_article_lines([demande]))
	parts = [f"{count} article{'s' if count > 1 else ''}"] if count else []
	if demande.get("etudes"):
		parts.append(f"Études : {_study_summary(demande['etudes'])}")
	return " · ".join(parts)


def _demande_piece(demandes, required, retained):
	cancelled = [demande for demande in demandes if demande.get("status") == DEMANDE_CANCELLED]
	alive = [demande for demande in demandes if demande.get("status") != DEMANDE_CANCELLED]
	counting = [demande for demande in alive if demande.get("status") != DEMANDE_DRAFT]
	documents = [_document("Demande Faisabilite", demande) for demande in alive]
	field = "checklist_bc_demande_faisabilite" if required else None
	if counting:
		state = "wait" if all(demande.get("status") in DEMANDE_RUNNING for demande in counting) else "ok"
		return _piece("demande", "Demande de faisabilité", state, required, documents, " ; ".join(filter(None, map(_demande_details, counting))), field)
	if alive:
		return _piece("demande", "Demande de faisabilité", "missing", required, documents, _("Encore en brouillon : elle compte une fois confirmée."), field)
	if retained:
		return _piece("demande", "Demande de faisabilité", "skip", required, [], _("Sans objet : un devis existant couvre la commande."), field)
	note = _("Une demande annulée.") if len(cancelled) == 1 else _("{0} demandes annulées.").format(len(cancelled)) if cancelled else ""
	return _piece("demande", "Demande de faisabilité", "missing", required, [], note, field, empty=_("Aucune demande pour l'instant"))


def _quotations(demandes):
	quotations = []
	for group in demandes:
		quotations += [row for row in group.get("sales_documents") or [] if row.get("doctype") == "Quotation"]
	return quotations


def _devis_piece(ticket, demandes, required, excluding):
	retained = cstr(ticket.get("devis_rapproche")) if ticket.get("decision_rapprochement") == RETAINED else ""
	alive = [demande for demande in demandes if demande.get("status") != DEMANDE_CANCELLED]
	documents = [_document("Quotation", row) for row in _quotations(alive) if row.get("name") != excluding]
	detail = ""
	if retained and retained != excluding:
		row = frappe.db.get_value("Quotation", retained, ["name", "status", "docstatus", "grand_total"], as_dict=True)
		if row and cint(row.docstatus) != 2:
			documents = [_document("Quotation", row)] + [document for document in documents if document["name"] != retained]
			detail = _("Retenu au rapprochement")
	field = "checklist_bc_devis" if required else None
	if documents:
		return _piece("devis", "Devis", "ok", required, documents, detail, field)
	return _piece("devis", "Devis", "missing" if required else "skip", required, [], "", field, empty=_("Aucun devis pour l'instant"))


def _commande_piece(demandes, dossiers, commande):
	for group in demandes + dossiers:
		for row in group.get("sales_documents") or []:
			if row.get("doctype") == "Sales Order" and cint(row.get("docstatus")) != 2:
				commande = row
				break
	if commande:
		return _piece("commande", "Commande", "ok", False, [_document("Sales Order", commande)])
	return _piece("commande", "Commande", "skip", False, [], _("Pour information : pas requise pour terminer le ticket."), empty=_("Aucune commande"))


def _articles_piece(ticket, field, lines=()):
	"""Les articles d'une demande font foi ; sinon, une vérification signée par une personne."""
	if lines:
		count = len(lines)
		return _piece("articles", "Articles", "ok", True, [], ", ".join(filter(None, lines)), field, summary=f"{count} article{'s' if count > 1 else ''} dans la demande")
	if ticket.get("articles_verifies_par"):
		when = format_datetime(ticket.get("articles_verifies_le"), "dd/MM/yyyy") if ticket.get("articles_verifies_le") else ""
		who = get_fullname(ticket.articles_verifies_par)
		return _piece("articles", "Articles", "ok", True, [], "", field, summary=_("Vérifiés par {0}").format(who) + (f" le {when}" if when else ""), verified=True)
	return _piece("articles", "Articles", "missing", True, [], _("Ajoutez-les à une demande, ou confirmez leur vérification en haut de la fiche."), field, empty=_("Non vérifiés"), can_verify=True)


def _photo_piece(ticket, excluding):
	files = frappe.get_all("File", filters={"attached_to_doctype": TICKET, "attached_to_name": ticket.name, "is_folder": 0}, fields=["name", "file_name", "file_url"])
	photos = [file for file in files if file.name != excluding and splitext(cstr(file.file_name or file.file_url))[1].lower() in IMAGE_EXTENSIONS]
	if photos:
		return _piece("photo", "Photo", "ok", True, [], _("Détectées dans les documents du ticket."), "checklist_rec_photo", summary=f"{len(photos)} photo{'s' if len(photos) > 1 else ''} jointe{'s' if len(photos) > 1 else ''}")
	return _piece("photo", "Photo", "missing", True, [], _("Joignez une image dans les documents du ticket."), "checklist_rec_photo", empty=_("Aucune photo pour l'instant"))


def dossier_pieces(ticket, cycle=None, commande=None, excluding=None):
	"""Les pièces du ticket. `excluding` écarte un document en cours de suppression."""
	from aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial import get_cycle_documents

	cycle = get_cycle_documents(ticket.name) if cycle is None else cycle
	demandes = [row for row in cycle.get("demandes") or [] if row.get("name") != excluding]
	dossiers = [row for row in cycle.get("dossiers") or [] if row.get("name") != excluding]
	request_type = cstr(ticket.get("request_type"))
	retained = ticket.get("decision_rapprochement") == RETAINED and bool(ticket.get("devis_rapproche"))
	pieces = []
	if request_type == "Bon de commande":
		pieces = [_demande_piece(demandes, True, retained), _devis_piece(ticket, demandes, True, excluding), _commande_piece(demandes, dossiers, commande)]
	elif request_type == "Demande de devis":
		alive = [demande for demande in demandes if demande.get("status") != DEMANDE_CANCELLED]
		pieces = [_articles_piece(ticket, "checklist_dd_articles", _article_lines(alive))]
	elif request_type == "Essai Blanc":
		alive = [dossier for dossier in dossiers if dossier.get("status") != DOSSIER_CANCELLED]
		field = "checklist_eb_dossier_essai_blanc"
		dossier = _piece("dossier", "Dossier essai à blanc", "ok", True, [_document("Dossier Essai Blanc", row) for row in alive], "", field) if alive else _piece("dossier", "Dossier essai à blanc", "missing", True, [], "", field, empty=_("Aucun dossier pour l'instant"))
		pieces = [dossier, _articles_piece(ticket, "checklist_eb_articles")]
	elif request_type == "Réclamation":
		quantity = flt(ticket.get("quantites_impactees"))
		pieces = [
			_photo_piece(ticket, excluding),
			_piece("quantites", "Quantités impactées", "ok" if quantity > 0 else "missing", True, [], "", "checklist_rec_quantites", quantity=quantity),
		]
	# Ce qui existe en plus se montre pour information : ces pièces ne bloquent rien.
	keys = {piece["key"] for piece in pieces}
	if demandes and "demande" not in keys and any(demande.get("status") != DEMANDE_CANCELLED for demande in demandes):
		pieces.append(_demande_piece(demandes, False, False))
	if "devis" not in keys:
		devis = _devis_piece(ticket, demandes + dossiers, False, excluding)
		if devis["documents"]:
			pieces.append(devis)
	if "commande" not in keys:
		found = _commande_piece(demandes, dossiers, commande)
		if found["documents"]:
			pieces.append(found)
	return pieces


def apply_pieces(ticket, pieces=None):
	"""Recopie les pièces dans les champs du ticket. Renvoie les pièces."""
	pieces = dossier_pieces(ticket) if pieces is None else pieces
	for piece in pieces:
		if piece.get("field"):
			ticket.set(piece["field"], 1 if piece["state"] in SATISFIED else 0)
	return pieces


def sync_ticket_pieces(ticket_name, excluding=None):
	"""Remet à jour les champs d'un ticket ouvert quand un document lié change, sans toucher à sa date de modification."""
	if not ticket_name or not frappe.db.exists(TICKET, ticket_name):
		return
	ticket = frappe.get_doc(TICKET, ticket_name)
	if cstr(ticket.status) in CLOSED:
		return
	for piece in dossier_pieces(ticket, excluding=excluding):
		field = piece.get("field")
		wanted = 1 if piece["state"] in SATISFIED else 0
		if field and cint(ticket.get(field)) != wanted:
			frappe.db.set_value(TICKET, ticket_name, field, wanted, update_modified=False)


def _tickets_of(doc):
	"""Le ou les tickets concernés par un document lié."""
	if doc.doctype == "File":
		return {doc.attached_to_name} if doc.attached_to_doctype == TICKET else set()
	if doc.doctype == "Quotation":
		demande = doc.get("custom_demande_faisabilité")
		found = frappe.db.get_value("Demande Faisabilite", demande, "ticket_commercial") if demande else None
		retained = frappe.get_all(TICKET, filters={"devis_rapproche": doc.name}, pluck="name")
		return {found, *retained} - {None, ""}
	before = doc.get_doc_before_save()
	return {doc.get("ticket_commercial"), before.get("ticket_commercial") if before else None} - {None, ""}


def on_related_update(doc, method=None):
	for ticket_name in _tickets_of(doc):
		sync_ticket_pieces(ticket_name)


def on_related_trash(doc, method=None):
	for ticket_name in _tickets_of(doc):
		sync_ticket_pieces(ticket_name, excluding=doc.name)
