import frappe

def uppercase_customer_name(doc, method):
    # Convertir le nom du client en majuscules s'il existe
    if doc.customer_name:
        doc.customer_name = doc.customer_name.upper()

def set_default_commercial(doc, method):
    if not doc.custom_commercial_attribué:  # Si le champ est vide
        # Attribuer le créateur comme commercial
        doc.custom_commercial_attribué = doc.owner
        
        # Récupérer le nom complet du créateur
        full_name = frappe.db.get_value("User", doc.owner, "full_name") or frappe.utils.get_fullname(doc.owner)
        doc.custom_nom_commercial = full_name

@frappe.whitelist()
def get_customer_contacts(customer):
    """
    Récupère la liste des contacts liés à un client (via Dynamic Link) et
    renvoie un tableau d'objets, chacun contenant :
      - docname: le nom du document contact
      - contact: concaténation prénom + nom
      - designation: fonction
      - mobile: numéro mobile principal
      - email: email principal
    """
    contacts_data = []

    # Récupère les Dynamic Links associant le client aux contacts
    dynamic_links = frappe.get_all(
        "Dynamic Link",
        filters={
            "link_doctype": "Customer",
            "link_name": customer
        },
        fields=["parent"]
    )
    contact_names = [d.parent for d in dynamic_links]

    # Parcours de chaque contact pour en extraire les infos utiles
    for contact_name in contact_names:
        contact_doc = frappe.get_doc("Contact", contact_name)
        full_name = (contact_doc.first_name or "") + " " + (contact_doc.last_name or "")
        designation = contact_doc.designation or ""

        # Recherche du mobile principal
        mobile = ""
        if contact_doc.phone_nos:
            primary_mobile = next((p.phone for p in contact_doc.phone_nos if p.is_primary_mobile_no), None)
            mobile = primary_mobile or (contact_doc.phone_nos[0].phone if contact_doc.phone_nos else "")

        # Recherche de l'email principal
        email = ""
        if contact_doc.email_ids:
            primary_email = next((e.email_id for e in contact_doc.email_ids if e.is_primary), None)
            email = primary_email or (contact_doc.email_ids[0].email_id if contact_doc.email_ids else "")

        contacts_data.append({
            "docname": contact_doc.name,
            "contact": full_name.strip(),
            "designation": designation,
            "mobile": mobile,
            "email": email
        })

    return contacts_data
