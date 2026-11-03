# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Saisies hors-ligne de la PWA commerciale : application idempotente d'une file d'actions.

Chaque action porte un identifiant généré par l'appareil. Une action appliquée (ou refusée) est
inscrite dans le journal `Mutation Commercial` : renvoyée une seconde fois (réseau coupé avant la
réponse), elle n'est pas rejouée et le résultat enregistré est rendu.

Une action peut viser un document créé par une action précédente qui n'a pas encore de nom serveur :
le champ `<champ>_ref` contient alors l'identifiant de l'action de création, résolu par le journal.

Réponse par action : `ok` (appliquée), sinon `retry` dit si l'appareil doit réessayer (erreur passagère,
document d'origine pas encore créé) ou abandonner (validation, permission : l'action passe en échec).
"""

import base64
import json

import frappe
from frappe import _
from frappe.model.workflow import apply_workflow
from frappe.utils import cint, cstr, get_datetime, get_fullname, getdate, now_datetime, strip_html, today

from aurescrm.api.commercial_mobile import customer_scope, parse_gps, require_commercial
from aurescrm.custom_permissions import get_customer_edit_status, is_exempt_user

MAX_MUTATIONS = 100
MAX_PHOTO_BYTES = 5 * 1024 * 1024
MAX_ATTACHMENTS = 6
TICKET = "Ticket Commercial"
TICKET_FIELDS = {"priority", "channel", "description", "echeance"}
URGENCE_LEVELS = {"U1", "U2", "U3"}
JOURNAL = "Mutation Commercial"
VISITE = "Visite Commerciale"
RDV = "Rendez Vous Client"
APPEL = "Appel Telephonique"

# Champs d'une visite modifiables depuis l'appareil (le reste est géré par le workflow et le serveur).
VISITE_FIELDS = {
	"type_visite",
	"notes",
	"date_rdv",
	"creance_client",
	"resultat_recouvrement",
	"montant_reclame",
	"montant_encaisse",
	"type_paiement",
	"date_paiement_negociee",
	"date_prochaine_relance",
	"numero_document_paiement",
	"motif_non_paiement",
}
RDV_FIELDS = {"status", "date_heure", "details"}
APPEL_FIELDS = {"status", "type", "notes", "date_rappel", "heure"}


class RetryLater(Exception):
	"""Erreur passagère : l'appareil garde l'action et réessaiera."""


class Refused(Exception):
	"""Action impossible : l'appareil la passe en échec (le commercial peut la corriger ou l'abandonner)."""


# ---------------------------------------------------------------------------
# Point d'entrée
# ---------------------------------------------------------------------------
@frappe.whitelist(methods=["POST"])
def push_mutations(mutations):
	user = require_commercial()
	mutations = frappe.parse_json(mutations) or []
	if not isinstance(mutations, list):
		frappe.throw(_("Format de file d'envoi invalide."))
	if len(mutations) > MAX_MUTATIONS:
		frappe.throw(_("Pas plus de {0} actions par envoi.").format(MAX_MUTATIONS))
	return [process_mutation(user, mutation) for mutation in mutations]


def process_mutation(user, mutation):
	mutation_id = cstr((mutation or {}).get("id")).strip()
	kind = (mutation or {}).get("type")
	payload = (mutation or {}).get("payload") or {}
	if not mutation_id or len(mutation_id) > 140:
		return _result(mutation_id, ok=False, retry=False, error=_("Action sans identifiant."))
	if kind not in MUTATION_TYPES:
		return _result(mutation_id, ok=False, retry=False, error=_("Action inconnue : {0}").format(kind))

	known = frappe.db.get_value(JOURNAL, mutation_id, ["utilisateur", "statut", "resultat", "erreur"], as_dict=True)
	if known:
		if known.utilisateur != user:
			return _result(mutation_id, ok=False, retry=False, error=_("Cette action appartient à un autre compte."))
		return _result(
			mutation_id,
			ok=known.statut == "Appliquée",
			retry=False,
			result=frappe.parse_json(known.resultat) if known.resultat else None,
			error=known.erreur,
			replayed=True,
		)

	frappe.db.savepoint("commercial_mutation")
	try:
		result = MUTATION_TYPES[kind](user, payload) or {}
	except (RetryLater, frappe.TimestampMismatchError, frappe.QueryDeadlockError, frappe.QueryTimeoutError) as error:
		frappe.db.rollback(save_point="commercial_mutation")
		return _result(mutation_id, ok=False, retry=True, error=_message(error))
	except (Refused, frappe.ValidationError, frappe.PermissionError, frappe.DoesNotExistError) as error:
		frappe.db.rollback(save_point="commercial_mutation")
		message = _message(error)
		_journal(user, mutation_id, kind, payload, "Refusée", error=message)
		frappe.db.commit()
		return _result(mutation_id, ok=False, retry=False, error=message)
	except Exception as error:
		frappe.db.rollback(save_point="commercial_mutation")
		frappe.log_error(title=f"PWA commerciale : action {kind}", message=frappe.get_traceback())
		return _result(mutation_id, ok=False, retry=True, error=_message(error))
	finally:
		frappe.local.message_log = []

	_journal(user, mutation_id, kind, payload, "Appliquée", result=result)
	# Chaque action réussie est acquise, même si une suivante du même envoi échoue ou si la requête est coupée.
	frappe.db.commit()
	return _result(mutation_id, ok=True, retry=False, result=result)


def _result(mutation_id, ok, retry, result=None, error=None, replayed=False):
	return {"id": mutation_id, "ok": ok, "retry": retry, "result": result, "error": error, "replayed": replayed}


def _message(error):
	messages = [strip_html(cstr(m.get("message") if isinstance(m, dict) else m)) for m in frappe.local.message_log or []]
	text = strip_html(cstr(error)) or (messages[-1] if messages else "")
	return (text or _("Erreur serveur.")).strip()[:500]


def _journal(user, mutation_id, kind, payload, statut, result=None, error=None):
	doc = frappe.get_doc(
		{
			"doctype": JOURNAL,
			"mutation_id": mutation_id,
			"utilisateur": user,
			"type": kind,
			"statut": statut,
			"reference_doctype": (result or {}).get("doctype"),
			"reference_name": (result or {}).get("name"),
			"cree_sur_appareil": _datetime_or_none(payload.get("created_at")),
			"resultat": json.dumps(result, default=str) if result is not None else None,
			"erreur": error,
		}
	)
	doc.flags.ignore_permissions = True
	doc.insert()


def _datetime_or_none(value):
	try:
		return get_datetime(value) if value else None
	except Exception:
		return None


# ---------------------------------------------------------------------------
# Résolution des références et contrôles de périmètre
# ---------------------------------------------------------------------------
def resolve(user, payload, field, doctype, required=True):
	"""Nom serveur du document visé : `payload[field]`, ou l'action de création `payload[field_ref]`."""
	name = payload.get(field)
	ref = payload.get(f"{field}_ref")
	if not name and ref:
		row = frappe.db.get_value(JOURNAL, {"mutation_id": ref, "utilisateur": user}, ["statut", "reference_name"], as_dict=True)
		if not row:
			# La création n'est pas encore arrivée : elle précède normalement cette action dans la file.
			raise RetryLater(_("Le document d'origine n'est pas encore créé."))
		if row.statut != "Appliquée" or not row.reference_name:
			raise Refused(_("Le document d'origine a été refusé : cette action ne peut pas s'appliquer."))
		name = row.reference_name
	if not name:
		if required:
			raise Refused(_("Document {0} manquant.").format(_(doctype)))
		return None
	if not frappe.db.exists(doctype, name):
		raise RetryLater(_("{0} {1} introuvable.").format(_(doctype), name))
	return name


