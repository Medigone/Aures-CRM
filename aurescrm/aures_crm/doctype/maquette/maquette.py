import frappe
from frappe.model.document import Document

class Maquette(Document):
    def autoname(self):
        # Nommer selon la version: MAQ-Client-Article-V{ver}
        # S'assurer que ver est défini (première version = 1)
        if not getattr(self, 'ver', None):
            self.ver = 1
        self.name = f"MAQ-{self.client}-{self.article}-V{self.ver}"

    def validate(self):
        if self.is_new() or self.status == 'A référencer':
            self.nom_reference_par = ''
            self.reference_par = ''
        elif self.status == 'Référencée':
            self.reference_par = frappe.session.user
            self.nom_reference_par = frappe.db.get_value('User', frappe.session.user, 'full_name')

    @frappe.whitelist()
    def set_status_referenced(self):
        if self.status == "A référencer":
            self.status = "Référencée"
            self.reference_par = frappe.session.user
            self.nom_reference_par = frappe.db.get_value('User', frappe.session.user, 'full_name')
            self.save()
            return True
        return False

    @frappe.whitelist()
    def activate_version(self):
        if self.status in ["Référencée", "Obsolète"]:
            active_version = frappe.get_list(
                'Maquette',
                filters={
                    'article': self.article,
                    'status': 'Version Activée'
                },
                fields=['name']
            )

            if active_version:
                old_version = frappe.get_doc('Maquette', active_version[0].name)
                old_version.status = 'Obsolète'
                old_version.add_comment('Info', f"Version désactivée par version '{self.name}'")
                old_version.save()

            self.status = 'Version Activée'
            self.save()
            return True
        return False

    @frappe.whitelist()
    def create_new_version(self, desc_changements):
        """
        Crée une nouvelle version basée sur l'article courant.
        - Recherche le numéro de version maximal existant pour cet article
        - Incrémente de 1
        - Crée le document avec ver et laisse autoname générer le nom
        """
        # Déterminer la version la plus élevée existante pour cet article
        result = frappe.db.sql(
            "SELECT MAX(ver) FROM `tabMaquette` WHERE article=%s", 
            (self.article,),
            as_list=True
        )
        max_ver = result[0][0] or 0
        next_ver = max_ver + 1

        new_doc = frappe.get_doc({
            'doctype': 'Maquette',
            'client': self.client,
            'article': self.article,
            'id_responsable': self.id_responsable,
            'parent_maquette': self.name,
            'desc_changements': desc_changements,
            'ver': next_ver,
            'status': 'A référencer'
        })
        new_doc.insert(ignore_permissions=True)
        return new_doc.name
