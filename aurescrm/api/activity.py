# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Commentaires et activité d'un document, pour le fil commun des applications Aures.

Mêmes sources que la timeline du Desk : `Comment`, `Version` et `Communication`. Un commentaire écrit dans une
application se lit donc sur le Desk, et inversement. Ce module ne contrôle pas l'accès à l'application : c'est le
rôle de la méthode qui l'appelle. Il contrôle en revanche la lecture du document et la propriété du commentaire.
"""

import json
import re
from urllib.parse import unquote

import frappe
from bs4 import BeautifulSoup
from frappe import _
from frappe.desk.form import utils as form_utils
from frappe.desk.search import get_names_for_mentions
from frappe.utils import cstr, escape_html, formatdate, get_fullname, strip_html, time_diff_in_seconds

MAX_COMMENTS = 200
MAX_VERSIONS = 100
MAX_EMAILS = 50
MAX_VALUE_LENGTH = 80

# Type de commentaire Frappe → nature de la ligne dans le fil.
LOG_KINDS = {
	"Assigned": "assign",
	"Assignment Completed": "assign",
	"Attachment": "file",
	"Attachment Removed": "file",
	"Workflow": "info",
	"Info": "info",
}
SAFE_FILE_URL = re.compile(r"^/(private/)?files/")
# Bornes d'une mention pendant le découpage du texte : ces caractères ne se saisissent pas.
MENTION_START, MENTION_END = "\x00", "\x01"
HIDDEN_FIELDTYPES = {"Section Break", "Column Break", "Tab Break", "HTML", "Button"}
# Champs masqués du formulaire dont le changement compte quand même : leur valeur s'affiche ailleurs, en pastille.
SHOWN_HIDDEN_FIELDS = {"Ticket Commercial": {"status"}}
# Libellés du Desk que le métier nomme autrement.
FIELD_LABELS = {"Item": {"custom_fiche_technique_article": "BAT"}}
ATTACH_FIELDTYPES = {"Attach", "Attach Image"}
# Frappe enregistre un envoi en plusieurs temps : ces lignes-là ne font qu'un seul événement.
SAME_UPLOAD_SECONDS = 30


def parse_comment(content):
	"""HTML d'un commentaire → texte, morceaux à afficher et personnes mentionnées. Aucun HTML ne sort d'ici."""
	soup = BeautifulSoup(cstr(content), "html.parser")
	mentions = []
	for mention in soup.find_all(class_="mention"):
		# Le Desk range parfois un lien HTML dans `data-value` : seul le nom compte.
		label = BeautifulSoup(cstr(mention.get("data-value")), "html.parser").get_text().strip() or mention.get_text().strip().lstrip("@")
		if mention.get("data-id"):
			mentions.append({"id": mention["data-id"], "label": label})
		mention.replace_with(f"{MENTION_START}@{label}{MENTION_END}")
	for line_break in soup.find_all("br"):
		line_break.replace_with("\n")
	for block in soup.find_all(["p", "div", "li"]):
		block.append("\n")

	raw = re.sub(r"\n{3,}", "\n\n", soup.get_text().replace("﻿", "")).strip()
	parts = []
	for index, chunk in enumerate(re.split(f"{MENTION_START}|{MENTION_END}", raw)):
		if chunk:
			parts.append({"text": chunk, "mention": index % 2 == 1})
	return {"text": raw.replace(MENTION_START, "").replace(MENTION_END, ""), "parts": parts, "mentions": mentions}


def to_comment_html(text, mentions=None):
	"""Texte saisi → HTML que le Desk affiche et dont Frappe tire ses notifications de mention."""
	value = escape_html(cstr(text).strip())
	if not value:
		frappe.throw(_("Écrivez un commentaire avant de l'envoyer."))
	for mention in mentions or []:
		user, label = cstr(mention.get("id")), cstr(mention.get("label"))
		if not user or not label or not frappe.db.exists("User", user):
			continue
		safe_label = escape_html(label)
		value = value.replace(
			f"@{safe_label}",
			f'<span class="mention" data-id="{escape_html(user)}" data-value="{safe_label}" data-denotation-char="@">@{safe_label}</span>',
		)
	return f'<div class="ql-editor read-mode"><p>{value.replace(chr(10), "<br>")}</p></div>'


def _parse_mentions(mentions):
	return json.loads(mentions) if isinstance(mentions, str) and mentions else (mentions or [])


def _format_value(df, value):
	if value in (None, ""):
		return "—"
	if df.fieldtype == "Check":
		return _("Oui") if str(value) == "1" else _("Non")
	if df.fieldtype == "Date":
		return formatdate(value, "dd/MM/yyyy")
	if df.fieldtype in ATTACH_FIELDTYPES:
		return unquote(cstr(value).rsplit("/", 1)[-1])
	text = strip_html(cstr(value)).strip()
	return text if len(text) <= MAX_VALUE_LENGTH else f"{text[:MAX_VALUE_LENGTH]}…"


def _version_items(doc):
	meta = doc.meta
	readable = set(meta.get_permlevel_access("read") or [0]) | {0}
	shown_hidden = SHOWN_HIDDEN_FIELDS.get(doc.doctype, ())
	versions = frappe.get_all(
		"Version",
		filters={"ref_doctype": doc.doctype, "docname": str(doc.name)},
		fields=["name", "owner", "creation", "data"],
		order_by="creation desc",
		limit_page_length=MAX_VERSIONS,
	)
	items = []
	for version in versions:
		data = json.loads(version.data or "{}")
		base = {"who": get_fullname(version.owner), "at": str(version.creation)}
		changes = []
		for fieldname, old, new in data.get("changed") or []:
			if fieldname == "docstatus":
				verb = {1: _("a validé ce document"), 2: _("a annulé ce document")}.get(new)
				if verb:
					items.append({"id": f"{version.name}-docstatus", "kind": "info", "text": verb, **base})
				continue
			df = meta.get_field(fieldname)
			if not df or df.permlevel not in readable or df.fieldtype in HIDDEN_FIELDTYPES:
				continue
			if df.hidden and fieldname not in shown_hidden:
				continue
			before, after = _format_value(df, old), _format_value(df, new)
			# Une valeur vide devenue une autre valeur vide : rien n'a changé pour le lecteur.
			if before == after:
				continue
			label = FIELD_LABELS.get(doc.doctype, {}).get(fieldname) or _(df.label or fieldname)
			change = {"label": label, "old": before, "new": after}
			if df.fieldtype in ATTACH_FIELDTYPES:
				change["file"] = True
			changes.append(change)
		if changes:
			items.append({"id": version.name, "kind": "change", "changes": changes, **base})
		tables = {row[0] for key in ("added", "removed", "row_changed") for row in data.get(key) or []}
		labels = sorted(_(meta.get_label(table)) for table in tables if meta.get_field(table))
		if labels:
			text = _("a modifié {0}").format(", ".join(labels))
			items.append({"id": f"{version.name}-rows", "kind": "info", "text": text, **base})
	return items


def _log_item(comment):
	kind = LOG_KINDS[comment.comment_type]
	base = {"id": comment.name, "kind": kind, "at": str(comment.creation)}
	who = comment.comment_by or get_fullname(comment.owner)
	if kind == "file":
		soup = BeautifulSoup(cstr(comment.content), "html.parser")
		anchor = soup.find("a")
		url = cstr(anchor.get("href")) if anchor else ""
		label = anchor.get_text().strip() if anchor else strip_html(cstr(comment.content)).strip()
		removed = comment.comment_type == "Attachment Removed"
		return {
			**base,
			"who": who,
			"text": _("a retiré un fichier") if removed else _("a joint"),
			"link": {"label": label, "url": url if SAFE_FILE_URL.match(url) else None},
		}
	if comment.comment_type == "Workflow":
		return {**base, "who": who, "text": _("a passé ce document à {0}").format(strip_html(cstr(comment.content)))}
	# Attributions et informations : la phrase de Frappe nomme déjà son auteur.
	return {**base, "who": "", "text": strip_html(cstr(comment.content)).strip()}


def _same_upload(first, second):
	if first["who"] != second["who"]:
		return False
	return abs(time_diff_in_seconds(first["at"], second["at"])) <= SAME_UPLOAD_SECONDS


def merge_uploads(items):
	"""Un fichier joint fait une seule ligne, qui dit à quoi il sert, au lieu d'une ligne par trace laissée par Frappe."""
	joined = []
	merged = []
	for item in items:
		if item["kind"] == "file" and item.get("link") and item.get("text") == _("a joint"):
			if any(other["link"]["label"] == item["link"]["label"] and _same_upload(other, item) for other in joined):
				continue
			joined.append(item)
		merged.append(item)
	result = []
	for item in merged:
		if item["kind"] != "change":
			result.append(item)
			continue
		kept = []
		for change in item["changes"]:
			is_file = change.pop("file", False)
			target = next((row for row in joined if is_file and row["link"]["label"] == change["new"] and _same_upload(row, item)), None)
			if target:
				target.setdefault("roles", []).append(change["label"].lower())
			else:
				kept.append(change)
		if kept:
			result.append({**item, "changes": kept})
	for item in joined:
		roles = item.pop("roles", None)
		if roles:
			item["after"] = _("comme {0}").format(", ".join(roles))
	return result


