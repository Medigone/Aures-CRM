// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt


frappe.ui.form.on('Demande Faisabilite', {
    refresh: function(frm) {
        // Eviter l'ajout multiple du bouton
        if (!frm.get_field('html').$wrapper.find('#add-article-btn').length) {
            // Ajout du bouton dans le champ HTML
            frm.get_field('html').$wrapper.append(
                '<button id="add-article-btn" class="btn btn-primary" style="margin-top: 10px;">Ajouter un article</button>'
            );

            // Déclenchement du prompt lors du clic sur le bouton
            frm.get_field('html').$wrapper.find('#add-article-btn').click(function() {
                frappe.prompt([
                    {
                        'fieldname': 'article',
                        'fieldtype': 'Link',
                        'label': 'Article',
                        'options': 'Item',
                        'reqd': 1,
                        // Filtrage des articles en fonction du champ 'client' du document
                        'get_query': function() {
                            return {
                                filters: {
                                    custom_client: frm.doc.client
                                }
                            };
                        }
                    },
                    {
                        'fieldname': 'quantite',
                        'fieldtype': 'Int',
                        'label': 'Quantité',
                        'reqd': 1
                    },
                    {
                        'fieldname': 'date_livraison',
                        'fieldtype': 'Date',
                        'label': 'Date de livraison',
                        'reqd': 1
                    },
                    {
                        'fieldname': 'est_creation',
                        'fieldtype': 'Check',
                        'label': 'Création',
                        'default': 0
                    }
                ],
                function(values) {
                    // Vérifier si l'article existe déjà dans la liste
                    var already_exists = false;
                    frm.doc.liste_articles.forEach(function(row) {
                        if(row.article === values.article) {
                            already_exists = true;
                        }
                    });

                    if (already_exists) {
                        frappe.msgprint("Cet article existe déjà dans la liste.");
                    } else {
                        // Ajout d'une nouvelle ligne dans le child table "liste_articles"
                        var row = frm.add_child('liste_articles');
                        row.article = values.article;
                        row.quantite = values.quantite;
                        row.date_livraison = values.date_livraison;
                        row.est_creation = values.est_creation;
                        
                        // Rafraîchir le champ pour afficher la nouvelle ligne
                        frm.refresh_field('liste_articles');
                        
                        // Sauvegarder le document après l'ajout de l'article
                        frm.save().then(function() {
                            frappe.msgprint("Article ajouté.");
                        });
                    }
                },
                'Ajouter un article',   // Titre du prompt
                'Ajouter'               // Libellé du bouton de validation
                );
            });
        }
    }
});
