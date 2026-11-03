# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Notifications push de la PWA commerciale : clés VAPID, appareils abonnés, préférences, anti-bruit et envoi.

Repris de MediConnect (mediconnect/push/service.py). Un abonnement vaut pour un appareil et une
application (service worker de portée `/commercial`). Le contenu reste court : un titre, une phrase,
l'adresse à ouvrir dans l'application.
"""

from __future__ import annotations

import hashlib

import frappe
from frappe.utils import now_datetime

from aurescrm.push.webpush import (
	PushSubscriptionKeys,
	WebPushError,
	generate_vapid_keypair,
	send_web_push,
)

DT_PARAMETRES = "Parametres Push Commercial"
DT_ABONNEMENT = "Abonnement Push Commercial"
CONF_PRIVATE_KEY = "aures_vapid_private_key"
CONF_PUBLIC_KEY = "aures_vapid_public_key"
CONF_SUBJECT = "aures_vapid_subject"

APP_COMMERCIAL = "commercial"
APPLICATIONS = (APP_COMMERCIAL,)

# Catégories que le commercial peut couper (ordre d'affichage).
CATEGORIES = {
	APP_COMMERCIAL: {
		"tickets": "Tickets : prise en charge, urgence, blocage créance",
		"devis": "Devis validés",
		"bat": "BAT et maquettes",
		"commandes": "Commandes et production",
		"reclamations": "Réclamations traitées",
	},
}
CATEGORIE_TEST = "test"

# Au-delà, l'endpoint est désactivé ; un 404/410 le supprime tout de suite.
MAX_ECHECS = 5
# L'app signale sa présence toutes les 60 s quand elle est visible : pas de push pendant ce temps.
PRESENCE_TTL = 75
# Au plus un push par sujet (`tag`, un fil par exemple) et par utilisateur sur cette durée.
INTERVALLE_TAG = 120
TITRE_MAX = 80
CORPS_MAX = 140


def endpoint_hash(endpoint: str) -> str:
	return hashlib.sha256(endpoint.encode("utf-8")).hexdigest()


def require_application(application) -> str:
	if application not in APPLICATIONS:
		frappe.throw(frappe._("Application inconnue."), frappe.ValidationError)
	return application


# ---------------------------------------------------------------------------
# Réglages et clés VAPID
# ---------------------------------------------------------------------------
def get_vapid_subject() -> str:
	return (
		frappe.conf.get(CONF_SUBJECT)
		or frappe.db.get_single_value(DT_PARAMETRES, "vapid_subject")
		or frappe.utils.get_url()
	)


def get_vapid_keys() -> tuple[str, str] | None:
	"""(clé privée, clé publique), générées au premier usage ; le site_config passe en priorité."""
	conf_private = frappe.conf.get(CONF_PRIVATE_KEY)
	conf_public = frappe.conf.get(CONF_PUBLIC_KEY)
	if conf_private and conf_public:
		return conf_private, conf_public

	doc = frappe.get_single(DT_PARAMETRES)
	private_key = doc.get_password("vapid_private_key", raise_exception=False)
	if private_key and doc.vapid_public_key:
		return private_key, doc.vapid_public_key

	if frappe.flags.read_only:
		return None
	private_key, public_key = generate_vapid_keypair()
	doc.vapid_private_key = private_key
	doc.vapid_public_key = public_key
	doc.save(ignore_permissions=True)
	frappe.db.commit()
	return private_key, public_key


def is_push_enabled() -> bool:
	if not frappe.db.exists("DocType", DT_PARAMETRES):
		return False
	return bool(frappe.db.get_single_value(DT_PARAMETRES, "enabled"))


def get_public_key() -> str | None:
	keys = get_vapid_keys()
	return keys[1] if keys else None


# ---------------------------------------------------------------------------
# Appareils abonnés
# ---------------------------------------------------------------------------
def save_subscription(user, application, *, endpoint, p256dh, auth, user_agent=None) -> str:
	"""Enregistre (ou réattribue) l'abonnement d'un appareil ; idempotent sur l'endpoint."""
	digest = endpoint_hash(endpoint)
	name = frappe.db.get_value(DT_ABONNEMENT, {"endpoint_hash": digest}, "name")
	if name:
		doc = frappe.get_doc(DT_ABONNEMENT, name)
	else:
		doc = frappe.new_doc(DT_ABONNEMENT)
		doc.endpoint_hash = digest
		doc.endpoint = endpoint
	# Un appareil partagé change de main : l'endpoint suit le dernier qui s'est abonné.
	doc.user = user
	doc.application = application
	doc.p256dh = p256dh
	doc.auth = auth
	doc.user_agent = (user_agent or "")[:500]
	doc.enabled = 1
	doc.failure_count = 0
	doc.last_error = None
	doc.last_seen_at = now_datetime()
	doc.save(ignore_permissions=True)
	return doc.name


def remove_subscription(endpoint: str, user: str | None = None) -> bool:
	filters = {"endpoint_hash": endpoint_hash(endpoint)}
	if user:
		filters["user"] = user
	name = frappe.db.get_value(DT_ABONNEMENT, filters, "name")
	if not name:
		return False
	frappe.delete_doc(DT_ABONNEMENT, name, ignore_permissions=True, force=True)
	return True


def get_subscriptions(users, application) -> list[dict]:
	users = [u for u in dict.fromkeys(users or []) if u and u != "Guest"]
	if not users:
		return []
	return frappe.get_all(
		DT_ABONNEMENT,
		filters={"user": ["in", users], "application": application, "enabled": 1},
		fields=["name", "user", "endpoint", "p256dh", "auth"],
	)


