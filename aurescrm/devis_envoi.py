# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Envoi d'un devis validé au client : PDF « Devis Aures », email, partage depuis la PWA, et suivi sur le devis.

Le commercial est prévenu à la validation (`commercial_events.quotation_push`), puis relancé le lendemain matin si
rien n'est parti. L'envoi s'enregistre sur trois champs du devis (`custom_envoye_le`, `custom_envoye_par`,
`custom_canal_envoi`, modifiables après validation) et dans son fil.

Commerciaux et back office n'ont pas le droit d'imprimer ni d'envoyer un email depuis le Desk : le PDF se produit ici
pour qui lit le devis et fait partie des rôles d'envoi, comme si le droit d'imprimer lui était donné pour ce seul usage.
"""

import frappe
from frappe import _
from frappe.utils import add_days, cstr, escape_html, get_datetime, get_fullname, getdate, now_datetime, today, validate_email_address

DEVIS = "Quotation"
FORMAT = "Devis Aures"
CHAMP_LE = "custom_envoye_le"
CHAMP_PAR = "custom_envoye_par"
CHAMP_CANAL = "custom_canal_envoi"
CANAUX = ("Email", "WhatsApp", "Autre application", "Remis en main propre", "Autre")
A_ENVOYER = ("Open", "Replied", "Partially Ordered")
ROLES_ENVOI = frozenset(
	{"Administrateur Ventes", "Chargé Devis", "Responsable Devis", "Commercial Itinérant", "Commercial Sédentaire", "Superviseur CRM", "System Manager"}
)


def champs_prets():
	"""Les champs d'envoi n'existent qu'après la migration : sans eux, l'envoi ne se propose pas."""
	return frappe.get_meta(DEVIS).has_field(CHAMP_LE)


def peut_envoyer(doc, user=None):
	user = user or frappe.session.user
	if not champs_prets() or doc.docstatus != 1 or doc.status not in A_ENVOYER:
		return False
	if user != "Administrator" and not (ROLES_ENVOI & set(frappe.get_roles(user))):
		return False
	return bool(doc.has_permission("read", user=user))


def etat(doc):
	"""Ce qui est connu de l'envoi : None tant que rien n'est parti, ou si les champs manquent."""
	if not champs_prets() or not doc.get(CHAMP_LE):
		return None
	par = doc.get(CHAMP_PAR)
	return {"le": str(doc.get(CHAMP_LE)), "par": par, "par_nom": get_fullname(par) if par else None, "canal": doc.get(CHAMP_CANAL) or None}


def _devis(name):
	doc = frappe.get_doc(DEVIS, name)
	doc.check_permission("read")
	return doc


def _pour_envoi(name):
	doc = _devis(name)
	if not peut_envoyer(doc):
		frappe.throw(_("Ce devis ne peut pas être envoyé : il doit être validé et encore ouvert."), frappe.PermissionError)
	return doc


def pdf(doc):
	"""Le PDF remis au client. Produit par l'administrateur : le droit de lire le devis a été contrôlé avant."""
	user = frappe.session.user
	frappe.set_user("Administrator")
	try:
		return frappe.get_print(DEVIS, doc.name, FORMAT, doc=doc, as_pdf=True, no_letterhead=1)
	finally:
		frappe.set_user(user)


def _annoncer(doc):
	"""Les champs s'écrivent sans enregistrer le devis : bureau et PWA sont prévenus à la main."""
	from aurescrm import bureau_events, commercial_events

	try:
		bureau_events.announce(doc)
		commercial_events.announce(doc, commercial_events.concerned_users(doc))
	except Exception:
		frappe.log_error(title=f"Envoi du devis {doc.name} : annonce")


