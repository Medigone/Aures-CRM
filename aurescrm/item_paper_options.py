# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

import frappe

TYPE_PAPIER_DEFAULTS = (
	"Autocollant",
	"Bristol",
	"BBTB",
	"BB",
	"BBTB FSC",
	"B Gris",
	"B Kraft",
	"Papier Offset",
	"REH",
	"REH Martelé",
	"REH Martelé Métallisé",
	"Thermosoudable",
	"NCR",
	"Listing",
	"lamine",
	"Couché",
	"Goblet avec PE",
	"Autres",
)

GRAMMAGE_PAPIER_DEFAULTS = (
	45,
	50,
	60,
	70,
	80,
	90,
	100,
	115,
	130,
	150,
	200,
	210,
	220,
	230,
	250,
	265,
	270,
	275,
	290,
	300,
	305,
	320,
	330,
	350,
	355,
	360,
	380,
	400,
	450,
	900,
)


def ensure_type_papier(libelle):
	libelle = (libelle or "").strip()
	if not libelle:
		return None
	if frappe.db.exists("Type Papier", libelle):
		return libelle
	doc = frappe.get_doc({"doctype": "Type Papier", "libelle": libelle})
	doc.insert(ignore_permissions=True)
	return doc.name


def ensure_grammage_papier(valeur):
	try:
		valeur_int = int(valeur)
	except (TypeError, ValueError):
		return None
	name = str(valeur_int)
	if frappe.db.exists("Grammage Papier", name):
		return name
	doc = frappe.get_doc({"doctype": "Grammage Papier", "valeur": valeur_int})
	doc.insert(ignore_permissions=True)
	return doc.name


def seed_type_papier_defaults():
	for libelle in TYPE_PAPIER_DEFAULTS:
		ensure_type_papier(libelle)


def seed_grammage_papier_defaults():
	for valeur in GRAMMAGE_PAPIER_DEFAULTS:
		ensure_grammage_papier(valeur)


def get_type_papier_options():
	return frappe.get_all(
		"Type Papier",
		filters={"disabled": 0},
		pluck="name",
		order_by="libelle asc",
	)


def get_grammage_papier_options():
	return frappe.get_all(
		"Grammage Papier",
		pluck="name",
		order_by="valeur asc",
	)


def is_valid_type_papier(value):
	value = (value or "").strip()
	return bool(value and frappe.db.exists("Type Papier", value))


def is_valid_grammage_papier(value):
	value = (value or "").strip()
	return bool(value and frappe.db.exists("Grammage Papier", value))
