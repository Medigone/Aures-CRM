# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""
Met à jour le modèle d’e-mail « Lien upload maquette client » en base.

Les fixtures Frappe ne réappliquent pas toujours les enregistrements existants : ce patch force
le contenu (logo, bouton copier, sans WhatsApp / formats) sur chaque site après déploiement.
"""

import frappe

TEMPLATE_NAME = "Lien upload maquette client"

SUBJECT = (
    "{{ (doc.get('customer_name', '') or doc.get('name', '')) }} — Dépôt de votre {{ requested_file }}"
)


def execute() -> None:
    path = frappe.get_app_path("aurescrm", "email_templates", "lien_upload_maquette_client.html")
    body = frappe.read_file(path)
    if not body or not body.strip():
        frappe.log_error(
            message=f"Fichier modèle introuvable ou vide : {path}",
            title="Nextcloud Email Template",
        )
        return

    if not frappe.db.exists("Email Template", TEMPLATE_NAME):
        doc = frappe.get_doc(
            {
                "doctype": "Email Template",
                "name": TEMPLATE_NAME,
                "subject": SUBJECT,
                "use_html": 1,
                "response_html": body,
            }
        )
        doc.insert(ignore_permissions=True)
        print(f"Email Template « {TEMPLATE_NAME} » créé.", flush=True)
        return

    doc = frappe.get_doc("Email Template", TEMPLATE_NAME)
    doc.subject = SUBJECT
    doc.use_html = 1
    doc.response_html = body
    doc.save(ignore_permissions=True)
    print(f"Email Template « {TEMPLATE_NAME} » mis à jour.", flush=True)
