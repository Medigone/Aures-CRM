/**
 * Client Script for Etude Faisabilite Doctype
 * Handles dynamic filters, HTML field updates with Trace/Imposition links and actions (Create/Update/Open). // <-- Updated comment
 */

frappe.ui.form.on('Etude Faisabilite', {
    /**
     * Refreshes the form view.
     * @param {object} frm - The current form object.
     */
    refresh: function(frm) {
        // Apply dynamic filters
        set_filters(frm);
        // Load or update the HTML section displaying Trace/Imposition info and actions
        load_trace_imposition_links(frm);
        // Refresh local attachment fields based on linked documents
        refresh_attached_files(frm);
        
        // Ajouter le bouton pour afficher/modifier les spécifications techniques de l'article
        // if (frm.doc.article) {
        //     frm.add_custom_button(__('Spécifications Techniques'), function() {
        //         show_item_technical_specs(frm.doc.article);
        //     }, __('Article'));
        // }
    },
    
    /**
     * Triggered when the client field changes.
     * @param {object} frm - The current form object.
     */
    client: function(frm) {
        // Re-apply filters as client impacts article list
        set_filters(frm);
        // Clear potentially invalid selections if client changes
        // frm.set_value('article', null); // Optional: uncomment if needed
        // frm.set_value('trace', null);
        // frm.set_value('imposition', null);
        // load_trace_imposition_links(frm); // Update HTML if fields are cleared
        // refresh_attached_files(frm);
    },

    /**
     * Triggered when the article field changes.
     * @param {object} frm - The current form object.
     */
    article: function(frm) {
        // Re-apply filters as article impacts trace/imposition lists
        set_filters(frm);
        
        // Vérifier s'il existe déjà un tracé pour cet article et le lier automatiquement
        if (frm.doc.article && !frm.doc.trace) {
            frappe.call({
                method: "aurescrm.aures_crm.doctype.etude_faisabilite.etude_faisabilite.get_existing_trace_for_article",
                args: { article: frm.doc.article },
                callback: function(r) {
                    if (r.message) {
                        // Un tracé existe, on le lie automatiquement
                        frm.set_value('trace', r.message);
                        // Pas besoin de message d'erreur, on lie silencieusement
                    }
                    // Mettre à jour l'affichage dans tous les cas
                    load_trace_imposition_links(frm);
                    refresh_attached_files(frm);
                }
            });
        }
    },

    /**
     * Triggered when the trace field changes.
     * @param {object} frm - The current form object.
     */
    trace: function(frm) {
        // Re-apply filters as trace impacts imposition list
        set_filters(frm);
        // Update the HTML display
        load_trace_imposition_links(frm);
        // Refresh local attachment fields
        refresh_attached_files(frm);
        // Clear imposition if trace changes and the current imposition is linked to the old trace
        // (Add logic here if needed, requires checking current imposition's trace link)
        // frm.set_value('imposition', null); // Optional: uncomment if needed
    },

    /**
     * Triggered when the imposition field changes.
     * @param {object} frm - The current form object.
     */
    imposition: function(frm) {
        // Apply filters (might be relevant if imposition had dependencies)
        set_filters(frm);
        // Update the HTML display
        load_trace_imposition_links(frm);
        // Refresh local attachment fields
        refresh_attached_files(frm);
    },

    /**
     * Triggered when the status field changes.
     * @param {object} frm - The current form object.
     */
    status: function(frm) {
        // Reload the HTML section to show/hide Create/Update buttons based on status
        load_trace_imposition_links(frm);
    }
});

/**
 * Sets dynamic query filters for link fields (Article, Trace, Imposition).
 * @param {object} frm - The current form object.
 */
function set_filters(frm) {
    // Filter Articles based on the selected Client
    frm.fields_dict.article.get_query = function(doc) {
        if (!doc.client) {
             frappe.throw(__("Veuillez d'abord sélectionner un Client."));
        }
        return {
            filters: {
                'custom_client': doc.client // Ensure 'custom_client' is the correct field name in Article Doctype
            }
        };
    };
    frm.set_query("article"); // Apply the query immediately

    // Filter Traces based on the selected Article
    frm.fields_dict.trace.get_query = function(doc) {
        if (!doc.article) {
             frappe.throw(__("Veuillez d'abord sélectionner un Article."));
        }
        return {
            filters: {
                article: doc.article // Ensure 'article' is the correct field name in Trace Doctype
            }
        };
    };
    frm.set_query("trace");

    // Filter Impositions based on the selected Article and Trace
    frm.fields_dict.imposition.get_query = function(doc) {
        if (!doc.article || !doc.trace) {
             frappe.throw(__("Veuillez d'abord sélectionner un Article et un Tracé."));
        }
        return {
            filters: {
                article: doc.article, // Ensure 'article' is the correct field name in Imposition Doctype
                trace: doc.trace    // Ensure 'trace' is the correct field name in Imposition Doctype
            }
        };
    };
    frm.set_query("imposition");
}

/**
 * Affiche les spécifications techniques d'un article dans une boîte de dialogue.
 * @param {string} item_code - Le code de l'article à afficher.
 */
