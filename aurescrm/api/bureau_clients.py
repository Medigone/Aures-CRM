# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Clients du poste de bureau (/bureau/clients) : liste, fiche, création d'un prospect et modification.

Même contrat que `bureau.py` : les listes passent par `frappe.get_list` pour garder les permissions, chaque écriture
passe par `doc.insert()` ou `doc.save()` pour garder validations et hooks, et une modification reçoit la date
`modified` affichée à l'écran. Un document lié que le rôle ne peut pas lire donne une liste vide, pas une erreur.
"""

import frappe
from frappe import _
from frappe.utils import cint, cstr, flt, get_fullname, strip_html, today

from aurescrm.api import activity
from aurescrm.api.bureau import (
	BELL_FIELD,
	CLOSED_STATUSES,
	NOBODY,
	TICKET,
	URGENCE_RANK,
	_commercial_users,
	_parse,
	condition_filters,
	doctype_filter_fields,
	has_child_filter,
	page_bounds,
	require_bureau,
	row_bell,
	row_tags,
)
from aurescrm.api.commercial_mobile import _latest_bat_status, parse_gps
from aurescrm.commercial_assignment import get_current_company
from aurescrm.custom_permissions import can_view_customer_activity, get_customer_edit_status

CUSTOMER = "Customer"
CREANCE = "Creance Client"
SOLDEE = "Soldée"
COMMERCIAL_FIELD = "custom_commercial_attribué"
GROUP_FIELD = "custom_groupe_de_sociétés"
PHONE_FIELD = "custom_téléphone"
MAIN_PHONE_FIELD = "custom_nº_téléphone_principal"

LIST_FIELDS = [
	"name",
	"modified",
	"creation",
	"custom_date_existence",
	"customer_name",
	"custom_status",
	"custom_wilaya",
	"customer_group",
	"custom_nom_commercial",
	"custom_nom_contact_principal",
	"custom_grand_compte",
	PHONE_FIELD,
	MAIN_PHONE_FIELD,
	"_user_tags",
	BELL_FIELD,
]

VIEWS = {
	"all": lambda row: True,
	"actif": lambda row: row["status"] == "Actif",
	"prospect": lambda row: row["status"] == "Prospect",
	"dormant": lambda row: row["status"] == "Dormant",
	"creance": lambda row: row["creance"] > 0,
	"perdu": lambda row: row["status"] in ("Perdu", "Exclu"),
}
SORT_KEYS = {"client", "status", "wilaya", "commercial", "visite", "creance", "tickets", "categorie", "contact", "telephone", "name", "creation", "date", "modified"}

RELATED_LIMIT = 50
COMMUNE_SEARCH_LIMIT = 12
NOTE_LENGTH = 300

# Seuls ces champs se modifient depuis la fenêtre ; le commercial et le statut ont leur propre traitement.
EDITABLE_FIELDS = {
	"customer_name": "customer_name",
	"status": "custom_status",
	"forme_juridique": "custom_forme_juridique",
	"categorie": "customer_group",
	"commune": "custom_commune",
	"contact": "custom_nom_contact_principal",
	"telephone": PHONE_FIELD,
	"email": "custom_email",
	"groupe": GROUP_FIELD,
	"sensibilite_prix": "custom_sensibilité_prix",
	"sensibilite_delais": "custom_sensibilité_délais",
	"sensibilite_qualite": "custom_sensibilité_qualité",
	"sensibilite_process": "custom_sensibilité_process",
	"rc": "custom_nº_rc",
	"nif": "custom_nº_nif",
	"nis": "custom_nº_nis",
	"ai": "custom_nº_ai",
}
REQUIRED_VALUES = {
	"customer_name": _("Saisissez la raison sociale."),
	"forme_juridique": _("Choisissez la forme juridique."),
	"categorie": _("Choisissez la catégorie."),
	"commune": _("Choisissez la commune."),
	"commercial": _("Choisissez le commercial."),
}
# Pièce administrative → (libellé, champ du numéro, champ du fichier).
ADMIN_PIECES = {
	"rc": ("Nº RC", "custom_nº_rc", "custom_fichier_rc"),
	"nif": ("Nº NIF", "custom_nº_nif", "custom_fichier_nif"),
	"nis": ("Nº NIS", "custom_nº_nis", "custom_fichier_nis"),
	"ai": ("Nº AI", "custom_nº_ai", "custom_fichier_ai"),
}


def _readable(doctype):
	return frappe.has_permission(doctype, "read")


def _soldes():
	"""Solde restant par client, sur les créances non soldées, pour qui peut lire les créances."""
	if not _readable(CREANCE):
		return {}
	rows = frappe.get_all(
		CREANCE,
		filters={"statut": ["!=", SOLDEE]},
		fields=["client", "sum(solde_restant) as total"],
		group_by="client",
	)
	return {row.client: flt(row.total) for row in rows}


def _last_visits():
	"""Dernière visite passée par client : une visite planifiée n'est pas encore une visite."""
	if not _readable("Visite Commerciale"):
		return {}
	rows = frappe.get_all(
		"Visite Commerciale",
		filters={"docstatus": ["<", 2], "date": ["<=", today()]},
		fields=["client", "max(date) as last"],
		group_by="client",
	)
	return {row.client: row.last for row in rows}


