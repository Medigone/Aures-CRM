# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Page du poste de bureau Aures, servie sous /bureau.

Un visiteur sans session passe par la page de connexion du site. Un utilisateur connecté sans le bon
rôle reçoit la page : l'application affiche alors un refus, et l'API refuse de toute façon ses appels.
"""

import re
from urllib.parse import quote

import frappe
from frappe import _

from aurescrm.api.bureau import can_access_bureau

no_cache = 1

HOME_PATH = "/bureau"


def safe_redirect(target):
	"""Retour après connexion : une page du poste de bureau seulement."""
	value = (target or "").strip()
	return value if re.match(r"^/bureau(?:[/?#]|$)", value) else HOME_PATH


def get_context(context=None):
	if frappe.session.user == "Guest":
		target = safe_redirect(frappe.local.request.full_path.rstrip("?"))
		frappe.local.flags.redirect_location = f"/login?redirect-to={quote(target, safe='/')}"
		raise frappe.Redirect
	frappe.db.commit()
	context = frappe._dict()
	context.boot = get_boot()
	return context


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
			"default_route": HOME_PATH,
			"site_name": frappe.local.site,
			"socketio_port": frappe.conf.get("socketio_port") or 9000,
			"csrf_token": frappe.sessions.get_csrf_token(),
			"user": user if user != "Guest" else None,
			"user_fullname": frappe.utils.get_fullname(user) if user != "Guest" else None,
			"can_access": can_access_bureau(user),
		}
	)
