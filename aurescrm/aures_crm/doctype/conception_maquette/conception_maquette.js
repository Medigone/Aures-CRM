// Copyright (c) 2025, SAS AURES and contributors
// For license information, please see license.txt

frappe.ui.form.on('Conception Maquette', {
    refresh: function(frm) {
        // Filtrer le champ infographe_assigne pour ne montrer que les utilisateurs avec les rôles Prepresse
        frm.set_query('infographe_assigne', function() {
            return {
                query: 'frappe.core.doctype.user.user.user_query',
                filters: {
                    'roles': ['Technicien Prepresse', 'Responsable Prepresse']
                }
            };
        });

        // Rendre client et article readonly si le statut n'est pas 'Nouveau'
        if (frm.doc.status !== 'Nouveau') {
            frm.set_df_property('client', 'read_only', 1);
            frm.set_df_property('article', 'read_only', 1);
        } else {
            frm.set_df_property('client', 'read_only', 0);
            frm.set_df_property('article', 'read_only', 0);
        }

        // Afficher les informations dans le champ HTML
        afficher_infos(frm);

        // Ajouter les boutons d'attribution de l'infographe
        ajouter_boutons_attribution(frm);

        // Ajouter les boutons d'actions selon le statut
        ajouter_boutons_actions(frm);
    },

    client: function(frm) {
        frm.refresh_field('nom_client');
    },

    article: function(frm) {
        frm.refresh_field('designation_article');
    },

    infographe_assigne: function(frm) {
        frm.refresh_field('nom_infographe');
        afficher_infos(frm);
    },

    priorite: function(frm) {
        afficher_infos(frm);
    },

    points_effort: function(frm) {
        afficher_infos(frm);
    },

    points_complexite: function(frm) {
        afficher_infos(frm);
    },

    temps_total: function(frm) {
        afficher_infos(frm);
    },

    date_validation: function(frm) {
        afficher_infos(frm);
    }
});

// Fonction pour ajouter les boutons d'actions selon le statut
function ajouter_boutons_actions(frm) {
    // Ne pas afficher de boutons si le document n'est pas sauvegardé
    if (frm.is_new()) return;
    
    // Bouton "Démarrer" pour statut Nouveau
    if (frm.doc.status === 'Nouveau') {
        frm.add_custom_button(__('Démarrer Conception'), function() {
            demarrer_conception(frm);
        }, __('Actions'));
    }
    
    // Bouton "Terminer" pour statut En Cours
    if (frm.doc.status === 'En Cours') {
        frm.add_custom_button(__('Terminer Conception'), function() {
            terminer_conception(frm);
        }, __('Actions'));
    }
    
    // Bouton "Valider" pour statut Terminé
    if (frm.doc.status === 'Terminé') {
        frm.add_custom_button(__('Valider Conception'), function() {
            valider_conception(frm);
        }, __('Actions'));
    }
    
    // Bouton "Annuler" pour tous les statuts sauf Validé et Annulé
    if (frm.doc.status !== 'Validé' && frm.doc.status !== 'Annulé') {
        frm.add_custom_button(__('Annuler Conception'), function() {
            annuler_conception(frm);
        }, __('Actions'));
    }
}

// Fonction pour démarrer la conception
function demarrer_conception(frm) {
    frappe.confirm(
        __('Êtes-vous sûr de vouloir démarrer cette conception ?'),
        function() {
            frappe.call({
                method: 'demarrer_conception',
                doc: frm.doc,
                callback: function(r) {
                    if (r.message) {
                        frm.reload_doc();
                    }
                }
            });
        }
    );
}

// Fonction pour terminer la conception
function terminer_conception(frm) {
    frappe.confirm(
        __('Êtes-vous sûr de vouloir terminer cette conception ?<br><br>Le temps total sera calculé automatiquement.'),
        function() {
            frappe.call({
                method: 'terminer_conception',
                doc: frm.doc,
                callback: function(r) {
                    if (r.message) {
                        frm.reload_doc();
                    }
                }
            });
        }
    );
}

// Fonction pour valider la conception
function valider_conception(frm) {
    frappe.confirm(
        __('Êtes-vous sûr de vouloir valider cette conception ?<br><br>Cette action est définitive.'),
        function() {
            frappe.call({
                method: 'valider_conception',
                doc: frm.doc,
                callback: function(r) {
                    if (r.message) {
                        frm.reload_doc();
                    }
                }
            });
        }
    );
}

