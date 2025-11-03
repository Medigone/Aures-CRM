# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _
from frappe.utils import today


class PVDestructionMaquette(Document):
    def autoname(self):
        from frappe.model.naming import make_autoname
        self.name = make_autoname("PV-DEST-.YYYY.-.#####")

    def validate(self):
        # Valider que la maquette existe
        if self.maquette:
            maquette_status = frappe.db.get_value('Maquette', self.maquette, 'status')
            if maquette_status == 'Détruite' and self.status == 'Brouillon':
                frappe.throw(
                    _("La maquette '{0}' est déjà détruite.").format(self.maquette),
                    title=_("Erreur de validation")
                )

    def before_submit(self):
        """Vérifications avant la soumission du PV"""
        # Vérifier que le fichier validé par le client est présent
        if not self.fichier_valide_client:
            frappe.throw(
                _("Veuillez joindre le fichier validé par le client avant de valider le PV."),
                title=_("Document requis")
            )

        # Vérifier que la maquette n'est pas déjà détruite
        maquette_status = frappe.db.get_value('Maquette', self.maquette, 'status')
        if maquette_status == 'Détruite':
            frappe.throw(
                _("La maquette '{0}' est déjà détruite.").format(self.maquette),
                title=_("Erreur de validation")
            )

    def on_submit(self):
        """
        Actions à effectuer lors de la soumission (validation) du PV :
        - Enregistre la date de destruction
        - Enregistre qui a validé le PV
        - Met la maquette à "Détruite"
        """
        # Mettre à jour la date de destruction et qui a validé
        self.db_set('date_destruction', today())
        self.db_set('valide_par', frappe.session.user)

        # Mettre la maquette à "Détruite"
        maquette = frappe.get_doc('Maquette', self.maquette)
        if maquette.status != 'Détruite':
            maquette.status = 'Détruite'
            maquette.save(ignore_permissions=True)

            # Ajouter un commentaire sur la maquette
            maquette.add_comment(
                'Info',
                _("Maquette détruite via PV de destruction '{0}' validé le {1}.").format(
                    self.name,
                    frappe.utils.formatdate(today())
                )
            )

