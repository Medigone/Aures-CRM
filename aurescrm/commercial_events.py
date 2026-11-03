# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Événements de la PWA commerciale, branchés sur `on_change` / `on_trash` de tous les DocTypes (hooks « * »).

Pour chaque document suivi :
- **temps réel** : les commerciaux concernés (attribution du client, champs utilisateur du document) reçoivent
  `aures_commercial_update` après le commit. Le message ne porte que des identifiants : l'appareil recharge son
  instantané par l'API, qui applique le périmètre ;
- **push** : quelques changements utiles au terrain (urgence décidée, ticket pris en charge, devis validé, BAT,
  commande confirmée, production terminée, réclamation traitée) partent en notification, sauf à leur auteur.

Rien ici ne doit bloquer une sauvegarde : une erreur est journalisée, jamais levée.
"""

import frappe
from frappe.utils import cint, fmt_money

REALTIME_EVENT = "aures_commercial_update"
_LOCAL_KEY = "aures_commercial_realtime"

# DocType → (champ client, champs utilisateur directement concernés).
WATCHED = {
	"Customer": ("name", ("custom_commercial_attribué",)),
	"Visite Commerciale": ("client", ("utilisateur",)),
	"Rendez Vous Client": ("client", ("commercial",)),
	"Appel Telephonique": ("client", ("utilisateur",)),
	"Ticket Commercial": ("customer", ("commercial",)),
	"Quotation": ("party_name", ()),
	"Sales Order": ("customer", ()),
	"Reclamations Clients": ("client", ("id_commercial",)),
	"BAT": ("client", ()),
	"Maquette": ("client", ()),
	"Creance Client": ("client", ("commercial",)),
	"Ordre de Production": ("client", ()),
	"Dossier Fabrication": ("client", ()),
	"Etude Technique": ("client", ()),
	"Item": ("custom_client", ()),
	"Pilotage Commercial": (None, ("user",)),
}


def _muted():
	flags = frappe.flags
	return bool(flags.in_migrate or flags.in_patch or flags.in_install or flags.in_import or flags.in_test)


def commercials_of(customer):
	"""Commerciaux d'un client : attribution legacy et table d'attributions (toutes sociétés)."""
	if not customer:
		return set()
	rows = frappe.db.sql(
		"""
		select `custom_commercial_attribué` from `tabCustomer` where name = %(c)s
		union
		select commercial from `tabCustomer Commercial Assignment`
		where parent = %(c)s and parenttype = 'Customer' and parentfield = 'custom_commercial_assignments'
		""",
		{"c": customer},
	)
	return {row[0] for row in rows if row[0]}


def concerned_users(doc):
	customer_field, user_fields = WATCHED[doc.doctype]
	users = {doc.get(field) for field in user_fields if doc.get(field)}
	if customer_field:
		if doc.doctype == "Quotation" and doc.get("quotation_to") != "Customer":
			return users
		users |= commercials_of(doc.get(customer_field))
	users.discard("Guest")
	return users


# ---------------------------------------------------------------------------
# Points d'entrée (hooks)
# ---------------------------------------------------------------------------
def on_change(doc, method=None):
	if doc.doctype not in WATCHED or _muted():
		return
	try:
		users = concerned_users(doc)
		announce(doc, users)
		trigger = PUSH_TRIGGERS.get(doc.doctype)
		if trigger:
			trigger(doc, doc.get_doc_before_save(), users)
	except Exception:
		frappe.log_error(title=f"PWA commerciale : événement {doc.doctype}")


def on_trash(doc, method=None):
	if doc.doctype not in WATCHED or _muted():
		return
	try:
		announce(doc, concerned_users(doc), deleted=True)
	except Exception:
		frappe.log_error(title=f"PWA commerciale : suppression {doc.doctype}")


# ---------------------------------------------------------------------------
# Temps réel
# ---------------------------------------------------------------------------
def announce(doc, users, deleted=False):
	"""Un message par document et par utilisateur dans la requête, envoyé après le commit."""
	sent = getattr(frappe.local, _LOCAL_KEY, None)
	if sent is None:
		sent = set()
		setattr(frappe.local, _LOCAL_KEY, sent)
	message = {"doctype": doc.doctype, "name": doc.name, "by": frappe.session.user, "deleted": int(deleted)}
	for user in users:
		key = (user, doc.doctype, doc.name)
		if key in sent:
			continue
		sent.add(key)
		frappe.publish_realtime(REALTIME_EVENT, message, user=user, after_commit=True)


# ---------------------------------------------------------------------------
# Notifications push
# ---------------------------------------------------------------------------
def notify(users, categorie, title, body, path, tag):
	"""Push aux destinataires, sauf l'auteur du changement (il le voit déjà)."""
	from aurescrm.push.service import APP_COMMERCIAL, enqueue_push

	recipients = [u for u in users if u and u != frappe.session.user]
	if recipients:
		enqueue_push(recipients, APP_COMMERCIAL, categorie, title, body, url=f"/commercial{path}", tag=tag)


