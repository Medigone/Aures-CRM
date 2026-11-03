# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Page de la PWA commerciale (force de vente Aures), servie sous /commercial."""

import re
from urllib.parse import quote

import frappe
from frappe import _

no_cache = 1

HOME_PATH = "/commercial"
LOGIN_PATH = "/commercial/connexion"


def safe_redirect(target):
	"""Retour après connexion : une page de la PWA seulement (même règle que `safeRedirect` côté client)."""
	value = (target or "").strip()
	if not re.match(r"^/commercial(?:[/?#]|$)", value) or value.startswith(LOGIN_PATH):
		return HOME_PATH
	return value


def get_context(context=None):
	request = frappe.local.request
	path = "/" + (request.path or "").strip("/")
	on_login = path == LOGIN_PATH
	if frappe.session.user == "Guest" and not on_login:
		# Page de connexion de la PWA, avec la page demandée pour y revenir ensuite.
		target = safe_redirect(request.full_path.rstrip("?"))
		frappe.local.flags.redirect_location = (
			LOGIN_PATH if target == HOME_PATH else f"{LOGIN_PATH}?redirect-to={quote(target, safe='/')}"
		)
		raise frappe.Redirect
	if frappe.session.user != "Guest" and on_login:
		frappe.local.flags.redirect_location = safe_redirect(frappe.form_dict.get("redirect-to"))
		raise frappe.Redirect
	frappe.db.commit()
	context = frappe._dict()
	context.boot = get_boot()
	return context


@frappe.whitelist()
def get_commercial_boot():
	"""Jeton CSRF frais : l'application ouverte hors-ligne le recharge avant de synchroniser."""
	return get_boot()


@frappe.whitelist(methods=["POST"], allow_guest=True)
def get_context_for_dev():
	if not frappe.conf.developer_mode:
		frappe.throw(_("Cette méthode est réservée au mode développeur."))
	return get_boot()


def get_boot():
	user = frappe.session.user
	return frappe._dict(
		{
			"frappe_version": frappe.__version__,
			"default_route": "/commercial",
			"site_name": frappe.local.site,
			"socketio_port": frappe.conf.get("socketio_port") or 9000,
			"csrf_token": frappe.sessions.get_csrf_token(),
			"user": user if user != "Guest" else None,
		}
	)
