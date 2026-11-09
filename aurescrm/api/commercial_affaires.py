# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Affaires du portefeuille pour la PWA commerciale : tickets, devis, commandes (et fabrication),
réclamations, BAT. Sections de l'instantané (`get_sync_page`) et consultations en ligne.

Toutes les listes sont limitées au portefeuille du commercial (`customer_scope`).
"""

import frappe
from frappe.utils import add_days, today

from aurescrm.api.commercial_mobile import customer_scope, require_commercial

TICKET_HISTORY_DAYS = 180
SALES_HISTORY_DAYS = 365
RECLAMATION_HISTORY_DAYS = 365
MOUVEMENTS_LIMIT = 30


def _in(values):
	"""Paramètre SQL `in %(...)s` : jamais vide (MariaDB refuse `in ()`)."""
	return tuple(values) or ("",)


# ---------------------------------------------------------------------------
# Sections de l'instantané
# ---------------------------------------------------------------------------
def page_tickets(user, start, length):
	since = add_days(today(), -TICKET_HISTORY_DAYS)
	return frappe.db.sql(
		f"""
		select t.name, t.status, t.docstatus, t.customer as client, t.customer_name, t.request_type, t.priority,
			t.channel, t.description, t.echeance, t.site, t.niveau_urgence, t.niveau_urgence_demande,
			t.statut_demande_urgence, t.commentaire_validation_urgence, t.statut_creance, t.motif_blocage_creance,
			t.assigne_a_nom, t.commercial, t.nom_commercial, t.creation_date, t.creation, t.modified
		from `tabTicket Commercial` t
		where (t.docstatus = 0 or t.modified >= %(since)s)
			and (t.commercial = %(user)s or {customer_scope("t.customer", user)})
		order by t.modified desc, t.name desc
		limit %(length)s offset %(start)s
		""",
		{"since": since, "user": user, "start": start, "length": length},
		as_dict=True,
	)


def _lines(child_doctype, parents):
	rows = frappe.db.sql(
		f"""
		select parent, item_code, item_name, qty, rate, amount, delivery_date
		from `tab{child_doctype}` where parent in %(parents)s order by parent, idx
		""" if child_doctype == "Sales Order Item" else f"""
		select parent, item_code, item_name, qty, rate, amount
		from `tab{child_doctype}` where parent in %(parents)s order by parent, idx
		""",
		{"parents": _in(parents)},
		as_dict=True,
	)
	grouped = {}
	for row in rows:
		grouped.setdefault(row.pop("parent"), []).append(row)
	return grouped


def page_devis(user, start, length):
	from aurescrm.devis_envoi import champs_prets

	since = add_days(today(), -SALES_HISTORY_DAYS)
	# Suivi de l'envoi au client : les champs n'existent qu'après la migration.
	envoi = ", q.custom_envoye_le as envoye_le, q.custom_canal_envoi as canal_envoi" if champs_prets() else ""
	rows = frappe.db.sql(
		f"""
		select q.name, q.party_name as client, q.customer_name, q.transaction_date as date, q.valid_till,
			q.status, q.docstatus, q.custom_statut_commande as statut_commande, q.grand_total, q.currency,
			q.`custom_demande_faisabilité` as demande_faisabilite, q.modified{envoi}
		from `tabQuotation` q
		where q.quotation_to = 'Customer' and q.docstatus < 2 and q.transaction_date >= %(since)s
			and {customer_scope("q.party_name", user)}
		order by q.transaction_date desc, q.name desc
		limit %(length)s offset %(start)s
		""",
		{"since": since, "start": start, "length": length},
		as_dict=True,
	)
	lines = _lines("Quotation Item", [r.name for r in rows])
	for row in rows:
		row.lignes = lines.get(row.name, [])
	return rows


def page_commandes(user, start, length):
	since = add_days(today(), -SALES_HISTORY_DAYS)
	rows = frappe.db.sql(
		f"""
		select so.name, so.customer as client, so.customer_name, so.transaction_date as date, so.delivery_date,
			so.status, so.docstatus, so.per_delivered, so.per_billed, so.grand_total, so.currency,
			so.custom_bon_de_commande_client as bon_commande_client, so.custom_date_bon_de_commande as date_bon_commande,
			so.custom_devis as devis, so.modified
		from `tabSales Order` so
		where so.docstatus < 2 and so.transaction_date >= %(since)s and {customer_scope("so.customer", user)}
		order by so.transaction_date desc, so.name desc
		limit %(length)s offset %(start)s
		""",
		{"since": since, "start": start, "length": length},
		as_dict=True,
	)
	names = [r.name for r in rows]
	lines = _lines("Sales Order Item", names)
	fabrication = fabrication_summary(names)
	for row in rows:
		row.lignes = lines.get(row.name, [])
		row.fabrication = fabrication.get(row.name)
	return rows


def fabrication_summary(sales_orders):
	"""Avancement de fabrication par commande : dossier, études techniques, ordres de production."""
	if not sales_orders:
		return {}
	summary = {name: {"dossier": None, "etudes": [], "ordres": []} for name in sales_orders}
	for row in frappe.db.sql(
		"select name, status, sales_order from `tabDossier Fabrication` where sales_order in %(so)s",
		{"so": _in(sales_orders)},
		as_dict=True,
	):
		summary[row.sales_order]["dossier"] = {"name": row.name, "status": row.status}
	for row in frappe.db.sql(
		"""
		select name, status, commande, article, nom_article, date_echeance
		from `tabEtude Technique` where commande in %(so)s order by name
		""",
		{"so": _in(sales_orders)},
		as_dict=True,
	):
		summary[row.pop("commande")]["etudes"].append(row)
	for row in frappe.db.sql(
		"""
		select name, status, sales_order, article, machine, quantite_a_produire, quantite_produite,
			date_debut_prevue, date_fin_prevue, date_fin_reelle, priorite
		from `tabOrdre de Production` where sales_order in %(so)s and docstatus < 2 order by name
		""",
		{"so": _in(sales_orders)},
		as_dict=True,
	):
		summary[row.pop("sales_order")]["ordres"].append(row)
	return summary


def page_reclamations(user, start, length):
	since = add_days(today(), -RECLAMATION_HISTORY_DAYS)
	return frappe.db.sql(
		f"""
		select r.name, r.status, r.docstatus, r.client, r.nom_client, r.type_reclamation, r.`procédé` as procede,
			r.date_creation, r.date_echeance, r.date_resolution, r.visite, r.observations, r.traitement, r.modified
		from `tabReclamations Clients` r
		where r.docstatus < 2 and (r.docstatus = 0 or r.date_creation >= %(since)s)
			and (r.id_commercial = %(user)s or {customer_scope("r.client", user)})
		order by r.date_creation desc, r.name desc
		limit %(length)s offset %(start)s
		""",
		{"since": since, "user": user, "start": start, "length": length},
		as_dict=True,
	)


def page_bats(user, start, length):
	return frappe.db.sql(
		f"""
		select b.name, b.status, b.date, b.client, b.article, b.designation_article, b.image, b.fichier_valide,
			b.code_bat_client, b.valide_par_nom, b.modified
		from `tabBAT` b
		where b.status != 'Obsolète' and {customer_scope("b.client", user)}
		order by b.modified desc, b.name desc
		limit %(length)s offset %(start)s
		""",
		{"start": start, "length": length},
		as_dict=True,
	)


AFFAIRES_SECTIONS = {
	"tickets": page_tickets,
	"devis": page_devis,
	"commandes": page_commandes,
	"reclamations": page_reclamations,
	"bats": page_bats,
}


def affaires_references(select_options):
	return {
		"types_ticket": select_options("Ticket Commercial", "request_type"),
		"priorites_ticket": select_options("Ticket Commercial", "priority"),
		"canaux_ticket": select_options("Ticket Commercial", "channel"),
		"sites": frappe.get_all(
			"Site Production", filters={"status": ["!=", "Inactif"]}, fields=["name", "title", "procede"], order_by="title asc"
		),
		"types_reclamation": select_options("Reclamations Clients", "type_reclamation"),
	}


# ---------------------------------------------------------------------------
# Consultations en ligne (gardées par l'appareil)
# ---------------------------------------------------------------------------
@frappe.whitelist()
def get_ticket_cycle(ticket):
	"""Cycle du ticket : demandes de faisabilité, études, devis et commandes (ou dossiers Essai Blanc)."""
	require_commercial()
	from aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial import get_cycle_documents

	return {"ticket": ticket, "fetched_at": frappe.utils.now_datetime(), **get_cycle_documents(ticket)}


@frappe.whitelist()
def get_creance_detail(creance):
	"""Derniers mouvements d'une créance du portefeuille."""
	require_commercial()
	doc = frappe.get_doc("Creance Client", creance)
	doc.check_permission("read")
	return {
		"creance": creance,
		"fetched_at": frappe.utils.now_datetime(),
		"solde_restant": doc.solde_restant,
		"montant_initial": doc.montant_initial,
		"total_recouvre": doc.total_recouvre,
		"statut": doc.statut,
		"observations": doc.observations,
		"mouvements": frappe.get_all(
			"Mouvement Creance Client",
			filters={"creance_client": creance, "docstatus": ["<", 2]},
			fields=["name", "date_mouvement", "type_mouvement", "sens", "montant", "type_paiement", "source_visite"],
			order_by="date_mouvement desc, creation desc",
			limit=MOUVEMENTS_LIMIT,
		),
	}