def assert_client(user, client):
	"""Le client fait partie du portefeuille du commercial."""
	if is_exempt_user(user):
		return
	found = frappe.db.sql(
		f"select c.name from `tabCustomer` c where c.name = %s and {customer_scope('c.name', user)}",
		client,
	)
	if not found:
		raise Refused(_("Le client {0} n'est pas dans votre portefeuille.").format(client))


def own_document(user, doc, owner_field):
	if is_exempt_user(user) or doc.get(owner_field) == user or doc.owner == user:
		return
	raise Refused(_("{0} {1} appartient à un autre commercial.").format(_(doc.doctype), doc.name))


def _set_fields(doc, payload, allowed):
	for field in allowed:
		if field in payload:
			doc.set(field, payload.get(field))


def _created(doc):
	return {"doctype": doc.doctype, "name": doc.name}


# ---------------------------------------------------------------------------
# Visites commerciales (workflow : Nouveau → Démarrer → En Cours → Terminer → Terminé → Annuler)
# ---------------------------------------------------------------------------
def _visite(user, payload, draft=True):
	doc = frappe.get_doc(VISITE, resolve(user, payload, "visite", VISITE))
	own_document(user, doc, "utilisateur")
	if draft and doc.docstatus != 0:
		raise Refused(_("La visite {0} est déjà terminée ou annulée.").format(doc.name))
	return doc


