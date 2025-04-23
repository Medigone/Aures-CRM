frappe.ui.form.on('Etude Faisabilite', {
    refresh: function(frm) {
        // === Filtres dynamiques ===
        set_filters(frm);

        // === BOUTONS DANS LE STATUT "En étude" SEULEMENT ===
        // Les boutons 'Tracé' et 'Imposition' sous le groupe 'Créer' ont été supprimés.
        // if (frm.doc.status === "En étude") {
            // === CRÉATION TRACE ===
            // if (!frm.doc.trace && !frm.doc.imposition) {
            //     frm.add_custom_button('Tracé', async function () { ... }, 'Créer'); // Supprimé
            // }
            // === CRÉATION IMPOSITION ===
            // if (frm.doc.trace && !frm.doc.imposition) {
            //     frm.add_custom_button('Imposition', function () { ... }, 'Créer'); // Supprimé
            // }
        // }


        // === NOMENCLATURE et DEVIS ===
        // Les boutons 'Nomenclature' et 'Devis' sous le groupe 'Créer' ont été supprimés.
        // if (frm.doc.status === "Réalisable" && frm.doc.article) {
            // Bouton pour créer une Nomenclature
            // frm.add_custom_button('Nomenclature', function() { ... }, "Créer"); // Supprimé

            // Bouton pour créer un Devis
            // frm.add_custom_button('Devis', function() { ... }, "Créer"); // Supprimé
        // }
    },

    client: function(frm) {
        set_filters(frm);
    },

    article: function(frm) {
        set_filters(frm);
    },

    trace: function(frm) {
        set_filters(frm);
    },

    status: function(frm) {
        frm.refresh(); // Rafraîchit pour potentiellement masquer/afficher d'autres éléments si nécessaire
    }
});

// Fonction centralisée pour appliquer les filtres
function set_filters(frm) {
    // Filtrer les articles selon le client
    frm.fields_dict.article.get_query = function(doc) {
        return {
            filters: {
                'custom_client': doc.client
            }
        };
    };

    // Filtrer les traces selon l’article sélectionné
    frm.fields_dict.trace.get_query = function(doc) {
        return {
            filters: {
                article: doc.article
            }
        };
    };

    // Filtrer les impositions selon l’article et la trace sélectionnés
    frm.fields_dict.imposition.get_query = function(doc) {
        return {
            filters: {
                article: doc.article,
                trace: doc.trace
            }
        };
    };
}