def get_feed(doctype, name):
	"""Fil d'un document, du plus récent au plus ancien."""
	doc = frappe.get_doc(doctype, name)
	doc.check_permission("read")
	user = frappe.session.user

	comments = frappe.get_all(
		"Comment",
		filters={
			"reference_doctype": doctype,
			"reference_name": str(name),
			"comment_type": ["in", ["Comment", *LOG_KINDS]],
		},
		fields=["name", "comment_type", "content", "owner", "comment_by", "creation"],
		order_by="creation desc",
		limit_page_length=MAX_COMMENTS,
	)
	items = []
	comment_count = 0
	for comment in comments:
		if comment.comment_type != "Comment":
			items.append(_log_item(comment))
			continue
		comment_count += 1
		items.append(
			{
				"id": comment.name,
				"kind": "comment",
				"who": comment.comment_by or get_fullname(comment.owner),
				"at": str(comment.creation),
				"mine": comment.owner == user,
				**parse_comment(comment.content),
			}
		)
	items.extend(_version_items(doc))

	emails = frappe.get_all(
		"Communication",
		filters={"reference_doctype": doctype, "reference_name": str(name), "communication_type": "Communication"},
		fields=["name", "subject", "sender", "sender_full_name", "creation"],
		order_by="creation desc",
		limit_page_length=MAX_EMAILS,
	)
	for email in emails:
		items.append(
			{
				"id": email.name,
				"kind": "mail",
				"who": email.sender_full_name or email.sender or "",
				"at": str(email.creation),
				"text": _("a envoyé un e-mail"),
				"link": {"label": email.subject or _("Sans objet"), "url": f"/app/communication/{email.name}"},
			}
		)

	items.sort(key=lambda item: item["at"], reverse=True)
	items = merge_uploads(items)
	items.append(
		{"id": f"{doc.name}-creation", "kind": "create", "who": get_fullname(doc.owner), "at": str(doc.creation), "text": _("a créé ce document")}
	)
	return {"items": items, "comment_count": comment_count}


