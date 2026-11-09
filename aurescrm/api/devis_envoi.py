# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Envoi d'un devis au client, depuis la PWA commerciale ou le bureau. Les règles sont dans `aurescrm/devis_envoi.py`."""

import frappe
from frappe import _

from aurescrm import devis_envoi


def _connecte():
	if frappe.session.user == "Guest":
		raise frappe.PermissionError(_("Connexion requise."))


@frappe.whitelist()
def get_envoi(name):
	"""Ce qu'il faut pour envoyer : droit, état de l'envoi, email et téléphone du client, message proposé."""
	_connecte()
	doc = devis_envoi._devis(name)
	return {
		"name": doc.name,
		"peut_envoyer": devis_envoi.peut_envoyer(doc),
		"envoi": devis_envoi.etat(doc),
		"email": devis_envoi.destinataire_par_defaut(doc),
		"telephone": devis_envoi.telephone_client(doc),
		"message": devis_envoi.message_par_defaut(doc),
		"canaux": list(devis_envoi.CANAUX),
	}


@frappe.whitelist()
def get_devis_pdf(name):
	"""Le PDF « Devis Aures », à partager : pour qui lit le devis et fait partie des rôles d'envoi."""
	_connecte()
	doc = devis_envoi._devis(name)
	if not (devis_envoi.peut_envoyer(doc) or doc.has_permission("print")):
		frappe.throw(_("Vous ne pouvez pas obtenir le PDF de ce devis."), frappe.PermissionError)
	frappe.local.response.filename = f"{doc.name}.pdf"
	frappe.local.response.filecontent = devis_envoi.pdf(doc)
	frappe.local.response.type = "pdf"


@frappe.whitelist(methods=["POST"])
def send_devis_email(name, destinataire, message=None):
	_connecte()
	doc = devis_envoi._pour_envoi(name)
	return {"envoi": devis_envoi.envoyer_email(doc, destinataire, message)}


@frappe.whitelist(methods=["POST"])
def mark_devis_sent(name, canal, le=None):
	"""Envoi fait hors du serveur : partage depuis le téléphone, remise en main propre."""
	_connecte()
	doc = devis_envoi._pour_envoi(name)
	return {"envoi": devis_envoi.enregistrer(doc, canal, le=le)}