// Fonction pour annuler la conception
function annuler_conception(frm) {
    frappe.confirm(
        __('Êtes-vous sûr de vouloir annuler cette conception ?'),
        function() {
            frappe.call({
                method: 'annuler_conception',
                doc: frm.doc,
                callback: function(r) {
                    if (r.message) {
                        frm.reload_doc();
                    }
                }
            });
        }
    );
}

// Fonction pour afficher les informations dans le champ HTML
function afficher_infos(frm) {
    const html_field = frm.fields_dict.infos;
    if (!html_field) return;
    
    let html = '<div style="border: 0.5px solid #d1d8dd; border-radius: 8px; overflow: hidden; margin-bottom: 15px;">';
    
    // En-tête
    html += '<div style="padding: 10px 20px; border-bottom: 0.5px solid #d1d8dd; background-color: #f8f9fa;">';
    html += '<div style="display: flex; align-items: center;">';
    html += '<span style="font-size: 14px; font-weight: 600; color: #1a1a1a;">Informations de la conception</span>';
    html += '</div></div>';
    
    // Contenu
    html += '<div style="padding: 20px; background-color: #ffffff;">';
    
    // Grille d'informations
    html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">';
    
    // Priorité
    if (frm.doc.priorite) {
        let priority_badge = get_priority_badge_conception(frm.doc.priorite);
        html += `<div style="display: flex; flex-direction: column;">
            <span style="font-size: 11px; font-weight: 600; color: #6c757d; text-transform: uppercase; margin-bottom: 5px;">Priorité</span>
            <div>${priority_badge}</div>
        </div>`;
    }
    
    // Infographe assigné
    if (frm.doc.infographe_assigne && frm.doc.nom_infographe) {
        html += `<div style="display: flex; flex-direction: column;">
            <span style="font-size: 11px; font-weight: 600; color: #6c757d; text-transform: uppercase; margin-bottom: 5px;">Infographe</span>
            <span style="font-size: 12px; color: #1a1a1a; font-weight: 500;">
                ${frm.doc.nom_infographe}
            </span>
        </div>`;
    }
    
    // Points d'effort
    if (frm.doc.points_effort) {
        let effort_label = frm.doc.points_effort;
        let effort_number = frm.doc.points_complexite;
        html += `<div style="display: flex; flex-direction: column;">
            <span style="font-size: 11px; font-weight: 600; color: #6c757d; text-transform: uppercase; margin-bottom: 5px;">Complexité</span>
            <span style="font-size: 12px; color: #1a1a1a;">
                ${effort_label}`;
        
        // Afficher les points si disponibles
        if (effort_number) {
            html += ` <span style="color: #6c757d;">(${effort_number} point${effort_number > 1 ? 's' : ''})</span>`;
        }
        
        html += `</span>
        </div>`;
    }
    
    // Temps de travail
    if (frm.doc.temps_total) {
        html += `<div style="display: flex; flex-direction: column;">
            <span style="font-size: 11px; font-weight: 600; color: #6c757d; text-transform: uppercase; margin-bottom: 5px;">Temps total</span>
            <span style="font-size: 12px; color: #1a1a1a; font-weight: 500;">
                ⏱️ ${frm.doc.temps_total.toFixed(2)} heures
            </span>
        </div>`;
    }
    
    // Date de validation
    if (frm.doc.date_validation) {
        let date_validation = frappe.datetime.str_to_user(frm.doc.date_validation);
        html += `<div style="display: flex; flex-direction: column;">
            <span style="font-size: 11px; font-weight: 600; color: #6c757d; text-transform: uppercase; margin-bottom: 5px;">Validé le</span>
            <span style="font-size: 12px; color: #1a1a1a;">
                ${date_validation}
            </span>
        </div>`;
    }
    
    html += '</div>'; // Fin de la grille
    html += '</div>'; // Fin du contenu
    html += '</div>'; // Fin du container principal
    
    html_field.$wrapper.html(html);
}

