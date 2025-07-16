import frappe
from frappe.model.document import Document

class EtudeFaisabiliteFlexo(Document):
    def before_insert(self):
        """Vérifie si des documents existent déjà pour l'article et les lie automatiquement lors de la création"""
        if self.article:
            if not self.trace:
                self.auto_link_existing_trace()
            if not self.plan_flexo:
                self.auto_link_existing_plan_flexo()
            if not self.maquette:
                self.auto_link_existing_maquette()
            if not self.cliche:
                self.auto_link_existing_cliche()
    
    def before_save(self):
        """Vérifie si des documents existent déjà pour l'article et les lie automatiquement lors de la sauvegarde"""
        if self.article:
            if not self.trace:
                self.auto_link_existing_trace()
            if not self.plan_flexo:
                self.auto_link_existing_plan_flexo()
            if not self.maquette:
                self.auto_link_existing_maquette()
            if not self.cliche:
                self.auto_link_existing_cliche()

    def auto_link_existing_trace(self):
        """Recherche et lie automatiquement un tracé existant pour l'article"""
        existing_trace = frappe.db.exists("Trace", {"article": self.article})
        if existing_trace:
            self.trace = existing_trace

    def auto_link_existing_plan_flexo(self):
        """Recherche et lie automatiquement un plan flexo existant pour l'article"""
        existing_plan = frappe.db.exists("Plan Flexo", {"article": self.article})
        if existing_plan:
            self.plan_flexo = existing_plan

    def auto_link_existing_maquette(self):
        """Recherche et lie automatiquement une maquette active existante pour l'article"""
        existing_maquette = frappe.db.exists("Maquette", {"article": self.article, "status": "Version Activée"})
        if existing_maquette:
            self.maquette = existing_maquette

    def auto_link_existing_cliche(self):
        """Recherche et lie automatiquement un cliché actif existant pour l'article"""
        existing_cliche = frappe.db.exists("Cliche", {"article": self.article, "version_active": 1})
        if existing_cliche:
            self.cliche = existing_cliche

@frappe.whitelist()
def refresh_attached_files(docname):
    """
    Récupère les fichiers attachés depuis les documents Trace, Plan Flexo, Maquette et Cliche liés
    et les renvoie pour mise à jour dans le document Etude Faisabilite Flexo.
    """
    try:
        etude = frappe.get_doc("Etude Faisabilite Flexo", docname)
        result = {}
        
        # Récupérer le fichier du tracé si un tracé est lié
        if etude.trace:
            trace_doc = frappe.get_doc("Trace", etude.trace)
            if trace_doc.fichier_trace:
                result["fichier_trace"] = trace_doc.fichier_trace
        
        # Récupérer le fichier du plan flexo si un plan est lié
        if etude.plan_flexo:
            plan_doc = frappe.get_doc("Plan Flexo", etude.plan_flexo)
            if plan_doc.fichier:
                result["fichier_plan_flexo"] = plan_doc.fichier
        
        # Récupérer le fichier de la maquette si une maquette est liée
        if etude.maquette:
            maquette_doc = frappe.get_doc("Maquette", etude.maquette)
            if maquette_doc.fichier_maquette:
                result["fichier_maquette"] = maquette_doc.fichier_maquette
        
        # Récupérer le fichier du cliché si un cliché est lié
        if etude.cliche:
            cliche_doc = frappe.get_doc("Cliche", etude.cliche)
            if cliche_doc.fich_maquette:
                result["fichier_cliche"] = cliche_doc.fich_maquette
        
        return result
    except Exception as e:
        frappe.log_error(message=str(e), title="Erreur refresh_attached_files Flexo")
        return {"error": str(e)}

@frappe.whitelist()
def get_existing_trace_for_article(article):
    """
    Vérifie si un tracé existe déjà pour un article donné et le retourne
    """
    if not article:
        return None
    existing_trace = frappe.db.exists("Trace", {"article": article})
    return existing_trace

