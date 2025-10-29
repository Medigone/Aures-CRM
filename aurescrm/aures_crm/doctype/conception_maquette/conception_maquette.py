# Copyright (c) 2025, SAS AURES and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _


class ConceptionMaquette(Document):
    def autoname(self):
        """
        Génère automatiquement le nom selon le format: CONC-.YYYY.-.#####
        Exemple: CONC-2025-00001
        """
        from frappe.model.naming import make_autoname
        self.name = make_autoname("CONC-.YYYY.-.#####")

    def validate(self):
        """
        Validations lors de la sauvegarde du document
        """
        self.extract_points_complexite()
        self.update_status_dates()
        self.calculate_temps_total()
        self.validate_status_transition()
    
    def extract_points_complexite(self):
        """
        Convertit le label d'effort en points numériques
        Exemple: "Simple" → 1, "Moyen" → 2, "Complexe" → 3
        """
        if self.points_effort:
            # Mapping des labels vers les points
            effort_map = {
                "Simple": 1,
                "Moyen": 2,
                "Complexe": 3
            }
            self.points_complexite = effort_map.get(self.points_effort)
        else:
            self.points_complexite = None

    def update_status_dates(self):
        """
        Met à jour automatiquement les dates selon les changements de statut
        """
        # Si le statut passe à "En Cours" et qu'il n'y a pas de date_debut
        if self.status == "En Cours" and not self.date_debut:
            self.date_debut = frappe.utils.now_datetime()

        # Si le statut passe à "Terminé" et qu'il n'y a pas de date_fin
        if self.status == "Terminé" and not self.date_fin:
            self.date_fin = frappe.utils.now_datetime()

        # Si le statut passe à "Validé" et qu'il n'y a pas de date_validation
        if self.status == "Validé" and not self.date_validation:
            self.date_validation = frappe.utils.today()

    def calculate_temps_total(self):
        """
        Calcule le temps total passé sur la conception en heures
        """
        if self.date_debut and self.date_fin:
            # Convertir les datetime en objets datetime si ce sont des strings
            from frappe.utils import get_datetime
            debut = get_datetime(self.date_debut)
            fin = get_datetime(self.date_fin)
            
            # Calculer la différence en heures
            delta = fin - debut
            self.temps_total = round(delta.total_seconds() / 3600, 2)
        else:
            self.temps_total = 0

    def validate_status_transition(self):
        """
        Valide que les transitions de statut respectent le workflow
        """
        # Ne pas permettre de passer à "Validé" sans être passé par "Terminé"
        if self.status == "Validé":
            # Si c'est un nouveau document ou qu'il n'a jamais été terminé
            if not self.date_fin:
                frappe.throw(
                    _("Impossible de valider une conception qui n'a pas été terminée. "
                      "Veuillez d'abord passer le statut à 'Terminé'."),
                    title=_("Erreur de transition de statut")
                )

    def before_save(self):
        """
        Actions avant la sauvegarde
        """
        # Nettoyer les dates si le statut revient en arrière
        if self.status == "Nouveau":
            self.date_debut = None
            self.date_fin = None
            self.date_validation = None
        elif self.status == "En Cours":
            self.date_fin = None
            self.date_validation = None
        elif self.status == "Terminé":
            self.date_validation = None

    def on_update(self):
        """
        Actions après la sauvegarde/mise à jour
        """
        # Ajouter un commentaire lors des changements de statut importants
        if self.has_value_changed("status"):
            old_status = self.get_doc_before_save().status if self.get_doc_before_save() else None
            if old_status:
                self.add_comment(
                    "Info",
                    _("Statut changé de '{0}' à '{1}'").format(old_status, self.status)
                )
    
    @frappe.whitelist()
    def demarrer_conception(self):
        """
        Démarre la conception (Nouveau → En Cours)
        """
        if self.status != "Nouveau":
            frappe.throw(_("Vous ne pouvez démarrer que depuis le statut 'Nouveau'."))
        
        if not self.infographe_assigne:
            frappe.throw(_("Vous devez attribuer un infographe avant de démarrer la conception."))
        
        self.status = "En Cours"
        self.date_debut = frappe.utils.now_datetime()
        self.save()
        
        frappe.msgprint(_("Conception démarrée avec succès."), indicator="green")
        return True
    
    @frappe.whitelist()
    def terminer_conception(self):
        """
        Termine la conception (En Cours → Terminé)
        """
        if self.status != "En Cours":
            frappe.throw(_("Vous ne pouvez terminer que depuis le statut 'En Cours'."))
        
        self.status = "Terminé"
        self.date_fin = frappe.utils.now_datetime()
        self.calculate_temps_total()
        self.save()
        
        frappe.msgprint(_("Conception terminée. Temps total: {0} heures").format(self.temps_total), indicator="green")
        return True
    
    @frappe.whitelist()
    def valider_conception(self):
        """
        Valide la conception (Terminé → Validé)
        """
        if self.status != "Terminé":
            frappe.throw(_("Vous ne pouvez valider que depuis le statut 'Terminé'."))
        
        self.status = "Validé"
        self.date_validation = frappe.utils.today()
        self.save()
        
        frappe.msgprint(_("Conception validée avec succès."), indicator="green")
        return True
    
    @frappe.whitelist()
    def annuler_conception(self):
        """
        Annule la conception
        """
        if self.status == "Validé":
            frappe.throw(_("Impossible d'annuler une conception déjà validée."))
        
        if self.status == "Annulé":
            frappe.throw(_("Cette conception est déjà annulée."))
        
        self.status = "Annulé"
        self.save()
        
        frappe.msgprint(_("Conception annulée."), indicator="red")
        return True


