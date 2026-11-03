# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Renderers de la PWA commerciale : la SPA sous /commercial, son service worker et son manifest.

Le service worker doit être servi depuis /commercial pour contrôler les pages /commercial
(un script servi sous /assets ne contrôle que /assets). `CommercialPWAFile` doit donc être
listé avant `CommercialPage` dans `page_renderer`.
"""

import hashlib
import os

import frappe
from frappe.website.page_renderers.base_renderer import BaseRenderer
from frappe.website.page_renderers.template_page import TemplatePage
from werkzeug.wrappers import Response

SPA = "commercial"
# Remplacé au service par l'empreinte du build : chaque build donne un nouveau service worker,
# qui purge les caches de l'ancien.
SW_VERSION_PLACEHOLDER = b"__BUILD_VERSION__"
PWA_MIMETYPES = {
	"sw.js": "application/javascript",
	"manifest.webmanifest": "application/manifest+json",
}
PWA_FILES = {f"{SPA}/{filename}" for filename in PWA_MIMETYPES}


def normalized(path):
	return (path or "").strip("/ ").lower()


def is_spa_path(path):
	value = normalized(path)
	if value in PWA_FILES:
		return False
	return value == SPA or value.startswith(f"{SPA}/")


def build_version():
	"""Empreinte de la page construite : elle référence les assets hachés du build courant."""
	index = frappe.get_app_path("aurescrm", "www", f"{SPA}.html")
	if not os.path.exists(index):
		return "dev"
	with open(index, "rb") as f:
		return hashlib.sha1(f.read()).hexdigest()[:12]


class CommercialPWAFile(BaseRenderer):
	"""Service worker et manifest, lus dans le build (public/commercial)."""

	def can_render(self):
		return normalized(self.path) in PWA_FILES

	def render(self):
		filename = normalized(self.path).split("/", 1)[1]
		path = frappe.get_app_path("aurescrm", "public", SPA, filename)
		if not os.path.exists(path):
			return Response("", status=404)
		with open(path, "rb") as f:
			content = f.read()
		if filename == "sw.js":
			content = content.replace(SW_VERSION_PLACEHOLDER, build_version().encode())
		response = Response(content, mimetype=PWA_MIMETYPES[filename])
		response.headers["Cache-Control"] = "no-cache"
		if filename == "sw.js":
			# Sans cet en-tête, /commercial/sw.js ne pourrait contrôler que /commercial/ (barre finale).
			response.headers["Service-Worker-Allowed"] = f"/{SPA}"
		return response


class CommercialPage(TemplatePage):
	"""Sert la SPA pour /commercial et /commercial/* (hors fichiers PWA)."""

	def __init__(self, path, http_status_code=None):
		self._original_path = path or ""
		super().__init__(SPA if is_spa_path(path) else path, http_status_code)

	def can_render(self):
		return is_spa_path(self._original_path)