function show_item_technical_specs(item_code) {
    if (!item_code) {
        frappe.msgprint({
            title: __('Erreur'),
            message: __('Code article non spécifié'),
            indicator: 'red'
        });
        return;
    }

    frappe.call({
        method: "frappe.client.get",
        args: {
            doctype: "Item",
            name: item_code
        },
        callback: function(r) {
            if (r.message) {
                const item = r.message;
                const d = new frappe.ui.Dialog({
                    title: __('Spécifications Techniques: {0}', [item.item_name || item_code]),
                    fields: [
                        {fieldtype: 'HTML', fieldname: 'specs_html'}
                    ],
                    primary_action_label: __('Fermer'),
                    primary_action: function() {
                        d.hide();
                    }
                });

                // Construire le HTML pour afficher les spécifications techniques
                let html = `<div style="padding: 10px;">
                    <div style="margin-bottom: 15px;">
                        <div style="font-weight: bold; margin-bottom: 5px;">${__('Code Article')}:</div>
                        <div style="padding: 5px; background-color: #f8f9fa; border-radius: 4px;">${item.item_code || ''}</div>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <div style="font-weight: bold; margin-bottom: 5px;">${__('Désignation')}:</div>
                        <div style="padding: 5px; background-color: #f8f9fa; border-radius: 4px;">${item.item_name || ''}</div>
                    </div>`;

                // Ajouter les champs personnalisés pertinents s'ils existent
                if (item.description) {
                    html += `<div style="margin-bottom: 15px;">
                        <div style="font-weight: bold; margin-bottom: 5px;">${__('Description')}:</div>
                        <div style="padding: 5px; background-color: #f8f9fa; border-radius: 4px;">${item.description || ''}</div>
                    </div>`;
                }

                // Ajouter d'autres champs techniques si disponibles
                const tech_fields = [
                    { label: __('Dimensions'), value: item.custom_dimensions },
                    { label: __('Matière'), value: item.custom_matiere },
                    { label: __('Grammage'), value: item.custom_grammage },
                    { label: __('Finition'), value: item.custom_finition },
                    { label: __('Couleurs'), value: item.custom_couleurs }
                ];

                tech_fields.forEach(field => {
                    if (field.value) {
                        html += `<div style="margin-bottom: 15px;">
                            <div style="font-weight: bold; margin-bottom: 5px;">${field.label}:</div>
                            <div style="padding: 5px; background-color: #f8f9fa; border-radius: 4px;">${field.value}</div>
                        </div>`;
                    }
                });

                html += '</div>';
                d.fields_dict.specs_html.$wrapper.html(html);
                d.show();
            } else {
                frappe.msgprint({
                    title: __('Erreur'),
                    message: __('Article non trouvé'),
                    indicator: 'red'
                });
            }
        }
    });
}

// Rendre la fonction accessible globalement
if (typeof window !== 'undefined') {
    window.show_item_technical_specs = show_item_technical_specs;
}

/**
 * Loads the HTML content displaying Trace/Imposition links and action buttons
 * into the 'html_doc' field.
 * @param {object} frm - The current form object.
 */
