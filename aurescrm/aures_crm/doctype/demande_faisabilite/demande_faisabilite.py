# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _ # Ajout de l'import
from frappe.utils import now_datetime, add_days, getdate, cint # Ajout de l'import


class DemandeFaisabilite(Document):
	def before_insert(self):
		if self.ticket_commercial and not self.get("niveau_urgence"):
			self.niveau_urgence = (
				frappe.db.get_value("Ticket Commercial", self.ticket_commercial, "niveau_urgence")
				or "U0"
			)

	def validate(self):
		"""Validation automatique pour synchroniser type, is_reprint et essai_blanc"""
		# Interdire les sous-articles dans la liste d'articles
		for row in self.get("liste_articles"):
			if row.article:
				is_sub = frappe.db.get_value("Item", row.article, "custom_sous_article")
				if cint(is_sub):
					frappe.throw(
						_("L'article {0} est un sous-article et ne peut pas être sélectionné "
						  "dans la demande. Veuillez sélectionner l'article parent à la place."
						).format(row.article)
					)

		# Synchronisation automatique entre type et is_reprint
		if self.type == "Retirage":
			self.is_reprint = 1
			self.essai_blanc = 0
		elif self.type == "Premier Tirage":
			self.is_reprint = 0
			self.essai_blanc = 0
		elif self.type == "Essai Blanc":
			self.essai_blanc = 1
			self.is_reprint = 0
		
		# Validation cohérence
		if self.type == "Retirage" and self.is_reprint != 1:
			frappe.throw("Incohérence détectée : Type 'Retirage' mais is_reprint n'est pas coché")
		if self.type == "Premier Tirage" and self.is_reprint != 0:
			frappe.throw("Incohérence détectée : Type 'Premier Tirage' mais is_reprint est coché")
		if self.type == "Essai Blanc" and self.essai_blanc != 1:
			frappe.throw("Incohérence détectée : Type 'Essai Blanc' mais essai_blanc n'est pas coché")
		if self.type == "Retirage" and self.essai_blanc != 0:
			frappe.throw("Incohérence détectée : Type 'Retirage' mais essai_blanc est coché")
		if self.type == "Premier Tirage" and self.essai_blanc != 0:
			frappe.throw("Incohérence détectée : Type 'Premier Tirage' mais essai_blanc est coché")
		
		# Validation pour éviter les doublons de bon de commande client pour les retirages
		if self.type == "Retirage" and self.n_bon_commande:
			# Chercher les autres demandes avec le même numéro de bon de commande
			filters = {
				"n_bon_commande": self.n_bon_commande,
				"type": "Retirage",
				"client": self.client
			}
			# Exclure le document actuel pour permettre les modifications
			if not self.is_new():
				filters["name"] = ["!=", self.name]
			
			existing_demandes = frappe.get_all(
				"Demande Faisabilite",
				filters=filters,
				fields=["name"]
			)
			
			if existing_demandes:
				frappe.throw(
					_("Un numéro de bon de commande client '{0}' existe déjà pour une autre demande de retirage (Demande : {1}). Veuillez utiliser un numéro différent.").format(
						self.n_bon_commande,
						existing_demandes[0].name
					)
				)

	def can_generate_etudes(self):
		"""
		Vérifie si la demande peut générer des études de faisabilité.
		Seul le statut "Brouillon" permet de générer des études.
		
		Returns:
			bool: True si la demande peut générer des études, False sinon
		"""
		# Seul le statut "Brouillon" permet de générer des études
		# Les autres statuts indiquent que la demande a déjà été traitée
		valid_statuses = ["Brouillon"]
		return self.status in valid_statuses
	
	def get_etudes_faisabilite(self):
		"""Récupère les études de faisabilité liées avec leurs informations d'article

		Returns:
			dict: Dictionnaire contenant les études de faisabilité et les documents de vente associés
		"""
		# Récupération des études de faisabilité liées à cette demande
		etudes = frappe.get_list(
			"Etude Faisabilite",
			filters={"demande_faisabilite": self.name},
			fields=["name", "status", "article"],
			ignore_permissions=True
		)

		# Pour chaque étude, récupérer les informations de l'article
		for etude in etudes:
			if etude.article:
				article = frappe.get_doc('Item', etude.article)
				etude.update({
					"designation_article": article.item_name,
					"code_article": article.item_code
				})

		# Récupération des documents de vente liés
		sales_documents = []

		# Récupération des devis liés
		quotations = frappe.get_list(
			"Quotation",
			filters={"custom_demande_faisabilité": self.name, "docstatus": ["!=", 2]},
			fields=["name", "status"],
			ignore_permissions=True
		)
		for qtn in quotations:
			sales_documents.append({
				"doctype": "Quotation",
				"name": qtn.name,
				"status": qtn.status
			})

		# Récupération des commandes client liées
		sales_orders = frappe.get_list(
			"Sales Order",
			filters={"custom_demande_de_faisabilité": self.name, "docstatus": ["!=", 2]},
			fields=["name", "status"],
			ignore_permissions=True
		)
		for so in sales_orders:
			sales_documents.append({
				"doctype": "Sales Order",
				"name": so.name,
				"status": so.status
			})

		return {
			"etudes": etudes,
			"sales_documents": sales_documents
		}

