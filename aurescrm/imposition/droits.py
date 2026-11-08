# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Qui voit les coûts de l'imposition : l'équipe devis seule (Chargé Devis, Responsable Devis), et l'administration.

Prix à la tonne, coût matière et coût pour 1000 ne sortent jamais du serveur pour les autres rôles ; le Desk les
masque par le niveau de permission 1 des mêmes champs.
"""

import frappe

ROLES_COUTS = frozenset({"Chargé Devis", "Responsable Devis", "System Manager"})
CHAMPS_COUTS = ("cout_matiere", "cout_par_1000", "cout_complet")


def voit_couts(user=None):
	user = user or frappe.session.user
	if user == "Administrator":
		return True
	return bool(ROLES_COUTS & set(frappe.get_roles(user)))


def masquer_ligne(ligne):
	"""Une ligne de scénario sans ses coûts, pour qui ne les voit pas. Rendue telle quelle sinon."""
	if not isinstance(ligne, dict) or voit_couts():
		return ligne
	return {cle: valeur for cle, valeur in ligne.items() if cle not in CHAMPS_COUTS}


def masquer_lignes(lignes):
	if voit_couts():
		return lignes
	return [masquer_ligne(ligne) for ligne in lignes or []]