function load_trace_imposition_links(frm) {
    const html_field = frm.fields_dict.html_doc;
    if (!html_field) {
        console.warn("Le champ 'html_doc' n'existe pas dans le formulaire Etude Faisabilite.");
        return;
    }

    // Clear previous content
    html_field.$wrapper.html("");

    // Si le statut est "Nouveau", afficher uniquement le message d'information
    if (frm.doc.status === "Nouveau") {
        html_field.$wrapper.html(`
            <div style="padding: 20px; text-align: center; background-color: #f8f9fa; border-radius: 8px; margin-bottom: 15px;">
                <div style="font-size: 16px; color: #8d99a6; margin-bottom: 10px;">
                    <i class="fa fa-info-circle" style="margin-right: 8px;"></i>
                    Démarrer l'Étude pour afficher le tracé disponible
                </div>
                <div style="font-size: 12px; color: #8d99a6;">
                    Changez le statut en "En étude" pour accéder aux fonctionnalités de tracé et d'imposition
                </div>
            </div>
        `);
        return;
    }

    // --- HTML Structure and Styling ---
    var html = `<div style='display: flex; flex-direction: column; gap: 20px; padding-bottom: 10px;'>
        <style>
            .ef-container { display: flex; flex-direction: column; gap: 20px; align-items: stretch; width: 100%; }
            .ef-section { flex: 1; min-width: 250px; display: flex; flex-direction: column; }
            .ef-card { border: 0.5px solid #d1d8dd; border-radius: 8px; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
            .ef-card-header { padding: 10px 20px; border-bottom: 0.5px solid #d1d8dd; background-color: #f8f9fa; }
            .ef-card-title { font-size: 14px; font-weight: 600; color: #1a1a1a; }
            .ef-card-content { padding: 20px; background-color: #ffffff; flex-grow: 1; }
            .ef-item { margin-bottom: 10px; display: flex; flex-direction: column; gap: 5px; }
            .ef-link-line { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 8px; margin-bottom: 8px; font-size: 12px; }
            .ef-link-line span { margin-right: 4px; }
            .ef-link-line a { color: var(--text-color); text-decoration: none; word-break: break-all; }
            .ef-link-line a:hover { text-decoration: underline; color: var(--link-color); }
            .ef-action-line { margin-top: 5px; display: flex; gap: 5px; }
            .ef-create-btn { margin-top: 10px; }
            /* Responsive layout */
            @media (min-width: 768px) {
              .ef-container { flex-direction: row !important; }
              .ef-section { width: 50%; }
            }
            /* Ensure button text is visible */
            .btn-xs { line-height: 1.5; padding: 1px 5px; font-size: 12px; }
            /* Style pour le bouton de spécifications techniques */
            .ef-specs-btn { 
                margin-bottom: 0px; 
                text-align: left; 
                padding: 10px; 
                background-color: #ffffff; 
                
            }
        </style>
        
        <!-- Bouton Fiche Technique Article placé avant les sections Tracé et Imposition -->
        ${frm.doc.article ? `<div class='ef-specs-btn'>
            <button class='btn btn-primary' onclick="show_item_technical_specs('${frm.doc.article}'); return false;">
                Fiche Technique
            </button>
        </div>` : ''}
        
        <div class='ef-container'>`;

    // --- Section Tracé ---
    html += `<div class='ef-section'>
                <div class='ef-card'>
                    <div class='ef-card-header'><span class='ef-card-title'>Tracé</span></div>
                    <div class='ef-card-content'>`;
    if (frm.doc.trace) {
        html += `<div class='ef-item'>
                    <div class='ef-link-line'>
                        <span>•</span>
                        <a href='#' onclick="frappe.set_route('Form','Trace','${frm.doc.trace}'); return false;">${frm.doc.trace}</a>
                    </div>
                    <div class='ef-action-line'>
                        <button class='btn btn-xs btn-secondary' onclick="updateTrace('${frm.doc.trace}'); return false;" title="${__('Mettre à jour les données du Tracé')}">Mise à jour</button>
                        <button class='btn btn-xs btn-light' onclick="openAttachedFile('Trace', '${frm.doc.trace}'); return false;" title="${__('Ouvrir le fichier Tracé attaché')}">
                             Ouvrir Fichier
                        </button>
                    </div>
                 </div>`;
    } else {
        // Vérifier si un tracé existe déjà pour cet article
        if (frm.doc.article) {
            html += `<p style='font-size: 11px; color: var(--text-muted);'>Vérification de l'existence d'un tracé pour cet article...</p>`;
            
            // Show "Create Trace" button only if status allows and prerequisites are met
            if (frm.doc.status === "En étude" && !frm.doc.trace && !frm.doc.imposition && frm.doc.client && frm.doc.article) {
                html += `<div class='ef-create-btn'>
                            <button class='btn btn-xs btn-primary' onclick="createTrace('${frm.docname}'); return false;">Créer Tracé</button>
                         </div>`;
            }
        } else {
            html += `<p style='font-size: 11px; color: var(--text-muted);'>Aucun tracé lié, Démarrez l'Étude pour pouvoir Créer un nouveau tracé</p>`;
            // Show "Create Trace" button only if status allows and prerequisites are met
            if (frm.doc.status === "En étude" && !frm.doc.trace && !frm.doc.imposition && frm.doc.client && frm.doc.article) {
                html += `<div class='ef-create-btn'>
                            <button class='btn btn-xs btn-primary' onclick="createTrace('${frm.docname}'); return false;">Créer Tracé</button>
                         </div>`;
            } else if (frm.doc.status === "En étude" && (!frm.doc.client || !frm.doc.article)) {
                 html += `<p style='font-size: 11px; color: var(--text-muted);'>Sélectionnez Client et Article pour créer un Tracé.</p>`;
            }
        }
    }
    html += `</div></div></div>`; // End Tracé section

    // --- Section Imposition ---
    html += `<div class='ef-section'>
                <div class='ef-card'>
                    <div class='ef-card-header'><span class='ef-card-title'>Imposition</span></div>
                    <div class='ef-card-content'>`;
    if (frm.doc.imposition) {
        html += `<div class='ef-item'>
                    <div class='ef-link-line'>
                        <span>•</span>
                        <a href='#' onclick="frappe.set_route('Form','Imposition','${frm.doc.imposition}'); return false;">${frm.doc.imposition}</a>
                    </div>
                    <div class='ef-action-line'>
                        <button class='btn btn-xs btn-secondary' onclick="updateImposition('${frm.doc.imposition}'); return false;" title="${__('Mettre à jour les données de l\'Imposition')}">Mise à jour</button>
                        <button class='btn btn-xs btn-light' onclick="openAttachedFile('Imposition', '${frm.doc.imposition}'); return false;" title="${__('Ouvrir le fichier Imposition attaché')}">
                            Ouvrir Fichier
                       </button>
                    </div>
                 </div>`;
    } else {
        html += `<p style='font-size: 11px; color: var(--text-muted);'>Aucune imposition liée.</p>`;
        // Show "Create Imposition" button only if status allows, trace exists, and imposition doesn't
        if (frm.doc.status === "En étude" && frm.doc.trace && !frm.doc.imposition) {
            html += `<div class='ef-create-btn'>
                        <button class='btn btn-xs btn-primary' onclick="createImposition('${frm.docname}'); return false;">Créer Imposition</button>
                     </div>`;
        } else if (frm.doc.status === "En étude" && !frm.doc.trace) {
            html += `<p style='font-size: 11px; color: var(--text-muted);'>Créez ou liez un Tracé pour créer une Imposition.</p>`;
        }
    }
    html += `</div></div></div>`; // End Imposition section

    html += `</div>`; // End ef-container
    html += `</div>`; // End outer div
    html_field.$wrapper.html(html); // Inject HTML

    // --- Define Global Action Functions ---

    /**
     * Utility function to style dialog primary buttons (now does nothing, uses default).
     * @param {object} dialog - The Frappe Dialog object.
     */
    function style_dialog_primary_button(dialog) {
        // No custom styling needed. Dialog's primary button will use default .btn-primary style.
    }

    // --- NOUVELLE FONCTION ---
    /**
     * Fetches the file path from a linked document and opens it in a new tab.
     * @param {string} doctype - 'Trace' or 'Imposition'.
     * @param {string} docname - The name of the document containing the file.
     */
    if (!window.openAttachedFile) {
        window.openAttachedFile = function(doctype, docname) {
            if (!doctype || !docname) {
                console.error("Doctype ou Docname manquant pour openAttachedFile");
                return;
            }
            const fieldname = (doctype === 'Trace') ? 'fichier_trace' : 'fichier_imp';
            frappe.show_alert({message: __('Récupération du lien fichier...'), indicator: 'blue'}, 2);

            frappe.call({
                method: "frappe.client.get_value",
                args: {
                    doctype: doctype,
                    filters: { name: docname },
                    fieldname: fieldname
                },
                callback: function(r) {
                    if (r.message && r.message[fieldname]) {
                        const file_path = r.message[fieldname];
                        try {
                            const full_url = frappe.urllib.get_full_url(file_path);
                            window.open(full_url, '_blank');
                        } catch (e) {
                            console.error("Erreur URL:", e);
                            frappe.msgprint({ title: __('Erreur'), message: __("Impossible de construire l'URL pour:") + ` ${file_path}`, indicator: 'red' });
                        }
                    } else {
                        frappe.msgprint({ title: __('Fichier non trouvé'), message: __("Aucun fichier attaché au document {0} ({1}) dans le champ '{2}'.", [doctype, docname, fieldname]), indicator: 'orange' });
                    }
                },
                error: function(err) {
                    frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur récupération chemin fichier.") + "<br>" + err.message, indicator: 'red' });
                }
            });
        };
    }
    // --- FIN NOUVELLE FONCTION ---


    /**
     * Creates a new Trace document, links it, and prompts for required info.
     * @param {string} docname - Name of the current Etude Faisabilite document.
     */
    if (!window.createTrace) {
        window.createTrace = function(docname) {
            var frm = cur_frm; // Get current form instance
            if (!frm.doc.client || !frm.doc.article) {
                frappe.msgprint({ title: __('Prérequis manquants'), message: __('Veuillez remplir les champs Client et Article avant de créer une Trace.'), indicator: 'orange' });
                return;
            }
            frappe.call({
                method: "frappe.client.insert",
                args: { doc: { doctype: "Trace", client: frm.doc.client, article: frm.doc.article, etude_faisabilite: frm.doc.name } },
                freeze: true, freeze_message: __("Création de la Trace..."),
                callback: function(r) {
                    if (r.message && r.message.name) {
                        var trace_id = r.message.name;
                        frm.set_value("trace", trace_id); // Link the new Trace

                        var d = new frappe.ui.Dialog({
                            title: __('Compléter les informations de la Trace'),
                            fields: [
                                { fieldtype: 'HTML', fieldname: 'id_section', options: `<div style="display: flex; align-items: center; margin-bottom: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;"><div style="margin-right: 10px; font-weight: bold;">ID:</div><div style="flex-grow: 1; font-family: monospace; padding: 5px; background-color: #fff; border: 1px solid #d1d8dd; border-radius: 3px;">${trace_id}</div><button class="btn btn-xs btn-default" title="${__('Copier ID')}" onclick="navigator.clipboard.writeText('${trace_id}'); frappe.show_alert({message: __('ID copié'), indicator: 'green'}, 2); return false;" style="margin-left: 10px;"><i class="fa fa-copy"></i></button></div>`},
                                { label: __('Dimensions'), fieldname: 'dimensions', fieldtype: 'Data', reqd: 1, description: __('Entrez les dimensions du tracé') },
                                { label: __('Fichier Tracé'), fieldname: 'fichier_trace', fieldtype: 'Attach', reqd: 1, description: __('Joignez le fichier du tracé') }
                            ],
                            primary_action_label: __('Enregistrer et Fermer'),
                            primary_action: function() {
                                var values = d.get_values();
                                if (!values.dimensions || !values.fichier_trace) {
                                     frappe.msgprint({ title: __('Validation'), message: __("Veuillez remplir tous les champs obligatoires."), indicator: 'orange' });
                                     return; // Prevent closing dialog
                                }
                                // Update the newly created Trace document
                                frappe.call({
                                    method: "frappe.client.set_value",
                                    args: { doctype: "Trace", name: trace_id, fieldname: { dimensions: values.dimensions, fichier_trace: values.fichier_trace } },
                                    freeze: true, freeze_message: __("Mise à jour de la Trace..."),
                                    callback: function(r_update) {
                                        if (r_update.message) {
                                            frappe.show_alert({message:__('Trace créée et mise à jour avec succès.'), indicator:'green'}, 5);
                                            // Save the Etude Faisabilite to persist the link, then refresh UI
                                            frm.save()
                                                .then(() => {
                                                    load_trace_imposition_links(frm);
                                                    refresh_attached_files(frm);
                                                })
                                                .catch((err) => { console.error("Save failed after linking existing Trace:", err); });
                                            d.hide();
                                        } else { frappe.msgprint({ title: __('Erreur'), message: __("Erreur lors de la mise à jour de la Trace."), indicator: 'red' }); }
                                    },
                                    error: function(err_update) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la mise à jour de la Trace.") + "<br>" + err_update.message, indicator: 'red' });}
                                });
                            }
                        });
                        style_dialog_primary_button(d); // Apply default styling (no-op now)
                        d.show();
                    } else { frappe.msgprint({ title: __('Erreur'), message: __("Erreur lors de la création de la Trace.") + (r.exc ? "<br>" + r.exc : ""), indicator: 'red' }); }
                },
                error: function(err) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la création de la Trace.") + "<br>" + err.message, indicator: 'red' }); }
            });
        };
    }

    /**
     * Opens a dialog to update an existing Trace document.
     * @param {string} trace_id - The name/ID of the Trace document to update.
     */
    if (!window.updateTrace) {
        window.updateTrace = function(trace_id) {
            var frm = cur_frm;
            // 1. Get current values
            frappe.call({
                method: "frappe.client.get_value",
                args: { doctype: "Trace", fieldname: ["dimensions", "fichier_trace"], filters: { name: trace_id } },
                callback: function(r) {
                    if (r.message) {
                        let current_values = r.message;
                        // 2. Show update dialog
                        var d = new frappe.ui.Dialog({
                            title: __('Mettre à jour le document Trace'),
                            fields: [
                                { fieldtype: 'HTML', fieldname: 'id_section', options: `<div style="display: flex; align-items: center; margin-bottom: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;"><div style="margin-right: 10px; font-weight: bold;">ID:</div><div style="flex-grow: 1; font-family: monospace; padding: 5px; background-color: #fff; border: 1px solid #d1d8dd; border-radius: 3px;">${trace_id}</div><button class="btn btn-xs btn-default" title="${__('Copier ID')}" onclick="navigator.clipboard.writeText('${trace_id}'); frappe.show_alert({message: __('ID copié'), indicator: 'green'}, 2); return false;" style="margin-left: 10px;"><i class="fa fa-copy"></i></button></div>`},
                                { label: __('Dimensions'), fieldname: 'dimensions', fieldtype: 'Data', reqd: 1, default: current_values.dimensions || "", description: __('Entrez les nouvelles dimensions') },
                                { label: __('Fichier Tracé'), fieldname: 'fichier_trace', fieldtype: 'Attach', reqd: 1, default: current_values.fichier_trace || "", description: __('Joignez le nouveau fichier') },
                                { fieldtype: 'HTML', fieldname: 'current_file_info', options: current_values.fichier_trace ? `<div style="margin-top: -10px; margin-bottom: 10px; font-size: 11px; color: var(--text-muted);">Fichier actuel: <a href="${current_values.fichier_trace}" target="_blank">${current_values.fichier_trace.split('/').pop()}</a></div>` : `<div style="margin-top: -10px; margin-bottom: 10px; font-size: 11px; color: #888;">Aucun fichier actuel.</div>`}
                            ],
                            primary_action_label: __('Mettre à jour'),
                            primary_action: function() {
                                var values = d.get_values();
                                if (!values.dimensions || !values.fichier_trace) {
                                     frappe.msgprint({ title: __('Validation'), message: __("Veuillez remplir tous les champs obligatoires."), indicator: 'orange' });
                                     return;
                                }
                                // 3. Update the document
                                frappe.call({
                                    method: "frappe.client.set_value",
                                    args: { doctype: "Trace", name: trace_id, fieldname: { dimensions: values.dimensions, fichier_trace: values.fichier_trace } },
                                    freeze: true, freeze_message: __("Mise à jour du Tracé..."),
                                    callback: function(r_update) {
                                        if (r_update.message) {
                                            frappe.show_alert({message:__('Trace mise à jour avec succès.'), indicator:'green'}, 5);
                                            d.hide();
                                            load_trace_imposition_links(frm); // Refresh HTML links/buttons
                                            refresh_attached_files(frm);    // Refresh local file field
                                        } else { frappe.msgprint({ title: __('Erreur'), message: __("Erreur lors de la mise à jour de la Trace."), indicator: 'red' }); }
                                    },
                                    error: function(err_update) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la mise à jour de la Trace.") + "<br>" + err_update.message, indicator: 'red' }); }
                                });
                            }
                        });
                        style_dialog_primary_button(d);
                        d.show();
                    } else { frappe.msgprint({ title: __('Erreur'), message: __("Impossible de récupérer les infos de la Trace:") + trace_id, indicator: 'red' }); }
                },
                error: function(err) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la récupération des infos Trace.") + "<br>" + err.message, indicator: 'red' }); }
            });
        };
    }

    /**
     * Creates a new Imposition document, links it, and prompts for required info.
     * @param {string} docname - Name of the current Etude Faisabilite document.
     */
    if (!window.createImposition) {
        window.createImposition = function(docname) {
            var frm = cur_frm;
            if (!frm.doc.client || !frm.doc.article || !frm.doc.trace) {
                frappe.msgprint({ title: __('Prérequis manquants'), message: __('Veuillez remplir Client, Article et Tracé avant de créer une Imposition.'), indicator: 'orange' });
                return;
            }
            frappe.call({
                method: "frappe.client.insert",
                args: { doc: { doctype: "Imposition", client: frm.doc.client, article: frm.doc.article, trace: frm.doc.trace /*, etude_faisabilite: frm.doc.name // Optional link */ } },
                freeze: true, freeze_message: __("Création de l'Imposition..."),
                callback: function(r) {
                    if (r.message && r.message.name) {
                        var imposition_id = r.message.name;
                        frm.set_value("imposition", imposition_id); // Link the new Imposition

                        var d = new frappe.ui.Dialog({
                            title: __('Compléter les informations de l\'Imposition'),
                            fields: [
                                { fieldtype: 'HTML', fieldname: 'id_section', options: `<div style="display: flex; align-items: center; margin-bottom: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;"><div style="margin-right: 10px; font-weight: bold;">ID:</div><div style="flex-grow: 1; font-family: monospace; padding: 5px; background-color: #fff; border: 1px solid #d1d8dd; border-radius: 3px;">${imposition_id}</div><button class="btn btn-xs btn-default" title="${__('Copier ID')}" onclick="navigator.clipboard.writeText('${imposition_id}'); frappe.show_alert({message: __('ID copié'), indicator: 'green'}, 2); return false;" style="margin-left: 10px;"><i class="fa fa-copy"></i></button></div>`},
                                { label: __('Format Imposition'), fieldname: 'format_imp', fieldtype: 'Data', reqd: 1, description: __('Entrez le format') },
                                { label: __('Laize/Palette'), fieldname: 'laize_pal', fieldtype: 'Select', options: 'Laize\nPalette', reqd: 1, description: __('Sélectionnez le type') },
                                { label: __('Nombre de poses'), fieldname: 'nbr_poses', fieldtype: 'Int', reqd: 1, description: __('Entrez le nombre total de poses') },
                                { label: __('Fichier Imposition'), fieldname: 'fichier_imp', fieldtype: 'Attach', reqd: 1, description: __('Joignez le fichier d\'imposition') }
                            ],
                            primary_action_label: __('Enregistrer et Fermer'),
                            primary_action: function() {
                                var values = d.get_values();
                                if (!values.format_imp || !values.laize_pal || !values.nbr_poses || !values.fichier_imp) {
                                    frappe.msgprint({ title: __('Validation'), message: __("Veuillez remplir tous les champs obligatoires."), indicator: 'orange' });
                                    return;
                                }
                                // Update the newly created Imposition document
                                frappe.call({
                                    method: "frappe.client.set_value",
                                    args: { doctype: "Imposition", name: imposition_id, fieldname: { format_imp: values.format_imp, laize_pal: values.laize_pal, nbr_poses: values.nbr_poses, fichier_imp: values.fichier_imp } },
                                    freeze: true, freeze_message: __("Mise à jour de l'Imposition..."),
                                    callback: function(r_update) {
                                        if (r_update.message) {
                                            frappe.show_alert({message:__('Imposition créée et mise à jour avec succès.'), indicator:'green'}, 5);
                                            // Save the Etude Faisabilite to persist the link, then refresh UI
                                            frm.save()
                                                .then(() => {
                                                    load_trace_imposition_links(frm);
                                                    refresh_attached_files(frm);
                                                })
                                                .catch((err) => { console.error("Save failed after Imposition creation:", err); });
                                            d.hide();
                                        } else { frappe.msgprint({ title: __('Erreur'), message: __("Erreur lors de la mise à jour de l'Imposition."), indicator: 'red' }); }
                                    },
                                    error: function(err_update) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la mise à jour de l'Imposition.") + "<br>" + err_update.message, indicator: 'red' });}
                                });
                            }
                        });
                        style_dialog_primary_button(d);
                        d.show();
                    } else { frappe.msgprint({ title: __('Erreur'), message: __("Erreur lors de la création de l'Imposition.") + (r.exc ? "<br>" + r.exc : ""), indicator: 'red' }); }
                },
                error: function(err) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la création de l'Imposition.") + "<br>" + err.message, indicator: 'red' }); }
            });
        };
    }

    /**
     * Opens a dialog to update an existing Imposition document.
     * @param {string} imposition_id - The name/ID of the Imposition document to update.
     */
    if (!window.updateImposition) {
        window.updateImposition = function(imposition_id) {
            var frm = cur_frm;
             // 1. Get current values
            frappe.call({
                method: "frappe.client.get_value",
                args: { doctype: "Imposition", fieldname: ["format_imp", "laize_pal", "nbr_poses", "fichier_imp"], filters: { name: imposition_id } },
                callback: function(r) {
                    if (r.message) {
                        let current_values = r.message;
                        // 2. Show update dialog
                        var d = new frappe.ui.Dialog({
                            title: __('Mettre à jour le document Imposition'),
                            fields: [
                                { fieldtype: 'HTML', fieldname: 'id_section', options: `<div style="display: flex; align-items: center; margin-bottom: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;"><div style="margin-right: 10px; font-weight: bold;">ID:</div><div style="flex-grow: 1; font-family: monospace; padding: 5px; background-color: #fff; border: 1px solid #d1d8dd; border-radius: 3px;">${imposition_id}</div><button class="btn btn-xs btn-default" title="${__('Copier ID')}" onclick="navigator.clipboard.writeText('${imposition_id}'); frappe.show_alert({message: __('ID copié'), indicator: 'green'}, 2); return false;" style="margin-left: 10px;"><i class="fa fa-copy"></i></button></div>`},
                                { label: __('Format Imposition'), fieldname: 'format_imp', fieldtype: 'Data', reqd: 1, default: current_values.format_imp || "", description: __('Entrez le format') },
                                { label: __('Laize/Palette'), fieldname: 'laize_pal', fieldtype: 'Select', options: 'Laize\nPalette', reqd: 1, default: current_values.laize_pal || "", description: __('Sélectionnez le type') },
                                { label: __('Nombre de poses'), fieldname: 'nbr_poses', fieldtype: 'Int', reqd: 1, default: current_values.nbr_poses || 0, description: __('Entrez le nombre total de poses') },
                                { label: __('Fichier Imposition'), fieldname: 'fichier_imp', fieldtype: 'Attach', reqd: 1, default: current_values.fichier_imp || "", description: __('Joignez le nouveau fichier') },
                                { fieldtype: 'HTML', fieldname: 'current_file_info_imp', options: current_values.fichier_imp ? `<div style="margin-top: -10px; margin-bottom: 10px; font-size: 11px; color: var(--text-muted);">Fichier actuel: <a href="${current_values.fichier_imp}" target="_blank">${current_values.fichier_imp.split('/').pop()}</a></div>` : `<div style="margin-top: -10px; margin-bottom: 10px; font-size: 11px; color: #888;">Aucun fichier actuel.</div>`}
                            ],
                            primary_action_label: __('Mettre à jour'),
                            primary_action: function() {
                                var values = d.get_values();
                                if (!values.format_imp || !values.laize_pal || !values.nbr_poses || !values.fichier_imp) {
                                     frappe.msgprint({ title: __('Validation'), message: __("Veuillez remplir tous les champs obligatoires."), indicator: 'orange' });
                                     return;
                                }
                                // 3. Update the document
                                frappe.call({
                                    method: "frappe.client.set_value",
                                    args: { doctype: "Imposition", name: imposition_id, fieldname: { format_imp: values.format_imp, laize_pal: values.laize_pal, nbr_poses: values.nbr_poses, fichier_imp: values.fichier_imp } },
                                    freeze: true, freeze_message: __("Mise à jour de l'Imposition..."),
                                    callback: function(r_update) {
                                        if (r_update.message) {
                                            frappe.show_alert({message:__('Imposition mise à jour avec succès.'), indicator:'green'}, 5);
                                            d.hide();
                                            load_trace_imposition_links(frm); // Refresh HTML links/buttons
                                            refresh_attached_files(frm);    // Refresh local file field
                                        } else { frappe.msgprint({ title: __('Erreur'), message: __("Erreur lors de la mise à jour de l'Imposition."), indicator: 'red' }); }
                                    },
                                    error: function(err_update) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la mise à jour de l'Imposition.") + "<br>" + err_update.message, indicator: 'red' }); }
                                });
                            }
                        });
                        style_dialog_primary_button(d);
                        d.show();
                    } else { frappe.msgprint({ title: __('Erreur'), message: __("Impossible de récupérer les infos de l'Imposition:") + imposition_id, indicator: 'red' }); }
                },
                error: function(err) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la récupération des infos Imposition.") + "<br>" + err.message, indicator: 'red' }); }
            });
        };
    }

    // --- End of Action Functions ---

} // --- Fin de la fonction load_trace_imposition_links ---