def _open_tickets():
	if not _readable(TICKET):
		return {}
	rows = frappe.get_all(
		TICKET,
		filters={"status": ["not in", CLOSED_STATUSES]},
		fields=["customer", "count(name) as total"],
		group_by="customer",
	)
	return {row.customer: row.total for row in rows}


def _list_row(client, soldes, visits, tickets):
	return {
		"name": client.name,
		"modified": client.modified,
		"creation": str(client.creation),
		"date": str(client.custom_date_existence) if client.custom_date_existence else None,
		"tags": row_tags(client),
		"cloche": row_bell(client),
		"client": client.customer_name or client.name,
		"status": client.custom_status,
		"wilaya": client.custom_wilaya,
		"categorie": client.customer_group,
		"commercial": client.custom_nom_commercial,
		"contact": client.custom_nom_contact_principal,
		"telephone": client.get(PHONE_FIELD) or client.get(MAIN_PHONE_FIELD),
		"grand_compte": cint(client.custom_grand_compte),
		"visite": visits.get(client.name),
		"creance": soldes.get(client.name, 0),
		"tickets": tickets.get(client.name, 0),
	}


def order_clients(rows, sort=None, direction=None):
	"""Par raison sociale, ou par la colonne demandée. Une ligne sans valeur reste à la fin, dans les deux sens."""
	key = sort if sort in SORT_KEYS else "client"
	descending = cstr(direction) == "desc" and sort in SORT_KEYS

	def text(row):
		return cstr(row["client"]).casefold()

	ordered = sorted(rows, key=text)
	filled = [row for row in ordered if row.get(key) not in (None, "")]
	empty = [row for row in ordered if row.get(key) in (None, "")]

	def value(row):
		item = row[key]
		return item if isinstance(item, (int, float)) else cstr(item).casefold()

	# Le tri de Python est stable : à valeur égale, l'ordre alphabétique reste, y compris en sens inverse.
	return sorted(filled, key=value, reverse=descending) + empty


@frappe.whitelist()
def get_clients(view="all", conditions=None, search=None, start=0, page_length=None, sort=None, direction=None):
	"""Une page de la liste, le total, l'ordre de toute la vue, et les compteurs de toutes les vues pour les mêmes filtres."""
	require_bureau()
	if view not in VIEWS:
		frappe.throw(_("Vue inconnue."))
	value = cstr(search).strip()
	pattern = f"%{value}%"
	conditions = condition_filters(_parse(conditions), CUSTOMER)
	clients = frappe.get_list(
		CUSTOMER,
		filters=[["disabled", "=", 0], *conditions],
		distinct=has_child_filter(conditions, CUSTOMER),
		or_filters=[
			["customer_name", "like", pattern],
			["name", "like", pattern],
			["custom_wilaya", "like", pattern],
			["custom_nom_contact_principal", "like", pattern],
		]
		if value
		else None,
		fields=LIST_FIELDS,
		limit_page_length=0,
	)
	soldes, visits, tickets = _soldes(), _last_visits(), _open_tickets()
	rows = [_list_row(client, soldes, visits, tickets) for client in clients]
	counts = {name: sum(1 for row in rows if test(row)) for name, test in VIEWS.items()}
	ordered = order_clients([row for row in rows if VIEWS[view](row)], sort, direction)
	first, length = page_bounds(len(ordered), start, page_length)
	return {
		"clients": ordered[first : first + length],
		"counts": counts,
		"total": len(ordered),
		"start": first,
		"page_length": length,
		# Toute la vue, pour aller au client voisin depuis la fiche, au-delà de la page affichée.
		"names": [row["name"] for row in ordered],
	}