def _changed(doc, before, field):
	return (before.get(field) if before else None) != doc.get(field)


def _submitted(doc, before):
	return doc.docstatus == 1 and (not before or before.docstatus == 0)


def ticket_push(doc, before, users):
	if not before:
		return
	recipients = {doc.commercial} if doc.commercial else users
	label = f"{doc.request_type or 'Ticket'} · {doc.customer_name or doc.customer}"
	path = f"/tickets/{doc.name}"
	tag = f"ticket:{doc.name}"
	if _changed(doc, before, "statut_demande_urgence") and doc.statut_demande_urgence in ("Validée", "Refusée"):
		title = f"Urgence {doc.niveau_urgence} validée" if doc.statut_demande_urgence == "Validée" else "Urgence refusée"
		return notify(recipients, "tickets", title, label, path, tag)
	if not _changed(doc, before, "status"):
		return
	if doc.status == "En Cours" and before.status == "Nouveau":
		who = f" par {doc.assigne_a_nom}" if doc.assigne_a_nom else ""
		notify(recipients, "tickets", f"Ticket pris en charge{who}", label, path, tag)
	elif doc.status == "Blocage Créance":
		notify(recipients, "tickets", "Ticket bloqué : créance", label, path, tag)
	elif doc.status == "Terminé":
		notify(recipients, "tickets", "Ticket terminé", label, path, tag)


def quotation_push(doc, before, users):
	if not _submitted(doc, before):
		return
	montant = fmt_money(doc.grand_total, currency=doc.currency)
	notify(users, "devis", "Devis validé", f"{doc.customer_name or doc.party_name} · {montant}", f"/devis/{doc.name}", f"devis:{doc.name}")


def sales_order_push(doc, before, users):
	if not _submitted(doc, before):
		return
	bc = f" · BC {doc.custom_bon_de_commande_client}" if doc.get("custom_bon_de_commande_client") else ""
	notify(users, "commandes", "Commande confirmée", f"{doc.customer_name or doc.customer}{bc}", f"/commandes/{doc.name}", f"commande:{doc.name}")


def bat_push(doc, before, users):
	designation = doc.get("designation_article") or doc.article
	client = doc.get("nom_client") or doc.client
	path = f"/articles/{doc.article}" if doc.article else "/"
	tag = f"bat:{doc.name}"
	if not before:
		return notify(users, "bat", "Nouveau BAT à faire valider", f"{client} · {designation}", path, tag)
	if _changed(doc, before, "status") and doc.status in ("BAT-E Validé", "BAT-P Validé"):
		notify(users, "bat", doc.status, f"{client} · {designation}", path, tag)


def production_push(doc, before, users):
	if not before or not _changed(doc, before, "status") or doc.status != "Terminé" or not doc.sales_order:
		return
	quantite = f" · {cint(doc.quantite_produite)} produits" if doc.get("quantite_produite") else ""
	notify(
		users,
		"commandes",
		"Production terminée",
		f"{doc.client or ''} · {doc.article or doc.name}{quantite}",
		f"/commandes/{doc.sales_order}",
		f"production:{doc.name}",
	)


def reclamation_push(doc, before, users):
	if not before or not _changed(doc, before, "status") or doc.status not in ("Traité", "Non Traité"):
		return
	recipients = {doc.id_commercial} if doc.get("id_commercial") else users
	title = "Réclamation traitée" if doc.status == "Traité" else "Réclamation non traitée"
	notify(
		recipients,
		"reclamations",
		title,
		f"{doc.get('nom_client') or doc.client} · {doc.type_reclamation or ''}",
		f"/reclamations/{doc.name}",
		f"reclamation:{doc.name}",
	)


PUSH_TRIGGERS = {
	"Ticket Commercial": ticket_push,
	"Quotation": quotation_push,
	"Sales Order": sales_order_push,
	"BAT": bat_push,
	"Ordre de Production": production_push,
	"Reclamations Clients": reclamation_push,
}