def visite_create(user, payload):
	client = resolve(user, payload, "client", "Customer")
	assert_client(user, client)
	if not payload.get("type_visite"):
		raise Refused(_("Le type de visite est obligatoire."))
	doc = frappe.get_doc(
		{
			"doctype": VISITE,
			"client": client,
			"utilisateur": user,
			"date": getdate(payload.get("date")) if payload.get("date") else today(),
		}
	)
	_set_fields(doc, payload, VISITE_FIELDS)
	doc.insert()
	return _created(doc)


def _start(doc, payload):
	if doc.status != "Nouveau":
		return
	if payload.get("gps"):
		doc.gps_visite = cstr(payload.get("gps"))[:140]
	doc.heure_debut_visite = get_datetime(payload.get("debut")) if payload.get("debut") else now_datetime()
	doc.save()
	# apply_workflow relit le document en base : les champs sont enregistrés avant la transition.
	apply_workflow(doc, "Démarrer")


def visite_start(user, payload):
	doc = _visite(user, payload)
	_start(doc, payload)
	return _created(doc)


def visite_update(user, payload):
	doc = _visite(user, payload)
	_set_fields(doc, payload, VISITE_FIELDS)
	if "date" in payload and doc.status == "Nouveau" and payload.get("date"):
		doc.date = getdate(payload.get("date"))
	doc.save()
	return _created(doc)


def visite_finish(user, payload):
	doc = _visite(user, payload)
	if doc.status == "Nouveau":
		_start(doc, {"gps": payload.get("gps"), "debut": payload.get("debut") or payload.get("fin")})
		doc = frappe.get_doc(VISITE, doc.name)
	_set_fields(doc, payload, VISITE_FIELDS)
	doc.heure_fin_visite = get_datetime(payload.get("fin")) if payload.get("fin") else now_datetime()
	photo = payload.get("photo_document_paiement")
	if photo:
		doc.photo_document_paiement = save_file(doc, photo, "photo_document_paiement")
	doc.save()
	apply_workflow(doc, "Terminer")
	return _created(doc)


def visite_cancel(user, payload):
	doc = _visite(user, payload, draft=False)
	if doc.docstatus == 0:
		# Une visite pas encore terminée n'a pas de transition d'annulation : le brouillon est supprimé
		# (propriété vérifiée par `_visite`).
		frappe.delete_doc(VISITE, doc.name, ignore_permissions=True)
		return {"doctype": VISITE, "name": doc.name, "deleted": 1}
	if doc.docstatus == 1:
		apply_workflow(doc, "Annuler")
	return _created(doc)


def save_file(doc, attachment, fieldname=None):
	"""Fichier pris sur l'appareil ({filename, data : data URL base64}), joint en privé au document."""
	data = cstr(attachment.get("data") if isinstance(attachment, dict) else attachment)
	if "," in data:
		data = data.split(",", 1)[1]
	try:
		content = base64.b64decode(data, validate=True)
	except Exception:
		raise Refused(_("Pièce jointe illisible."))
	if len(content) > MAX_PHOTO_BYTES:
		raise Refused(_("Pièce jointe trop lourde (5 Mo au plus)."))
	default_name = f"{doc.name}-{fieldname or 'piece-jointe'}.jpg"
	filename = cstr(attachment.get("filename") if isinstance(attachment, dict) else "") or default_name
	file_doc = frappe.get_doc(
		{
			"doctype": "File",
			"file_name": filename[:120],
			"attached_to_doctype": doc.doctype,
			"attached_to_name": doc.name,
			"attached_to_field": fieldname,
			"is_private": 1,
			"content": content,
			"decode": False,
		}
	)
	file_doc.insert()
	return file_doc.file_url


# ---------------------------------------------------------------------------
# Rendez-vous et appels
# ---------------------------------------------------------------------------
def rdv_create(user, payload):
	client = resolve(user, payload, "client", "Customer")
	assert_client(user, client)
	if not payload.get("date_heure"):
		raise Refused(_("La date du rendez-vous est obligatoire."))
	doc = frappe.get_doc(
		{
			"doctype": RDV,
			"client": client,
			"raison_sociale": frappe.db.get_value("Customer", client, "customer_name"),
			"statut_client": frappe.db.get_value("Customer", client, "custom_status"),
			"commercial": user,
			"nom_commercial": get_fullname(user),
			"status": payload.get("status") or "En Attente",
		}
	)
	_set_fields(doc, payload, RDV_FIELDS)
	doc.insert()
	return _created(doc)


def rdv_update(user, payload):
	doc = frappe.get_doc(RDV, resolve(user, payload, "rdv", RDV))
	own_document(user, doc, "commercial")
	_set_fields(doc, payload, RDV_FIELDS)
	doc.save()
	return _created(doc)


