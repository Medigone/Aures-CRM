// Copyright (c) 2026, Aures Emballages and contributors
// For license information, please see license.txt

frappe.ui.form.on("Calcul Devis", {
    refresh: function(frm) {
        // Filtrer les impositions par article sélectionné
        frm.set_query("imposition", function() {
            return {
                filters: {
                    "article": frm.doc.article
                }
            };
        });
        
        // Rafraîchir l'affichage conditionnel des champs de coûts finitions
        toggle_finition_costs(frm);
    },

    // === Données Techniques ===
    quantite: function(frm) {
        calculate_all(frm);
    },
    
    nbr_poses: function(frm) {
        calculate_all(frm);
    },

    // === Imposition change - recalculer surface ===
    imposition: function(frm) {
        // Les champs fetch_from sont mis à jour automatiquement
        // On attend un peu pour que les valeurs soient récupérées
        setTimeout(() => {
            calculate_surface(frm);
            calculate_all(frm);
        }, 500);
    },

    // === Format d'impression ===
    format_imp: function(frm) {
        calculate_surface(frm);
        calculate_all(frm);
    },

    // === Grammage ===
    grammage: function(frm) {
        calculate_surface(frm);
        calculate_all(frm);
    },

    // === Coût Support au kg ===
    cout_support_kg: function(frm) {
        calculate_support_cost(frm);
        calculate_all(frm);
    },

    // === Coûts Fixes ===
    cout_calage: function(frm) {
        calculate_all(frm);
    },
    
    cout_plaques_cliches: function(frm) {
        calculate_all(frm);
    },
    
    cout_forme_decoupe: function(frm) {
        calculate_all(frm);
    },
    
    cout_prepresse: function(frm) {
        calculate_all(frm);
    },
    
    cout_autres_fixes: function(frm) {
        calculate_all(frm);
    },

    // === Coûts Finitions (par m²) ===
    cout_pelliculage_m2: function(frm) {
        calculate_finitions_cost(frm);
        calculate_all(frm);
    },

    cout_marquage_chaud_m2: function(frm) {
        calculate_finitions_cost(frm);
        calculate_all(frm);
    },

    cout_acrylique_m2: function(frm) {
        calculate_finitions_cost(frm);
        calculate_all(frm);
    },

    cout_uv_m2: function(frm) {
        calculate_finitions_cost(frm);
        calculate_all(frm);
    },

    cout_selectif_m2: function(frm) {
        calculate_finitions_cost(frm);
        calculate_all(frm);
    },

    cout_drip_off_m2: function(frm) {
        calculate_finitions_cost(frm);
        calculate_all(frm);
    },

    cout_mat_gras_m2: function(frm) {
        calculate_finitions_cost(frm);
        calculate_all(frm);
    },

    cout_blister_m2: function(frm) {
        calculate_finitions_cost(frm);
        calculate_all(frm);
    },

    cout_recto_verso_m2: function(frm) {
        calculate_finitions_cost(frm);
        calculate_all(frm);
    },

    cout_fenetre_m2: function(frm) {
        calculate_finitions_cost(frm);
        calculate_all(frm);
    },

    cout_braille_m2: function(frm) {
        calculate_finitions_cost(frm);
        calculate_all(frm);
    },

    cout_gaufrage_m2: function(frm) {
        calculate_finitions_cost(frm);
        calculate_all(frm);
    },

    cout_massicot_m2: function(frm) {
        calculate_finitions_cost(frm);
        calculate_all(frm);
    },

    cout_collerette_m2: function(frm) {
        calculate_finitions_cost(frm);
        calculate_all(frm);
    },

    cout_blanc_couvrant_m2: function(frm) {
        calculate_finitions_cost(frm);
        calculate_all(frm);
    },

    // === Autres Coûts Variables (par Feuille) ===
    cout_encres_feuille: function(frm) {
        calculate_all(frm);
    },
    
    cout_mo_feuille: function(frm) {
        calculate_all(frm);
    },
    
    cout_autres_feuille: function(frm) {
        calculate_all(frm);
    },

    // === Gâche ===
    taux_gache_tirage: function(frm) {
        calculate_all(frm);
    },

    // === Marge ===
    marge_percent: function(frm) {
        calculate_all(frm);
    },

    // === Changement d'article - recharger les finitions ===
    article: function(frm) {
        frm.set_value("imposition", "");
        frm.set_value("nbr_poses", 0);
        frm.set_value("taux_chutes", 0);
        frm.set_value("format_imp", "");
        frm.set_value("surface_feuille", 0);
        frm.set_value("poids_feuille", 0);
        
        // Les finitions seront rechargées via fetch_from
        // Attendre que les valeurs soient récupérées puis actualiser l'affichage
        setTimeout(() => {
            toggle_finition_costs(frm);
        }, 500);
    },

    // === Changement de devis ===
    devis: function(frm) {
        if (frm.doc.devis) {
            frappe.db.get_value("Quotation", frm.doc.devis, "custom_id_client", (r) => {
                if (r && r.custom_id_client) {
                    frm.set_value("client", r.custom_id_client);
                }
            });
        }
    },

    // === Événements de changement des finitions (pour affichage conditionnel) ===
    fin_pelliculage: function(frm) {
        toggle_finition_costs(frm);
    },
    fin_marquage_chaud: function(frm) {
        toggle_finition_costs(frm);
    },
    fin_acrylique: function(frm) {
        toggle_finition_costs(frm);
    },
    fin_uv: function(frm) {
        toggle_finition_costs(frm);
    },
    fin_selectif: function(frm) {
        toggle_finition_costs(frm);
    },
    fin_drip_off: function(frm) {
        toggle_finition_costs(frm);
    },
    fin_mat_gras: function(frm) {
        toggle_finition_costs(frm);
    },
    fin_blister: function(frm) {
        toggle_finition_costs(frm);
    },
    fin_recto_verso: function(frm) {
        toggle_finition_costs(frm);
    },
    fin_fenetre: function(frm) {
        toggle_finition_costs(frm);
    },
    fin_braille: function(frm) {
        toggle_finition_costs(frm);
    },
    fin_gaufrage: function(frm) {
        toggle_finition_costs(frm);
    },
    fin_massicot: function(frm) {
        toggle_finition_costs(frm);
    },
    fin_collerette: function(frm) {
        toggle_finition_costs(frm);
    },
    fin_blanc_couvrant: function(frm) {
        toggle_finition_costs(frm);
    }
});