@frappe.whitelist()
def get_existing_plan_flexo_for_article(article):
    """
    Vérifie si un plan flexo existe déjà pour un article donné et le retourne
    """
    if not article:
        return None
    existing_plan = frappe.db.exists("Plan Flexo", {"article": article})
    return existing_plan

@frappe.whitelist()
def get_existing_maquette_for_article(article):
    """
    Vérifie si une maquette existe déjà pour un article donné et la retourne
    """
    if not article:
        return None
    existing_maquette = frappe.db.exists("Maquette", {"article": article})
    return existing_maquette

@frappe.whitelist()
def get_existing_cliche_for_article(article):
    """
    Vérifie si un cliché actif existe déjà pour un article donné et le retourne
    """
    if not article:
        return None
    existing_cliche = frappe.db.exists("Cliche", {"article": article, "version_active": 1})
    return existing_cliche

@frappe.whitelist()
def get_existing_maquette_for_article(article):
    """
    Vérifie si une maquette active existe déjà pour un article donné et la retourne
    """
    if not article:
        return None
    existing_maquette = frappe.db.exists("Maquette", {"article": article, "status": "Version Activée"})
    return existing_maquette

@frappe.whitelist()
def check_new_cliche_versions(article):
    """
    Vérifie s'il existe des nouvelles versions de cliché non activées pour un article
    """
    if not article:
        return None
    
    # Récupérer la version active
    active_cliche = frappe.db.get_value("Cliche", {"article": article, "version_active": 1}, ["name", "version"])
    
    if not active_cliche:
        return None
    
    active_version = active_cliche[1] if active_cliche else 0
    
    # Chercher des versions plus récentes non activées
    newer_versions = frappe.db.get_list(
        "Cliche",
        filters={
            "article": article,
            "version": [">", active_version],
            "version_active": 0
        },
        fields=["name", "version", "status"],
        order_by="version desc"
    )
    
    return {
        "active_version": active_version,
        "newer_versions": newer_versions
    }

@frappe.whitelist()
def check_new_maquette_versions(article):
    """
    Vérifie s'il existe des nouvelles versions de maquette pour un article
    """
    if not article:
        return None
    
    # Récupérer la version active
    active_maquette = frappe.db.get_value("Maquette", {"article": article, "status": "Version Activée"}, ["name", "ver"])
    
    if not active_maquette:
        return None
    
    active_version = active_maquette[1] if active_maquette else 0
    
    # Chercher des versions plus récentes non activées
    newer_versions = frappe.db.get_list(
        "Maquette",
        filters={
            "article": article,
            "ver": [">", active_version],
            "status": ["!=", "Version Activée"]
        },
        fields=["name", "ver", "status"],
        order_by="ver desc"
    )
    
    return {
        "active_version": active_version,
        "newer_versions": newer_versions
    }

@frappe.whitelist()
def get_all_cliche_versions(article):
    """
    Récupère toutes les versions de cliché pour un article avec leurs détails complets
    """
    if not article:
        return None
    
    all_versions = frappe.db.get_list(
        "Cliche",
        filters={"article": article},
        fields=["name", "version", "status", "version_active", "creation", "modified", "desc_changements"],
        order_by="version desc"
    )
    
    # Enrichir avec les informations utilisateur
    for version in all_versions:
        # Récupérer les informations de création/modification
        doc_info = frappe.db.get_value("Cliche", version.name, ["owner", "modified_by"], as_dict=True)
        if doc_info:
            version.created_by = frappe.db.get_value("User", doc_info.owner, "full_name") or doc_info.owner
            version.modified_by = frappe.db.get_value("User", doc_info.modified_by, "full_name") or doc_info.modified_by
    
    return all_versions