// Fonction pour obtenir le badge de la priorité (style cohérent avec demande_faisabilite.js)
function get_priority_badge_conception(priority) {
    const config = {
        "Urgente": { color: "rgba(230, 57, 70, 0.1)", textColor: "#e63946", icon: "🔴" },
        "Haute": { color: "rgba(231, 111, 81, 0.1)", textColor: "#e76f51", icon: "🟠" },
        "Normale": { color: "rgba(42, 157, 143, 0.1)", textColor: "#2a9d8f", icon: "🟢" }
    };
    
    const style = config[priority] || { color: "rgba(102, 102, 102, 0.1)", textColor: "#666", icon: "⚪" };
    
    return "<span style='background-color: " + style.color + "; font-size: 11px; color: " + style.textColor + "; border-radius: 4px; padding: 2px 8px;'>" +
           style.icon + " " + priority + "</span>";
}

// Fonction pour ajouter les boutons d'attribution de l'infographe
function ajouter_boutons_attribution(frm) {
    // Ne pas afficher de boutons si le document n'est pas sauvegardé
    if (frm.is_new()) return;
    
    // Bouton "À moi" - pour s'attribuer la conception
    if (frm.doc.status === 'Nouveau' || !frm.doc.infographe_assigne) {
        frm.add_custom_button(__('À moi'), function() {
            let currentUser = frappe.session.user;
            
            frappe.call({
                method: "aurescrm.aures_crm.doctype.conception_maquette.conception_maquette.update_infographe",
                args: {
                    docname: frm.doc.name,
                    infographe_user: currentUser
                },
                callback: function(r) {
                    if (r.message && r.message.status === "success") {
                        let userFullName = r.message.full_name;
                        frm.set_value('infographe_assigne', currentUser);
                        frm.set_value('nom_infographe', userFullName);
                        frm.refresh_field('infographe_assigne');
                        frm.refresh_field('nom_infographe');
                        frappe.show_alert({ 
                            message: __('Infographe assigné: ') + userFullName, 
                            indicator: 'green' 
                        });
                        frm.reload_doc();
                    } else {
                        let error_msg = r.message ? r.message.message : __('Erreur inconnue');
                        frappe.show_alert({ 
                            message: __('Erreur lors de la mise à jour: ') + error_msg, 
                            indicator: 'red' 
                        });
                    }
                },
                error: function(r) {
                    frappe.show_alert({ 
                        message: __('Erreur de communication serveur'), 
                        indicator: 'red' 
                    });
                    console.error("Erreur update_infographe:", r);
                }
            });
        }, __("Attribuer"));
    }
    
    // Bouton "Attribuer à..." - pour choisir un infographe
    if (frm.doc.status === 'Nouveau' || !frm.doc.infographe_assigne) {
        frm.add_custom_button(__('Attribuer à...'), function() {
            let dialog = new frappe.ui.Dialog({
                title: __('Sélectionner un Infographe'),
                fields: [
                    {
                        label: __('Infographe'),
                        fieldname: 'selected_user',
                        fieldtype: 'Link',
                        options: 'User',
                        reqd: 1,
                        get_query: function() {
                            return {
                                query: "aurescrm.aures_crm.doctype.conception_maquette.conception_maquette.get_infographes_prepresse",
                            };
                        }
                    }
                ],
                primary_action_label: __('Sélectionner'),
                primary_action(values) {
                    if (values.selected_user) {
                        let selectedUser = values.selected_user;
                        
                        frappe.call({
                            method: "aurescrm.aures_crm.doctype.conception_maquette.conception_maquette.update_infographe",
                            args: {
                                docname: frm.doc.name,
                                infographe_user: selectedUser
                            },
                            callback: function(r) {
                                if (r.message && r.message.status === "success") {
                                    let userFullName = r.message.full_name;
                                    frm.set_value('infographe_assigne', selectedUser);
                                    frm.set_value('nom_infographe', userFullName);
                                    frm.refresh_field('infographe_assigne');
                                    frm.refresh_field('nom_infographe');
                                    frappe.show_alert({ 
                                        message: __('Infographe assigné: ') + userFullName, 
                                        indicator: 'green' 
                                    });
                                    frm.reload_doc();
                                } else {
                                    let error_msg = r.message ? r.message.message : __('Erreur inconnue');
                                    frappe.show_alert({ 
                                        message: __('Erreur lors de la mise à jour: ') + error_msg, 
                                        indicator: 'red' 
                                    });
                                }
                            },
                            error: function(r) {
                                frappe.show_alert({ 
                                    message: __('Erreur de communication serveur'), 
                                    indicator: 'red' 
                                });
                                console.error("Erreur update_infographe:", r);
                            }
                        });
                    }
                    dialog.hide();
                }
            });
            dialog.show();
        }, __("Attribuer"));
    }
}

