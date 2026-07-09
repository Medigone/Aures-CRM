# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import add_days, date_diff, getdate, today

ECHEANCE_DAYS = {
	"Expirés": 0,
	"Expirant dans 30 jours": 30,
	"Expirant dans 60 jours": 60,
	"Expirant dans 90 jours": 90,
}


def execute(filters=None):
	filters = filters or {}
	echeance = filters.get("echeance") or "Expirant dans 90 jours"
	limit_date = add_days(today(), ECHEANCE_DAYS.get(echeance, 90))

	columns = get_columns()

	conditions = ""
	values = {"limit_date": limit_date, "today": today()}
	if echeance == "Expirés":
		conditions = "and doc.date_expiration < %(today)s"
	else:
		conditions = "and doc.date_expiration <= %(limit_date)s"

	data = frappe.db.sql(
		"""
		select
			emp.name as employe,
			emp.nom_complet,
			emp.statut,
			doc.type_document,
			doc.date_emission,
			doc.date_expiration,
			doc.fichier,
			doc.commentaire
		from `tabDocument Employe` doc
		inner join `tabEmploye` emp on doc.parent = emp.name
		where doc.parenttype = 'Employe'
			and ifnull(doc.date_expiration, '') != ''
			{conditions}
		order by doc.date_expiration asc
		""".format(conditions=conditions),
		values,
		as_dict=True,
	)

	for row in data:
		days = date_diff(getdate(row.date_expiration), getdate(today()))
		if days < 0:
			row.etat = _("Expiré depuis {0} jour(s)").format(abs(days))
		elif days == 0:
			row.etat = _("Expire aujourd'hui")
		else:
			row.etat = _("Expire dans {0} jour(s)").format(days)

	return columns, data


def get_columns():
	return [
		{
			"fieldname": "employe",
			"label": _("Employé"),
			"fieldtype": "Link",
			"options": "Employe",
			"width": 140,
		},
		{
			"fieldname": "nom_complet",
			"label": _("Nom complet"),
			"fieldtype": "Data",
			"width": 180,
		},
		{
			"fieldname": "statut",
			"label": _("Statut"),
			"fieldtype": "Data",
			"width": 90,
		},
		{
			"fieldname": "type_document",
			"label": _("Type de document"),
			"fieldtype": "Data",
			"width": 160,
		},
		{
			"fieldname": "date_emission",
			"label": _("Date d'émission"),
			"fieldtype": "Date",
			"width": 110,
		},
		{
			"fieldname": "date_expiration",
			"label": _("Date d'expiration"),
			"fieldtype": "Date",
			"width": 110,
		},
		{
			"fieldname": "etat",
			"label": _("État"),
			"fieldtype": "Data",
			"width": 160,
		},
		{
			"fieldname": "fichier",
			"label": _("Fichier"),
			"fieldtype": "Data",
			"width": 160,
		},
		{
			"fieldname": "commentaire",
			"label": _("Commentaire"),
			"fieldtype": "Data",
			"width": 200,
		},
	]
