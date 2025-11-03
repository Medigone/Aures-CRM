import frappe
from frappe.model.document import Document
from frappe import _


def update_bats_on_maquette_activation(doc, method):
    """
    Hook appelé lors de la sauvegarde d'une maquette.
    Si le statut passe à "Version Activée", met à jour tous les BAT liés à l'ancienne maquette.
    """
    # Vérifier si le statut a changé vers "Version Activée"
    if doc.status == 'Version Activée':
        # Récupérer l'ancien statut depuis la base de données si le document existe déjà
        if doc.name and frappe.db.exists('Maquette', doc.name):
            old_status = frappe.db.get_value('Maquette', doc.name, 'status')
            # Si le statut n'était pas déjà "Version Activée", c'est un changement
            if old_status != 'Version Activée':
                # Trouver les maquettes "Obsolète" pour le même article (l'ancienne version qui vient d'être désactivée)
                obsolete_maquettes = frappe.get_list(
                    'Maquette',
                    filters={
                        'article': doc.article,
                        'status': 'Obsolète',
                        'name': ['!=', doc.name]
                    },
                    fields=['name'],
                    order_by='modified desc',
                    limit=1
                )

                if obsolete_maquettes:
                    old_maquette_name = obsolete_maquettes[0].name
                    
                    # Mettre à jour tous les BAT liés à l'ancienne maquette
                    bats_linked = frappe.get_list(
                        'BAT',
                        filters={
                            'maquette': old_maquette_name,
                            'status': ['!=', 'Obsolète']
                        },
                        fields=['name']
                    )

                    for bat_info in bats_linked:
                        bat_doc = frappe.get_doc('BAT', bat_info.name)
                        bat_doc.status = 'Obsolète'
                        bat_doc.obsolete_par = frappe.session.user
                        bat_doc.save(ignore_permissions=True)
                        bat_doc.add_comment(
                            'Info',
                            _("BAT marqué comme obsolète suite à l'activation de la nouvelle version de maquette : {0}").format(doc.name)
                        )


