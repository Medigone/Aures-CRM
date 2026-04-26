# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Création rétroactive des dossiers Nextcloud (sans liens de dépôt) pour les clients actifs."""


import frappe
from aurescrm.integrations.nextcloud import bulk_create_folders_for_all_customers


def execute() -> None:
    res = bulk_create_folders_for_all_customers(dry_run=False)
    frappe.clear_cache()
    msg = frappe._(
        "Nextcloud (migration) : {created} dossiers créés, {upgraded} URL converties en /f/, {skipped} déjà persistantes, {errors} erreurs sur {total} clients actifs."
    ).format(
        created=res.get("dossiers_crees", 0),
        upgraded=res.get("url_mises_a_niveau_fileid", 0),
        skipped=res.get("deja_persistantes_ou_ignorees", 0),
        errors=res.get("erreurs", 0),
        total=res.get("total", 0),
    )
    # Visible dans la console ``bench migrate`` (pas d’environnement de formulaire)
    print(msg, flush=True)
