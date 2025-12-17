/**
 * Customer Form Script
 * - Met le formulaire en lecture seule si l'utilisateur n'est pas le commercial attribué
 * - Masque tous les onglets sauf "Détails"
 */

frappe.ui.form.on("Customer", {
    refresh: function(frm) {
        // Ne rien faire pour les nouveaux documents
        if (frm.is_new()) {
            return;
        }
        
        // Appeler l'API serveur pour vérifier les permissions
        frappe.call({
            method: "aurescrm.custom_permissions.can_edit_customer",
            args: {
                customer_name: frm.doc.name
            },
            callback: function(r) {
                if (r.message && !r.message.can_edit) {
                    // Utiliser le nom du commercial s'il existe, sinon l'email
                    const commercial_display = r.message.nom_commercial || r.message.commercial_attribue;
                    
                    // Mettre le formulaire en lecture seule
                    set_form_read_only(frm, commercial_display);
                    
                    // Masquer les onglets sauf "Détails"
                    hide_tabs_except_details(frm);
                }
            }
        });
    }
});

function set_form_read_only(frm, commercial_attribue) {
    // Désactiver tous les champs un par un
    frm.fields.forEach(function(field) {
        if (field.df && field.df.fieldname) {
            frm.set_df_property(field.df.fieldname, "read_only", 1);
        }
    });
    
    // Désactiver le bouton de sauvegarde
    frm.disable_save();
    
    // Masquer les boutons d'action principaux
    frm.page.clear_primary_action();
    frm.page.clear_secondary_action();
    
    // Masquer le bouton Menu > Supprimer et autres actions
    frm.page.clear_menu();
    
    // Afficher un message d'information en haut du formulaire
    frm.set_intro(
        __("Ce client est attribué à <b>{0}</b>. Vous êtes en mode lecture seule.", [commercial_attribue]),
        "blue"
    );
}

function hide_tabs_except_details(frm) {
    // Utiliser setTimeout pour s'assurer que le DOM est prêt
    setTimeout(function() {
        // Sélectionner tous les liens d'onglets dans le formulaire
        const tab_links = frm.page.wrapper.find('.form-tabs .nav-item');
        
        if (!tab_links.length) {
            return;
        }
        
        // Labels autorisés pour l'onglet "Détails" (insensible à la casse et aux accents)
        const allowed_patterns = ["détails", "details", "detils"];
        
        tab_links.each(function() {
            const $tab = $(this);
            const tab_text = $tab.find('a').text().trim().toLowerCase();
            
            // Normaliser le texte (enlever les accents pour comparaison)
            const normalized_text = tab_text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            const is_details_tab = allowed_patterns.some(pattern => {
                const normalized_pattern = pattern.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return normalized_text === normalized_pattern || tab_text === pattern;
            });
            
            if (!is_details_tab) {
                $tab.hide();
            }
        });
    }, 100);
}