def comment_counts(doctype, names):
	"""Nombre de commentaires de chaque document, en une seule requête."""
	if not names:
		return {}
	rows = frappe.get_all(
		"Comment",
		filters={"reference_doctype": doctype, "reference_name": ["in", list(names)], "comment_type": "Comment"},
		fields=["reference_name", "count(name) as total"],
		group_by="reference_name",
	)
	return {row.reference_name: row.total for row in rows}


def comment_summary(doctype, name):
	"""Nombre de commentaires et dernier d'entre eux, pour l'aperçu."""
	filters = {"reference_doctype": doctype, "reference_name": str(name), "comment_type": "Comment"}
	last = frappe.get_all(
		"Comment", filters=filters, fields=["content", "owner", "comment_by", "creation"], order_by="creation desc", limit_page_length=1
	)
	if not last:
		return {"count": 0, "last": None}
	comment = last[0]
	return {
		"count": frappe.db.count("Comment", filters),
		"last": {"who": comment.comment_by or get_fullname(comment.owner), "at": str(comment.creation), "parts": parse_comment(comment.content)["parts"]},
	}


def add_comment(doctype, name, text, mentions=None):
	"""La lecture du document suffit pour commenter, comme sur le Desk."""
	user = frappe.session.user
	form_utils.add_comment(doctype, name, to_comment_html(text, _parse_mentions(mentions)), user, get_fullname(user))
	return get_feed(doctype, name)


def _own_comment(doctype, name, comment_name):
	comment = frappe.get_doc("Comment", comment_name)
	if comment.reference_doctype != doctype or comment.reference_name != str(name) or comment.comment_type != "Comment":
		frappe.throw(_("Ce commentaire n'appartient pas à ce document."), frappe.PermissionError)
	if frappe.session.user not in ("Administrator", comment.owner):
		frappe.throw(_("Vous ne pouvez modifier que vos propres commentaires."), frappe.PermissionError)
	return comment


def update_comment(doctype, name, comment_name, text, mentions=None):
	_own_comment(doctype, name, comment_name)
	form_utils.update_comment(comment_name, to_comment_html(text, _parse_mentions(mentions)))
	return get_feed(doctype, name)


def delete_comment(doctype, name, comment_name):
	_own_comment(doctype, name, comment_name)
	frappe.get_doc(doctype, name).check_permission("read")
	frappe.delete_doc("Comment", comment_name, ignore_permissions=True)
	return get_feed(doctype, name)


def mention_candidates():
	"""Personnes qu'on peut mentionner : la même liste que sur le Desk, sans les groupes."""
	return [{"id": row["id"], "label": row["value"] or row["id"]} for row in get_names_for_mentions("") if not row.get("is_group")]
