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

    // === Gâche ===
    taux_gache_tirage: function(frm) {
        calculate_all(frm);
    },

    // === Marge ===
    marge_percent: function(frm) {
        calculate_all(frm);
    },

    // === Changement d'article ===
    article: function(frm) {
        frm.set_value("imposition", "");
        frm.set_value("nbr_poses", 0);
        frm.set_value("taux_chutes", 0);
        frm.set_value("format_imp", "");
        frm.set_value("surface_feuille", 0);
        frm.set_value("poids_feuille", 0);
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
    }
});

frappe.ui.form.on("Calcul Devis Poste", {
    postes_add: function(frm) {
        calculate_all(frm);
    },

    postes_remove: function(frm) {
        calculate_all(frm);
    },

    nombre_passages: function(frm) {
        calculate_all(frm);
    },

    cout_fixe: function(frm) {
        calculate_all(frm);
    },

    unite_calcul: function(frm) {
        calculate_all(frm);
    },

    cout_variable_unitaire: function(frm) {
        calculate_all(frm);
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

    // 3. Coût total du support
    let cout_support_total = flt(frm.doc.cout_support_feuille) * feuilles_avec_gache;
    frm.set_value("cout_support_total", cout_support_total);

    // 4 et 5. Totaux des postes saisis manuellement
    let total_fixes = 0;
    let total_variables = 0;

    (frm.doc.postes || []).forEach(poste => {
        let passages = cint(poste.nombre_passages) || 1;
        total_fixes += flt(poste.cout_fixe) * passages;

        let quantite_reference = 1;
        if (poste.unite_calcul === "Par feuille") {
            quantite_reference = feuilles_avec_gache;
        } else if (poste.unite_calcul === "Par 1000 unités") {
            quantite_reference = quantite / 1000;
        }

        total_variables += flt(poste.cout_variable_unitaire) *
                           passages *
                           quantite_reference;
    });

    frm.set_value("total_couts_fixes", total_fixes);
    frm.set_value("total_couts_variables", total_variables);

    // 6. Coût total = Support + Fixes + Variables
    let cout_total = cout_support_total + total_fixes + total_variables;
    frm.set_value("cout_total", cout_total);
    
    // 7. Coût unitaire = Coût total / Quantité commandée
    let cout_unitaire = 0;
    if (quantite > 0) {
        cout_unitaire = cout_total / quantite;
    }
    frm.set_value("cout_unitaire", cout_unitaire);
    
    // 8. Prix unitaire proposé = Coût unitaire × (1 + Marge%)
    let marge_multiplier = 1 + (flt(frm.doc.marge_percent) / 100);
    let prix_unitaire = cout_unitaire * marge_multiplier;
    frm.set_value("prix_unitaire_propose", prix_unitaire);
    
    // 9. Prix total proposé = Prix unitaire × Quantité
    let prix_total = prix_unitaire * quantite;
    frm.set_value("prix_total_propose", prix_total);
}
