frappe.ui.form.on('Maquette', {
    onload: function(frm) {
        // Initialiser les sections couleur au chargement
        update_section_visibility(frm);
    },

    refresh: function(frm) {
        // Bouton Référencée
        if (!frm.is_new() && frm.doc.status === "A référencer") {
            frm.add_custom_button("Référencée", function() {
                frappe.confirm(
                    'Confirmez-vous que le fichier source de la maquette a été renommé avec cet ID dans le serveur des maquettes ?',
                    function() {
                        frm.call('set_status_referenced').then(() => {
                            frappe.msgprint(`Maquette ${frm.doc.name} a été marquée comme référencée dans le serveur.`);
                            frm.reload_doc();
                        });
                    }
                );
            });
        }

        // Bouton Activer
        if (!frm.is_new() && ["Référencée", "Obsolète"].includes(frm.doc.status)) {
            frm.add_custom_button("Activer", function() {
                frappe.confirm(
                    'Ceci va mettre cette version comme version Activée pour cet article, êtes-vous sûr de vouloir continuer ?',
                    function() {
                        frm.call('activate_version').then(() => {
                            frappe.msgprint("La maquette a été activée.");
                            frm.reload_doc();
                        });
                    }
                );
            });
        }

        // Nouveau bouton Nouvelle Version
        if (!frm.is_new() && frm.doc.status === "Version Activée") {
            frm.add_custom_button("Nouvelle Version", function() {
                frappe.confirm(
                    'Créer une nouvelle version de cette maquette ?',
                    function() {
                        frappe.prompt(
                            [
                                {
                                    fieldname: 'desc_changements',
                                    fieldtype: 'Small Text',
                                    label: 'Description des changements',
                                    reqd: 1
                                }
                            ],
                            function(data) {
                                frm.call('create_new_version', { desc_changements: data.desc_changements }).then(r => {
                                    let message = '';
                                    let version_name = '';
                                    
                                    if (typeof r.message === 'object' && r.message.new_version) {
                                        // Un PV a été créé
                                        version_name = r.message.new_version;
                                        message = `Nouvelle version créée : ${version_name}`;
                                        if (r.message.pv_destruction) {
                                            message += `<br>PV de destruction créé : <a href="#Form/PV Destruction Maquette/${r.message.pv_destruction}">${r.message.pv_destruction}</a>`;
                                        }
                                    } else {
                                        // Pas de PV créé
                                        version_name = r.message;
                                        message = `Nouvelle version créée : ${version_name}`;
                                    }
                                    
                                    frappe.msgprint(
                                        message,
                                        function() {
                                            if (version_name) {
                                                frappe.set_route('Form', 'Maquette', version_name);
                                            }
                                        }
                                    );
                                });
                            },
                            'Nouvelle Version',
                            'Créer'
                        );
                    }
                );
            });
        }

        // Rafraîchir champs de référence et couleur
        frm.refresh_field('nom_reference_par');
        frm.refresh_field('reference_par');
        update_section_visibility(frm);
        build_resume_couleurs(frm);
    },

    setup: function(frm) {
        frm.set_query('article', function() {
            return {
                filters: {
                    'custom_client': frm.doc.client
                }
            };
        });
    },

    mode_couleur: function(frm) {
        // Quand le mode couleur change, gérer la visibilité et pré-remplir si nécessaire
        update_section_visibility(frm);
        ensure_cmjn_rows(frm);
        sync_counters(frm);
        build_resume_couleurs(frm);
        
        // Forcer un refresh complet du formulaire pour s'assurer que les depends_on sont recalculés
        setTimeout(() => {
            frm.refresh();
        }, 100);
    },

    validate: function(frm) {
        // Synchroniser les compteurs et vérifier la cohérence avant sauvegarde
        sync_counters(frm);

        // Recalculer le résumé
        build_resume_couleurs(frm);
    }
});

// Hook pour la child table CMJN
frappe.ui.form.on('Maquette CMJN Ligne', {
    cmjn_details_add: function(frm, cdt, cdn) {
        sync_counters(frm);
        build_resume_couleurs(frm);
    },
    cmjn_details_remove: function(frm, cdt, cdn) {
        sync_counters(frm);
        build_resume_couleurs(frm);
    },
    canal: function(frm, cdt, cdn) {
        build_resume_couleurs(frm);
    }
});