# --- Fonctions copiées depuis faisabilite_hook.py ---

def clean_empty_rows(demande):
	"""
	Supprime les lignes vides du tableau liste_articles
	Une ligne est considérée comme vide si le champ 'article' est vide
	"""
	if not demande.get("liste_articles"):
		return
	
	# Filtrer les lignes qui ont un article
	valid_rows = [row for row in demande.liste_articles if row.article]
	
	# Vider la table et réinsérer uniquement les lignes valides
	demande.liste_articles = []
	for row in valid_rows:
		demande.append("liste_articles", row)
	
	# Sauvegarder les modifications
	demande.save(ignore_permissions=True)


def create_maquette_if_not_exists(client, article):
	"""
	Crée une Maquette pour l'article si elle n'existe pas déjà
	Vérifie l'existence d'une maquette pour le couple (client, article)
	
	Args:
		client: Le nom du client (Customer)
		article: Le nom de l'article (Item)
	
	Returns:
		str: Le nom de la maquette existante ou nouvellement créée
	"""
	if not client or not article:
		return None
	
	# Vérifier si une maquette existe déjà pour ce client et cet article
	existing_maquette = frappe.db.get_value(
		"Maquette",
		{
			"client": client,
			"article": article
		},
		"name"
	)
	
	if existing_maquette:
		frappe.msgprint(f"Maquette existante trouvée pour l'article {article} : {existing_maquette}")
		return existing_maquette
	
	# Créer une nouvelle maquette
	try:
		maquette = frappe.new_doc("Maquette")
		maquette.client = client
		maquette.article = article
		maquette.status = "A référencer"
		maquette.ver = 0
		maquette.id_responsable = frappe.session.user
		# Laisser mode_couleur vide pour éviter les validations de couleur
		maquette.mode_couleur = ""
		
		maquette.insert(ignore_permissions=True)
		frappe.msgprint(f"Nouvelle maquette créée pour l'article {article} : {maquette.name}")
		
		return maquette.name
	except Exception as e:
		frappe.log_error(
			message=f"Erreur lors de la création de la maquette pour {article}: {str(e)}",
			title="Erreur création Maquette"
		)
		# Ne pas bloquer le processus si la création de la maquette échoue
		return None