def _select_options(fieldname):
	return [option for option in (frappe.get_meta(CUSTOMER).get_field(fieldname).options or "").split("\n") if option]


@frappe.whitelist()
def get_client_options():
	"""Valeurs proposées dans les filtres et dans la fenêtre du client.

	Ces listes de référence ne contiennent que des noms : tout rôle du bureau les reçoit, sans droit sur chacune.
	"""
	require_bureau()
	plain = lambda values: [{"value": value, "label": value} for value in values]
	categories = frappe.get_all("Customer Group", filters={"is_group": 0}, order_by="name asc", pluck="name", limit_page_length=0)
	wilayas = frappe.get_all("Wilayas", order_by="name asc", pluck="name", limit_page_length=0)
	commercials = [{"value": user.name, "label": user.full_name or user.name} for user in _commercial_users()]
	return {
		"statuses": _select_options("custom_status"),
		"formes": _select_options("custom_forme_juridique"),
		"sensibilites": _select_options("custom_sensibilité_prix"),
		"categories": categories,
		"groupes": frappe.get_all("Groupe de societes", order_by="name asc", pluck="name", limit_page_length=0),
		"wilayas": wilayas,
		"commercials": commercials,
		"nobody": NOBODY,
		"filter_fields": doctype_filter_fields(
			CUSTOMER,
			{
				COMMERCIAL_FIELD: [{"value": NOBODY, "label": _("Non attribué")}, *commercials],
				"customer_group": plain(categories),
				"custom_wilaya": plain(wilayas),
			},
		),
	}


@frappe.whitelist()
def search_communes(search=None):
	"""Communes proposées dans la fenêtre : la wilaya en découle sur le client."""
	require_bureau()
	value = cstr(search).strip()
	return frappe.get_list(
		"Communes",
		or_filters=[["commune", "like", f"%{value}%"], ["wilaya", "like", f"%{value}%"]] if value else None,
		fields=["name", "commune", "wilaya"],
		order_by="commune asc",
		limit_page_length=COMMUNE_SEARCH_LIMIT,
	)


def _note(value):
	text = " ".join(strip_html(cstr(value)).split())
	return text if len(text) <= NOTE_LENGTH else f"{text[:NOTE_LENGTH].rstrip()}…"


def ticket_rows(filters=None, or_filters=None):
	rows = frappe.get_list(
		TICKET,
		filters=filters,
		or_filters=or_filters,
		fields=["name", "request_type", "status", "niveau_urgence", "echeance"],
		order_by="modified desc",
		limit_page_length=RELATED_LIMIT,
	)
	current_day = today()
	for row in rows:
		row.is_open = row.status not in CLOSED_STATUSES
		row.is_late = bool(row.is_open and row.echeance and str(row.echeance) < current_day)
	# Ouverts d'abord, les plus urgents en tête, puis la plus proche échéance.
	rows.sort(key=lambda row: (not row.is_open, -URGENCE_RANK.get(row.niveau_urgence, 0), not row.echeance, str(row.echeance or "")))
	return rows


def _tickets(name):
	if not _readable(TICKET):
		return []
	return ticket_rows({"customer": name})


