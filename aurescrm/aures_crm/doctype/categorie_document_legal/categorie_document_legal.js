// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Categorie Document Legal", {
	refresh(frm) {
		// Ajouter un bouton pour basculer le statut
		if (!frm.doc.__islocal) {
			const action_text = frm.doc.status === 'Activé' ? 'Désactiver' : 'Activer';
			const nouveau_statut = frm.doc.status === 'Activé' ? 'Désactivé' : 'Activé';
			
			frm.add_custom_button(__(action_text), function() {
				// Demander confirmation avant de changer le statut
				frappe.confirm(
					__('Êtes-vous sûr de vouloir {0} cette catégorie ?', [action_text.toLowerCase()]),
					function() {
						// L'utilisateur a confirmé
						// Mettre à jour le champ status
						frm.set_value('status', nouveau_statut);
						
						// Sauvegarder automatiquement
						frm.save().then(() => {
							frappe.msgprint({
								title: __('Statut mis à jour'),
								message: __('Le statut a été changé vers: {0}', [nouveau_statut]),
								indicator: 'green'
							});
							// Rafraîchir le formulaire pour mettre à jour le bouton
							frm.refresh();
						}).catch((error) => {
							frappe.msgprint({
								title: __('Erreur'),
								message: __('Erreur lors de la mise à jour du statut: {0}', [error.message]),
								indicator: 'red'
							});
						});
					},
					function() {
						// L'utilisateur a annulé - ne rien faire
						frappe.msgprint({
							message: __('Action annulée'),
							indicator: 'blue'
						});
					}
				);
			});
		}
	}
});