@frappe.whitelist()
def generate_etude_faisabilite(docname):
    """
    Pour chaque ligne de la table 'liste_articles' du document Demande Faisabilite,
    crée un nouveau document 'Etude Faisabilite' ou 'Etude Faisabilite Flexo' selon le procédé.
    Si l'article est un article composé, une étude est créée par sous-article
    (quantité = quantité demandée × quantité sous-article).
    Crée une Maquette si elle n'existe pas déjà, puis met à jour le statut de la demande.
    """
    try:
        demande = frappe.get_doc("Demande Faisabilite", docname)

        if not demande.can_generate_etudes():
            frappe.throw(
                f"Impossible de générer des études de faisabilité. "
                f"Le statut actuel '{demande.status}' ne permet pas cette action. "
                f"Seul le statut 'Brouillon' (statut initial) est autorisé."
            )

        if not demande.get("liste_articles"):
            frappe.throw("Aucun article n'a été ajouté à la demande.")

        communs = [
            "demande_faisabilite", "article", "article_parent", "quantite",
            "date_livraison", "client", "commercial", "id_commercial",
            "is_reprint", "essai_blanc", "niveau_urgence",
        ]
        offset_fields = communs + []
        flexo_fields = communs + []

        etudes_creees = 0
        etudes_ignorees = 0

        for row in demande.get("liste_articles"):
            row_essai_blanc = row.essai_blanc
            if row_essai_blanc in (None, ""):
                row_essai_blanc = demande.essai_blanc

            is_compose = cint(frappe.db.get_value("Item", row.article, "custom_article_compose"))

            if is_compose:
                sous_articles = frappe.get_all(
                    "Item",
                    filters={"custom_article_parent": row.article},
                    fields=["name", "custom_quantite_sous_article", "custom_procédé"],
                )
                if not sous_articles:
                    frappe.throw(
                        _("L'article composé {0} n'a aucun sous-article. "
                          "Veuillez d'abord créer des sous-articles.").format(row.article)
                    )

                for sa in sous_articles:
                    sa_qty = float(sa.custom_quantite_sous_article or 1)
                    computed_qty = int(row.quantite * sa_qty)
                    sa_procede = sa.get("custom_procédé") or ""

                    created, ignored = _create_etude(
                        demande=demande,
                        article=sa.name,
                        article_parent=row.article,
                        quantite=computed_qty,
                        date_livraison=row.date_livraison,
                        essai_blanc=row_essai_blanc,
                        procede=sa_procede,
                        offset_fields=offset_fields,
                        flexo_fields=flexo_fields,
                    )
                    etudes_creees += created
                    etudes_ignorees += ignored
            else:
                procede = row.procede_article or ""
                created, ignored = _create_etude(
                    demande=demande,
                    article=row.article,
                    article_parent=None,
                    quantite=row.quantite,
                    date_livraison=row.date_livraison,
                    essai_blanc=row_essai_blanc,
                    procede=procede,
                    offset_fields=offset_fields,
                    flexo_fields=flexo_fields,
                )
                etudes_creees += created
                etudes_ignorees += ignored

        if etudes_ignorees > 0:
            frappe.msgprint(
                _("{0} étude(s) ignorée(s) car déjà existante(s) pour cette demande.").format(etudes_ignorees),
                indicator="orange"
            )

        demande.status = "Confirmée"
        demande.save(ignore_permissions=True)
        return demande.status
    except Exception as e:
        frappe.log_error(message=str(e), title="Erreur generate_etude_faisabilite")
        frappe.throw(f"Une erreur est survenue lors de la génération des études de faisabilité : {str(e)}")


def _create_etude(demande, article, article_parent, quantite, date_livraison,
                  essai_blanc, procede, offset_fields, flexo_fields):
    """Crée une étude (Offset ou Flexo) et la maquette associée. Retourne (created, ignored)."""
    doctype = "Etude Faisabilite Flexo" if procede == "Flexo" else "Etude Faisabilite"

    existing = frappe.db.exists(doctype, {
        "demande_faisabilite": demande.name,
        "article": article,
        "quantite": quantite,
    })
    if existing:
        return 0, 1

    create_maquette_if_not_exists(demande.client, article)

    base_values = {
        "demande_faisabilite": demande.name,
        "article": article,
        "article_parent": article_parent or "",
        "quantite": quantite,
        "date_livraison": date_livraison,
        "client": demande.client,
        "commercial": demande.commercial,
        "id_commercial": demande.id_commercial,
        "is_reprint": demande.is_reprint,
        "essai_blanc": essai_blanc,
        "niveau_urgence": getattr(demande, "niveau_urgence", None) or "U0",
    }

    fields_list = flexo_fields if procede == "Flexo" else offset_fields
    etude = frappe.new_doc(doctype)
    valid_fieldnames = {f.fieldname for f in etude.meta.fields}
    for field in fields_list:
        if field in valid_fieldnames and field in base_values:
            etude.set(field, base_values[field])
    etude.insert(ignore_permissions=True)
    etude_name = etude.name
    # Recharger et sauvegarder : l'insert lie parfois le tracé (before_save) et d'autres champs
    # dérivés / fetch (fichier_trace, points_colle, procédé, etc.) se stabilisent au 2e pass.
    # Sans cela, le desk ouvre l'étude comme « non enregistré ».
    try:
        etude = frappe.get_doc(doctype, etude_name)
        etude.save(ignore_permissions=True)
    except Exception as e:
        frappe.log_error(
            message=frappe.get_traceback(), title="Etude: sauvegarde après création"
        )
        frappe.throw(
            _(
                "L'étude {0} a été créée mais la finalisation a échoué : {1}. "
                "Ouvrez le document et enregistrez-le manuellement."
            ).format(etude_name, str(e))
        )
    return 1, 0



