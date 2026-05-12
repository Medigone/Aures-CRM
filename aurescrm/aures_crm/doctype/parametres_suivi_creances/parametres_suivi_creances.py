# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class ParametresSuiviCreances(Document):
	pass


def is_suivi_creances_actif() -> bool:
	if not frappe.db.exists("DocType", "Parametres Suivi Creances"):
		return True
	return bool(frappe.db.get_single_value("Parametres Suivi Creances", "suivi_creances_actif"))


def assert_suivi_creances_actif():
	if not is_suivi_creances_actif():
		frappe.throw(
			_("Le suivi des créances est désactivé. Activez-le dans Paramètres Suivi Créances."),
			title=_("Suivi des créances"),
		)


@frappe.whitelist()
def generer_creances_par_client():
	"""Crée une fiche Creance Client vide pour chaque client actif qui n'en a pas."""
	frappe.only_for(("System Manager", "Administrateur Ventes"))
	assert_suivi_creances_actif()

	customers = frappe.get_all("Customer", filters={"disabled": 0}, fields=["name"], order_by="name")
	created = 0
	skipped = 0
	errors = []

	for row in customers:
		cname = row.name
		try:
			if frappe.db.exists("Creance Client", {"client": cname}):
				skipped += 1
				continue
			doc = frappe.get_doc({"doctype": "Creance Client", "client": cname})
			doc.insert()
			created += 1
		except Exception as e:
			errors.append({"client": cname, "message": str(e)})

	frappe.db.commit()
	return {"created": created, "skipped": skipped, "total": len(customers), "errors": errors}


@frappe.whitelist()
def get_stats():
	"""Nombre de clients actifs et de fiches créance (pour affichage dans les paramètres)."""
	frappe.only_for(("System Manager", "Administrateur Ventes"))
	nb_clients = frappe.db.count("Customer", {"disabled": 0})
	nb_creances = frappe.db.count("Creance Client")
	return {"nb_clients_actifs": nb_clients, "nb_creances_existantes": nb_creances}
