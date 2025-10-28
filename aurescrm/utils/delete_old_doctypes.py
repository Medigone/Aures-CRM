"""
Utilitaire pour supprimer les anciens DocTypes remplacés dans le module Production v2.0
"""

import frappe

def delete_old_production_doctypes():
    """Supprimer les anciens DocTypes de production"""
    
    doctypes_to_delete = [
        "Etape Production",
        "Matiere Etape Production"
    ]
    
    for doctype_name in doctypes_to_delete:
        try:
            if frappe.db.exists("DocType", doctype_name):
                print(f"Suppression de {doctype_name}...")
                
                # Supprimer le DocType
                frappe.delete_doc("DocType", doctype_name, force=True, ignore_missing=True)
                
                print(f"✓ {doctype_name} supprimé avec succès")
            else:
                print(f"⚠ {doctype_name} n'existe pas dans la base de données")
                
        except Exception as e:
            print(f"✗ Erreur lors de la suppression de {doctype_name}: {str(e)}")
            frappe.log_error(f"Erreur suppression {doctype_name}: {str(e)}")
    
    # Commit les changements
    frappe.db.commit()
    print("\n✓ Suppression terminée et commit effectué")
    
    return True