def _creance(name):
	if not _readable(CREANCE):
		return None
	creance = frappe.get_list(
		CREANCE,
		filters={"client": name},
		fields=["name", "statut", "solde_restant", "date_prochaine_relance", "dernier_resultat_recouvrement"],
		limit_page_length=1,
	)
	if not creance:
		return None
	row = creance[0]
	row.mouvements = frappe.get_list(
		"Mouvement Creance Client",
		filters={"creance_client": row.name},
		fields=["name", "date_mouvement", "type_mouvement", "type_paiement", "sens", "montant"],
		order_by="date_mouvement desc, creation desc",
		limit_page_length=RELATED_LIMIT,
	)
	return row


def _ventes(doctype, filters):
	if not _readable(doctype):
		return []
	fields = ["name", "transaction_date", "grand_total", "status"]
	if doctype == "Quotation":
		fields.append("custom_statut_commande")
	return frappe.get_list(doctype, filters=filters, fields=fields, order_by="transaction_date desc, name desc", limit_page_length=RELATED_LIMIT)


def _articles(name):
	if not _readable("Item"):
		return []
	rows = frappe.get_list(
		"Item",
		filters={"custom_client": name, "custom_type_article": "Client", "disabled": 0},
		fields=["name", "item_name", "custom_code_client", "custom_procédé"],
		order_by="name asc",
		limit_page_length=RELATED_LIMIT,
	)
	names = [row.name for row in rows]
	if not names:
		return []
	bats = _latest_bat_status(names) if _readable("BAT") else {}
	last_orders = dict(
		frappe.db.sql(
			"""
			select soi.item_code, max(so.transaction_date)
			from `tabSales Order Item` soi join `tabSales Order` so on so.name = soi.parent
			where soi.item_code in %(names)s and so.docstatus < 2
			group by soi.item_code
			""",
			{"names": names},
		)
	)
	return [
		{
			"name": row.name,
			"designation": row.item_name or row.name,
			"reference": row.custom_code_client,
			"procede": row.get("custom_procédé"),
			"bat": (bats.get(row.name) or {}).get("status"),
			"derniere_commande": last_orders.get(row.name),
		}
		for row in rows
	]


def _relation(name):
	"""Visites, rendez-vous et appels du client, du plus récent au plus ancien."""
	items = []
	if _readable("Visite Commerciale"):
		for row in frappe.get_list(
			"Visite Commerciale",
			filters={"client": name, "docstatus": ["<", 2]},
			fields=["name", "date", "type_visite", "status", "nom_utilisateur", "notes"],
			order_by="date desc",
			limit_page_length=RELATED_LIMIT,
		):
			items.append({"name": row.name, "doctype": "Visite Commerciale", "kind": "Visite", "date": row.date, "objet": row.type_visite, "who": row.nom_utilisateur, "status": row.status, "note": _note(row.notes)})
	if _readable("Rendez Vous Client"):
		for row in frappe.get_list(
			"Rendez Vous Client",
			filters={"client": name},
			fields=["name", "date_heure", "status", "nom_commercial", "details"],
			order_by="date_heure desc",
			limit_page_length=RELATED_LIMIT,
		):
			items.append({"name": row.name, "doctype": "Rendez Vous Client", "kind": "Rendez-vous", "date": row.date_heure, "objet": None, "who": row.nom_commercial, "status": row.status, "note": _note(row.details)})
	if _readable("Appel Telephonique"):
		for row in frappe.get_list(
			"Appel Telephonique",
			filters={"client": name},
			fields=["name", "date", "type", "status", "nom_utilisateur", "notes"],
			order_by="date desc",
			limit_page_length=RELATED_LIMIT,
		):
			items.append({"name": row.name, "doctype": "Appel Telephonique", "kind": "Appel", "date": row.date, "objet": row.type, "who": row.nom_utilisateur, "status": row.status, "note": _note(row.notes)})
	items.sort(key=lambda item: cstr(item["date"]), reverse=True)
	return items


