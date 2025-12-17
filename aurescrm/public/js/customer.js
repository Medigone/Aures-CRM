/**
 * Customer Form Script
 * - Met le formulaire en lecture seule si l'utilisateur n'est pas le commercial attribué
 * - Masque tous les onglets sauf "Détails"
 */
frappe.ui.form.on("Customer", {
    refresh: function(frm) {
        apply_customer_restrictions(frm);
    },
    
    onload: function(frm) {
        apply_customer_restrictions(frm);
    }
});

function apply_customer_restrictions(frm) {
    // Ne rien faire pour les nouveaux documents
    if (frm.is_new()) {
        return;
    }
    
    const user = frappe.session.user;
    const commercial_attribue = frm.doc.custom_commercial_attribué;
    
    // Vérifier si l'utilisateur est exempté (Admin ou System Manager)
    const is_exempt = frappe.user_roles.includes("Administrator") || 
                      frappe.user_roles.includes("System Manager");
    
    if (is_exempt) {
        return;
    }
    
    // Si le commercial est attribué et différent de l'utilisateur courant
    const is_restricted = commercial_attribue && commercial_attribue !== user;
    
    if (is_restricted) {
        // Mettre le formulaire en lecture seule
        set_form_read_only(frm);
        
        // Masquer les onglets sauf "Détails"
        hide_tabs_except_details(frm);
    }
}

function set_form_read_only(frm) {
    // Désactiver tous les champs
    frm.set_read_only();
    
    // Désactiver le bouton de sauvegarde
    frm.disable_save();
    
    // Masquer les boutons d'action principaux
    frm.page.clear_primary_action();
    frm.page.clear_secondary_action();
    
    // Afficher un message d'information
    frm.dashboard.add_comment(
        __("Ce client est attribué à un autre commercial. Vous êtes en mode lecture seule."),
        "blue",
        true
    );
}

function hide_tabs_except_details(frm) {
    // Récupérer tous les Tab Break du formulaire
    const tab_breaks = frm.meta.fields.filter(df => df.fieldtype === "Tab Break");
    
    if (!tab_breaks.length) {
        return;
    }
    
    // Labels autorisés pour l'onglet "Détails" (français et anglais)
    const allowed_labels = ["Détails", "Details", "détails", "details"];
    
    tab_breaks.forEach(function(df) {
        const translated_label = __(df.label);
        const is_details_tab = allowed_labels.some(label => 
            translated_label.toLowerCase() === label.toLowerCase() ||
            (df.label && df.label.toLowerCase() === label.toLowerCase())
        );
        
        if (!is_details_tab) {
            // Masquer l'onglet
            frm.set_df_property(df.fieldname, "hidden", 1);
        }
    });
    
    // Forcer le rafraîchissement de l'affichage des onglets
    frm.refresh_fields();
}