def _record_failure(name: str, error: WebPushError) -> None:
	if error.is_gone:
		# Le navigateur s'est désabonné ou l'app a été supprimée : la ligne ne sert plus.
		frappe.delete_doc(DT_ABONNEMENT, name, ignore_permissions=True, force=True)
		return
	echecs = (frappe.db.get_value(DT_ABONNEMENT, name, "failure_count") or 0) + 1
	frappe.db.set_value(
		DT_ABONNEMENT,
		name,
		{"failure_count": echecs, "last_error": str(error)[:500], "enabled": 0 if echecs >= MAX_ECHECS else 1},
		update_modified=False,
	)


# ---------------------------------------------------------------------------
# Préférences, présence et anti-bruit
# ---------------------------------------------------------------------------
def _cle_preferences(application):
	return f"mc_push_off_{application}"


def categories_coupees(user, application) -> set[str]:
	valeur = frappe.defaults.get_user_default(_cle_preferences(application), user=user) or ""
	return {c for c in valeur.split(",") if c}


def get_preferences(user, application) -> list[dict]:
	coupees = categories_coupees(user, application)
	return [
		{"id": cid, "label": label, "actif": cid not in coupees}
		for cid, label in CATEGORIES[application].items()
	]


def set_preferences(user, application, actives) -> list[dict]:
	actives = set(actives or [])
	coupees = [c for c in CATEGORIES[application] if c not in actives]
	frappe.defaults.set_user_default(_cle_preferences(application), ",".join(coupees), user=user)
	return get_preferences(user, application)


def _cle_presence(user, application):
	# Clé brute : `frappe.cache.exists` applique lui-même `make_key`, pas `set` ni `delete`.
	return f"aurescrm:push_actif:{application}:{user}"


def marquer_present(user, application) -> None:
	frappe.cache.set(frappe.cache.make_key(_cle_presence(user, application)), 1, ex=PRESENCE_TTL)


def marquer_absent(user, application) -> None:
	frappe.cache.delete(frappe.cache.make_key(_cle_presence(user, application)))


def est_present(user, application) -> bool:
	return bool(frappe.cache.exists(_cle_presence(user, application)))


def _tag_libre(user, application, tag) -> bool:
	"""Vrai au premier push d'un sujet dans la fenêtre ; les suivants sont absorbés."""
	if not tag:
		return True
	cle = frappe.cache.make_key(f"aurescrm:push_tag:{application}:{user}:{tag}")
	return bool(frappe.cache.set(cle, 1, ex=INTERVALLE_TAG, nx=True))


def destinataires_retenus(users, application, categorie, tag=None) -> list[str]:
	"""Utilisateurs à qui envoyer : catégorie active, absents de l'app, sujet pas déjà poussé."""
	retenus = []
	for user in dict.fromkeys(users or []):
		if not user or user == "Guest":
			continue
		if categorie != CATEGORIE_TEST:
			if categorie in categories_coupees(user, application):
				continue
			if est_present(user, application):
				continue
			if not _tag_libre(user, application, tag):
				continue
		retenus.append(user)
	return retenus


# ---------------------------------------------------------------------------
# Envoi
# ---------------------------------------------------------------------------
def _court(texte, limite):
	texte = " ".join((texte or "").split())
	return texte if len(texte) <= limite else texte[: limite - 1].rstrip() + "…"


def build_payload(title, body, url, tag=None) -> dict:
	"""Forme attendue par le handler `push` des service workers."""
	return {
		"title": _court(title, TITRE_MAX) or "Aures Commercial",
		"body": _court(body, CORPS_MAX),
		"url": url or "/",
		"tag": tag,
	}


def send_to_subscriptions(subscriptions, payload) -> int:
	"""Envoie `payload` à chaque abonnement ; renvoie le nombre de push acceptés."""
	keys = get_vapid_keys()
	if not keys or not subscriptions:
		return 0
	private_key, public_key = keys
	subject = get_vapid_subject()
	acceptes = 0
	for sub in subscriptions:
		try:
			send_web_push(
				PushSubscriptionKeys(endpoint=sub["endpoint"], p256dh=sub["p256dh"], auth=sub["auth"]),
				payload,
				vapid_private_key=private_key,
				vapid_public_key=public_key,
				vapid_subject=subject,
			)
			acceptes += 1
		except WebPushError as error:
			_record_failure(sub["name"], error)
		except Exception:
			frappe.log_error(title="Notification push : échec d'envoi")
	frappe.db.commit()
	return acceptes


def send_to_users(users, application, categorie, title, body, url=None, tag=None) -> int:
	if not is_push_enabled():
		return 0
	users = destinataires_retenus(users, application, categorie, tag)
	subscriptions = get_subscriptions(users, application)
	if not subscriptions:
		return 0
	return send_to_subscriptions(subscriptions, build_payload(title, body, url, tag))


def enqueue_push(users, application, categorie, title, body, url=None, tag=None) -> None:
	"""Un aller-retour HTTPS par appareil : jamais dans la requête, et seulement après le commit."""
	users = [u for u in dict.fromkeys(users or []) if u and u != "Guest"]
	if not users or not is_push_enabled():
		return
	frappe.enqueue(
		"aurescrm.push.service.send_to_users",
		queue="short",
		users=users,
		application=application,
		categorie=categorie,
		title=title,
		body=body,
		url=url,
		tag=tag,
		enqueue_after_commit=True,
	)
