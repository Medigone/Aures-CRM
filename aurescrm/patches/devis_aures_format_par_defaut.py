# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Le devis s'imprime par défaut au format « Devis Aures », sur le Desk comme depuis le bureau."""

import frappe
from frappe.custom.doctype.property_setter.property_setter import make_property_setter


def execute():
	if not frappe.db.exists("Print Format", "Devis Aures"):
		return
	make_property_setter("Quotation", None, "default_print_format", "Devis Aures", "Data", for_doctype=True)