@frappe.whitelist()
def update_demande_status_from_etudes(doc, method):
    """
    Hook déclenché lors de la mise à jour d'un document "Etude Faisabilite".
    Il parcourt les études associées au parent "Demande Faisabilite" et
    met à jour son statut de la manière suivante :
      - "En Cours" si au moins une étude a le statut "En étude"
      - "Finalisée" si toutes les études ont le statut "Réalisable" ou "Non Réalisable"
      - "Partiellement Finalisée" si aucune étude n'est en "En étude" et au moins une est
        "Réalisable" ou "Non Réalisable"

    La mise à jour n'intervient pas si le statut du parent est "Devis Établis" ou "Annulée".
    De plus, la mise à jour ne rétrograde pas le statut ; il y a une progression monotone.
    """
    parent_name = doc.demande_faisabilite
    if not parent_name:
        return

    parent = frappe.get_doc("Demande Faisabilite", parent_name)

    # Ne pas mettre à jour si le parent est dans un état final (hors Confirmée)
    if parent.status in ["Devis Établis", "Annulée"]:
        return

    # Récupérer les statuts de toutes les études liées (Offset + Flexo)
    etudes_offset = frappe.get_all("Etude Faisabilite", filters={"demande_faisabilite": parent_name}, fields=["status"])
    etudes_flexo = frappe.get_all("Etude Faisabilite Flexo", filters={"demande_faisabilite": parent_name}, fields=["status"])
    all_etudes = etudes_offset + etudes_flexo
    if not all_etudes:
        return

    statuses = [e.status for e in all_etudes]

    # Calcul du nouveau statut en fonction des règles
    if any(s == "En étude" for s in statuses):
        computed_status = "En Cours"
    elif all(s in ["Réalisable", "Non Réalisable", "Annulée"] for s in statuses):
        computed_status = "Finalisée"
    elif any(s in ["Réalisable", "Non Réalisable"] for s in statuses):
        computed_status = "Partiellement Finalisée"
    else:
        # Si aucune règle ne s'applique, on ne modifie pas
        return

    # Classement des statuts pour assurer une progression monotone
    status_rank = {
        "Brouillon": 0,
        "Confirmée": 1,
        "En Cours": 2,
        "Partiellement Finalisée": 3,
        "Finalisée": 4
    }
    current_rank = status_rank.get(parent.status, 0)
    new_rank = status_rank.get(computed_status, 0)

    # Mise à jour uniquement si le nouveau statut est supérieur (progression) ou si le parent est en "Confirmée"
    if current_rank < new_rank or parent.status == "Confirmée":
        parent.status = computed_status
        parent.save(ignore_permissions=True)
        frappe.msgprint("Statut de la Demande Faisabilité mis à jour en: " + computed_status)