@frappe.whitelist()
def update_infographe(docname, infographe_user):
    """Met à jour les champs infographe_assigne et nom_infographe pour un document Conception Maquette."""
    try:
        # Récupérer le nom complet de l'utilisateur
        full_name = frappe.db.get_value("User", infographe_user, "full_name")
        if not full_name:
            # Gérer le cas où l'utilisateur n'a pas de nom complet défini
            full_name = infographe_user  # Utiliser l'email/ID comme fallback
        
        # Mise à jour directe des valeurs
        frappe.db.set_value("Conception Maquette", docname, {
            "infographe_assigne": infographe_user,
            "nom_infographe": full_name
        }, update_modified=False)
        
        frappe.db.commit()  # Assurer que la transaction est commitée immédiatement
        
        # Retourner le nom complet pour l'UI
        return {"status": "success", "message": "Infographe et nom mis à jour", "full_name": full_name}
    except Exception as e:
        frappe.log_error(f"Erreur dans update_infographe pour {docname}: {e}", frappe.get_traceback())
        frappe.db.rollback()
        return {"status": "error", "message": str(e)}


@frappe.whitelist()
def get_infographes_prepresse(doctype, txt, searchfield, start, page_len, filters):
    """Récupère les utilisateurs ayant les rôles Prepresse"""
    # Récupérer les utilisateurs ayant les rôles "Technicien Prepresse" ou "Responsable Prepresse"
    users_with_role = frappe.get_all("Has Role",
                                     filters=[["role", "in", ["Technicien Prepresse", "Responsable Prepresse"]], 
                                              ["parenttype", "=", "User"]],
                                     fields=["parent"])
    user_list = [d.parent for d in users_with_role]
    
    if not user_list:
        return []
    
    # Condition pour la recherche textuelle (si l'utilisateur tape dans le champ Link)
    search_condition = ""
    if txt:
        search_condition = f"AND (`name` LIKE %(txt)s OR `full_name` LIKE %(txt)s)"
    
    # Requête pour récupérer les utilisateurs correspondants, actifs et filtrés
    return frappe.db.sql(f"""
        SELECT `name`, `full_name` FROM `tabUser`
        WHERE `name` IN %(user_list)s
        AND `enabled` = 1
        {search_condition}
        ORDER BY `full_name`
        LIMIT %(start)s, %(page_len)s
    """, {
        "user_list": tuple(user_list),
        "txt": f"%{txt}%",
        "start": start,
        "page_len": page_len
    }, as_list=True)