// Hook pour la child table Spot Colors
frappe.ui.form.on('Maquette Spot Color', {
    spot_colors_add: function(frm, cdt, cdn) {
        sync_counters(frm);
        build_resume_couleurs(frm);
    },
    spot_colors_remove: function(frm, cdt, cdn) {
        sync_counters(frm);
        build_resume_couleurs(frm);
    },
    code_spot: function(frm, cdt, cdn) {
        // Nettoyer les espaces et mettre en majuscules
        let row = locals[cdt][cdn];
        if (row.code_spot) {
            row.code_spot = row.code_spot.trim().toUpperCase();
            frm.refresh_field('spot_colors');
        }
        build_resume_couleurs(frm);
    }
});

// === FONCTIONS UTILITAIRES ===

/**
 * Met à jour la visibilité des sections CMJN et Pantone selon le mode_couleur
 */
function update_section_visibility(frm) {
    if (!frm.doc.mode_couleur) {
        return;
    }

    // Laisser depends_on gérer la visibilité, juste forcer un refresh
    frm.refresh_field('section_break_cmjn');
    frm.refresh_field('nombre_couleurs_process');
    frm.refresh_field('cmjn_details');
    frm.refresh_field('nombre_spot_colors');
    frm.refresh_field('spot_colors');
}

/**
 * Synchronise les compteurs nombre_couleurs_process et nombre_spot_colors
 */
function sync_counters(frm) {
    // Compter les lignes CMJN
    frm.doc.nombre_couleurs_process = (frm.doc.cmjn_details || []).length;
    frm.refresh_field('nombre_couleurs_process');

    // Compter les couleurs spot
    frm.doc.nombre_spot_colors = (frm.doc.spot_colors || []).length;
    frm.refresh_field('nombre_spot_colors');
}

/**
 * S'assure que les 4 canaux CMJN (C, M, J, N) existent quand on sélectionne un mode CMJN
 */
function ensure_cmjn_rows(frm) {
    if (!frm.doc.mode_couleur) {
        return;
    }

    const has_cmjn = frm.doc.mode_couleur === 'CMJN' || frm.doc.mode_couleur === 'CMJN + Pantone';
    
    if (has_cmjn && (!frm.doc.cmjn_details || frm.doc.cmjn_details.length === 0)) {
        // Pré-remplir avec les 4 canaux C, M, J, N
        const canaux = ['C', 'M', 'J', 'N'];
        canaux.forEach(canal => {
            let row = frm.add_child('cmjn_details');
            row.canal = canal;
        });
        frm.refresh_field('cmjn_details');
        sync_counters(frm);
    }
}

/**
 * Construit le résumé des couleurs (resume_couleurs)
 * Format:
 * - CMJN → "CMJN (4)"
 * - Pantone uniquement → "Pantone (n) — P xxx, P yyy"
 * - CMJN + Pantone → "CMJN (4) + Pantone (n) — P xxx, P yyy"
 */
function build_resume_couleurs(frm) {
    if (!frm.doc.mode_couleur) {
        frm.set_value('resume_couleurs', '');
        return;
    }

    let resume_parts = [];
    
    const has_cmjn = frm.doc.mode_couleur === 'CMJN' || frm.doc.mode_couleur === 'CMJN + Pantone';
    const has_pantone = frm.doc.mode_couleur === 'Pantone uniquement' || frm.doc.mode_couleur === 'CMJN + Pantone';

    // Partie CMJN
    if (has_cmjn) {
        const nb_cmjn = (frm.doc.cmjn_details || []).length;
        resume_parts.push(`CMJN (${nb_cmjn})`);
    }

    // Partie Pantone
    if (has_pantone) {
        const nb_spot = (frm.doc.spot_colors || []).length;
        let spot_codes = (frm.doc.spot_colors || [])
            .map(s => s.code_spot)
            .filter(c => c)
            .join(', ');
        
        if (spot_codes) {
            resume_parts.push(`Pantone (${nb_spot}) — ${spot_codes}`);
        } else {
            resume_parts.push(`Pantone (${nb_spot})`);
        }
    }

    const resume = resume_parts.join(' + ');
    frm.set_value('resume_couleurs', resume);
}
