import frappe
from frappe import _

from aurescrm.aures_crm.doctype.dossier_fabrication.dossier_fabrication import (
	create_dossier_from_sales_order,
)


def _niveau_urgence_pour_etude_technique(sales_order_doc, demande_name):
	"""
	Niveau d'urgence pour une Etude Technique créée depuis la commande.
	Priorité au champ de la commande (custom_niveau_urgence, ex. U2), sinon la demande, sinon U0.
	"""
	allowed = ("U0", "U1", "U2", "U3")
	nu = getattr(sales_order_doc, "custom_niveau_urgence", None)
	if nu in allowed:
		return nu
	so_name = getattr(sales_order_doc, "name", None) or sales_order_doc.get("name")
	if so_name:
		nu = frappe.db.get_value("Sales Order", so_name, "custom_niveau_urgence")
		if nu in allowed:
			return nu
	if demande_name:
		nu = frappe.db.get_value("Demande Faisabilite", demande_name, "niveau_urgence")
		if nu in allowed:
			return nu
	return "U0"


def update_quotation_status_on_so_submit(doc, method):
    """
    Hook called on Sales Order submission.
    Updates both the status and custom command status of the linked Quotation.
    Works even if the quotation is already "Ordered" to handle cancellations.
    """
    # Check if this Sales Order has a linked source Quotation via the custom field 'custom_devis'
    if doc.custom_devis:
        quotation_name = doc.custom_devis
        
        try:
            # Get the current status of the quotation first to avoid unnecessary updates
            current_status = frappe.db.get_value("Quotation", quotation_name, "status")

            if current_status is None:
                # Quotation doesn't exist, log error
                frappe.log_error(f"Source Quotation {quotation_name} not found for Sales Order {doc.name}", "update_quotation_status_on_so_submit")
                return

            # Analyser l'état de commande du devis (toujours, même si déjà "Ordered")
            command_analysis = analyze_quotation_command_status(quotation_name)
            
            # Mettre à jour le statut standard
            if command_analysis["is_fully_ordered"]:
                new_status = "Ordered"
                status_message = "Commandé"
            else:
                new_status = "Open"  # Remettre à "Open" si plus entièrement commandé
                status_message = "Ouvert"
            
            # Mettre à jour les champs
            frappe.db.set_value("Quotation", quotation_name, "status", new_status)
            frappe.db.set_value("Quotation", quotation_name, "custom_statut_commande", command_analysis["custom_status"])
            frappe.db.set_value("Quotation", quotation_name, "custom_pourcentage_commande", command_analysis["percentage"])
            frappe.db.set_value("Quotation", quotation_name, "modified", frappe.utils.now())
            
            # Message seulement si le statut a changé
            if current_status != new_status:
                frappe.msgprint(_("Devis {0} mis à jour - Statut: {1}, Commande: {2} ({3}%)").format(
                    quotation_name, status_message, command_analysis["custom_status"], command_analysis["percentage"]
                ))
                
        except Exception as e:
            # Catch potential errors from db.set_value or db.get_value
            frappe.log_error(f"Failed to update Quotation {quotation_name} status from SO {doc.name}: {e}", "update_quotation_status_on_so_submit")
            # Provide feedback to the user
            frappe.msgprint(_("Échec de la mise à jour du statut du Devis lié : {0}").format(e), indicator='red', title=_('Erreur'))


def update_quotation_status_on_so_cancel(doc, method):
    """
    Hook called on Sales Order cancellation.
    Updates the status and custom command status of the linked Quotation.
    """
    if doc.custom_devis:
        quotation_name = doc.custom_devis
        
        try:
            # Get the current status of the quotation
            current_status = frappe.db.get_value("Quotation", quotation_name, "status")

            if current_status is None:
                frappe.log_error(f"Source Quotation {quotation_name} not found for Sales Order {doc.name}", "update_quotation_status_on_so_cancel")
                return

            # Analyser l'état de commande du devis
            command_analysis = analyze_quotation_command_status(quotation_name)
            
            # Mettre à jour le statut standard
            if command_analysis["is_fully_ordered"]:
                new_status = "Ordered"
                status_message = "Commandé"
            else:
                new_status = "Open"  # Remettre à Open si plus entièrement commandé
                status_message = "Ouvert"
            
            # Mettre à jour les champs
            frappe.db.set_value("Quotation", quotation_name, "status", new_status)
            frappe.db.set_value("Quotation", quotation_name, "custom_statut_commande", command_analysis["custom_status"])
            frappe.db.set_value("Quotation", quotation_name, "custom_pourcentage_commande", command_analysis["percentage"])
            frappe.db.set_value("Quotation", quotation_name, "modified", frappe.utils.now())
            
            # Message seulement si le statut a changé
            if current_status != new_status:
                frappe.msgprint(_("Devis {0} mis à jour - Statut: {1}, Commande: {2} ({3}%)").format(
                    quotation_name, status_message, command_analysis["custom_status"], command_analysis["percentage"]
                ))
                
        except Exception as e:
            frappe.log_error(f"Failed to update Quotation {quotation_name} status from SO {doc.name}: {e}", "update_quotation_status_on_so_cancel")
            frappe.msgprint(_("Échec de la mise à jour du statut du Devis lié : {0}").format(e), indicator='red', title=_('Erreur'))


