# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""API des notifications push de la PWA commerciale : abonnement de l'appareil, préférences, présence et test."""

import json

import frappe
from frappe import _

from aurescrm.push import service
from aurescrm.push.webpush import is_allowed_push_endpoint


def _require_user() -> str:
	user = frappe.session.user
	if not user or user == "Guest":
		frappe.throw(_("Connexion requise."), frappe.AuthenticationError)
	return user


@frappe.whitelist(methods=["GET"])
def get_status(application, endpoint=None):
	"""État du push pour l'utilisateur : réglage du site, clé publique, appareils et préférences."""
	user = _require_user()
	application = service.require_application(application)
	if not service.is_push_enabled():
		return {"enabled": False, "public_key": None, "devices": 0, "this_device": False, "preferences": []}
	appareils = service.get_subscriptions([user], application)
	digest = service.endpoint_hash(endpoint) if endpoint else None
	return {
		"enabled": True,
		"public_key": service.get_public_key(),
		"devices": len(appareils),
		"this_device": bool(
			digest and frappe.db.exists(service.DT_ABONNEMENT, {"endpoint_hash": digest, "user": user, "enabled": 1})
		),
		"preferences": service.get_preferences(user, application),
	}


@frappe.whitelist(methods=["POST"])
def subscribe(application, subscription=None):
	"""Enregistre le PushSubscription produit par `registration.pushManager.subscribe()`."""
	user = _require_user()
	application = service.require_application(application)
	if not service.is_push_enabled():
		frappe.throw(_("Les notifications push ne sont pas activées sur ce site."))
	if isinstance(subscription, str):
		subscription = json.loads(subscription)
	subscription = subscription if isinstance(subscription, dict) else {}
	endpoint = (subscription.get("endpoint") or "").strip()
	keys = subscription.get("keys") or {}
	p256dh = (keys.get("p256dh") or "").strip()
	auth = (keys.get("auth") or "").strip()
	if not (endpoint.startswith("https://") and p256dh and auth):
		frappe.throw(_("Abonnement push incomplet."), frappe.ValidationError)
	if not is_allowed_push_endpoint(endpoint):
		frappe.throw(_("Service de notifications push non reconnu."), frappe.ValidationError)
	service.save_subscription(
		user,
		application,
		endpoint=endpoint,
		p256dh=p256dh,
		auth=auth,
		user_agent=frappe.get_request_header("User-Agent"),
	)
	return {"success": True}


@frappe.whitelist(methods=["POST"])
def unsubscribe(endpoint):
	user = _require_user()
	endpoint = (endpoint or "").strip()
	if not endpoint:
		frappe.throw(_("Endpoint manquant."), frappe.ValidationError)
	return {"success": service.remove_subscription(endpoint, user=user)}


@frappe.whitelist(methods=["POST"])
def set_preferences(application, actives=None):
	user = _require_user()
	application = service.require_application(application)
	if isinstance(actives, str):
		actives = json.loads(actives)
	return service.set_preferences(user, application, actives if isinstance(actives, list) else [])


@frappe.whitelist(methods=["POST"])
def presence(application, visible=1):
	"""L'app visible le signale toutes les 60 s : le serveur ne pousse pas ce qu'elle affiche déjà."""
	user = _require_user()
	application = service.require_application(application)
	if frappe.utils.cint(visible):
		service.marquer_present(user, application)
	else:
		service.marquer_absent(user, application)
	return {"ok": True}


@frappe.whitelist(methods=["POST"])
def send_test(application):
	"""Envoie une notification aux appareils de l'utilisateur pour vérifier le réglage."""
	user = _require_user()
	application = service.require_application(application)
	if not service.is_push_enabled():
		frappe.throw(_("Les notifications push ne sont pas activées sur ce site."))
	appareils = service.get_subscriptions([user], application)
	if not appareils:
		return {"delivered": 0, "devices": 0}
	acceptes = service.send_to_subscriptions(
		appareils,
		service.build_payload(
			"Aures Commercial",
			_("Les notifications fonctionnent sur cet appareil."),
			"/commercial/parametres",
			tag="test",
		),
	)
	return {"delivered": acceptes, "devices": len(appareils)}