/**
 * Refreshes the local 'fichier_trace' and 'fichier_imp' fields on the
 * Etude Faisabilite form based on the attached files in the linked
 * Trace and Imposition documents. Calls a server-side method.
 * @param {object} frm - The current form object.
 */
function refresh_attached_files(frm) {
    // Check if the local fields exist on the Etude Faisabilite Doctype
    const has_trace_field = frm.fields_dict['fichier_trace'] !== undefined;
    const has_imp_field = frm.fields_dict['fichier_imp'] !== undefined;

    if (!has_trace_field && !has_imp_field) {
        // console.log("No local attachment fields found on EtudeFaisabilite. Skipping refresh.");
        return; // Exit if neither field exists
    }

    // Only proceed if a Trace or Imposition is actually linked
    if (frm.doc.trace || frm.doc.imposition) {
        frappe.call({
            // Make sure this python method exists and returns {'fichier_trace': 'path', 'fichier_imp': 'path'}
            method: "aurescrm.aures_crm.doctype.etude_faisabilite.etude_faisabilite.refresh_attached_files",
            args: {
                docname: frm.doc.name // Pass the name of the current Etude Faisabilite doc
            },
            callback: function(r) {
                if (r.message) {
                    let changed = false;
                    let fields_to_refresh = [];

                    // Update fichier_trace if it exists locally and the value differs
                    if (has_trace_field && r.message.fichier_trace && frm.doc.fichier_trace !== r.message.fichier_trace) {
                        // Use quiet set_value to avoid triggering 'change' events unnecessarily before save
                        frm.set_value('fichier_trace', r.message.fichier_trace, true);
                        changed = true;
                        fields_to_refresh.push('fichier_trace');
                    } else if (has_trace_field && !r.message.fichier_trace && frm.doc.fichier_trace) {
                         // Clear local field if remote is empty but local has value
                        frm.set_value('fichier_trace', null, true);
                        changed = true;
                        fields_to_refresh.push('fichier_trace');
                    }


                    // Update fichier_imp if it exists locally and the value differs
                    if (has_imp_field && r.message.fichier_imp && frm.doc.fichier_imp !== r.message.fichier_imp) {
                        frm.set_value('fichier_imp', r.message.fichier_imp, true);
                        changed = true;
                        fields_to_refresh.push('fichier_imp');
                    } else if (has_imp_field && !r.message.fichier_imp && frm.doc.fichier_imp) {
                        // Clear local field if remote is empty but local has value
                        frm.set_value('fichier_imp', null, true);
                        changed = true;
                        fields_to_refresh.push('fichier_imp');
                    }


                    if (changed) {
                        // Refresh the display of changed fields
                        frm.refresh_fields(fields_to_refresh);
                        // Save automatically ONLY if values were changed and form isn't already saving
                        if (!frm.is_saving() && frm.is_dirty()) {
                            // console.log("Saving EtudeFaisabilite due to attachment field updates...");
                            frm.save()
                                .then(() => { /* console.log("Saved successfully.") */ })
                                .catch((err) => { console.error("Auto-save failed after refreshing attachments:", err); });
                        }
                    }
                }
                // No message means no files found or error occurred server-side (handle if needed)
            },
            error: function(err) {
                // Log error but don't necessarily bother the user unless critical
                console.error("Error calling refresh_attached_files:", err.message);
                // Optionally show a non-intrusive message:
                // frappe.show_alert({ message: __('Erreur de synchronisation des fichiers.'), indicator: 'orange' }, 5);
            }
        });
    } else {
        // If no Trace or Imposition is linked, ensure local fields are cleared
        let changed = false;
        let fields_to_refresh = [];
        if (has_trace_field && frm.doc.fichier_trace) {
            frm.set_value('fichier_trace', null, true);
            changed = true;
            fields_to_refresh.push('fichier_trace');
        }
        if (has_imp_field && frm.doc.fichier_imp) {
            frm.set_value('fichier_imp', null, true);
            changed = true;
            fields_to_refresh.push('fichier_imp');
        }
        if (changed) {
            frm.refresh_fields(fields_to_refresh);
            // Save if fields were cleared and form is dirty
            if (!frm.is_saving() && frm.is_dirty()) {
                frm.save()
                    .then(() => { /* console.log("Saved successfully after clearing attachments.") */ })
                    .catch((err) => { console.error("Auto-save failed after clearing attachments:", err); });
            }
        }
    }
}