@frappe.whitelist()
def generate_technical_studies(sales_order_name):
	"""
	Legacy / bouton commande : crée le Dossier Fabrication si absent.
	Les études techniques se créent depuis une ligne du programme livraison du dossier.
	"""
	try:
		sales_order = frappe.get_doc("Sales Order", sales_order_name)
		had_before = frappe.db.exists("Dossier Fabrication", {"sales_order": sales_order_name})
		name = create_dossier_from_sales_order(sales_order)
		if name:
			link = frappe.utils.get_link_to_form("Dossier Fabrication", name)
			if not had_before:
				frappe.msgprint(
					_("Dossier fabrication créé : {0}. Programmez les livraisons puis créez les études depuis le dossier.").format(
						link
					),
					indicator="green",
					title=_("Dossier fabrication"),
				)
			else:
				frappe.msgprint(
					_("Dossier fabrication : {0}. Programmez les livraisons puis créez les études depuis la grille « Programme livraison ».").format(
						link
					),
					indicator="blue",
					title=_("Dossier fabrication"),
				)
		else:
			frappe.msgprint(
				_(
					"Impossible de créer le dossier fabrication (demande de faisabilité liée "
					"et étude de faisabilité « Réalisable » avec tracé et imposition requis)."
				),
				indicator="yellow",
				title=_("Attention"),
			)
	except Exception as e:
		frappe.log_error(
			f"generate_technical_studies dossier for Sales Order {sales_order_name}: {e}",
			"generate_technical_studies",
		)
		frappe.msgprint(
			_("Échec : {0}").format(str(e)),
			indicator="red",
			title=_("Erreur"),
		)


@frappe.whitelist()
def check_existing_technical_studies(sales_order_name):
	"""Retourne True si un Dossier Fabrication existe déjà pour cette commande."""
	return bool(frappe.db.exists("Dossier Fabrication", {"sales_order": sales_order_name}))


@frappe.whitelist()
def get_sales_order_fabrication_dashboard(sales_order_name):
	"""Données pour le bloc HTML commande : lien vers le dossier fabrication (études créées depuis le dossier)."""
	dossier_name = frappe.db.get_value(
		"Dossier Fabrication", {"sales_order": sales_order_name}, "name"
	)
	return {"dossier": dossier_name}

@frappe.whitelist()
def get_technical_studies_for_sales_order(sales_order_name):
    """
    Get all technical studies linked to a specific Sales Order.
    Returns a list of technical studies with their details.
    """
    technical_studies = frappe.get_all(
        "Etude Technique",
        filters={"commande": sales_order_name},
        fields=["name", "status", "article", "nom_article", "technicien", "date_echeance"]
    )
    
    return technical_studies

def validate_bon_de_commande(doc, method):
    """Vérifie si les champs 'custom_bon_de_commande_client' et 'custom_date_bon_de_commande' sont remplis avant la soumission.
    
    Cette fonction est appelée via le hook 'before_submit'.
    """
    if not doc.custom_bon_de_commande_client or not doc.custom_date_bon_de_commande:
        frappe.throw(_("Veuillez renseigner les champs 'Bon de Commande Client' et 'Date Bon de Commande' avant de soumettre la commande."))