@frappe.whitelist()
def cancel_etudes_faisabilite(docname):
    """
    Tente d'annuler la Demande Faisabilite et supprimer/annuler les études liées.
    Retourne un dict avec :
      - status: "ok" si annulée
      - status: "blocked" si études bloquantes
      - blocked_etudes: liste des ID bloquants
      - deleted_count: nombre d'études supprimées
    """
    try:
        parent = frappe.get_doc("Demande Faisabilite", docname)

        # Récupérer les études Offset
        etudes_offset = frappe.get_all(
            "Etude Faisabilite",
            filters={"demande_faisabilite": docname},
            fields=["name", "status", "docstatus"]
        )
        
        # Récupérer les études Flexo
        etudes_flexo = frappe.get_all(
            "Etude Faisabilite Flexo",
            filters={"demande_faisabilite": docname},
            fields=["name", "status", "docstatus"]
        )

        # Vérifier les études bloquantes (Réalisable ou Non Réalisable) pour les deux types
        bloquees = []
        for e in etudes_offset:
            if e["status"] in ["Réalisable", "Non Réalisable"]:
                bloquees.append(f"Offset: {e['name']}")
        for e in etudes_flexo:
            if e["status"] in ["Réalisable", "Non Réalisable"]:
                bloquees.append(f"Flexo: {e['name']}")
        
        if bloquees:
            return {
                "status": "blocked",
                "blocked_etudes": bloquees
            }

        # Pas de blocage, on peut supprimer/annuler les études
        deleted_count = 0
        cancelled_count = 0
        
        # Activer le flag pour ignorer les permissions
        frappe.flags.ignore_permissions = True
        
        try:
            # Traiter les études Offset
            for e in etudes_offset:
                if e["docstatus"] == 0:
                    # Étude en brouillon : on la supprime
                    frappe.delete_doc("Etude Faisabilite", e["name"], ignore_permissions=True, force=True)
                    deleted_count += 1
                elif e["docstatus"] == 1:
                    # Étude soumise : on l'annule
                    doc = frappe.get_doc("Etude Faisabilite", e["name"])
                    doc.flags.ignore_permissions = True
                    doc.cancel()
                    cancelled_count += 1
            
            # Traiter les études Flexo
            for e in etudes_flexo:
                if e["docstatus"] == 0:
                    # Étude en brouillon : on la supprime
                    frappe.delete_doc("Etude Faisabilite Flexo", e["name"], ignore_permissions=True, force=True)
                    deleted_count += 1
                elif e["docstatus"] == 1:
                    # Étude soumise : on l'annule
                    doc = frappe.get_doc("Etude Faisabilite Flexo", e["name"])
                    doc.flags.ignore_permissions = True
                    doc.cancel()
                    cancelled_count += 1
        finally:
            # Toujours remettre le flag à False
            frappe.flags.ignore_permissions = False

        # Annuler la demande
        parent.status = "Annulée"
        parent.save(ignore_permissions=True)

        return {
            "status": "ok",
            "deleted_count": deleted_count,
            "cancelled_count": cancelled_count
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Erreur cancel_etudes_faisabilite")
        frappe.throw(_("Une erreur est survenue pendant l'annulation."))


@frappe.whitelist()
def get_articles_for_quotation(docname):
    """
    Retourne les articles éligibles au devis pour une Demande Faisabilite.
    Pour les articles composés, retourne l'article parent uniquement si TOUS
    ses sous-articles sont réalisables. La quantité est celle de la demande.
    """
    try:
        quotation_items = _resolve_quotation_articles(docname)
        if not quotation_items:
            return []

        article_ids = [qi["article"] for qi in quotation_items]
        items = frappe.get_all(
            "Item",
            filters={"name": ["in", article_ids]},
            fields=["name", "item_name", "stock_uom"],
        )
        item_dict = {item.name: item for item in items}

        results = []
        for qi in quotation_items:
            item = item_dict.get(qi["article"])
            if item:
                results.append({
                    "article": qi["article"],
                    "quantite": qi["quantite"],
                    "item_name": item.item_name,
                    "uom": item.stock_uom,
                    "date_livraison": qi["date_livraison"],
                })
        return results
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Erreur get_articles_for_quotation")
        frappe.throw(_("Impossible de récupérer les articles pour le devis."))


def _resolve_quotation_articles(docname):
    """
    Résout la liste d'articles à mettre dans le devis en tenant compte
    des articles composés (article_parent).
    Cherche dans les deux types d'études (Offset + Flexo).
    Retourne une liste de dicts : [{article, quantite, date_livraison}, ...]
    """
    demande = frappe.get_doc("Demande Faisabilite", docname)
    demande_articles = {row.article: row for row in demande.get("liste_articles")}

    common_filters = {"demande_faisabilite": docname, "status": "Réalisable"}
    common_fields = ["article", "article_parent", "quantite", "date_livraison"]

    etudes_realisables = (
        frappe.get_all("Etude Faisabilite", filters=common_filters, fields=common_fields)
        + frappe.get_all("Etude Faisabilite Flexo", filters=common_filters, fields=common_fields)
    )

    results = []
    parents_seen = set()
    articles_seen = set()

    for e in etudes_realisables:
        if e.article_parent:
            if e.article_parent in parents_seen:
                continue
            parents_seen.add(e.article_parent)

            all_etudes_for_parent = (
                frappe.get_all(
                    "Etude Faisabilite",
                    filters={"demande_faisabilite": docname, "article_parent": e.article_parent},
                    fields=["status"],
                )
                + frappe.get_all(
                    "Etude Faisabilite Flexo",
                    filters={"demande_faisabilite": docname, "article_parent": e.article_parent},
                    fields=["status"],
                )
            )
            all_statuses = [et.status for et in all_etudes_for_parent]

            if all_statuses and all(s == "Réalisable" for s in all_statuses):
                demande_row = demande_articles.get(e.article_parent)
                if demande_row:
                    results.append({
                        "article": e.article_parent,
                        "quantite": demande_row.quantite,
                        "date_livraison": demande_row.date_livraison,
                    })
        else:
            if e.article not in articles_seen:
                articles_seen.add(e.article)
                results.append({
                    "article": e.article,
                    "quantite": e.quantite,
                    "date_livraison": e.date_livraison,
                })

    return results


@frappe.whitelist()
def set_demande_status_from_quotation(doc, method):
    """
    Lorsqu’un devis est soumis, si lié à une Demande Faisabilité,
    alors on met à jour son statut en "Devis Établis".
    """
    if not doc.custom_demande_faisabilité:
        frappe.msgprint("Pas de demande faisabilité liée, aucun changement de statut.");
        return

    try:
        demande = frappe.get_doc("Demande Faisabilite", doc.custom_demande_faisabilité)

        frappe.msgprint(f"Demande liée trouvée : {demande.name}, statut actuel : {demande.status}")

        if demande.status in ["Finalisée", "Partiellement Finalisée"]:
            demande.status = "Devis Établis"
            demande.save(ignore_permissions=True)
            frappe.msgprint(_("Statut de la Demande Faisabilité mis à jour en 'Devis Établis'"))

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Erreur mise à jour statut depuis Quotation")
        frappe.msgprint("Erreur lors de la mise à jour de la demande liée.")


@frappe.whitelist()
def get_quotations_for_demande(demande_name):
    """
    Retourne les devis liés à une Demande Faisabilite via le champ custom_demande_faisabilite
    """
    return frappe.get_all(
        "Quotation",
        filters={"custom_demande_faisabilité": demande_name},
        fields=["name", "status"]
    )


@frappe.whitelist()
def get_sales_documents_for_demande(demande_name):
    """
    Fetches Quotations and Sales Orders linked to a specific Demande Faisabilite.

    Args:
        demande_name (str): The name of the Demande Faisabilite document.

    Returns:
        list: A list of dictionaries, each containing doctype, name, and status
              for linked Quotations and Sales Orders.
    """
    documents = []

    # Fetch linked Quotations
    # Ensure 'custom_demande_faisabilité' is the correct link field name in Quotation
    quotations = frappe.get_list(
        "Quotation",
        filters={"custom_demande_faisabilité": demande_name, "docstatus": ["!=", 2]}, # Exclude cancelled
        fields=["name", "status"]
    )
    for qtn in quotations:
        documents.append({
            "doctype": "Quotation",
            "name": qtn.name,
            "status": qtn.status
        })

    # Fetch linked Sales Orders
    # Ensure 'custom_demande_de_faisabilité' is the correct link field name in Sales Order
    sales_orders = frappe.get_list(
        "Sales Order",
        filters={"custom_demande_de_faisabilité": demande_name, "docstatus": ["!=", 2]}, # Exclude cancelled
        fields=["name", "status"]
    )
    for so in sales_orders:
        documents.append({
            "doctype": "Sales Order",
            "name": so.name,
            "status": so.status
        })

    # Optional: Sort the documents, e.g., by name or doctype
    # documents.sort(key=lambda x: x['name'])

    return documents


@frappe.whitelist()
def get_linked_documents_for_demande(demande_name):
    """
    Récupère les Etudes Faisabilite (Offset et Flexo), Quotations et Sales Orders liés à une Demande Faisabilite.
    """
    # Récupérer les études Offset
    etudes_offset = frappe.get_list(
        "Etude Faisabilite",
        filters={"demande_faisabilite": demande_name},
        fields=["name", "status", "item_name", "article"],
        ignore_permissions=True
    )
    # Récupérer les études Flexo
    etudes_flexo = frappe.get_list(
        "Etude Faisabilite Flexo",
        filters={"demande_faisabilite": demande_name},
        fields=["name", "status", "item_name", "article"],
        ignore_permissions=True
    )
    # Ajouter un champ pour différencier le type (pour l'affichage JS)
    for e in etudes_offset:
        e["doctype"] = "Etude Faisabilite"
    for e in etudes_flexo:
        e["doctype"] = "Etude Faisabilite Flexo"
    etudes = etudes_offset + etudes_flexo
    # Récupérer les documents de vente (inchangé)
    sales_documents = []
    quotations = frappe.get_list(
        "Quotation",
        filters={"custom_demande_faisabilité": demande_name, "docstatus": ["!=", 2]},
        fields=["name", "status"],
        ignore_permissions=True
    )
    for qtn in quotations:
        sales_documents.append({
            "doctype": "Quotation",
            "name": qtn.name,
            "status": qtn.status
        })
    sales_orders = frappe.get_list(
        "Sales Order",
        filters={"custom_demande_de_faisabilité": demande_name, "docstatus": ["!=", 2]},
        fields=["name", "status"],
        ignore_permissions=True
    )
    for so in sales_orders:
        sales_documents.append({
            "doctype": "Sales Order",
            "name": so.name,
            "status": so.status
        })
    return {
        "etudes": etudes,
        "sales_documents": sales_documents
    }


@frappe.whitelist()
def set_demande_status_from_sales_order(doc, method):
    """
    Lorsqu'une Sales Order est soumise, si elle est liée à une Demande Faisabilité,
    met à jour le statut de la demande en "Commandé".
    """
    # Vérifie si le champ de liaison existe et a une valeur
    if not doc.get("custom_demande_de_faisabilité"):
        # frappe.msgprint("Pas de Demande Faisabilité liée à cette commande.")
        return

    demande_name = doc.custom_demande_de_faisabilité

    try:
        demande = frappe.get_doc("Demande Faisabilite", demande_name)

        # Vérifie si le statut actuel permet la transition vers "Commandé"
        # Par exemple, on pourrait vouloir passer à "Commandé" seulement depuis "Devis Établis"
        # Adaptez cette condition selon votre workflow exact
        if demande.status == "Devis Établis":
            demande.status = "Commandé"
            demande.save(ignore_permissions=True)
            frappe.msgprint(_(f"Statut de la Demande Faisabilité {demande.name} mis à jour en 'Commandé'"))
        # else:
            # frappe.msgprint(f"Le statut actuel '{demande.status}' de la Demande Faisabilité {demande.name} ne permet pas de passer à 'Commandé'.")

    except frappe.DoesNotExistError:
        frappe.log_error(f"Demande Faisabilite {demande_name} non trouvée lors de la soumission de Sales Order {doc.name}", "Erreur Hook Sales Order")
        # frappe.msgprint(f"Erreur : Demande Faisabilité {demande_name} non trouvée.")
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Erreur mise à jour statut Demande Faisabilite depuis Sales Order {doc.name}")
        frappe.msgprint(_("Erreur lors de la mise à jour du statut de la Demande Faisabilité liée."))


@frappe.whitelist()
def check_bon_commande_exists(n_bon_commande, client=None, current_name=None):
	"""
	Vérifie si un numéro de bon de commande existe déjà pour une autre demande de retirage.
	
	Args:
		n_bon_commande (str): Le numéro de bon de commande à vérifier
		current_name (str, optional): Le nom du document actuel à exclure de la recherche
		
	Returns:
		dict: {"exists": bool, "demande_name": str ou None} - True si un doublon existe, False sinon
	"""
	if not n_bon_commande:
		return {"exists": False, "demande_name": None}
	
	filters = {
		"n_bon_commande": n_bon_commande,
		"type": "Retirage"
	}
	if client:
		filters["client"] = client
	
	# Exclure le document actuel si fourni
	if current_name:
		filters["name"] = ["!=", current_name]
	
	existing_demande = frappe.get_all(
		"Demande Faisabilite",
		filters=filters,
		fields=["name"],
		limit=1
	)
	
	if existing_demande:
		return {"exists": True, "demande_name": existing_demande[0].name}
	
	return {"exists": False, "demande_name": None}


@frappe.whitelist()
def create_quotation_with_calculs(docname):
    """
    Crée un Quotation côté serveur depuis une Demande Faisabilite,
    puis génère automatiquement les Calcul Devis pour chaque article.
    Pour les articles composés, le devis affiche l'article parent
    (uniquement si tous les sous-articles sont réalisables).
    """
    try:
        demande = frappe.get_doc("Demande Faisabilite", docname)

        quotation_items = _resolve_quotation_articles(docname)
        if not quotation_items:
            frappe.throw(_("Aucun article réalisable trouvé dans les études associées."))

        article_ids = [qi["article"] for qi in quotation_items]
        items = frappe.get_all(
            "Item",
            filters={"name": ["in", article_ids]},
            fields=["name", "item_name", "stock_uom"],
        )
        item_dict = {item.name: item for item in items}

        quotation = frappe.new_doc("Quotation")
        quotation.quotation_to = "Customer"
        quotation.party_name = demande.client
        quotation.custom_id_client = demande.client
        quotation.company = (
            frappe.defaults.get_user_default("company")
            or frappe.db.get_single_value("Global Defaults", "default_company")
        )
        quotation.custom_demande_faisabilité = demande.name
        quotation.custom_retirage = demande.is_reprint
        quotation.custom_essai_blanc = demande.essai_blanc

        if quotation_items[0]["date_livraison"]:
            quotation.custom_date_de_livraison = quotation_items[0]["date_livraison"]

        for qi in quotation_items:
            item = item_dict.get(qi["article"])
            if item:
                quotation.append("items", {
                    "item_code": qi["article"],
                    "item_name": item.item_name,
                    "uom": item.stock_uom,
                    "qty": qi["quantite"],
                })

        quotation.insert(ignore_permissions=True)

        needs_save = False

        if not quotation.valid_till:
            default_validity = cint(frappe.db.get_single_value("CRM Settings", "default_valid_till")) or 30
            quotation.valid_till = add_days(quotation.transaction_date or getdate(), default_validity)
            needs_save = True

        if quotation.tc_name and not quotation.terms:
            terms_content = frappe.db.get_value("Terms and Conditions", quotation.tc_name, "terms")
            if terms_content:
                quotation.terms = terms_content
                needs_save = True

        if quotation.taxes_and_charges and not quotation.taxes:
            from erpnext.controllers.accounts_controller import get_taxes_and_charges
            taxes = get_taxes_and_charges("Sales Taxes and Charges Template", quotation.taxes_and_charges)
            for tax in taxes:
                quotation.append("taxes", tax)
            quotation.calculate_taxes_and_totals()
            needs_save = True

        if needs_save:
            quotation.save(ignore_permissions=True)

        from aurescrm.aures_crm.doctype.calcul_devis.calcul_devis import generate_calcul_devis_for_quotation
        calcul_result = generate_calcul_devis_for_quotation(quotation.name)

        if demande.status in ["Finalisée", "Partiellement Finalisée"]:
            demande.status = "Devis Établis"
            demande.save(ignore_permissions=True)

        return {
            "quotation_name": quotation.name,
            "calcul_devis_count": calcul_result.get("created", 0),
            "message": _("Devis {0} créé avec {1} Calcul(s) Devis").format(
                quotation.name, calcul_result.get("created", 0)
            ),
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Erreur create_quotation_with_calculs")
        frappe.throw(_("Erreur lors de la création du devis : {0}").format(str(e)))


@frappe.whitelist()
def duplicate_demande_for_reprint(docname, new_date_livraison):
    """
    Duplique une Demande Faisabilite pour créer un retirage.
    Met à jour la date de livraison, coche 'is_reprint', réinitialise le statut,
    définit la date de création, le créateur et lie à la demande d'origine.
    """
    try:
        # 1. Récupérer le document original
        original_doc = frappe.get_doc("Demande Faisabilite", docname)

        # 2. Créer une copie
        new_doc = frappe.copy_doc(original_doc, ignore_no_copy=False)

        # 3. Modifier les champs nécessaires pour le retirage
        new_doc.status = "Brouillon"
        new_doc.date_livraison = new_date_livraison
        new_doc.type = "Retirage"  # Définir le type comme Retirage
        new_doc.is_reprint = 1     # Sera automatiquement défini par la validation
        new_doc.essai_blanc = 0    # Réinitialiser essai_blanc pour le retirage
        # --- MODIFIÉ : Utiliser le nouveau nom de champ 'demande_origin' ---
        new_doc.demande_origin = docname # <-- Modification ici

        # Définir explicitement la date de création et le propriétaire
        new_doc.owner = frappe.session.user
        new_doc.date_creation = now_datetime() # Utilisation de 'date_creation'

        # Mettre à jour la date de livraison dans la table enfants
        if new_doc.get("liste_articles"):
            for item in new_doc.liste_articles:
                item.date_livraison = new_date_livraison

        # Effacer les liens (si nécessaire)
        # new_doc.linked_quotation = None
        # new_doc.linked_sales_order = None

        # 4. Sauvegarder le nouveau document
        new_doc.insert(ignore_permissions=True)

        # 5. Retourner le nom du nouveau document
        return {"new_docname": new_doc.name}

    except frappe.DoesNotExistError:
        frappe.log_error(f"Demande Faisabilite {docname} non trouvée lors de la tentative de retirage.", "Erreur Retirage")
        return {"error": f"Document original {docname} non trouvé."}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Erreur lors de la création du retirage pour {docname}")
        return {"error": f"Une erreur est survenue: {str(e)}"}