@frappe.whitelist()
def get_all_maquette_versions(article):
    """
    Récupère toutes les versions de maquette pour un article avec leurs détails complets
    """
    if not article:
        return None
    
    all_versions = frappe.db.get_list(
        "Maquette",
        filters={"article": article},
        fields=["name", "ver", "status", "creation", "modified", "desc_changements"],
        order_by="ver desc"
    )
    
    # Enrichir avec les informations utilisateur
    for version in all_versions:
        # Récupérer les informations de création/modification
        doc_info = frappe.db.get_value("Maquette", version.name, ["owner", "modified_by"], as_dict=True)
        if doc_info:
            version.created_by = frappe.db.get_value("User", doc_info.owner, "full_name") or doc_info.owner
            version.modified_by = frappe.db.get_value("User", doc_info.modified_by, "full_name") or doc_info.modified_by
    
    return all_versions

@frappe.whitelist()
def change_cliche_version(etude_id, new_cliche_id):
    """
    Change la version du cliché liée à une étude de faisabilité
    """
    if not etude_id or not new_cliche_id:
        frappe.throw("ID de l'étude et du nouveau cliché requis")
    
    # Vérifier que l'étude existe
    if not frappe.db.exists("Etude Faisabilite Flexo", etude_id):
        frappe.throw(f"Étude de faisabilité {etude_id} non trouvée")
    
    # Vérifier que le cliché existe
    if not frappe.db.exists("Cliche", new_cliche_id):
        frappe.throw(f"Cliché {new_cliche_id} non trouvé")
    
    # Vérifier que le cliché correspond au même article
    etude = frappe.get_doc("Etude Faisabilite Flexo", etude_id)
    cliche_article = frappe.db.get_value("Cliche", new_cliche_id, "article")
    
    if cliche_article != etude.article:
        frappe.throw("Le cliché sélectionné ne correspond pas à l'article de l'étude")
    
    # Mettre à jour le lien
    etude.cliche = new_cliche_id
    etude.save(ignore_permissions=True)
    
    # Récupérer les informations du nouveau cliché
    new_cliche_info = frappe.db.get_value("Cliche", new_cliche_id, ["version", "status"], as_dict=True)
    
    return {
        "success": True,
        "message": f"Cliché changé vers {new_cliche_id} (V{new_cliche_info.version} - {new_cliche_info.status})",
        "new_cliche_id": new_cliche_id,
        "version": new_cliche_info.version,
        "status": new_cliche_info.status
    }

@frappe.whitelist()
def change_maquette_version(etude_id, new_maquette_id):
    """
    Change la version de la maquette liée à une étude de faisabilité
    """
    if not etude_id or not new_maquette_id:
        frappe.throw("ID de l'étude et de la nouvelle maquette requis")
    
    # Vérifier que l'étude existe
    if not frappe.db.exists("Etude Faisabilite Flexo", etude_id):
        frappe.throw(f"Étude de faisabilité {etude_id} non trouvée")
    
    # Vérifier que la maquette existe
    if not frappe.db.exists("Maquette", new_maquette_id):
        frappe.throw(f"Maquette {new_maquette_id} non trouvée")
    
    # Vérifier que la maquette correspond au même article
    etude = frappe.get_doc("Etude Faisabilite Flexo", etude_id)
    maquette_article = frappe.db.get_value("Maquette", new_maquette_id, "article")
    
    if maquette_article != etude.article:
        frappe.throw("La maquette sélectionnée ne correspond pas à l'article de l'étude")
    
    # Mettre à jour le lien
    etude.maquette = new_maquette_id
    etude.save(ignore_permissions=True)
    
    # Récupérer les informations de la nouvelle maquette
    new_maquette_info = frappe.db.get_value("Maquette", new_maquette_id, ["ver", "status"], as_dict=True)
    
    return {
        "success": True,
        "message": f"Maquette changée vers {new_maquette_id} (V{new_maquette_info.ver} - {new_maquette_info.status})",
        "new_maquette_id": new_maquette_id,
        "version": new_maquette_info.ver,
        "status": new_maquette_info.status
    }