def analyze_quotation_command_status(quotation_name):
    """
    Analyse complète de l'état de commande d'un devis
    Retourne un dictionnaire avec toutes les informations nécessaires
    """
    # Récupérer tous les articles du devis
    quotation_items = frappe.get_all(
        "Quotation Item",
        filters={"parent": quotation_name},
        fields=["item_code", "qty", "rate"]
    )
    
    if not quotation_items:
        return {
            "is_fully_ordered": False,
            "custom_status": "Non commandé",
            "percentage": 0,
            "total_items": 0,
            "ordered_items": 0,
            "remaining_items": []
        }
    
    total_items = len(quotation_items)
    ordered_items = 0
    remaining_items = []
    
    # Analyser chaque article
    for item in quotation_items:
        # Pour le statut principal, ne compter que les commandes validées
        ordered_qty = get_total_ordered_qty_for_item(quotation_name, item.item_code)
        
        if ordered_qty >= item.qty:
            ordered_items += 1
        else:
            # Pour les articles restants, calculer en tenant compte de TOUTES les commandes (y compris brouillons)
            total_ordered_qty_all = get_total_ordered_qty_for_item_all_orders(quotation_name, item.item_code)
            remaining_qty = item.qty - total_ordered_qty_all
            if remaining_qty > 0:  # Seulement si il reste vraiment quelque chose à commander
                remaining_items.append({
                    "item_code": item.item_code,
                    "remaining_qty": remaining_qty,
                    "ordered_qty": total_ordered_qty_all,
                    "total_qty": item.qty
                })
    
    # Calculer le pourcentage
    percentage = round((ordered_items / total_items) * 100, 1)
    
    # Déterminer le statut personnalisé
    if percentage == 100:
        custom_status = "Entièrement commandé"
        is_fully_ordered = True
    elif percentage > 0:
        custom_status = "Partiellement commandé"
        is_fully_ordered = False
    else:
        custom_status = "Non commandé"
        is_fully_ordered = False
    
    return {
        "is_fully_ordered": is_fully_ordered,
        "custom_status": custom_status,
        "percentage": percentage,
        "total_items": total_items,
        "ordered_items": ordered_items,
        "remaining_items": remaining_items,
        "has_draft_orders": get_draft_orders_count(quotation_name) > 0,
        "draft_orders_count": get_draft_orders_count(quotation_name)
    }


def get_total_ordered_qty_for_item(quotation_name, item_code):
    """
    Calcule la quantité totale commandée pour un article donné
    Prend en compte UNIQUEMENT les commandes validées (docstatus = 1)
    """
    # Récupérer UNIQUEMENT les commandes validées
    sales_orders = frappe.get_all(
        "Sales Order",
        filters={"custom_devis": quotation_name, "docstatus": 1},  # Seulement les validées
        fields=["name", "docstatus"]
    )
    
    total_qty = 0
    for so in sales_orders:
        so_items = frappe.get_all(
            "Sales Order Item",
            filters={"parent": so.name, "item_code": item_code},
            fields=["qty"]
        )
        total_qty += sum(item.qty for item in so_items)
    
    return total_qty


def get_total_ordered_qty_for_item_all_orders(quotation_name, item_code):
    """
    Calcule la quantité totale commandée pour un article donné
    Prend en compte TOUTES les commandes liées (brouillon ET validées, sauf annulées)
    """
    # Récupérer TOUTES les commandes liées (brouillon ET soumises)
    sales_orders = frappe.get_all(
        "Sales Order",
        filters={"custom_devis": quotation_name, "docstatus": ["!=", 2]},  # Exclure seulement les annulées
        fields=["name", "docstatus"]
    )
    
    total_qty = 0
    for so in sales_orders:
        so_items = frappe.get_all(
            "Sales Order Item",
            filters={"parent": so.name, "item_code": item_code},
            fields=["qty"]
        )
        total_qty += sum(item.qty for item in so_items)
    
    return total_qty


def get_draft_orders_count(quotation_name):
    """
    Compte le nombre de commandes en brouillon liées au devis
    """
    count = frappe.db.count(
        "Sales Order",
        filters={"custom_devis": quotation_name, "docstatus": 0}
    )
    return count


@frappe.whitelist()
def get_quotation_command_details(quotation_name):
    """
    API pour récupérer les détails de commande d'un devis
    """
    return analyze_quotation_command_status(quotation_name)


