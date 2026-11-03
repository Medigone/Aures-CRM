# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""API de la PWA commerciale (/commercial).

L'appareil garde un instantané hors-ligne : `get_sync_bundle` donne le contexte et les référentiels,
puis chaque liste se télécharge page par page avec `get_sync_page`. Le périmètre est celui du
commercial connecté : ses clients (attribution legacy `custom_commercial_attribué` ou table
`custom_commercial_assignments`) et ce qui s'y rattache. Les rôles exemptés (Superviseur CRM,
System Manager) voient tous les clients.
"""

import re

import frappe
from frappe import _
from frappe.utils import add_days, cint, now_datetime, today

from aurescrm.custom_permissions import build_commercial_permission_query_condition, is_exempt_user

SYNC_PAGE_LENGTH = 500
SYNC_PAGE_MAX = 1000
# Historique gardé hors-ligne : les visites et appels plus anciens restent dans le Desk.
VISIT_HISTORY_DAYS = 365
CALL_HISTORY_DAYS = 90
RDV_HISTORY_DAYS = 30

COMMERCIAL_ROLES = {
	"Commercial Itinérant",
	"Commercial Sédentaire",
	"Superviseur CRM",
	"Administrateur Ventes",
	"System Manager",
}

# Champs de fiche article jamais affichés dans les caractéristiques (identité, liens, techniques).
ARTICLE_SKIPPED_FIELDS = {
	"custom_client",
	"custom_type_article",
	"custom_article_parent",
	"custom_html_liste_sous_articles",
}
ARTICLE_VALUE_TYPES = {"Data", "Select", "Int", "Float", "Check", "Link", "Small Text", "Color", "Percent"}
LAYOUT_TYPES = {"Section Break", "Tab Break", "Column Break"}


# ---------------------------------------------------------------------------
# Accès et périmètre
# ---------------------------------------------------------------------------
def require_commercial():
	user = frappe.session.user
	if user == "Guest":
		raise frappe.PermissionError(_("Connexion requise."))
	roles = set(frappe.get_roles(user))
	if "Administrator" not in roles and not roles & COMMERCIAL_ROLES:
		raise frappe.PermissionError(_("L'application commerciale est réservée à l'équipe commerciale."))
	return user


def customer_scope(customer_field, user):
	"""Condition SQL : le client référencé par `customer_field` est dans le portefeuille de `user`."""
	if is_exempt_user(user):
		return "1=1"
	return build_commercial_permission_query_condition(customer_field, user)


def parse_gps(value):
	"""« 36.75, 3.05 » (texte du Desk) → (lat, lon) ; (None, None) si illisible."""
	if not value:
		return None, None
	numbers = re.findall(r"-?\d+(?:\.\d+)?", str(value))
	if len(numbers) < 2:
		return None, None
	lat, lon = float(numbers[0]), float(numbers[1])
	if not (-90 <= lat <= 90 and -180 <= lon <= 180):
		return None, None
	return lat, lon


# ---------------------------------------------------------------------------
# Instantané
# ---------------------------------------------------------------------------
@frappe.whitelist()
def get_sync_bundle():
	"""Contexte et référentiels ; les listes se téléchargent ensuite avec `get_sync_page`."""
	user = require_commercial()
	full_name, image = frappe.db.get_value("User", user, ["full_name", "user_image"]) or (user, None)
	roles = [role for role in frappe.get_roles(user) if role in COMMERCIAL_ROLES]
	return {
		"server_time": now_datetime(),
		"user": {"name": user, "full_name": full_name, "image": image, "roles": roles, "exempt": is_exempt_user(user)},
		"references": _references(),
	}


def _select_options(doctype, fieldname):
	field = frappe.get_meta(doctype).get_field(fieldname)
	return [option for option in (field.options or "").split("\n") if option] if field else []


def _references():
	return {
		"wilayas": frappe.get_all("Wilayas", fields=["name", "wilaya", "code", "region"], order_by="code asc"),
		"communes": frappe.get_all("Communes", fields=["name", "commune", "wilaya"], order_by="commune asc"),
		"types_visite": _select_options("Visite Commerciale", "type_visite"),
		"statuts_client": _select_options("Customer", "custom_status"),
		"types_appel": _select_options("Appel Telephonique", "type"),
		"statuts_rdv": _select_options("Rendez Vous Client", "status"),
	}


@frappe.whitelist()
def get_sync_page(section, start=0, page_length=SYNC_PAGE_LENGTH):
	"""Une page d'une liste de l'instantané ; l'appareil pagine jusqu'à recevoir une page incomplète."""
	if section not in SYNC_SECTIONS:
		frappe.throw(_("Section d'instantané inconnue."))
	user = require_commercial()
	return SYNC_SECTIONS[section](user, max(cint(start), 0), min(max(cint(page_length), 1), SYNC_PAGE_MAX))


def _page_clients(user, start, length):
	rows = frappe.db.sql(
		f"""
		select c.name, c.customer_name, c.custom_status as statut, c.customer_group as groupe,
			c.custom_wilaya as wilaya, c.custom_commune as commune, c.`custom_région` as region,
			c.custom_gps as gps, c.`custom_téléphone` as telephone,
			c.`custom_nº_téléphone_principal` as telephone_principal, c.custom_email as email,
			c.custom_nom_contact_principal as contact_principal, c.custom_grand_compte as grand_compte,
			c.`custom_groupe_de_sociétés` as groupe_societes, c.`custom_qualité_client` as qualite,
			c.custom_satisfaction_client as satisfaction, c.custom_nom_commercial as commercial,
			c.image, c.modified,
			(select max(v.date) from `tabVisite Commerciale` v where v.client = c.name and v.docstatus < 2) as derniere_visite,
			(select count(*) from `tabItem` i where i.custom_client = c.name and i.disabled = 0
				and i.custom_type_article = 'Client') as nb_articles
		from `tabCustomer` c
		where c.disabled = 0 and {customer_scope("c.name", user)}
		order by c.customer_name asc, c.name asc
		limit %(length)s offset %(start)s
		""",
		{"start": start, "length": length},
		as_dict=True,
	)
	for row in rows:
		row.lat, row.lon = parse_gps(row.pop("gps"))
		row.grand_compte = cint(row.grand_compte)
	return rows


def _page_contacts(user, start, length):
	return frappe.db.sql(
		f"""
		select concat(c.name, '|', dl.link_name) as cle, c.name, dl.link_name as client,
			trim(concat_ws(' ', c.first_name, c.last_name)) as nom, c.designation as fonction,
			c.mobile_no as mobile, c.phone as telephone, c.email_id as email, c.is_primary_contact as principal
		from `tabContact` c
		join `tabDynamic Link` dl on dl.parent = c.name and dl.parenttype = 'Contact' and dl.link_doctype = 'Customer'
		join `tabCustomer` cu on cu.name = dl.link_name
		where cu.disabled = 0 and {customer_scope("cu.name", user)}
		order by dl.link_name asc, c.name asc
		limit %(length)s offset %(start)s
		""",
		{"start": start, "length": length},
		as_dict=True,
	)


def article_characteristics(item, meta=None):
	"""Caractéristiques non vides d'un article, regroupées par section comme dans le Desk."""
	meta = meta or frappe.get_meta("Item")
	sections = []
	current = None
	for field in meta.fields:
		if field.fieldtype in ("Section Break", "Tab Break"):
			current = None
			if field.label:
				current = {"section": field.label, "valeurs": []}
				sections.append(current)
			continue
		if field.fieldtype in LAYOUT_TYPES or field.fieldtype not in ARTICLE_VALUE_TYPES:
			continue
		if not field.fieldname.startswith("custom_") or field.fieldname in ARTICLE_SKIPPED_FIELDS or field.hidden:
			continue
		value = item.get(field.fieldname)
		if field.fieldtype == "Check":
			if not cint(value):
				continue
			value = "Oui"
		elif value in (None, "", 0, 0.0):
			continue
		if current is None:
			current = {"section": _("Général"), "valeurs": []}
			sections.append(current)
		current["valeurs"].append({"label": _(field.label or field.fieldname), "valeur": value})
	return [section for section in sections if section["valeurs"]]