/**
 * Calcule la surface et le poids de la feuille
 */
function calculate_surface(frm) {
    let surface_feuille = 0;
    let poids_feuille = 0;
    
    if (frm.doc.format_imp) {
        try {
            // Parser le format "LARGEURxHAUTEUR"
            let format_str = String(frm.doc.format_imp).toLowerCase().replace('×', 'x');
            if (format_str.includes('x')) {
                let parts = format_str.split('x');
                let largeur = flt(parts[0].trim());
                let hauteur = flt(parts[1].trim());
                
                // Surface en m²
                surface_feuille = (largeur * hauteur) / 1000000;
                
                // Poids si grammage disponible
                let grammage = cint(frm.doc.grammage) || 0;
                if (grammage > 0 && surface_feuille > 0) {
                    poids_feuille = surface_feuille * grammage;
                }
            }
        } catch (e) {
            // Ignorer les erreurs de parsing
        }
    }
    
    frm.set_value("surface_feuille", surface_feuille);
    frm.set_value("poids_feuille", poids_feuille);
    
    // Recalculer le coût support
    calculate_support_cost(frm);
}

/**
 * Calcule le coût du support par feuille à partir du coût au kg
 */
function calculate_support_cost(frm) {
    let cout_support_feuille = 0;
    
    let poids_feuille = flt(frm.doc.poids_feuille) || 0;
    let cout_support_kg = flt(frm.doc.cout_support_kg) || 0;
    
    if (poids_feuille > 0 && cout_support_kg > 0) {
        // Coût = (poids en g / 1000) × coût/kg
        cout_support_feuille = (poids_feuille / 1000) * cout_support_kg;
    }
    
    frm.set_value("cout_support_feuille", cout_support_feuille);
}

/**
 * Calcule le coût total des finitions par feuille
 */
function calculate_finitions_cost(frm) {
    let surface = flt(frm.doc.surface_feuille) || 0;
    let total_finitions = 0;
    
    // Finitions de type Select
    const select_finitions = [
        { check: 'fin_pelliculage', cost: 'cout_pelliculage_m2' },
        { check: 'fin_marquage_chaud', cost: 'cout_marquage_chaud_m2' }
    ];
    
    // Finitions de type Check
    const check_finitions = [
        { check: 'fin_acrylique', cost: 'cout_acrylique_m2' },
        { check: 'fin_uv', cost: 'cout_uv_m2' },
        { check: 'fin_selectif', cost: 'cout_selectif_m2' },
        { check: 'fin_drip_off', cost: 'cout_drip_off_m2' },
        { check: 'fin_mat_gras', cost: 'cout_mat_gras_m2' },
        { check: 'fin_blister', cost: 'cout_blister_m2' },
        { check: 'fin_recto_verso', cost: 'cout_recto_verso_m2' },
        { check: 'fin_fenetre', cost: 'cout_fenetre_m2' },
        { check: 'fin_braille', cost: 'cout_braille_m2' },
        { check: 'fin_gaufrage', cost: 'cout_gaufrage_m2' },
        { check: 'fin_massicot', cost: 'cout_massicot_m2' },
        { check: 'fin_collerette', cost: 'cout_collerette_m2' },
        { check: 'fin_blanc_couvrant', cost: 'cout_blanc_couvrant_m2' }
    ];
    
    // Calculer pour finitions Select
    select_finitions.forEach(fin => {
        let fin_value = frm.doc[fin.check];
        let cout_m2 = flt(frm.doc[fin.cost]) || 0;
        
        // Actif si non vide et différent de "Sans"
        let is_active = fin_value && String(fin_value).trim().toLowerCase() !== 'sans';
        
        if (is_active && cout_m2 > 0 && surface > 0) {
            total_finitions += surface * cout_m2;
        }
    });
    
    // Calculer pour finitions Check
    check_finitions.forEach(fin => {
        let fin_value = cint(frm.doc[fin.check]) || 0;
        let cout_m2 = flt(frm.doc[fin.cost]) || 0;
        
        if (fin_value === 1 && cout_m2 > 0 && surface > 0) {
            total_finitions += surface * cout_m2;
        }
    });
    
    frm.set_value("total_cout_finitions_feuille", total_finitions);
}

