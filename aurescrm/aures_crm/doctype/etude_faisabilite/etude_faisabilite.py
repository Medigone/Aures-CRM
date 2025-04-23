# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class EtudeFaisabilite(Document):
	pass


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