def _page_articles(user, start, length):
	meta = frappe.get_meta("Item")
	names = [
		row.name
		for row in frappe.db.sql(
			f"""
			select i.name from `tabItem` i
			where i.disabled = 0 and i.custom_type_article = 'Client' and ifnull(i.custom_client, '') != ''
				and {customer_scope("i.custom_client", user)}
			order by i.custom_client asc, i.name asc
			limit %(length)s offset %(start)s
			""",
			{"start": start, "length": length},
			as_dict=True,
		)
	]
	if not names:
		return []
	# `select *` : plusieurs champs personnalisés ont des noms accentués (custom_procédé…).
	items = frappe.db.sql("select * from `tabItem` where name in %(names)s", {"names": names}, as_dict=True)
	bats = _latest_bat_status(names)
	rows = []
	for item in sorted(items, key=lambda i: (i.custom_client or "", i.name)):
		rows.append(
			{
				"name": item.name,
				"designation": item.item_name or item.description or item.name,
				"description": item.description,
				"client": item.custom_client,
				"code_client": item.custom_code_client,
				"procede": item.get("custom_procédé"),
				"dimensions": item.custom_dimensions_h_x_l,
				"support": item.custom_type_support,
				"image": item.image,
				"groupe": item.item_group,
				"parent": item.custom_article_parent,
				"sous_article": cint(item.custom_sous_article),
				"compose": cint(item.custom_article_compose),
				"fiche_technique": item.custom_fiche_technique_article,
				"trace_decoupe": item.get("custom_tracé_forme_découpe"),
				"consommation_annuelle": item.custom_consommation_annuelle,
				"bat": bats.get(item.name),
				"caracteristiques": article_characteristics(item, meta),
				"modified": item.modified,
			}
		)
	return rows