def _contacts(doc):
	"""Le contact principal de la fiche, puis les contacts liés au client, sans doublon."""
	contacts = []
	if doc.custom_nom_contact_principal or doc.get(PHONE_FIELD) or doc.custom_email:
		contacts.append(
			{
				"nom": doc.custom_nom_contact_principal,
				"fonction": None,
				"telephone": doc.get(PHONE_FIELD) or doc.get(MAIN_PHONE_FIELD),
				"email": doc.custom_email or doc.custom_email_principal_client,
				"principal": 1,
			}
		)
	if not _readable("Contact"):
		return contacts
	rows = frappe.db.sql(
		"""
		select trim(concat_ws(' ', c.first_name, c.last_name)) as nom, c.designation as fonction,
			coalesce(nullif(c.mobile_no, ''), c.phone) as telephone, c.email_id as email, c.is_primary_contact as principal
		from `tabContact` c
		join `tabDynamic Link` dl on dl.parent = c.name and dl.parenttype = 'Contact' and dl.link_doctype = 'Customer'
		where dl.link_name = %(name)s
		order by c.is_primary_contact desc, c.name asc
		limit %(limit)s
		""",
		{"name": doc.name, "limit": RELATED_LIMIT},
		as_dict=True,
	)
	known = {cstr(contact["nom"]).casefold() for contact in contacts}
	for row in rows:
		if cstr(row.nom).casefold() in known:
			# Le contact principal de la fiche gagne sa fonction, s'il existe aussi comme contact.
			contacts[0]["fonction"] = contacts[0]["fonction"] or row.fonction
			continue
		row.principal = 0 if contacts else cint(row.principal)
		contacts.append(row)
	return contacts


def _commune_labels(names):
	"""Le nom d'une commune est un identifiant : seul son champ `commune` se lit à l'écran."""
	names = [name for name in names if name]
	if not names:
		return {}
	return dict(frappe.get_all("Communes", filters={"name": ["in", names]}, fields=["name", "commune"], as_list=True))


def _adresses(doc):
	rows = []
	if _readable("Adresses de livraison"):
		rows = frappe.get_list(
			"Adresses de livraison",
			filters={"client": doc.name, "desactiver": 0},
			fields=["name", "commune", "wilaya"],
			limit_page_length=RELATED_LIMIT,
		)
	labels = _commune_labels([doc.custom_commune, *(row.commune for row in rows)])
	main = {
		"label": "Adresse principale",
		"commune": labels.get(doc.custom_commune) or doc.custom_commune,
		"wilaya": doc.custom_wilaya,
		"texte": doc.primary_address and strip_html(doc.primary_address).strip(),
	}
	return [main, *({"label": "Adresse de livraison", "commune": labels.get(row.commune) or row.commune, "wilaya": row.wilaya, "texte": None} for row in rows)]


def _rating(value):
	"""Une note Frappe vaut de 0 à 1 ; elle s'affiche sur 5. Sans note : rien, plutôt qu'un zéro trompeur."""
	return round(flt(value) * 5, 1) if flt(value) else None


