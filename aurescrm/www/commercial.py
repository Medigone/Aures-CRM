# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Page de la PWA commerciale (force de vente Aures), servie sous /commercial."""

import frappe
from frappe import _

no_cache = 1


def get_context(context=None):
	if frappe.session.user == "Guest":
		frappe.local.flags.redirect_location = "/login?redirect-to=/commercial"
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
