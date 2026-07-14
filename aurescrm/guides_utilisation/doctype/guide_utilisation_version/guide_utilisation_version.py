# Copyright (c) 2026, Medigo and contributors
# License: MIT

from __future__ import annotations

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, now_datetime


PUBLISHER_ROLES = ("Guide Validateur", "Guide Gestionnaire", "System Manager")
EDITABLE_STATUSES = ("Brouillon", "À valider")


class GuideUtilisationVersion(Document):
	def validate(self):
		self._validate_content()
		self._validate_unique_version_number()
		self._validate_immutable_published()
		self._validate_status_transition()

	def on_update(self):
		previous = self.get_doc_before_save()
		became_published = self.statut == "Publié" and (not previous or previous.statut != "Publié")
		if became_published:
			self._promote_as_current()

	def after_insert(self):
		# Publication initiale (import / seed) : insert en Brouillon puis promotion DB.
		if self.flags.get("allow_initial_publish"):
			self._force_publish_from_draft()

	def _force_publish_from_draft(self):
		"""Publie une version fraîchement créée sans passer par les transitions workflow."""
		now = now_datetime()
		frappe.db.sql(
			"SELECT name FROM `tabGuide Utilisation` WHERE name = %s FOR UPDATE",
			self.guide,
		)
		guide = frappe.get_doc("Guide Utilisation", self.guide)
		previous_name = guide.version_publiee
		if previous_name and previous_name != self.name:
			frappe.db.set_value(
				"Guide Utilisation Version",
				previous_name,
				{"statut": "Archivé"},
				update_modified=True,
			)
		frappe.db.set_value(
			"Guide Utilisation Version",
			self.name,
			{
				"statut": "Publié",
				"publie_le": now,
				"publie_par": frappe.session.user or "Administrator",
			},
			update_modified=False,
		)
		guide.db_set("version_publiee", self.name, update_modified=True)
		self.statut = "Publié"
		self.publie_le = now
		self.publie_par = frappe.session.user or "Administrator"

	def _validate_content(self):
		if self.format_contenu == "Markdown":
			if not (self.contenu_markdown or "").strip():
				frappe.throw(_("Le contenu Markdown est obligatoire."))
		elif self.format_contenu == "Texte riche":
			if not (self.contenu_riche or "").strip():
				frappe.throw(_("Le contenu riche est obligatoire."))
		else:
			frappe.throw(_("Format de contenu invalide."))

	def _validate_unique_version_number(self):
		exists = frappe.db.exists(
			"Guide Utilisation Version",
			{
				"guide": self.guide,
				"numero_version": cint(self.numero_version),
				"name": ["!=", self.name or ""],
			},
		)
		if exists:
			frappe.throw(
				_("La version {0} existe déjà pour ce guide.").format(cint(self.numero_version))
			)

	def _validate_immutable_published(self):
		if self.is_new():
			return

		previous = self.get_doc_before_save()
		if not previous or previous.statut not in ("Publié", "Archivé"):
			return

		protected = (
			"guide",
			"numero_version",
			"format_contenu",
			"contenu_markdown",
			"contenu_riche",
			"resume_modifications",
		)
		for fieldname in protected:
			if self.get(fieldname) != previous.get(fieldname):
				frappe.throw(_("Une version {0} ne peut plus être modifiée.").format(previous.statut))

	def _validate_status_transition(self):
		previous = None if self.is_new() else self.get_doc_before_save()
		old_status = previous.statut if previous else None
		new_status = self.statut or "Brouillon"

		if old_status == new_status:
			if new_status == "Brouillon" and not _can_edit_draft():
				frappe.throw(_("Vous n'avez pas la permission de modifier un brouillon."))
			return

		if self.is_new() and new_status != "Brouillon":
			# Même avec allow_initial_publish, l'insert passe toujours par Brouillon
			# (contrainte Workflow Frappe). La promotion se fait ensuite en after_insert.
			frappe.throw(_("Une nouvelle version doit commencer en Brouillon."))

		allowed = {
			(None, "Brouillon"),
			("Brouillon", "À valider"),
			("À valider", "Brouillon"),
			("À valider", "Publié"),
			("Publié", "Archivé"),
		}

		if (old_status, new_status) not in allowed:
			frappe.throw(
				_("Transition de statut non autorisée : {0} → {1}.").format(
					old_status or "—", new_status
				)
			)

		if new_status == "Publié" and not _can_publish():
			frappe.throw(_("Seuls les validateurs peuvent publier un guide."))
		if new_status == "À valider" and old_status == "Brouillon" and not _can_edit_draft():
			frappe.throw(_("Vous n'avez pas la permission d'envoyer ce guide à validation."))

	def _promote_as_current(self):
		"""Archive l'ancienne version publiée et pointe le guide vers celle-ci."""
		if not _can_publish() and not self.flags.get("allow_initial_publish"):
			frappe.throw(_("Seuls les validateurs peuvent publier un guide."))

		frappe.db.sql(
			"SELECT name FROM `tabGuide Utilisation` WHERE name = %s FOR UPDATE",
			self.guide,
		)

		guide = frappe.get_doc("Guide Utilisation", self.guide)
		previous_name = guide.version_publiee

		if previous_name and previous_name != self.name:
			frappe.db.set_value(
				"Guide Utilisation Version",
				previous_name,
				{"statut": "Archivé"},
				update_modified=True,
			)

		now = now_datetime()
		frappe.db.set_value(
			"Guide Utilisation Version",
			self.name,
			{
				"publie_le": now,
				"publie_par": frappe.session.user,
				"statut": "Publié",
			},
			update_modified=False,
		)
		self.publie_le = now
		self.publie_par = frappe.session.user
		guide.db_set("version_publiee", self.name, update_modified=True)


def _can_publish(user: str | None = None) -> bool:
	user = user or frappe.session.user
	if user == "Administrator":
		return True
	return bool(set(frappe.get_roles(user)) & set(PUBLISHER_ROLES))


def _can_edit_draft(user: str | None = None) -> bool:
	user = user or frappe.session.user
	if user == "Administrator":
		return True
	roles = set(frappe.get_roles(user))
	return bool(roles & set((*PUBLISHER_ROLES, "Guide Redacteur")))