/**
 * Affiche et permet de modifier les spécifications techniques de l'article.
 * @param {string} article_name - Le nom de l'article.
 */
function show_item_technical_specs(article_name) {
    if (!article_name) {
        frappe.msgprint({
            title: __('Article non sélectionné'),
            message: __('Veuillez d\'abord sélectionner un article.'),
            indicator: 'orange'
        });
        return;
    }
    
    // Récupérer les données de l'article
    frappe.call({
        method: "frappe.client.get",
        args: {
            doctype: "Item",
            name: article_name
        },
        callback: function(r) {
            if (r.message) {
                const item = r.message;
                const procede = item.custom_procédé || "";
                
                // Définir les champs à afficher selon le procédé
                const champsOffset = [
                    "custom_fiche_technique_article",
                    "custom_conditionnement",
                    "custom_support_fourni", 
                    "custom_support", 
                    "custom_grammage",
                    "custom_tolérance_",
                    "custom_impression", 
                    "custom_nbr_couleurs", 
                    "custom_nombre_de_poses", 
                    "custom_pelliculage", 
                    "custom_marquage_à_chaud", 
                    "custom_couleur_marquage_à_chaud", 
                    "custom_notice", 
                    "custom_largeur", 
                    "custom_hauteur", 
                    "custom_longueur", 
                    "custom_acrylique", 
                    "custom_uv", 
                    "custom_sélectif", 
                    "custom_drip_off", 
                    "custom_mat_gras", 
                    "custom_blister", 
                    "custom_recto_verso", 
                    "custom_fenêtre", 
                    "custom_dimension_fenêtre", 
                    "custom_epaisseur_fenêtre", 
                    "custom_gaufrage__estampage", 
                    "custom_massicot", 
                    "custom_collerette", 
                    "custom_blanc_couvrant", 
                    "custom_braille", 
                    "custom_texte_braille"
                ];
                
                const champsFlexo = [
                    "custom_fiche_technique_article", 
                    "custom_conditionnement",
                    "custom_désignation", 
                    "custom_type_support", 
                    "custom_complexage",
                    "custom_epaisseur",
                    "custom_epaisseur_2",
                    "custom_diametre_mandrin", 
                    "custom_diamètre_bobine", 
                    "custom_dimensions_h_x_l", 
                    "custom_sens_deroulement", 
                    "custom_sense_défilement_",
                    "custom_poids_bobine"
                ];
                
                // Sélectionner les champs à afficher selon le procédé
                const champsAfficher = procede === "Offset" ? champsOffset : 
                                      procede === "Flexo" ? champsFlexo : [];
                
                // Récupérer tous les champs de l'onglet custom_fiche_technique
                frappe.model.with_doctype("Item", function() {
                    const fields = [];
                    const meta = frappe.get_meta("Item");
                    
                    // Trouver tous les champs qui appartiennent à l'onglet custom_fiche_technique
                    meta.fields.forEach(field => {
                        // Vérifier si le champ appartient à l'onglet custom_fiche_technique
                        // Nous cherchons les champs qui sont après un Tab Break nommé custom_fiche_technique
                        // et avant le prochain Tab Break
                        if (field.fieldtype === "Tab Break" && field.fieldname === "custom_fiche_technique") {
                            // Marquer que nous sommes dans l'onglet custom_fiche_technique
                            meta.in_fiche_technique_tab = true;
                        } else if (field.fieldtype === "Tab Break" && meta.in_fiche_technique_tab) {
                            // Si nous trouvons un autre Tab Break après être entrés dans custom_fiche_technique,
                            // nous sortons de l'onglet
                            meta.in_fiche_technique_tab = false;
                        } else if (meta.in_fiche_technique_tab) {
                            // Si nous sommes dans l'onglet custom_fiche_technique, ajouter le champ
                            // Exclure les champs HTML, Button, etc. et filtrer selon le procédé
                            if (["Section Break", "Column Break"].indexOf(field.fieldtype) === -1 && 
                                (champsAfficher.length === 0 || champsAfficher.includes(field.fieldname))) {
                                fields.push({
                                    label: __(field.label),
                                    fieldname: field.fieldname,
                                    fieldtype: field.fieldtype,
                                    options: field.options,
                                    default: item[field.fieldname],
                                    reqd: field.reqd
                                });
                            }
                        }
                    });
                    
                    // Si aucun champ n'a été trouvé, afficher un message
                    if (fields.length === 0) {
                        frappe.msgprint({
                            title: __('Aucune spécification technique'),
                            message: __('Aucun champ n\'a été trouvé dans l\'onglet Fiche Technique pour cet article.'),
                            indicator: 'blue'
                        });
                        return;
                    }
                    
                    // Créer une boîte de dialogue pour afficher et modifier les champs
                    const d = new frappe.ui.Dialog({
                        title: __('Spécifications Techniques - ') + item.item_name,
                        fields: fields,
                        primary_action_label: __('Mettre à jour'),
                        primary_action: function() {
                            const values = d.get_values();
                            
                            // Mettre à jour l'article
                            frappe.call({
                                method: "frappe.client.set_value",
                                args: {
                                    doctype: "Item",
                                    name: article_name,
                                    fieldname: values
                                },
                                callback: function(r) {
                                    if (r.message) {
                                        frappe.show_alert({
                                            message: __('Spécifications techniques mises à jour avec succès.'),
                                            indicator: 'green'
                                        }, 5);
                                        d.hide();
                                    } else {
                                        frappe.msgprint({
                                            title: __('Erreur'),
                                            message: __('Une erreur est survenue lors de la mise à jour des spécifications techniques.'),
                                            indicator: 'red'
                                        });
                                    }
                                }
                            });
                        }
                    });
                    
                    d.show();
                });
            } else {
                frappe.msgprint({
                    title: __('Article non trouvé'),
                    message: __('Impossible de trouver l\'article sélectionné.'),
                    indicator: 'red'
                });
            }
        }
    });
}