/**
 * Gère l'affichage/masquage des champs de coûts finitions
 */
function toggle_finition_costs(frm) {
    // Finitions de type Select
    const select_finitions = [
        { check: 'fin_pelliculage', cost: 'cout_pelliculage_m2' },
        { check: 'fin_marquage_chaud', cost: 'cout_marquage_chaud_m2' }
    ];
    
    // Finitions de type Check
    const check_finitions = [
        { check: 'fin_acrylique', cost: 'cout_acrylique_m2' },
        { check: 'fin_uv', cost: 'cout_uv_m2' },
        { check: 'fin_selectif', cost: 'cout_selectif_m2' },
        { check: 'fin_drip_off', cost: 'cout_drip_off_m2' },
        { check: 'fin_mat_gras', cost: 'cout_mat_gras_m2' },
        { check: 'fin_blister', cost: 'cout_blister_m2' },
        { check: 'fin_recto_verso', cost: 'cout_recto_verso_m2' },
        { check: 'fin_fenetre', cost: 'cout_fenetre_m2' },
        { check: 'fin_braille', cost: 'cout_braille_m2' },
        { check: 'fin_gaufrage', cost: 'cout_gaufrage_m2' },
        { check: 'fin_massicot', cost: 'cout_massicot_m2' },
        { check: 'fin_collerette', cost: 'cout_collerette_m2' },
        { check: 'fin_blanc_couvrant', cost: 'cout_blanc_couvrant_m2' }
    ];
    
    // Gérer finitions Select
    select_finitions.forEach(fin => {
        let fin_value = frm.doc[fin.check];
        let is_active = fin_value && String(fin_value).trim().toLowerCase() !== 'sans';
        frm.toggle_display(fin.cost, is_active);
    });
    
    // Gérer finitions Check
    check_finitions.forEach(fin => {
        let fin_value = cint(frm.doc[fin.check]) || 0;
        frm.toggle_display(fin.cost, fin_value === 1);
    });
}

/**
 * Fonction principale de calcul de tous les coûts
 */
function calculate_all(frm) {
    // 1. Quantité de feuilles = Quantité commandée ÷ Nombre de poses
    let nbr_poses = cint(frm.doc.nbr_poses) || 1;
    let quantite = flt(frm.doc.quantite) || 0;
    let quantite_feuilles = nbr_poses > 0 ? Math.ceil(quantite / nbr_poses) : 0;
    frm.set_value("quantite_feuilles", quantite_feuilles);
    
    // 2. Feuilles avec gâche = Feuilles × (1 + Taux Gâche%)
    let taux_gache = flt(frm.doc.taux_gache_tirage) / 100;
    let feuilles_avec_gache = Math.ceil(quantite_feuilles * (1 + taux_gache));
    frm.set_value("quantite_feuilles_gache", feuilles_avec_gache);
    
    // 3. Total coûts fixes
    let total_fixes = flt(frm.doc.cout_calage) +
                      flt(frm.doc.cout_plaques_cliches) +
                      flt(frm.doc.cout_forme_decoupe) +
                      flt(frm.doc.cout_prepresse) +
                      flt(frm.doc.cout_autres_fixes);
    frm.set_value("total_couts_fixes", total_fixes);
    
    // 4. Total coûts variables = (coûts par feuille) × (feuilles avec gâche)
    // Inclut: support + finitions + encres + MO + autres
    let cout_par_feuille = flt(frm.doc.cout_support_feuille) +
                           flt(frm.doc.total_cout_finitions_feuille) +
                           flt(frm.doc.cout_encres_feuille) +
                           flt(frm.doc.cout_mo_feuille) +
                           flt(frm.doc.cout_autres_feuille);
    let total_variables = cout_par_feuille * feuilles_avec_gache;
    frm.set_value("total_couts_variables", total_variables);
    
    // 5. Coût total = Fixes + Variables
    let cout_total = total_fixes + total_variables;
    frm.set_value("cout_total", cout_total);
    
    // 6. Coût unitaire = Coût total / Quantité commandée
    let cout_unitaire = 0;
    if (quantite > 0) {
        cout_unitaire = cout_total / quantite;
    }
    frm.set_value("cout_unitaire", cout_unitaire);
    
    // 7. Prix unitaire proposé = Coût unitaire × (1 + Marge%)
    let marge_multiplier = 1 + (flt(frm.doc.marge_percent) / 100);
    let prix_unitaire = cout_unitaire * marge_multiplier;
    frm.set_value("prix_unitaire_propose", prix_unitaire);
    
    // 8. Prix total proposé = Prix unitaire × Quantité
    let prix_total = prix_unitaire * quantite;
    frm.set_value("prix_total_propose", prix_total);
}