def enregistrer(doc, canal, le=None, destinataire=None):
	if canal not in CANAUX:
		frappe.throw(_("Moyen d'envoi inconnu."))
	moment = get_datetime(le) if le else now_datetime()
	if moment.date() > getdate(today()):
		frappe.throw(_("La date d'envoi ne peut pas être dans le futur."))
	user = frappe.session.user
	doc.db_set({CHAMP_LE: moment, CHAMP_PAR: user, CHAMP_CANAL: canal}, update_modified=True)
	texte = _("a envoyé le devis au client par {0}").format(canal.lower() if canal not in ("Email", "WhatsApp") else canal)
	if canal == "Remis en main propre":
		texte = _("a remis le devis au client en main propre")
	if destinataire:
		texte += f" ({destinataire})"
	doc.add_comment("Info", texte)
	_annoncer(doc)
	return etat(doc)


def destinataire_par_defaut(doc):
	"""L'email du contact du devis, sinon celui du client."""
	if doc.get("contact_email"):
		return doc.contact_email
	client = doc.get("custom_id_client") or doc.party_name
	values = frappe.db.get_value("Customer", client, ["custom_email_principal_client", "custom_email", "email_id"], as_dict=True) or {}
	return values.get("custom_email_principal_client") or values.get("custom_email") or values.get("email_id") or None


def telephone_client(doc):
	if doc.get("contact_mobile"):
		return doc.contact_mobile
	client = doc.get("custom_id_client") or doc.party_name
	values = frappe.db.get_value("Customer", client, ["custom_nº_téléphone_principal", "custom_téléphone", "mobile_no"], as_dict=True) or {}
	return values.get("custom_nº_téléphone_principal") or values.get("custom_téléphone") or values.get("mobile_no") or None


def message_par_defaut(doc):
	nom = get_fullname(frappe.session.user)
	validite = f" Il est valable jusqu'au {frappe.utils.formatdate(doc.valid_till, 'dd/MM/yyyy')}." if doc.valid_till else ""
	return f"Bonjour,\n\nVeuillez trouver ci-joint notre devis {doc.name}.{validite}\n\nNous restons à votre disposition pour toute question.\n\nCordialement,\n{nom}\nAures Emballages"


def envoyer_email(doc, destinataire, message=None):
	destinataire = cstr(destinataire).strip()
	if not destinataire or not validate_email_address(destinataire):
		frappe.throw(_("Adresse email du client invalide."))
	texte = cstr(message).strip() or message_par_defaut(doc)
	expediteur = frappe.db.get_value("User", frappe.session.user, "email")
	frappe.sendmail(
		recipients=[destinataire],
		subject=_("Devis {0} · Aures Emballages").format(doc.name),
		message=escape_html(texte).replace("\n", "<br>"),
		reply_to=expediteur or None,
		attachments=[{"fname": f"{doc.name}.pdf", "fcontent": pdf(doc)}],
		reference_doctype=DEVIS,
		reference_name=doc.name,
	)
	return enregistrer(doc, "Email", destinataire=destinataire)


# ---------------------------------------------------------------------------
# Relance du lendemain (planificateur)
# ---------------------------------------------------------------------------
def a_relancer(jour=None):
	"""Devis validés la veille, encore ouverts et jamais envoyés."""
	if not champs_prets():
		return []
	jour = getdate(jour or today())
	veille = add_days(jour, -1)
	versions = frappe.get_all(
		"Version",
		filters={"ref_doctype": DEVIS, "creation": ["between", [f"{veille} 00:00:00", f"{veille} 23:59:59"]], "data": ["like", '%["docstatus",0,1]%']},
		pluck="docname",
	)
	if not versions:
		return []
	return frappe.get_all(DEVIS, filters={"name": ["in", list(set(versions))], "docstatus": 1, "status": ["in", A_ENVOYER], CHAMP_LE: ["is", "not set"]}, pluck="name")


def relancer():
	from aurescrm.commercial_events import concerned_users, notify

	for name in a_relancer():
		try:
			doc = frappe.get_doc(DEVIS, name)
			notify(concerned_users(doc), "devis", "Devis toujours à envoyer", f"{doc.customer_name or doc.party_name} · validé hier", f"/devis/{doc.name}", f"devis:{doc.name}")
		except Exception:
			frappe.log_error(title=f"Relance d'envoi du devis {name}")