def _client_payload(doc):
	user = frappe.session.user
	lat, lon = parse_gps(doc.custom_gps)
	can_activity = can_view_customer_activity(user, doc.name)
	return {
		"name": doc.name,
		"modified": doc.modified,
		"tags": row_tags(doc.as_dict()),
		"client": doc.customer_name or doc.name,
		"status": doc.custom_status,
		"forme_juridique": doc.custom_forme_juridique,
		"categorie": doc.customer_group,
		"groupe": doc.get(GROUP_FIELD),
		"depuis": doc.custom_date_existence,
		"commune": doc.custom_commune,
		"commune_label": _commune_labels([doc.custom_commune]).get(doc.custom_commune) or doc.custom_commune,
		"wilaya": doc.custom_wilaya,
		"map_url": f"https://www.google.com/maps?q={lat},{lon}" if lat is not None else None,
		"commercial": doc.custom_nom_commercial,
		"commercial_user": doc.get(COMMERCIAL_FIELD),
		"contact": doc.custom_nom_contact_principal,
		"telephone": doc.get(PHONE_FIELD),
		"email": doc.custom_email,
		"visite": _last_visits().get(doc.name),
		"grand_compte": cint(doc.custom_grand_compte),
		"prioritaire": cint(doc.custom_client_prioritaire),
		"petites_quantites": cint(doc.get("custom_client_avec_petites_quantités")),
		"qualite": _rating(doc.get("custom_qualité_client")),
		"satisfaction": _rating(doc.custom_satisfaction_client),
		"sensibilites": {
			"prix": doc.get("custom_sensibilité_prix"),
			"delais": doc.get("custom_sensibilité_délais"),
			"qualite": doc.get("custom_sensibilité_qualité"),
			"process": doc.get("custom_sensibilité_process"),
		},
		"pieces": [
			{"key": key, "label": label, "numero": doc.get(number), "fichier": doc.get(file)}
			for key, (label, number, file) in ADMIN_PIECES.items()
		],
		"attributions": [
			{"societe": row.company, "commercial": row.commercial_name or row.commercial, "principal": cint(row.is_principal)}
			for row in doc.custom_commercial_assignments
		],
		"contacts": _contacts(doc),
		"adresses": _adresses(doc),
		"tickets": _tickets(doc.name),
		"creance": _creance(doc.name),
		"devis": _ventes("Quotation", {"quotation_to": CUSTOMER, "party_name": doc.name, "docstatus": ["<", 2]}),
		"commandes": _ventes("Sales Order", {"customer": doc.name, "docstatus": ["<", 2]}),
		"articles": _articles(doc.name),
		"relation": _relation(doc.name),
		"comments": activity.comment_summary(CUSTOMER, doc.name) if can_activity else {"count": 0, "last": None},
		"can_edit": bool(doc.has_permission("write") and get_customer_edit_status(user, doc.name).get("can_edit")),
		"can_view_activity": bool(can_activity),
	}


@frappe.whitelist()
def get_client(name):
	require_bureau()
	doc = frappe.get_doc(CUSTOMER, name)
	doc.check_permission("read")
	return _client_payload(doc)


def _check_unique_name(customer_name, current=None):
	label = cstr(customer_name).strip().upper()
	existing = frappe.db.get_value(CUSTOMER, {"customer_name": label}, "name")
	if existing and existing != current:
		frappe.throw(_("Un client « {0} » existe déjà.").format(label))


def _check_commercial(commercial, current=None):
	if commercial != current and commercial not in {user.name for user in _commercial_users()}:
		frappe.throw(_("Choisissez un commercial de la liste."))


def _company():
	company = get_current_company() or frappe.defaults.get_global_default("company") or frappe.db.get_value("Company", {}, "name")
	if not company:
		frappe.throw(_("Aucune société n'est définie : le commercial ne peut pas être attribué."))
	return company


def _set_principal(doc, commercial):
	"""Le commercial devient le principal de la société. Les hooks du Customer tiennent le champ historique à jour."""
	company = _company()
	found = False
	for row in doc.custom_commercial_assignments:
		if row.company != company:
			continue
		row.is_principal = 1 if row.commercial == commercial else 0
		found = found or row.commercial == commercial
	if not found:
		doc.append(
			"custom_commercial_assignments",
			{"company": company, "commercial": commercial, "commercial_name": get_fullname(commercial), "is_principal": 1},
		)
	doc.set(COMMERCIAL_FIELD, commercial)
	doc.custom_nom_commercial = get_fullname(commercial)


def _clean_values(values):
	values = _parse(values) or {}
	return {key: cstr(value).strip() for key, value in values.items()}


def _check_required(values, keys):
	for key in keys:
		if not values.get(key):
			frappe.throw(REQUIRED_VALUES[key])


@frappe.whitelist(methods=["POST"])
def create_prospect(values=None):
	"""Crée un prospect. Le commercial est obligatoire : sans lui, le hook attribuerait le client à la personne qui saisit."""
	require_bureau()
	values = _clean_values(values)
	_check_required(values, REQUIRED_VALUES)
	_check_unique_name(values["customer_name"])
	_check_commercial(values["commercial"])
	doc = frappe.new_doc(CUSTOMER)
	doc.update(
		{
			"customer_name": values["customer_name"],
			"customer_type": "Company",
			"custom_status": "Prospect",
			"custom_forme_juridique": values["forme_juridique"],
			"customer_group": values["categorie"],
			"custom_commune": values["commune"],
			"custom_nom_contact_principal": values.get("contact") or None,
			PHONE_FIELD: values.get("telephone") or None,
			"custom_email": values.get("email") or None,
		}
	)
	_set_principal(doc, values["commercial"])
	doc.insert()
	return {"name": doc.name}


