// Configuration du calendrier pour "Visite Commerciale"
frappe.views.calendar["Visite Commerciale"] = {
    field_map: {
        "start": "date",    // Date prévue de la visite
        "end": "date",      // Même champ pour les visites ponctuelles
        "id": "name",              // Identifiant unique
        "title": "nom_client"      // Utiliser le nom du client (customer_name)
    },
    get_events_method: "aurescrm.aures_crm.doctype.visite_commerciale.visite_commerciale.get_events"
};