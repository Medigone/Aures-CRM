// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on('Demande Faisabilite', {
    refresh: function(frm) {

        // Charger la liste des Etude Faisabilite dans le champ "liens"
        load_etude_links(frm);

        // --- Bouton "Ajouter un article" ---
        if (!frm.get_field('html').$wrapper.find('#add-article-btn').length) {
            frm.get_field('html').$wrapper.append(
                '<button id="add-article-btn" class="btn btn-primary" style="margin-top: 10px;">Ajouter un article</button>'
            );

            frm.get_field('html').$wrapper.find('#add-article-btn').click(function() {
                frappe.prompt([
                    {
                        fieldname: 'article',
                        fieldtype: 'Link',
                        label: 'Article',
                        options: 'Item',
                        reqd: 1,
                        // Filtrer les articles en fonction du champ "custom_client" dans Item
                        // par rapport au champ client de la Demande Faisabilite
                        get_query: function() {
                            return {
                                filters: { custom_client: frm.doc.client }
                            };
                        }
                    },
                    {
                        fieldname: 'quantite',
                        fieldtype: 'Int',
                        label: 'Quantité',
                        reqd: 1
                    },
                    {
                        fieldname: 'date_livraison',
                        fieldtype: 'Date',
                        label: 'Date de livraison',
                        reqd: 1
                    },
                    {
                        fieldname: 'est_creation',
                        fieldtype: 'Check',
                        label: 'Création',
                        default: 0
                    }
                ],
                function(values) {
                    var already_exists = false;
                    frm.doc.liste_articles.forEach(function(row) {
                        if (row.article === values.article) {
                            already_exists = true;
                        }
                    });

                    if (already_exists) {
                        frappe.msgprint("Cet article existe déjà dans la liste.");
                    } else {
                        var row = frm.add_child('liste_articles');
                        row.article = values.article;
                        row.quantite = values.quantite;
                        row.date_livraison = values.date_livraison;
                        row.est_creation = values.est_creation;
                        frm.refresh_field('liste_articles');
                        frm.save().then(function() {
                            frappe.msgprint("Article ajouté.");
                        });
                    }
                },
                'Ajouter un article',
                'Ajouter'
                );
            });
        }

        // --- Bouton "Confirmer" ---
        if (frm.doc.status === "Brouillon") {
            frm.clear_custom_buttons();
            frm.add_custom_button("Confirmer", function() {
                frappe.confirm(
                    "Voulez-vous vraiment confirmer cette demande et générer une Étude de Faisabilité pour chaque article ?",
                    function() {  // Si l'utilisateur confirme
                        frappe.call({
                            method: "aurescrm.faisabilite_hook.generate_etude_faisabilite",
                            args: { docname: frm.doc.name },
                            callback: function(r) {
                                if (r.message) {
                                    frappe.msgprint("La demande a été confirmée et les études de faisabilité générées.");
                                    frm.reload_doc();
                                }
                            },
                            error: function(err) {
                                frappe.msgprint("Erreur lors de la génération : " + err);
                            }
                        });
                    },
                    function() {
                        // Rien si l'utilisateur annule
                    }
                );
            });
        }
    }
});

/**
 * Charge la liste des documents "Etude Faisabilite" liés à la demande
 * et affiche ces informations dans le champ HTML "liens".
 */
function load_etude_links(frm) {
    frappe.db.get_list("Etude Faisabilite", {
        filters: { demande_faisabilite: frm.doc.name },
        fields: ["name", "status"],
        limit_page_length: 100
    }).then(function(records) {
        var html = "";
        if (records && records.length > 0) {
            // Conteneur unique avec bordure, coins arrondis et padding
            html += "<div>";
            // Titre en haut du conteneur
            html += '<h3 style="font-size: 12px; font-weight: bold; margin-bottom: 12px;">Liste Études de Faisabilité</h3>';
            // Liste des études sans onclick sur la div de l'étude, mais uniquement sur le texte de l'id
            records.forEach(function(rec) {
                var badge = get_status_badge(rec.status);
                html += "<div style='margin-bottom: 5px;'>";
                // Le badge suivi d'un lien cliquable sur le texte de l'ID
                html += badge + " " + "<a href='#' onclick=\"frappe.set_route('Form','Etude Faisabilite','" + rec.name + "'); return false;\" style='font-weight: bold; font-size: 10px; text-decoration: none; color: inherit;'>" + rec.name + "</a>";
                html += "</div>";
            });
            html += "</div>";
        } else {
            html = "<p>Aucune étude de faisabilité liée.</p>";
        }
        frm.get_field("liens").$wrapper.html(html);
    });
}

/**
 * Retourne un badge HTML pour un statut donné en appliquant une couleur.
 */
function get_status_badge(status) {
    var config = {
        "Nouveau": { color: "#118ab2" },
        "En étude": { color: "#f4a261" },
        "Réalisable": { color: "#2a9d8f" },
        "Non Réalisable": { color: "#e63946" },
        "Programmée": { color: "#118ab2" }
    };
    var clr = config[status] ? config[status].color : "#999999";
    return "<span style='background-color: " + clr + "; font-size: 10px; color: #fff; border-radius: 4px; padding: 2px 4px; margin-right: 4px;'>" +
           status + "</span>";
}