/**
 * Affiche les spécifications techniques de l'article.
 * @param {string} article_name - Le nom de l'article.
 */
/**
 * Affiche et permet de modifier les spécifications techniques de l'article.
 * @param {string} article_name - Le nom de l'article.
 */
if (!window.showItemTechnicalSpecs) {
    window.showItemTechnicalSpecs = function(article_name) {
        if (!article_name) {
            frappe.msgprint({
                title: __('Article non sélectionné'),
                message: __('Veuillez d\'abord sélectionner un article.'),
                indicator: 'orange'
            });
            return;
        }
        
        // Récupérer les données de l'article
        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Item",
                name: article_name
            },
            callback: function(r) {
                if (r.message) {
                    const item = r.message;
                    const procede = item.custom_procédé || "";
                    
                    // Définir les champs à afficher selon le procédé
                    const champsOffset = [
                        "custom_fiche_technique_article",
                        "custom_conditionnement",
                        "custom_support_fourni", 
                        "custom_support", 
                        "custom_grammage", 
                        "custom_tolérance_",
                        "custom_impression", 
                        "custom_nbr_couleurs", 
                        "custom_nombre_de_poses", 
                        "custom_pelliculage", 
                        "custom_marquage_à_chaud", 
                        "custom_couleur_marquage_à_chaud", 
                        "custom_notice", 
                        "custom_largeur", 
                        "custom_hauteur", 
                        "custom_longueur", 
                        "custom_acrylique", 
                        "custom_uv", 
                        "custom_sélectif", 
                        "custom_drip_off", 
                        "custom_mat_gras", 
                        "custom_blister", 
                        "custom_recto_verso", 
                        "custom_fenêtre", 
                        "custom_dimension_fenêtre", 
                        "custom_epaisseur_fenêtre", 
                        "custom_gaufrage__estampage", 
                        "custom_massicot", 
                        "custom_collerette", 
                        "custom_blanc_couvrant", 
                        "custom_braille", 
                        "custom_texte_braille"
                    ];
                    
                    const champsFlexo = [
                        "custom_fiche_technique_article",
                        "custom_conditionnement", 
                        "custom_désignation", 
                        "custom_type_support", 
                        "custom_complexage",
                        "custom_epaisseur",
                        "custom_epaisseur_2",
                        "custom_diametre_mandrin", 
                        "custom_diamètre_bobine", 
                        "custom_dimensions_h_x_l", 
                        "custom_sens_deroulement", 
                        "custom_sense_défilement_",
                        "custom_poids_bobine"
                    ];
                    
                    // Sélectionner les champs à afficher selon le procédé
                    const champsAfficher = procede === "Offset" ? champsOffset : 
                                          procede === "Flexo" ? champsFlexo : [];
                    
                    // Récupérer tous les champs de l'onglet custom_fiche_technique
                    frappe.model.with_doctype("Item", function() {
                        const fields = [];
                        const meta = frappe.get_meta("Item");
                        
                        // Trouver tous les champs qui appartiennent à l'onglet custom_fiche_technique
                        meta.fields.forEach(field => {
                            // Vérifier si le champ appartient à l'onglet custom_fiche_technique
                            // Nous cherchons les champs qui sont après un Tab Break nommé custom_fiche_technique
                            // et avant le prochain Tab Break
                            if (field.fieldtype === "Tab Break" && field.fieldname === "custom_fiche_technique") {
                                // Marquer que nous sommes dans l'onglet custom_fiche_technique
                                meta.in_fiche_technique_tab = true;
                            } else if (field.fieldtype === "Tab Break" && meta.in_fiche_technique_tab) {
                                // Si nous trouvons un autre Tab Break après être entrés dans custom_fiche_technique,
                                // nous sortons de l'onglet
                                meta.in_fiche_technique_tab = false;
                            } else if (meta.in_fiche_technique_tab) {
                                // Si nous sommes dans l'onglet custom_fiche_technique, ajouter le champ
                                // Exclure les champs HTML, Button, etc. et filtrer selon le procédé
                                if (["Section Break", "Column Break"].indexOf(field.fieldtype) === -1 && 
                                    (champsAfficher.length === 0 || champsAfficher.includes(field.fieldname))) {
                                    fields.push({
                                        label: __(field.label),
                                        fieldname: field.fieldname,
                                        fieldtype: field.fieldtype,
                                        options: field.options,
                                        default: item[field.fieldname],
                                        reqd: field.reqd
                                    });
                                }
                            }
                        });
                        
                        // Si aucun champ n'a été trouvé, afficher un message
                        if (fields.length === 0) {
                            frappe.msgprint({
                                title: __('Aucune spécification technique'),
                                message: __('Aucun champ n\'a été trouvé dans l\'onglet Fiche Technique pour cet article.'),
                                indicator: 'blue'
                            });
                            return;
                        }
                        
                        // Créer une boîte de dialogue pour afficher et modifier les champs
                        const d = new frappe.ui.Dialog({
                            title: __('Spécifications Techniques - ') + item.item_name,
                            fields: fields,
                            primary_action_label: __('Mettre à jour'),
                            primary_action: function() {
                                const values = d.get_values();
                                
                                // Mettre à jour l'article
                                frappe.call({
                                    method: "frappe.client.set_value",
                                    args: {
                                        doctype: "Item",
                                        name: article_name,
                                        fieldname: values
                                    },
                                    callback: function(r) {
                                        if (r.message) {
                                            frappe.show_alert({
                                                message: __('Spécifications techniques mises à jour avec succès.'),
                                                indicator: 'green'
                                            }, 5);
                                            d.hide();
                                        } else {
                                            frappe.msgprint({
                                                title: __('Erreur'),
                                                message: __('Une erreur est survenue lors de la mise à jour des spécifications techniques.'),
                                                indicator: 'red'
                                            });
                                        }
                                    }
                                });
                            }
                        });
                        
                        d.show();
                    });
                } else {
                    frappe.msgprint({
                        title: __('Article non trouvé'),
                        message: __('Impossible de trouver l\'article sélectionné.'),
                        indicator: 'red'
                    });
                }
            }
        });
    };
}