def _client_for_write(name, modified):
	"""Client à modifier : mêmes droits que le Desk, et version identique à celle affichée à l'écran."""
	require_bureau()
	doc = frappe.get_doc(CUSTOMER, name)
	doc.check_permission("write")
	if not get_customer_edit_status(frappe.session.user, name).get("can_edit"):
		frappe.throw(_("Vous ne pouvez pas modifier ce client."), frappe.PermissionError)
	if modified and cstr(modified) != str(doc.modified):
		frappe.throw(
			_("Ce client vient d'être modifié par ailleurs. Il a été rechargé : vérifiez-le, puis recommencez."),
			frappe.TimestampMismatchError,
		)
	return doc


@frappe.whitelist(methods=["POST"])
def update_client(name, modified, values=None):
	doc = _client_for_write(name, modified)
	values = _clean_values(values)
	_check_required(values, [key for key in REQUIRED_VALUES if key in values])
	if "customer_name" in values:
		_check_unique_name(values["customer_name"], name)
	if values.get("commercial") and values["commercial"] != doc.get(COMMERCIAL_FIELD):
		_check_commercial(values["commercial"], doc.get(COMMERCIAL_FIELD))
		_set_principal(doc, values["commercial"])
	for key, fieldname in EDITABLE_FIELDS.items():
		if key in values:
			doc.set(fieldname, values[key] or None)
	doc.save()
	return _client_payload(doc)


def bind_file(doctype, name, fieldname, file_url):
	"""Rattache au champ le fichier déjà joint au document.

	Sans cela, Frappe crée une seconde ligne `File` à l'enregistrement, et le fil annonce le fichier deux fois.
	"""
	free = frappe.db.get_value(
		"File", {"file_url": file_url, "attached_to_doctype": doctype, "attached_to_name": name, "attached_to_field": ["is", "not set"]}, "name"
	)
	if free:
		frappe.db.set_value("File", free, "attached_to_field", fieldname, update_modified=False)


@frappe.whitelist(methods=["POST"])
def set_client_piece(name, modified, piece, file_url):
	"""Range un fichier déjà envoyé dans la pièce administrative choisie."""
	doc = _client_for_write(name, modified)
	if piece not in ADMIN_PIECES:
		frappe.throw(_("Pièce inconnue."))
	if not frappe.db.exists("File", {"file_url": file_url, "attached_to_doctype": CUSTOMER, "attached_to_name": name}):
		frappe.throw(_("Ce fichier n'est pas joint à ce client."))
	bind_file(CUSTOMER, name, ADMIN_PIECES[piece][2], file_url)
	doc.set(ADMIN_PIECES[piece][2], file_url)
	doc.save()
	return _client_payload(doc)


def _check_activity(name):
	require_bureau()
	if not can_view_customer_activity(frappe.session.user, name):
		frappe.throw(_("Vous n'avez pas accès à l'activité de ce client."), frappe.PermissionError)


@frappe.whitelist()
def get_client_activity(name):
	_check_activity(name)
	return activity.get_feed(CUSTOMER, name)


@frappe.whitelist(methods=["POST"])
def add_client_comment(name, text, mentions=None):
	_check_activity(name)
	return activity.add_comment(CUSTOMER, name, text, mentions)


@frappe.whitelist(methods=["POST"])
def update_client_comment(name, comment, text, mentions=None):
	_check_activity(name)
	return activity.update_comment(CUSTOMER, name, comment, text, mentions)


@frappe.whitelist(methods=["POST"])
def delete_client_comment(name, comment):
	_check_activity(name)
	return activity.delete_comment(CUSTOMER, name, comment)