def _latest_bat_status(items):
	"""Dernier BAT non obsolète de chaque article : {article: {name, status, date}}."""
	rows = frappe.get_all(
		"BAT",
		filters={"article": ["in", items], "status": ["!=", "Obsolète"]},
		fields=["name", "article", "status", "date", "modified"],
		order_by="modified desc",
	)
	latest = {}
	for row in rows:
		latest.setdefault(row.article, {"name": row.name, "status": row.status, "date": row.date})
	return latest


def _page_visites(user, start, length):
	since = add_days(today(), -VISIT_HISTORY_DAYS)
	return frappe.db.sql(
		f"""
		select v.name, v.status, v.docstatus, v.date, v.client, v.nom_client, v.type_visite,
			v.heure_debut_visite as debut, v.heure_fin_visite as fin, v.duree_visite as duree,
			v.wilaya, v.commune, v.notes, v.date_rdv, v.utilisateur, v.nom_utilisateur,
			v.resultat_recouvrement, v.montant_encaisse, v.date_prochaine_relance, v.modified
		from `tabVisite Commerciale` v
		where v.docstatus < 2 and v.date >= %(since)s
			and (v.utilisateur = %(user)s or {customer_scope("v.client", user)})
		order by v.date desc, v.name desc
		limit %(length)s offset %(start)s
		""",
		{"since": since, "user": user, "start": start, "length": length},
		as_dict=True,
	)


