import frappe
from frappe.model.document import Document

class EtudeFaisabiliteFlexo(Document):
    def before_save(self):
        """Vérifie si des documents existent déjà pour l'article et les lie automatiquement"""
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
        """Recherche et lie automatiquement une maquette existante pour l'article"""
        existing_maquette = frappe.db.exists("Maquette", {"article": self.article})
        if existing_maquette:
            self.maquette = existing_maquette

    def auto_link_existing_cliche(self):
        """Recherche et lie automatiquement un cliché existant pour l'article"""
        existing_cliche = frappe.db.exists("Cliche", {"article": self.article})
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
    Vérifie si un cliché existe déjà pour un article donné et le retourne
    """
    if not article:
        return None
    existing_cliche = frappe.db.exists("Cliche", {"article": article})
    return existing_cliche 