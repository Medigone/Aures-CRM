import frappe
from frappe.model.document import Document
from datetime import datetime, timedelta


class EtudeTechnique(Document):
    pass


# def create_etude_technique(doc, method):
#     if doc.custom_procédé == "Offset":
#         # Vérifiez si le client est renseigné
#         if not doc.custom_client:
#             frappe.logger().warning(f"No client linked to Item: {doc.name}")
#             return

#         # Récupérer le champ 'custom_commercial_attribué' du client
#         custom_commercial = frappe.db.get_value("Customer", doc.custom_client, "custom_commercial_attribué")

#         # Gérer le cas où le champ est vide
#         if not custom_commercial:
#             frappe.logger().warning(f"No custom_commercial_attribué found for Client: {doc.custom_client}")
#             custom_commercial = "Commercial par défaut"

#         frappe.logger().info(f"Custom Commercial for Client {doc.custom_client}: {custom_commercial}")

#         # Créez un nouveau document "Etude Technique Offset"
#         new_etude = frappe.get_doc({
#             "doctype": "Etude Technique Offset",
#             "article": doc.name,
#             "client": doc.custom_client,
#             "date_echeance": datetime.now() + timedelta(days=14),
#             "commercial": custom_commercial,
#             "status": "Nouveau"
#         })

#         new_etude.insert()
#         frappe.logger().info(f"Etude Technique Offset created for Item: {doc.name}")