def _page_rdv(user, start, length):
	since = add_days(today(), -RDV_HISTORY_DAYS)
	return frappe.db.sql(
		f"""
		select r.name, r.status, r.date_heure, r.client, r.raison_sociale, r.statut_client,
			r.details, r.commercial, r.nom_commercial, r.modified
		from `tabRendez Vous Client` r
		where r.date_heure >= %(since)s
			and (r.commercial = %(user)s or {customer_scope("r.client", user)})
		order by r.date_heure asc, r.name asc
		limit %(length)s offset %(start)s
		""",
		{"since": since, "user": user, "start": start, "length": length},
		as_dict=True,
	)


def _page_appels(user, start, length):
	since = add_days(today(), -CALL_HISTORY_DAYS)
	return frappe.db.sql(
		"""
		select a.name, a.status, a.type, a.date, a.heure, a.client, a.notes, a.date_rappel, a.modified
		from `tabAppel Telephonique` a
		where a.utilisateur = %(user)s and (a.date >= %(since)s or a.status = 'À Rappeler')
		order by a.date desc, a.name desc
		limit %(length)s offset %(start)s
		""",
		{"since": since, "user": user, "start": start, "length": length},
		as_dict=True,
	)


SYNC_SECTIONS = {
	"clients": _page_clients,
	"contacts": _page_contacts,
	"articles": _page_articles,
	"visites": _page_visites,
	"rdv": _page_rdv,
	"appels": _page_appels,
}


# ---------------------------------------------------------------------------
# Fiche article : historique (en ligne, gardé par l'appareil après consultation)
# ---------------------------------------------------------------------------
@frappe.whitelist()
def get_article_history(item):
	"""Devis, commandes, BAT, maquettes, sous-articles et réclamations d'un article du portefeuille."""
	require_commercial()
	doc = frappe.get_doc("Item", item)
	frappe.has_permission("Item", "read", doc=doc, throw=True)
	client = doc.custom_client
	return {
		"article": item,
		"fetched_at": now_datetime(),
		"devis": frappe.db.sql(
			"""
			select q.name, q.transaction_date as date, q.status, q.docstatus, q.custom_statut_commande as statut_commande,
				qi.qty, qi.rate, qi.amount, q.currency
			from `tabQuotation Item` qi join `tabQuotation` q on q.name = qi.parent
			where qi.item_code = %s and q.docstatus < 2
			order by q.transaction_date desc, q.name desc limit 20
			""",
			item,
			as_dict=True,
		),
		"commandes": frappe.db.sql(
			"""
			select so.name, so.transaction_date as date, so.delivery_date, so.status, so.docstatus,
				so.per_delivered, so.custom_bon_de_commande_client as bon_commande_client,
				soi.qty, soi.rate, soi.amount, so.currency
			from `tabSales Order Item` soi join `tabSales Order` so on so.name = soi.parent
			where soi.item_code = %s and so.docstatus < 2
			order by so.transaction_date desc, so.name desc limit 20
			""",
			item,
			as_dict=True,
		),
		"bat": frappe.get_all(
			"BAT",
			filters={"article": item},
			fields=["name", "status", "date", "image", "fichier_valide", "code_bat_client", "valide_par_nom"],
			order_by="modified desc",
			limit=10,
		),
		"maquettes": frappe.get_all(
			"Maquette",
			filters={"article": item},
			fields=["name", "status", "ver", "fichier_maquette", "date_activation", "mode_couleur", "resume_couleurs"],
			order_by="modified desc",
			limit=10,
		),
		"sous_articles": frappe.get_all(
			"Item",
			filters={"custom_article_parent": item},
			fields=["name", "item_name", "description", "custom_quantite_sous_article as quantite"],
			order_by="name asc",
		),
		# Les réclamations portent sur le client (pas de lien article) : les plus récentes du client.
		"reclamations_client": frappe.db.sql(
			"""
			select name, status, date_creation, type_reclamation, `procédé` as procede
			from `tabReclamations Clients`
			where client = %s and docstatus < 2
			order by date_creation desc limit 10
			""",
			client,
			as_dict=True,
		)
		if client
		else [],
	}
