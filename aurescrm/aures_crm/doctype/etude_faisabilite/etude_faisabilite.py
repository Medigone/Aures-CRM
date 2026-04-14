# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import math

import frappe
from frappe.model.document import Document
from frappe.utils import flt


def compute_nbr_feuilles(quantite, nbr_poses):
	"""Nombre de feuilles nécessaires : quantité / poses par feuille (arrondi supérieur, 2 décimales)."""
	if not quantite or not nbr_poses or nbr_poses <= 0:
		return 0
	return flt(math.ceil(float(quantite) / float(nbr_poses)), 2)


class EtudeFaisabilite(Document):
	def before_save(self):
		if self.article and not self.trace:
			self.auto_link_existing_trace()
		self.set_format_machine()

	def validate(self):
		self.set_nbr_feuilles()
		self.validate_imposition_machine_compatibility()

	def set_nbr_feuilles(self):
		if not self.imposition:
			self.nbr_feuilles = 0
			return
		nbr_poses = frappe.db.get_value("Imposition", self.imposition, "nbr_poses") or 0
		self.nbr_feuilles = compute_nbr_feuilles(self.quantite, nbr_poses)

	def auto_link_existing_trace(self):
		existing_trace = frappe.db.exists("Trace", {"article": self.article})
		if existing_trace:
			self.trace = existing_trace

	def set_format_machine(self):
		if self.machine_prevue:
			machine = frappe.db.get_value(
				"Machine",
				self.machine_prevue,
				["format_max_laize", "format_max_developpement"],
				as_dict=True,
			)
			if machine and machine.format_max_laize and machine.format_max_developpement:
				self.format_machine = f"{machine.format_max_laize}x{machine.format_max_developpement}"
			else:
				self.format_machine = ""
		else:
			self.format_machine = ""

	def validate_imposition_machine_compatibility(self):
		if not self.machine_prevue or not self.imposition:
			return

		machine = frappe.db.get_value(
			"Machine",
			self.machine_prevue,
			["format_max_laize", "format_max_developpement"],
			as_dict=True,
		)
		imposition = frappe.db.get_value(
			"Imposition",
			self.imposition,
			["format_laize", "format_developpement"],
			as_dict=True,
		)
		if not machine or not imposition:
			return

		if imposition.format_laize and machine.format_max_laize:
			if flt(imposition.format_laize) > flt(machine.format_max_laize):
				frappe.msgprint(
					_("La laize de l'imposition ({0} mm) dépasse le format max de la machine ({1} mm)").format(
						imposition.format_laize, machine.format_max_laize
					),
					indicator="orange",
					title=_("Attention"),
				)

		if imposition.format_developpement and machine.format_max_developpement:
			if flt(imposition.format_developpement) > flt(machine.format_max_developpement):
				frappe.msgprint(
					_("Le développement de l'imposition ({0} mm) dépasse le format max de la machine ({1} mm)").format(
						imposition.format_developpement, machine.format_max_developpement
					),
					indicator="orange",
					title=_("Attention"),
				)


@frappe.whitelist()
def refresh_attached_files(docname):
    """
    Récupère les fichiers attachés depuis les documents Trace et Imposition liés
    et les renvoie pour mise à jour dans le document Etude Faisabilite.
    """
    try:
        etude = frappe.get_doc("Etude Faisabilite", docname)
        result = {}
        
        # Récupérer le fichier de tracé si un tracé est lié
        if etude.trace:
            trace_doc = frappe.get_doc("Trace", etude.trace)
            if trace_doc.fichier_trace:
                result["fichier_trace"] = trace_doc.fichier_trace
        
        # Récupérer le fichier d'imposition si une imposition est liée
        if etude.imposition:
            imposition_doc = frappe.get_doc("Imposition", etude.imposition)
            if imposition_doc.fichier_imp:
                result["fichier_imp"] = imposition_doc.fichier_imp
        
        return result
    except Exception as e:
        frappe.log_error(message=str(e), title="Erreur refresh_attached_files")
        return {"error": str(e)}


@frappe.whitelist()
def get_existing_trace_for_article(article):
	if not article:
		return None
	existing_trace = frappe.db.exists("Trace", {"article": article})
	return existing_trace


@frappe.whitelist()
def get_compatible_impositions(doctype, txt, searchfield, start, page_len, filters):
	"""Return impositions compatible with the selected machine format."""
	article = filters.get("article")
	trace = filters.get("trace")
	machine = filters.get("machine")

	if not article or not trace:
		return []

	conditions = "i.article = %(article)s AND i.trace = %(trace)s"
	params = {"article": article, "trace": trace, "txt": f"%{txt}%", "start": int(start), "page_len": int(page_len)}

	if machine:
		machine_doc = frappe.db.get_value(
			"Machine", machine, ["format_max_laize", "format_max_developpement"], as_dict=True
		)
		if machine_doc:
			if machine_doc.format_max_laize:
				conditions += " AND (i.format_laize = 0 OR i.format_laize IS NULL OR i.format_laize <= %(max_laize)s)"
				params["max_laize"] = machine_doc.format_max_laize
			if machine_doc.format_max_developpement:
				conditions += " AND (i.format_developpement = 0 OR i.format_developpement IS NULL OR i.format_developpement <= %(max_dev)s)"
				params["max_dev"] = machine_doc.format_max_developpement

	if txt:
		conditions += " AND (i.name LIKE %(txt)s OR i.format_imp LIKE %(txt)s)"

	return frappe.db.sql(
		f"""
		SELECT i.name, i.format_imp, i.nbr_poses, i.taux_chutes
		FROM `tabImposition` i
		WHERE {conditions}
		ORDER BY i.modified DESC
		LIMIT %(start)s, %(page_len)s
		""",
		params,
	)