class Maquette(Document):
    def autoname(self):
        # Nommer selon la version: MAQ-{article_sans_prefixe_client}-V{ver}
        # S'assurer que ver est défini (première version = 1)
        if not getattr(self, 'ver', None):
            self.ver = 1

        # Extraire le code article et supprimer le préfixe 'CLI-' s'il existe
        article_code = self.article
        prefix_to_remove = "CLI-"
        if article_code and article_code.startswith(prefix_to_remove):
            article_part = article_code[len(prefix_to_remove):]
        else:
            # Fallback si le préfixe n'est pas trouvé (ou si article est vide)
            article_part = article_code

        self.name = f"MAQ-{article_part}-V{self.ver}"

    def validate(self):
        # Validation des statuts et références
        if self.is_new() or self.status == 'A référencer':
            self.nom_reference_par = ''
            self.reference_par = ''
        elif self.status == 'Référencée':
            self.reference_par = frappe.session.user
            self.nom_reference_par = frappe.db.get_value('User', frappe.session.user, 'full_name')

        # Validation de la gestion des couleurs
        self.validate_color_mode()
        self.clean_spot_color_codes()
        self.sync_color_counters()
        self.build_resume_couleurs()

    def validate_color_mode(self):
        """
        Valide la cohérence du mode couleur avec les données saisies.
        - Si CMJN ou CMJN + Pantone : cmjn_details doit être non vide (recommandé 4 canaux C/M/J/N)
        - Si contient Pantone : spot_colors doit avoir au moins 1 couleur
        """
        if not self.mode_couleur:
            return

        # Vérification CMJN
        if self.mode_couleur in ['CMJN', 'CMJN + Pantone']:
            if not self.cmjn_details or len(self.cmjn_details) == 0:
                frappe.throw(
                    _("Le mode couleur '{0}' nécessite au moins une ligne dans les détails CMJN.").format(self.mode_couleur),
                    title=_("Erreur de configuration CMJN")
                )

        # Vérification Pantone/Spot
        if self.mode_couleur in ['Pantone uniquement', 'CMJN + Pantone']:
            if not self.spot_colors or len(self.spot_colors) == 0:
                frappe.throw(
                    _("Le mode couleur '{0}' nécessite au moins une couleur Pantone/Spot.").format(self.mode_couleur),
                    title=_("Erreur de configuration Pantone")
                )

    def clean_spot_color_codes(self):
        """
        Nettoie les codes spot : supprime les espaces et met en majuscules.
        """
        if self.spot_colors:
            for spot in self.spot_colors:
                if spot.code_spot:
                    spot.code_spot = spot.code_spot.strip().upper()

    def sync_color_counters(self):
        """
        Synchronise les compteurs nombre_couleurs_process et nombre_spot_colors.
        """
        self.nombre_couleurs_process = len(self.cmjn_details) if self.cmjn_details else 0
        self.nombre_spot_colors = len(self.spot_colors) if self.spot_colors else 0

    def build_resume_couleurs(self):
        """
        Construit le résumé des couleurs (resume_couleurs).
        Format:
        - CMJN → "CMJN (4)"
        - Pantone uniquement → "Pantone (n) — P xxx, P yyy"
        - CMJN + Pantone → "CMJN (4) + Pantone (n) — P xxx, P yyy"
        """
        if not self.mode_couleur:
            self.resume_couleurs = ''
            return

        resume_parts = []

        has_cmjn = self.mode_couleur in ['CMJN', 'CMJN + Pantone']
        has_pantone = self.mode_couleur in ['Pantone uniquement', 'CMJN + Pantone']

        # Partie CMJN
        if has_cmjn:
            nb_cmjn = len(self.cmjn_details) if self.cmjn_details else 0
            resume_parts.append(f"CMJN ({nb_cmjn})")

        # Partie Pantone
        if has_pantone:
            nb_spot = len(self.spot_colors) if self.spot_colors else 0
            spot_codes = [s.code_spot for s in self.spot_colors if s.code_spot] if self.spot_colors else []
            
            if spot_codes:
                resume_parts.append(f"Pantone ({nb_spot}) — {', '.join(spot_codes)}")
            else:
                resume_parts.append(f"Pantone ({nb_spot})")

        self.resume_couleurs = ' + '.join(resume_parts)

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
                old_version.save(ignore_permissions=True)

                # Mettre à jour tous les BAT liés à l'ancienne maquette
                bats_linked = frappe.get_list(
                    'BAT',
                    filters={
                        'maquette': old_version.name,
                        'status': ['!=', 'Obsolète']
                    },
                    fields=['name']
                )

                for bat_info in bats_linked:
                    bat_doc = frappe.get_doc('BAT', bat_info.name)
                    bat_doc.status = 'Obsolète'
                    bat_doc.obsolete_par = frappe.session.user
                    bat_doc.save(ignore_permissions=True)
                    bat_doc.add_comment(
                        'Info',
                        _("BAT marqué comme obsolète suite à l'activation de la nouvelle version de maquette : {0}").format(self.name)
                    )

            self.status = 'Version Activée'
            self.save(ignore_permissions=True)
            return True
        return False

    @frappe.whitelist()
    def create_new_version(self, desc_changements):
        """
        Crée une nouvelle version basée sur l'article courant.
        - Recherche le numéro de version maximal existant pour cet article
        - Incrémente de 1
        - Crée le document avec ver et laisse autoname générer le nom
        - Si une maquette "Version Activée" existe, crée automatiquement un PV de destruction
        """
        # Vérifier s'il existe une maquette "Version Activée" pour le même article
        active_maquette = frappe.get_list(
            'Maquette',
            filters={
                'article': self.article,
                'status': 'Version Activée'
            },
            fields=['name'],
            limit=1
        )

        pv_created = None

        if active_maquette:
            # Créer automatiquement un PV de destruction pour l'ancienne maquette
            old_maquette_name = active_maquette[0].name
            
            pv_doc = frappe.get_doc({
                'doctype': 'PV Destruction Maquette',
                'maquette': old_maquette_name,
                'date_creation': frappe.utils.today(),
                'status': 'Brouillon',
                'cree_par': frappe.session.user
            })
            pv_doc.insert(ignore_permissions=True)
            pv_created = pv_doc.name

            # Mettre à jour l'ancienne maquette avec le lien vers le PV
            old_maquette = frappe.get_doc('Maquette', old_maquette_name)
            old_maquette.pv_destruction = pv_created
            old_maquette.save(ignore_permissions=True)

            # Ajouter un commentaire sur l'ancienne maquette
            old_maquette.add_comment(
                'Info',
                _("PV de destruction '{0}' créé automatiquement lors de la création d'une nouvelle version.").format(pv_created)
            )

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
        
        result_msg = new_doc.name
        if pv_created:
            result_msg = {
                'new_version': new_doc.name,
                'pv_destruction': pv_created
            }
        
        return result_msg