def appel_create(user, payload):
	client = resolve(user, payload, "client", "Customer", required=False)
	if client:
		assert_client(user, client)
	heure = get_datetime(payload.get("heure")) if payload.get("heure") else now_datetime()
	doc = frappe.get_doc({"doctype": APPEL, "client": client, "utilisateur": user, "date": getdate(heure)})
	_set_fields(doc, payload, APPEL_FIELDS)
	doc.heure = heure
	if not doc.status:
		doc.status = "Répondu"
	doc.insert()
	return _created(doc)


def appel_update(user, payload):
	doc = frappe.get_doc(APPEL, resolve(user, payload, "appel", APPEL))
	own_document(user, doc, "utilisateur")
	_set_fields(doc, payload, APPEL_FIELDS - {"heure"})
	doc.save()
	return _created(doc)


# ---------------------------------------------------------------------------
# Clients : prospect et position GPS
# ---------------------------------------------------------------------------
def prospect_create(user, payload):
	customer_name = cstr(payload.get("customer_name")).strip()
	if not customer_name:
		raise Refused(_("La raison sociale est obligatoire."))
	if frappe.db.exists("Customer", {"customer_name": customer_name.upper()}) or frappe.db.exists(
		"Customer", {"customer_name": customer_name}
	):
		raise Refused(_("Un client « {0} » existe déjà.").format(customer_name))
	lat, lon = parse_gps(payload.get("gps"))
	doc = frappe.get_doc(
		{
			"doctype": "Customer",
			"customer_name": customer_name,
			"customer_type": "Company",
			"custom_status": "Prospect",
			"custom_téléphone": payload.get("telephone"),
			"custom_email": payload.get("email"),
			"custom_wilaya": payload.get("wilaya"),
			"custom_commune": payload.get("commune"),
			"custom_nom_contact_principal": payload.get("contact"),
			"custom_gps": f"{lat}, {lon}" if lat is not None else None,
		}
	)
	# Le hook `set_default_commercial` attribue le prospect à son créateur (legacy + table d'attributions).
	doc.insert()
	return _created(doc)


def client_update_gps(user, payload):
	client = resolve(user, payload, "client", "Customer")
	if not get_customer_edit_status(user, client).get("can_edit"):
		raise Refused(_("Vous ne pouvez pas modifier ce client."))
	lat, lon = parse_gps(payload.get("gps"))
	if lat is None:
		raise Refused(_("Position GPS invalide."))
	# Seul le champ GPS change : pas de sauvegarde complète du Customer (validations ERPNext sans rapport).
	frappe.db.set_value("Customer", client, "custom_gps", f"{lat}, {lon}")
	return {"doctype": "Customer", "name": client}


# ---------------------------------------------------------------------------
# Articles client (codification `<client>-NNN` par aurescrm.utils.custom_item_naming)
# ---------------------------------------------------------------------------
ARTICLE_ITEM_GROUP = "Produits"
ARTICLE_UOM = "Unité"


def _article_default(doctype, preferred, settings_field):
	if frappe.db.exists(doctype, preferred):
		return preferred
	return frappe.db.get_single_value("Stock Settings", settings_field) or preferred


def article_create(user, payload):
	client = resolve(user, payload, "client", "Customer")
	assert_client(user, client)
	designation = cstr(payload.get("designation")).strip()
	if not designation:
		raise Refused(_("La désignation est obligatoire."))
	procede = payload.get("procede")
	procedes = [o for o in (frappe.get_meta("Item").get_field("custom_procédé").options or "").split("\n") if o]
	if procede not in procedes:
		raise Refused(_("Le procédé est obligatoire."))
	if frappe.db.exists("Item", {"custom_client": client, "item_code": designation.upper(), "disabled": 0}):
		raise Refused(_("Le client a déjà un article « {0} ».").format(designation.upper()))
	attachments = payload.get("attachments") or []
	if len(attachments) > MAX_ATTACHMENTS:
		raise Refused(_("{0} pièces jointes au plus.").format(MAX_ATTACHMENTS))
	doc = frappe.get_doc(
		{
			"doctype": "Item",
			"item_code": designation,
			"custom_type_article": "Client",
			"custom_client": client,
			"custom_procédé": procede,
			"custom_code_client": cstr(payload.get("code_client")).strip() or None,
			"custom_consommation_annuelle": cint(payload.get("consommation_annuelle")) or None,
			"item_group": _article_default("Item Group", ARTICLE_ITEM_GROUP, "item_group"),
			"stock_uom": _article_default("UOM", ARTICLE_UOM, "stock_uom"),
			"is_stock_item": 1,
		}
	)
	# Offset : cotations largeur × hauteur × longueur (le texte « Cotations Article » en est déduit) ; sinon H x L libre.
	if procede == "Offset":
		for field in ("largeur", "hauteur", "longueur"):
			doc.set(f"custom_{field}", cint(payload.get(field)) or None)
	else:
		doc.custom_dimensions_h_x_l = cstr(payload.get("dimensions")).strip() or None
	doc.insert()
	# Première photo : visuel de l'article ; le reste (fiche technique, échantillon…) en pièces jointes.
	for index, attachment in enumerate(attachments):
		is_image = cstr(attachment.get("data") if isinstance(attachment, dict) else "").startswith("data:image")
		if index == 0 and is_image:
			doc.db_set("image", save_file(doc, attachment, "image"))
		else:
			save_file(doc, attachment)
	notes = cstr(payload.get("notes")).strip()
	if notes:
		doc.add_comment("Comment", "<p>" + frappe.utils.escape_html(notes).replace("\n", "<br>") + "</p>")
	return _created(doc)