@frappe.whitelist()
def get_validated_command_status(quotation_name):
    """
    Calcule le statut de commande basé uniquement sur les commandes validées (docstatus = 1)
    """
    try:
        # Récupérer seulement les commandes validées
        sales_orders = frappe.get_all(
            "Sales Order",
            filters={"custom_devis": quotation_name, "docstatus": 1},
            fields=["name"]
        )
        
        if not sales_orders:
            return {
                "custom_status": "Non commandé",
                "percentage": 0,
                "validated_orders_count": 0
            }
        
        # Récupérer les articles du devis original
        quotation_items = frappe.get_all(
            "Quotation Item",
            filters={"parent": quotation_name},
            fields=["item_code", "qty"]
        )
        
        if not quotation_items:
            return {
                "custom_status": "Non commandé", 
                "percentage": 0,
                "validated_orders_count": len(sales_orders)
            }
        
        # Calculer les quantités commandées pour chaque article (uniquement commandes validées)
        ordered_items = {}
        for item in quotation_items:
            item_code = item.item_code
            total_ordered = 0
            
            for so in sales_orders:
                so_items = frappe.get_all(
                    "Sales Order Item",
                    filters={"parent": so.name, "item_code": item_code},
                    fields=["qty"]
                )
                total_ordered += sum(item.qty for item in so_items)
            
            ordered_items[item_code] = {
                "quotation_qty": item.qty,
                "ordered_qty": total_ordered
            }
        
        # Déterminer le statut
        fully_ordered_items = 0
        partially_ordered_items = 0
        
        for item_code, data in ordered_items.items():
            if data["ordered_qty"] >= data["quotation_qty"]:
                fully_ordered_items += 1
            elif data["ordered_qty"] > 0:
                partially_ordered_items += 1
        
        total_items = len(quotation_items)
        
        if fully_ordered_items == total_items:
            custom_status = "Entièrement commandé"
            percentage = 100
        elif fully_ordered_items > 0 or partially_ordered_items > 0:
            custom_status = "Partiellement commandé"
            # Calculer le pourcentage basé sur les quantités totales
            total_quotation_qty = sum(item["quotation_qty"] for item in ordered_items.values())
            total_ordered_qty = sum(item["ordered_qty"] for item in ordered_items.values())
            percentage = min(100, int((total_ordered_qty / total_quotation_qty) * 100)) if total_quotation_qty > 0 else 0
        else:
            custom_status = "Non commandé"
            percentage = 0
        
        return {
            "custom_status": custom_status,
            "percentage": percentage,
            "validated_orders_count": len(sales_orders),
            "ordered_items": ordered_items
        }
        
    except Exception as e:
        frappe.log_error(f"Failed to calculate validated command status for quotation {quotation_name}: {e}", 
                        "get_validated_command_status")
        return {
            "custom_status": "Non commandé",
            "percentage": 0,
            "validated_orders_count": 0
        }


@frappe.whitelist()
def get_linked_sales_orders_for_quotation(quotation_name):
    """
    Récupère toutes les commandes liées à un devis avec leurs détails
    """
    try:
        # Récupérer toutes les commandes liées (brouillon ET soumises)
        sales_orders = frappe.get_all(
            "Sales Order",
            filters={"custom_devis": quotation_name, "docstatus": ["!=", 2]},  # Exclure les annulées
            fields=["name", "status", "docstatus", "creation", "grand_total", "delivery_date", 
                   "custom_date_bon_de_commande", "custom_bon_de_commande_client"],
            order_by="creation desc"
        )
        
        # Analyser l'état de commande du devis
        command_analysis = analyze_quotation_command_status(quotation_name)
        
        # Enrichir les données des commandes
        enriched_orders = []
        for so in sales_orders:
            # Déterminer le statut affiché
            if so.docstatus == 0:
                display_status = "Brouillon"
            else:
                display_status = so.status
            
            # Récupérer les articles de cette commande
            so_items = frappe.get_all(
                "Sales Order Item",
                filters={"parent": so.name},
                fields=["item_code", "item_name", "qty", "rate", "amount"],
                order_by="idx"
            )
            
            enriched_orders.append({
                "name": so.name,
                "status": display_status,
                "docstatus": so.docstatus,
                "creation": so.creation,
                "grand_total": so.grand_total,
                "delivery_date": so.delivery_date,
                "custom_date_bon_de_commande": so.custom_date_bon_de_commande,
                "custom_bon_de_commande_client": so.custom_bon_de_commande_client,
                "items_count": len(so_items),
                "items": so_items[:3],  # Limiter à 3 items pour l'affichage
                "has_more_items": len(so_items) > 3
            })
        
        return {
            "sales_orders": enriched_orders,
            "command_analysis": command_analysis,
            "total_orders": len(enriched_orders),
            "draft_orders": len([so for so in enriched_orders if so["docstatus"] == 0]),
            "submitted_orders": len([so for so in enriched_orders if so["docstatus"] == 1])
        }
        
    except Exception as e:
        frappe.log_error(f"Failed to get linked sales orders for quotation {quotation_name}: {e}", 
                        "get_linked_sales_orders_for_quotation")
        return {
            "sales_orders": [],
            "command_analysis": {"custom_status": "Non commandé", "percentage": 0},
            "total_orders": 0,
            "draft_orders": 0,
            "submitted_orders": 0
        }