# ---------------------------------------------------------------------------
# Tickets commerciaux (workflow piloté par l'Administration des ventes : le commercial crée et suit)
# ---------------------------------------------------------------------------
def _ticket(user, payload):
	doc = frappe.get_doc(TICKET, resolve(user, payload, "ticket", TICKET))
	own_document(user, doc, "commercial")
	return doc


def ticket_create(user, payload):
	client = resolve(user, payload, "client", "Customer")
	assert_client(user, client)
	for field, label in (("request_type", _("Le type de demande")), ("site", _("Le site de production"))):
		if not payload.get(field):
			raise Refused(_("{0} est obligatoire.").format(label))
	attachments = payload.get("attachments") or []
	if len(attachments) > MAX_ATTACHMENTS:
		raise Refused(_("{0} pièces jointes au plus.").format(MAX_ATTACHMENTS))
	description = cstr(payload.get("description"))
	# Ticket ouvert depuis une visite (réclamation…) : la visite d'origine est citée, le ticket n'a pas de lien dédié.
	visite = resolve(user, payload, "visite", VISITE, required=False)
	if visite:
		description += "<p>" + _("Visite d'origine : {0}").format(visite) + "</p>"
	doc = frappe.get_doc(
		{
			"doctype": TICKET,
			"customer": client,
			"request_type": payload.get("request_type"),
			"site": payload.get("site"),
			"priority": payload.get("priority") or "Moyenne",
			"channel": payload.get("channel"),
			"echeance": payload.get("echeance") or None,
			"description": description or None,
			"commercial": user,
		}
	)
	doc.insert()
	for attachment in attachments:
		save_file(doc, attachment)
	return _created(doc)


def ticket_update(user, payload):
	doc = _ticket(user, payload)
	if doc.docstatus != 0 or doc.status != "Nouveau":
		raise Refused(_("Le ticket {0} est déjà pris en charge : modifiez-le avec l'Administration des ventes.").format(doc.name))
	_set_fields(doc, payload, TICKET_FIELDS)
	doc.save()
	return _created(doc)


def ticket_urgence_request(user, payload):
	from aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial import submit_urgence_request

	doc = _ticket(user, payload)
	niveau = payload.get("niveau")
	if niveau not in URGENCE_LEVELS:
		raise Refused(_("Niveau d'urgence invalide (U1, U2 ou U3)."))
	motif = cstr(payload.get("motif")).strip()
	if not motif:
		raise Refused(_("Le motif de l'urgence est obligatoire."))
	html = "<p>" + frappe.utils.escape_html(motif).replace("\n", "<br>") + "</p>"
	submit_urgence_request(doc.name, niveau, html)
	return _created(doc)


def ticket_urgence_cancel(user, payload):
	from aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial import cancel_urgence_request

	doc = _ticket(user, payload)
	cancel_urgence_request(doc.name)
	return _created(doc)


MUTATION_TYPES = {
	"visite_create": visite_create,
	"visite_start": visite_start,
	"visite_update": visite_update,
	"visite_finish": visite_finish,
	"visite_cancel": visite_cancel,
	"rdv_create": rdv_create,
	"rdv_update": rdv_update,
	"appel_create": appel_create,
	"appel_update": appel_update,
	"prospect_create": prospect_create,
	"article_create": article_create,
	"client_update_gps": client_update_gps,
	"ticket_create": ticket_create,
	"ticket_update": ticket_update,
	"ticket_urgence_request": ticket_urgence_request,
	"ticket_urgence_cancel": ticket_urgence_cancel,
}
