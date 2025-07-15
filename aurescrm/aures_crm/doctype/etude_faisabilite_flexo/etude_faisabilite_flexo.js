/**
 * Client Script for Etude Faisabilite Flexo Doctype
 * Handles dynamic filters, HTML field updates with Trace/Plan Flexo/Maquette/Cliche links and actions (Create/Update/Open).
 */

frappe.ui.form.on('Etude Faisabilite Flexo', {
    /**
     * Refreshes the form view.
     * @param {object} frm - The current form object.
     */
    refresh: function(frm) {
        // Apply dynamic filters
        set_filters_flexo(frm);
        // Load or update the HTML section displaying linked documents info and actions
        load_flexo_linked_docs_html(frm);
        // Refresh local attachment fields based on linked documents
        refresh_attached_files_flexo(frm);
    },
    
    /**
     * Triggered when the client field changes.
     * @param {object} frm - The current form object.
     */
    client: function(frm) {
        // Re-apply filters as client impacts article list
        set_filters_flexo(frm);
    },

    /**
     * Triggered when the article field changes.
     * @param {object} frm - The current form object.
     */
    article: function(frm) {
        // Re-apply filters as article impacts linked documents lists
        set_filters_flexo(frm);
        // Update the HTML display
        load_flexo_linked_docs_html(frm);
        refresh_attached_files_flexo(frm);
    },

    /**
     * Triggered when the trace field changes.
     * @param {object} frm - The current form object.
     */
    trace: function(frm) {
        // Re-apply filters
        set_filters_flexo(frm);
        // Update the HTML display
        load_flexo_linked_docs_html(frm);
        // Refresh local attachment fields
        refresh_attached_files_flexo(frm);
    },

    /**
     * Triggered when the plan_flexo field changes.
     * @param {object} frm - The current form object.
     */
    plan_flexo: function(frm) {
        // Apply filters
        set_filters_flexo(frm);
        // Update the HTML display
        load_flexo_linked_docs_html(frm);
        // Refresh local attachment fields
        refresh_attached_files_flexo(frm);
    },

    /**
     * Triggered when the maquette field changes.
     * @param {object} frm - The current form object.
     */
    maquette: function(frm) {
        // Apply filters
        set_filters_flexo(frm);
        // Update the HTML display
        load_flexo_linked_docs_html(frm);
        // Refresh local attachment fields
        refresh_attached_files_flexo(frm);
    },

    /**
     * Triggered when the cliche field changes.
     * @param {object} frm - The current form object.
     */
    cliche: function(frm) {
        // Apply filters
        set_filters_flexo(frm);
        // Update the HTML display
        load_flexo_linked_docs_html(frm);
        // Refresh local attachment fields
        refresh_attached_files_flexo(frm);
    },

    /**
     * Triggered when the status field changes.
     * @param {object} frm - The current form object.
     */
    status: function(frm) {
        // Reload the HTML section to show/hide Create/Update buttons based on status
        load_flexo_linked_docs_html(frm);
    }
});

/**
 * Sets dynamic query filters for link fields (Article, Trace, Plan Flexo, Maquette, Cliche).
 * @param {object} frm - The current form object.
 */
function set_filters_flexo(frm) {
    // Filter Articles based on the selected Client
    frm.fields_dict.article.get_query = function(doc) {
        if (!doc.client) {
             frappe.throw(__("Veuillez d'abord sélectionner un Client."));
        }
        return {
            filters: {
                'custom_client': doc.client
            }
        };
    };
    frm.set_query("article");

    // Filter Trace based on the selected Article
    if (frm.fields_dict.trace) {
        frm.fields_dict.trace.get_query = function(doc) {
            if (!doc.article) {
                 frappe.throw(__("Veuillez d'abord sélectionner un Article."));
            }
            return {
                filters: {
                    article: doc.article
                }
            };
        };
        frm.set_query("trace");
    }

    // Filter Plan Flexo based on the selected Article
    if (frm.fields_dict.plan_flexo) {
        frm.fields_dict.plan_flexo.get_query = function(doc) {
            if (!doc.article) {
                 frappe.throw(__("Veuillez d'abord sélectionner un Article."));
            }
            return {
                filters: {
                    article: doc.article
                }
            };
        };
        frm.set_query("plan_flexo");
    }

    // Filter Maquette based on the selected Article
    if (frm.fields_dict.maquette) {
        frm.fields_dict.maquette.get_query = function(doc) {
            if (!doc.article) {
                 frappe.throw(__("Veuillez d'abord sélectionner un Article."));
            }
            return {
                filters: {
                    article: doc.article
                }
            };
        };
        frm.set_query("maquette");
    }

    // Filter Cliche based on the selected Article
    if (frm.fields_dict.cliche) {
        frm.fields_dict.cliche.get_query = function(doc) {
            if (!doc.article) {
                 frappe.throw(__("Veuillez d'abord sélectionner un Article."));
            }
            return {
                filters: {
                    article: doc.article
                }
            };
        };
        frm.set_query("cliche");
    }
}

/**
 * Fonction pour afficher les spécifications techniques Flexo (section custom_flexo)
 */
function show_flexo_technical_specs(article_name) {
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
                
                // Récupérer les champs de la section custom_flexo
                frappe.model.with_doctype("Item", function() {
                    const fields = [];
                    const meta = frappe.get_meta("Item");
                    let in_flexo_section = false;
                    
                    // Parcourir tous les champs pour trouver ceux de la section custom_flexo
                    meta.fields.forEach(field => {
                        if (field.fieldtype === "Section Break" && field.fieldname === "custom_flexo") {
                            in_flexo_section = true;
                        } else if (field.fieldtype === "Section Break" && in_flexo_section) {
                            in_flexo_section = false;
                        } else if (in_flexo_section && ["Section Break", "Column Break"].indexOf(field.fieldtype) === -1) {
                            fields.push({
                                label: __(field.label),
                                fieldname: field.fieldname,
                                fieldtype: field.fieldtype,
                                options: field.options,
                                default: item[field.fieldname],
                                reqd: field.reqd
                            });
                        }
                    });
                    
                    // Si aucun champ n'a été trouvé, afficher un message
                    if (fields.length === 0) {
                        frappe.msgprint({
                            title: __('Aucune spécification Flexo'),
                            message: __('Aucun champ n\'a été trouvé dans la section Flexo pour cet article.'),
                            indicator: 'blue'
                        });
                        return;
                    }
                    
                    // Créer une boîte de dialogue pour afficher et modifier les champs
                    const d = new frappe.ui.Dialog({
                        title: __('Spécifications Techniques Flexo - ') + item.item_name,
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
                                            message: __('Spécifications techniques Flexo mises à jour avec succès.'),
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

// Rendre la fonction accessible globalement
if (typeof window !== 'undefined') {
    window.show_flexo_technical_specs = show_flexo_technical_specs;
}

/**
 * Loads the HTML content displaying linked documents links and action buttons
 * into the 'html_doc' field.
 * @param {object} frm - The current form object.
 */
function load_flexo_linked_docs_html(frm) {
    const html_field = frm.fields_dict.html_doc;
    if (!html_field) {
        console.warn("Le champ 'html_doc' n'existe pas dans le formulaire Etude Faisabilite Flexo.");
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
                    Démarrer l'Étude pour afficher les documents disponibles
                </div>
                <div style="font-size: 12px; color: #8d99a6;">
                    Changez le statut en "En étude" pour accéder aux fonctionnalités de création de documents
                </div>
            </div>
        `);
        return;
    }

    // --- HTML Structure and Styling ---
    var html = `<div style='display: flex; flex-direction: column; gap: 20px; padding-bottom: 10px;'>
        <style>
            .ef-container { 
                display: grid; 
                grid-template-columns: 1fr; 
                gap: 20px; 
                width: 100%; 
            }
            .ef-section { 
                display: flex; 
                flex-direction: column; 
                min-height: 200px;
            }
            .ef-card { 
                border: 0.5px solid #d1d8dd; 
                border-radius: 8px; 
                height: 100%; 
                display: flex; 
                flex-direction: column; 
                overflow: hidden; 
            }
            .ef-card-header { 
                padding: 10px 20px; 
                border-bottom: 0.5px solid #d1d8dd; 
                background-color: #f8f9fa; 
            }
            .ef-card-title { 
                font-size: 14px; 
                font-weight: 600; 
                color: #1a1a1a; 
            }
            .ef-card-content { 
                padding: 20px; 
                background-color: #ffffff; 
                flex-grow: 1; 
            }
            .ef-item { 
                margin-bottom: 10px; 
                display: flex; 
                flex-direction: column; 
                gap: 5px; 
            }
            .ef-link-line { 
                display: flex; 
                align-items: baseline; 
                flex-wrap: wrap; 
                gap: 4px 8px; 
                margin-bottom: 8px; 
                font-size: 12px; 
            }
            .ef-link-line span { 
                margin-right: 4px; 
            }
            .ef-link-line a { 
                color: var(--text-color); 
                text-decoration: none; 
                word-break: break-all; 
            }
            .ef-link-line a:hover { 
                text-decoration: underline; 
                color: var(--link-color); 
            }
            .ef-action-line { 
                margin-top: 5px; 
                display: flex; 
                gap: 5px; 
                flex-wrap: wrap;
            }
            .ef-create-btn { 
                margin-top: 10px; 
            }
            
            /* Responsive layout */
            /* Mobile first: 1 colonne */
            @media (max-width: 767px) {
                .ef-container { 
                    grid-template-columns: 1fr; 
                }
                .ef-action-line {
                    flex-direction: column;
                    gap: 8px;
                }
                .ef-action-line .btn {
                    width: 100%;
                    text-align: center;
                }
            }
            
            /* Tablette: 2 colonnes */
            @media (min-width: 768px) and (max-width: 1199px) {
                .ef-container { 
                    grid-template-columns: 1fr 1fr; 
                }
            }
            
            /* Desktop: 4 colonnes */
            @media (min-width: 1200px) {
                .ef-container { 
                    grid-template-columns: repeat(4, 1fr); 
                }
            }
            
            /* Ensure button text is visible */
            .btn-xs { 
                line-height: 1.5; 
                padding: 1px 5px; 
                font-size: 12px; 
            }
            
            /* Style pour le bouton de spécifications techniques */
            .ef-specs-btn { 
                margin-bottom: 15px; 
                text-align: left; 
                padding: 10px; 
                background-color: #ffffff; 
            }
        </style>
        
        <!-- Bouton Fiche Technique Article placé avant les sections -->
        ${frm.doc.article ? `<div class='ef-specs-btn'>
            <button class='btn btn-primary' onclick="show_flexo_technical_specs('${frm.doc.article}'); return false;">
                Fiche Technique Flexo
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
                        <button class='btn btn-xs btn-light' onclick="openAttachedFile('Trace', '${frm.doc.trace}', 'fichier_trace'); return false;" title="${__('Ouvrir le fichier Tracé attaché')}">
                             Ouvrir Fichier
                        </button>
                    </div>
                 </div>`;
    } else {
        html += `<p style='font-size: 11px; color: var(--text-muted);'>Aucun tracé lié.</p>`;
        // Show "Create Trace" button only if status allows and prerequisites are met
        if (frm.doc.status === "En étude" && frm.doc.client && frm.doc.article) {
            html += `<div class='ef-create-btn'>
                        <button class='btn btn-xs btn-primary' onclick="createTrace('${frm.docname}'); return false;">Créer Tracé</button>
                     </div>`;
        } else if (frm.doc.status === "En étude" && (!frm.doc.client || !frm.doc.article)) {
             html += `<p style='font-size: 11px; color: var(--text-muted);'>Sélectionnez Client et Article pour créer un Tracé.</p>`;
        }
    }
    html += `</div></div></div>`; // End Tracé section

    // --- Section Plan Flexo ---
    html += `<div class='ef-section'>
                <div class='ef-card'>
                    <div class='ef-card-header'><span class='ef-card-title'>Plan Flexo</span></div>
                    <div class='ef-card-content'>`;
    if (frm.doc.plan_flexo) {
        html += `<div class='ef-item'>
                    <div class='ef-link-line'>
                        <span>•</span>
                        <a href='#' onclick="frappe.set_route('Form','Plan Flexo','${frm.doc.plan_flexo}'); return false;">${frm.doc.plan_flexo}</a>
                    </div>
                    <div class='ef-action-line'>
                        <button class='btn btn-xs btn-secondary' onclick="updatePlanFlexo('${frm.doc.plan_flexo}'); return false;" title="${__('Mettre à jour les données du Plan Flexo')}">Mise à jour</button>
                        <button class='btn btn-xs btn-light' onclick="openAttachedFile('Plan Flexo', '${frm.doc.plan_flexo}', 'fichier'); return false;" title="${__('Ouvrir le fichier Plan Flexo attaché')}">
                            Ouvrir Fichier
                       </button>
                    </div>
                 </div>`;
    } else {
        html += `<p style='font-size: 11px; color: var(--text-muted);'>Aucun plan flexo lié.</p>`;
        // Show "Create Plan Flexo" button only if status allows and prerequisites are met
        if (frm.doc.status === "En étude" && frm.doc.client && frm.doc.article) {
            html += `<div class='ef-create-btn'>
                        <button class='btn btn-xs btn-primary' onclick="createPlanFlexo('${frm.docname}'); return false;">Créer Plan Flexo</button>
                     </div>`;
        } else if (frm.doc.status === "En étude" && (!frm.doc.client || !frm.doc.article)) {
            html += `<p style='font-size: 11px; color: var(--text-muted);'>Sélectionnez Client et Article pour créer un Plan Flexo.</p>`;
        }
    }
    html += `</div></div></div>`; // End Plan Flexo section

    // --- Section Maquette ---
    html += `<div class='ef-section'>
                <div class='ef-card'>
                    <div class='ef-card-header'><span class='ef-card-title'>Maquette</span></div>
                    <div class='ef-card-content'>`;
    if (frm.doc.maquette) {
        html += `<div class='ef-item'>
                    <div class='ef-link-line'>
                        <span>•</span>
                        <a href='#' onclick="frappe.set_route('Form','Maquette','${frm.doc.maquette}'); return false;">${frm.doc.maquette}</a>
                    </div>
                    <div class='ef-action-line'>
                        <button class='btn btn-xs btn-secondary' onclick="updateMaquette('${frm.doc.maquette}'); return false;" title="${__('Mettre à jour les données de la Maquette')}">Mise à jour</button>
                        <button class='btn btn-xs btn-light' onclick="openAttachedFile('Maquette', '${frm.doc.maquette}', 'fichier_maquette'); return false;" title="${__('Ouvrir le fichier Maquette attaché')}">
                            Ouvrir Fichier
                       </button>
                    </div>
                 </div>`;
    } else {
        html += `<p style='font-size: 11px; color: var(--text-muted);'>Aucune maquette liée.</p>`;
        // Show "Create Maquette" button only if status allows and prerequisites are met
        if (frm.doc.status === "En étude" && frm.doc.client && frm.doc.article) {
            html += `<div class='ef-create-btn'>
                        <button class='btn btn-xs btn-primary' onclick="createMaquette('${frm.docname}'); return false;">Créer Maquette</button>
                     </div>`;
        } else if (frm.doc.status === "En étude" && (!frm.doc.client || !frm.doc.article)) {
            html += `<p style='font-size: 11px; color: var(--text-muted);'>Sélectionnez Client et Article pour créer une Maquette.</p>`;
        }
    }
    html += `</div></div></div>`; // End Maquette section

    // --- Section Cliché ---
    html += `<div class='ef-section'>
                <div class='ef-card'>
                    <div class='ef-card-header'><span class='ef-card-title'>Cliché</span></div>
                    <div class='ef-card-content'>`;
    if (frm.doc.cliche) {
        html += `<div class='ef-item'>
                    <div class='ef-link-line'>
                        <span>•</span>
                        <a href='#' onclick="frappe.set_route('Form','Cliche','${frm.doc.cliche}'); return false;">${frm.doc.cliche}</a>
                    </div>
                    <div class='ef-action-line'>
                        <button class='btn btn-xs btn-secondary' onclick="updateCliche('${frm.doc.cliche}'); return false;" title="${__('Mettre à jour les données du Cliché')}">Mise à jour</button>
                        <button class='btn btn-xs btn-light' onclick="openAttachedFile('Cliche', '${frm.doc.cliche}', 'fich_maquette'); return false;" title="${__('Ouvrir le fichier Cliché attaché')}">
                            Ouvrir Fichier
                       </button>
                    </div>
                 </div>`;
    } else {
        html += `<p style='font-size: 11px; color: var(--text-muted);'>Aucun cliché lié.</p>`;
        // Show "Create Cliche" button only if status allows and prerequisites are met
        if (frm.doc.status === "En étude" && frm.doc.client && frm.doc.article) {
            html += `<div class='ef-create-btn'>
                        <button class='btn btn-xs btn-primary' onclick="createCliche('${frm.docname}'); return false;">Créer Cliché</button>
                     </div>`;
        } else if (frm.doc.status === "En étude" && (!frm.doc.client || !frm.doc.article)) {
            html += `<p style='font-size: 11px; color: var(--text-muted);'>Sélectionnez Client et Article pour créer un Cliché.</p>`;
        }
    }
    html += `</div></div></div>`; // End Cliché section

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

    /**
     * Fetches the file path from a linked document and opens it in a new tab.
     * @param {string} doctype - Document type.
     * @param {string} docname - The name of the document containing the file.
     * @param {string} fieldname - The field name containing the file.
     */
    if (!window.openAttachedFile) {
        window.openAttachedFile = function(doctype, docname, fieldname) {
            if (!doctype || !docname || !fieldname) {
                console.error("Doctype, Docname ou Fieldname manquant pour openAttachedFile");
                return;
            }
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

    /**
     * Creates a new Trace document, links it, and prompts for required info.
     * @param {string} docname - Name of the current Etude Faisabilite Flexo document.
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
                args: { doc: { doctype: "Trace", client: frm.doc.client, article: frm.doc.article, etude_faisabilite_flexo: frm.doc.name } },
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
                                                    load_flexo_linked_docs_html(frm);
                                                    refresh_attached_files_flexo(frm);
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
                                            load_flexo_linked_docs_html(frm); // Refresh HTML links/buttons
                                            refresh_attached_files_flexo(frm);    // Refresh local file field
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
     * Creates a new Plan Flexo document, links it, and prompts for required info.
     * @param {string} docname - Name of the current Etude Faisabilite Flexo document.
     */
    if (!window.createPlanFlexo) {
        window.createPlanFlexo = function(docname) {
            var frm = cur_frm;
            if (!frm.doc.client || !frm.doc.article) {
                frappe.msgprint({ title: __('Prérequis manquants'), message: __('Veuillez remplir les champs Client et Article avant de créer un Plan Flexo.'), indicator: 'orange' });
                return;
            }
            frappe.call({
                method: "frappe.client.insert",
                args: { doc: { doctype: "Plan Flexo", client: frm.doc.client, article: frm.doc.article, etude_faisabilite_flexo: frm.doc.name } },
                freeze: true, freeze_message: __("Création du Plan Flexo..."),
                callback: function(r) {
                    if (r.message && r.message.name) {
                        var plan_id = r.message.name;
                        frm.set_value("plan_flexo", plan_id);

                        var d = new frappe.ui.Dialog({
                            title: __('Compléter les informations du Plan Flexo'),
                            fields: [
                                { fieldtype: 'HTML', fieldname: 'id_section', options: `<div style="display: flex; align-items: center; margin-bottom: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;"><div style="margin-right: 10px; font-weight: bold;">ID:</div><div style="flex-grow: 1; font-family: monospace; padding: 5px; background-color: #fff; border: 1px solid #d1d8dd; border-radius: 3px;">${plan_id}</div><button class="btn btn-xs btn-default" title="${__('Copier ID')}" onclick="navigator.clipboard.writeText('${plan_id}'); frappe.show_alert({message: __('ID copié'), indicator: 'green'}, 2); return false;" style="margin-left: 10px;"><i class="fa fa-copy"></i></button></div>`},
                                { label: __('Dimensions'), fieldname: 'dimensions', fieldtype: 'Data', reqd: 1, description: __('Entrez les dimensions du plan') },
                                { label: __('Laize'), fieldname: 'laize', fieldtype: 'Float', reqd: 1, description: __('Entrez la laize') },
                                { label: __('Fichier Plan Flexo'), fieldname: 'fichier', fieldtype: 'Attach', reqd: 1, description: __('Joignez le fichier du plan') }
                            ],
                            primary_action_label: __('Enregistrer et Fermer'),
                            primary_action: function() {
                                var values = d.get_values();
                                if (!values.dimensions || !values.laize || !values.fichier) {
                                    frappe.msgprint({ title: __('Validation'), message: __("Veuillez remplir tous les champs obligatoires."), indicator: 'orange' });
                                    return;
                                }
                                frappe.call({
                                    method: "frappe.client.set_value",
                                    args: { doctype: "Plan Flexo", name: plan_id, fieldname: { dimensions: values.dimensions, laize: values.laize, fichier: values.fichier } },
                                    freeze: true, freeze_message: __("Mise à jour du Plan Flexo..."),
                                    callback: function(r_update) {
                                        if (r_update.message) {
                                            frappe.show_alert({message:__('Plan Flexo créé et mis à jour avec succès.'), indicator:'green'}, 5);
                                            frm.save()
                                                .then(() => {
                                                    load_flexo_linked_docs_html(frm);
                                                    refresh_attached_files_flexo(frm);
                                                })
                                                .catch((err) => { console.error("Save failed after Plan Flexo creation:", err); });
                                            d.hide();
                                        } else { frappe.msgprint({ title: __('Erreur'), message: __("Erreur lors de la mise à jour du Plan Flexo."), indicator: 'red' }); }
                                    },
                                    error: function(err_update) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la mise à jour du Plan Flexo.") + "<br>" + err_update.message, indicator: 'red' });}
                                });
                            }
                        });
                        style_dialog_primary_button(d);
                        d.show();
                    } else { frappe.msgprint({ title: __('Erreur'), message: __("Erreur lors de la création du Plan Flexo.") + (r.exc ? "<br>" + r.exc : ""), indicator: 'red' }); }
                },
                error: function(err) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la création du Plan Flexo.") + "<br>" + err.message, indicator: 'red' }); }
            });
        };
    }

    /**
     * Opens a dialog to update an existing Plan Flexo document.
     * @param {string} plan_id - The name/ID of the Plan Flexo document to update.
     */
    if (!window.updatePlanFlexo) {
        window.updatePlanFlexo = function(plan_id) {
            var frm = cur_frm;
            frappe.call({
                method: "frappe.client.get_value",
                args: { doctype: "Plan Flexo", fieldname: ["dimensions", "laize", "fichier"], filters: { name: plan_id } },
                callback: function(r) {
                    if (r.message) {
                        let current_values = r.message;
                        var d = new frappe.ui.Dialog({
                            title: __('Mettre à jour le document Plan Flexo'),
                            fields: [
                                { fieldtype: 'HTML', fieldname: 'id_section', options: `<div style="display: flex; align-items: center; margin-bottom: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;"><div style="margin-right: 10px; font-weight: bold;">ID:</div><div style="flex-grow: 1; font-family: monospace; padding: 5px; background-color: #fff; border: 1px solid #d1d8dd; border-radius: 3px;">${plan_id}</div><button class="btn btn-xs btn-default" title="${__('Copier ID')}" onclick="navigator.clipboard.writeText('${plan_id}'); frappe.show_alert({message: __('ID copié'), indicator: 'green'}, 2); return false;" style="margin-left: 10px;"><i class="fa fa-copy"></i></button></div>`},
                                { label: __('Dimensions'), fieldname: 'dimensions', fieldtype: 'Data', reqd: 1, default: current_values.dimensions || "", description: __('Entrez les nouvelles dimensions') },
                                { label: __('Laize'), fieldname: 'laize', fieldtype: 'Float', reqd: 1, default: current_values.laize || 0, description: __('Entrez la nouvelle laize') },
                                { label: __('Fichier Plan Flexo'), fieldname: 'fichier', fieldtype: 'Attach', reqd: 1, default: current_values.fichier || "", description: __('Joignez le nouveau fichier') },
                                { fieldtype: 'HTML', fieldname: 'current_file_info_plan', options: current_values.fichier ? `<div style="margin-top: -10px; margin-bottom: 10px; font-size: 11px; color: var(--text-muted);">Fichier actuel: <a href="${current_values.fichier}" target="_blank">${current_values.fichier.split('/').pop()}</a></div>` : `<div style="margin-top: -10px; margin-bottom: 10px; font-size: 11px; color: #888;">Aucun fichier actuel.</div>`}
                            ],
                            primary_action_label: __('Mettre à jour'),
                            primary_action: function() {
                                var values = d.get_values();
                                if (!values.dimensions || !values.laize || !values.fichier) {
                                     frappe.msgprint({ title: __('Validation'), message: __("Veuillez remplir tous les champs obligatoires."), indicator: 'orange' });
                                     return;
                                }
                                frappe.call({
                                    method: "frappe.client.set_value",
                                    args: { doctype: "Plan Flexo", name: plan_id, fieldname: { dimensions: values.dimensions, laize: values.laize, fichier: values.fichier } },
                                    freeze: true, freeze_message: __("Mise à jour du Plan Flexo..."),
                                    callback: function(r_update) {
                                        if (r_update.message) {
                                            frappe.show_alert({message:__('Plan Flexo mis à jour avec succès.'), indicator:'green'}, 5);
                                            d.hide();
                                            load_flexo_linked_docs_html(frm);
                                            refresh_attached_files_flexo(frm);
                                        } else { frappe.msgprint({ title: __('Erreur'), message: __("Erreur lors de la mise à jour du Plan Flexo."), indicator: 'red' }); }
                                    },
                                    error: function(err_update) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la mise à jour du Plan Flexo.") + "<br>" + err_update.message, indicator: 'red' }); }
                                });
                            }
                        });
                        style_dialog_primary_button(d);
                        d.show();
                    } else { frappe.msgprint({ title: __('Erreur'), message: __("Impossible de récupérer les infos du Plan Flexo:") + plan_id, indicator: 'red' }); }
                },
                error: function(err) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la récupération des infos Plan Flexo.") + "<br>" + err.message, indicator: 'red' }); }
            });
        };
    }

    /**
     * Creates a new Maquette document, links it, and prompts for required info.
     * @param {string} docname - Name of the current Etude Faisabilite Flexo document.
     */
    if (!window.createMaquette) {
        window.createMaquette = function(docname) {
            var frm = cur_frm;
            if (!frm.doc.client || !frm.doc.article) {
                frappe.msgprint({ title: __('Prérequis manquants'), message: __('Veuillez remplir les champs Client et Article avant de créer une Maquette.'), indicator: 'orange' });
                return;
            }
            frappe.call({
                method: "frappe.client.insert",
                args: { doc: { doctype: "Maquette", client: frm.doc.client, article: frm.doc.article, etude_faisabilite_flexo: frm.doc.name } },
                freeze: true, freeze_message: __("Création de la Maquette..."),
                callback: function(r) {
                    if (r.message && r.message.name) {
                        var maquette_id = r.message.name;
                        frm.set_value("maquette", maquette_id);

                        var d = new frappe.ui.Dialog({
                            title: __('Compléter les informations de la Maquette'),
                            fields: [
                                { fieldtype: 'HTML', fieldname: 'id_section', options: `<div style="display: flex; align-items: center; margin-bottom: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;"><div style="margin-right: 10px; font-weight: bold;">ID:</div><div style="flex-grow: 1; font-family: monospace; padding: 5px; background-color: #fff; border: 1px solid #d1d8dd; border-radius: 3px;">${maquette_id}</div><button class="btn btn-xs btn-default" title="${__('Copier ID')}" onclick="navigator.clipboard.writeText('${maquette_id}'); frappe.show_alert({message: __('ID copié'), indicator: 'green'}, 2); return false;" style="margin-left: 10px;"><i class="fa fa-copy"></i></button></div>`},
                                { label: __('Fichier Maquette'), fieldname: 'fichier_maquette', fieldtype: 'Attach', reqd: 1, description: __('Joignez le fichier de la maquette') }
                            ],
                            primary_action_label: __('Enregistrer et Fermer'),
                            primary_action: function() {
                                var values = d.get_values();
                                if (!values.fichier_maquette) {
                                    frappe.msgprint({ title: __('Validation'), message: __("Veuillez joindre le fichier de la maquette."), indicator: 'orange' });
                                    return;
                                }
                                frappe.call({
                                    method: "frappe.client.set_value",
                                    args: { doctype: "Maquette", name: maquette_id, fieldname: { fichier_maquette: values.fichier_maquette } },
                                    freeze: true, freeze_message: __("Mise à jour de la Maquette..."),
                                    callback: function(r_update) {
                                        if (r_update.message) {
                                            frappe.show_alert({message:__('Maquette créée et mise à jour avec succès.'), indicator:'green'}, 5);
                                            frm.save()
                                                .then(() => {
                                                    load_flexo_linked_docs_html(frm);
                                                    refresh_attached_files_flexo(frm);
                                                })
                                                .catch((err) => { console.error("Save failed after Maquette creation:", err); });
                                            d.hide();
                                        } else { frappe.msgprint({ title: __('Erreur'), message: __("Erreur lors de la mise à jour de la Maquette."), indicator: 'red' }); }
                                    },
                                    error: function(err_update) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la mise à jour de la Maquette.") + "<br>" + err_update.message, indicator: 'red' });}
                                });
                            }
                        });
                        style_dialog_primary_button(d);
                        d.show();
                    } else { frappe.msgprint({ title: __('Erreur'), message: __("Erreur lors de la création de la Maquette.") + (r.exc ? "<br>" + r.exc : ""), indicator: 'red' }); }
                },
                error: function(err) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la création de la Maquette.") + "<br>" + err.message, indicator: 'red' }); }
            });
        };
    }

    /**
     * Opens a dialog to update an existing Maquette document.
     * @param {string} maquette_id - The name/ID of the Maquette document to update.
     */
    if (!window.updateMaquette) {
        window.updateMaquette = function(maquette_id) {
            var frm = cur_frm;
            frappe.call({
                method: "frappe.client.get_value",
                args: { doctype: "Maquette", fieldname: ["fichier_maquette"], filters: { name: maquette_id } },
                callback: function(r) {
                    if (r.message) {
                        let current_values = r.message;
                        var d = new frappe.ui.Dialog({
                            title: __('Mettre à jour le document Maquette'),
                            fields: [
                                { fieldtype: 'HTML', fieldname: 'id_section', options: `<div style="display: flex; align-items: center; margin-bottom: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;"><div style="margin-right: 10px; font-weight: bold;">ID:</div><div style="flex-grow: 1; font-family: monospace; padding: 5px; background-color: #fff; border: 1px solid #d1d8dd; border-radius: 3px;">${maquette_id}</div><button class="btn btn-xs btn-default" title="${__('Copier ID')}" onclick="navigator.clipboard.writeText('${maquette_id}'); frappe.show_alert({message: __('ID copié'), indicator: 'green'}, 2); return false;" style="margin-left: 10px;"><i class="fa fa-copy"></i></button></div>`},
                                { label: __('Fichier Maquette'), fieldname: 'fichier_maquette', fieldtype: 'Attach', reqd: 1, default: current_values.fichier_maquette || "", description: __('Joignez le nouveau fichier') },
                                { fieldtype: 'HTML', fieldname: 'current_file_info_maquette', options: current_values.fichier_maquette ? `<div style="margin-top: -10px; margin-bottom: 10px; font-size: 11px; color: var(--text-muted);">Fichier actuel: <a href="${current_values.fichier_maquette}" target="_blank">${current_values.fichier_maquette.split('/').pop()}</a></div>` : `<div style="margin-top: -10px; margin-bottom: 10px; font-size: 11px; color: #888;">Aucun fichier actuel.</div>`}
                            ],
                            primary_action_label: __('Mettre à jour'),
                            primary_action: function() {
                                var values = d.get_values();
                                if (!values.fichier_maquette) {
                                     frappe.msgprint({ title: __('Validation'), message: __("Veuillez joindre le fichier de la maquette."), indicator: 'orange' });
                                     return;
                                }
                                frappe.call({
                                    method: "frappe.client.set_value",
                                    args: { doctype: "Maquette", name: maquette_id, fieldname: { fichier_maquette: values.fichier_maquette } },
                                    freeze: true, freeze_message: __("Mise à jour de la Maquette..."),
                                    callback: function(r_update) {
                                        if (r_update.message) {
                                            frappe.show_alert({message:__('Maquette mise à jour avec succès.'), indicator:'green'}, 5);
                                            d.hide();
                                            load_flexo_linked_docs_html(frm);
                                            refresh_attached_files_flexo(frm);
                                        } else { frappe.msgprint({ title: __('Erreur'), message: __("Erreur lors de la mise à jour de la Maquette."), indicator: 'red' }); }
                                    },
                                    error: function(err_update) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la mise à jour de la Maquette.") + "<br>" + err_update.message, indicator: 'red' }); }
                                });
                            }
                        });
                        style_dialog_primary_button(d);
                        d.show();
                    } else { frappe.msgprint({ title: __('Erreur'), message: __("Impossible de récupérer les infos de la Maquette:") + maquette_id, indicator: 'red' }); }
                },
                error: function(err) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la récupération des infos Maquette.") + "<br>" + err.message, indicator: 'red' }); }
            });
        };
    }

    /**
     * Creates a new Cliche document, links it, and prompts for required info.
     * @param {string} docname - Name of the current Etude Faisabilite Flexo document.
     */
    if (!window.createCliche) {
        window.createCliche = function(docname) {
            var frm = cur_frm;
            if (!frm.doc.client || !frm.doc.article) {
                frappe.msgprint({ title: __('Prérequis manquants'), message: __('Veuillez remplir les champs Client et Article avant de créer un Cliché.'), indicator: 'orange' });
                return;
            }
            frappe.call({
                method: "frappe.client.insert",
                args: { doc: { doctype: "Cliche", client: frm.doc.client, article: frm.doc.article, etude_faisabilite_flexo: frm.doc.name } },
                freeze: true, freeze_message: __("Création du Cliché..."),
                callback: function(r) {
                    if (r.message && r.message.name) {
                        var cliche_id = r.message.name;
                        frm.set_value("cliche", cliche_id);

                        var d = new frappe.ui.Dialog({
                            title: __('Compléter les informations du Cliché'),
                            fields: [
                                { fieldtype: 'HTML', fieldname: 'id_section', options: `<div style="display: flex; align-items: center; margin-bottom: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;"><div style="margin-right: 10px; font-weight: bold;">ID:</div><div style="flex-grow: 1; font-family: monospace; padding: 5px; background-color: #fff; border: 1px solid #d1d8dd; border-radius: 3px;">${cliche_id}</div><button class="btn btn-xs btn-default" title="${__('Copier ID')}" onclick="navigator.clipboard.writeText('${cliche_id}'); frappe.show_alert({message: __('ID copié'), indicator: 'green'}, 2); return false;" style="margin-left: 10px;"><i class="fa fa-copy"></i></button></div>`},
                                { label: __('Fichier Maquette'), fieldname: 'fich_maquette', fieldtype: 'Attach', reqd: 1, description: __('Joignez le fichier de la maquette pour le cliché') }
                            ],
                            primary_action_label: __('Enregistrer et Fermer'),
                            primary_action: function() {
                                var values = d.get_values();
                                if (!values.fich_maquette) {
                                    frappe.msgprint({ title: __('Validation'), message: __("Veuillez joindre le fichier de la maquette."), indicator: 'orange' });
                                    return;
                                }
                                frappe.call({
                                    method: "frappe.client.set_value",
                                    args: { doctype: "Cliche", name: cliche_id, fieldname: { fich_maquette: values.fich_maquette } },
                                    freeze: true, freeze_message: __("Mise à jour du Cliché..."),
                                    callback: function(r_update) {
                                        if (r_update.message) {
                                            frappe.show_alert({message:__('Cliché créé et mis à jour avec succès.'), indicator:'green'}, 5);
                                            frm.save()
                                                .then(() => {
                                                    load_flexo_linked_docs_html(frm);
                                                    refresh_attached_files_flexo(frm);
                                                })
                                                .catch((err) => { console.error("Save failed after Cliche creation:", err); });
                                            d.hide();
                                        } else { frappe.msgprint({ title: __('Erreur'), message: __("Erreur lors de la mise à jour du Cliché."), indicator: 'red' }); }
                                    },
                                    error: function(err_update) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la mise à jour du Cliché.") + "<br>" + err_update.message, indicator: 'red' });}
                                });
                            }
                        });
                        style_dialog_primary_button(d);
                        d.show();
                    } else { frappe.msgprint({ title: __('Erreur'), message: __("Erreur lors de la création du Cliché.") + (r.exc ? "<br>" + r.exc : ""), indicator: 'red' }); }
                },
                error: function(err) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la création du Cliché.") + "<br>" + err.message, indicator: 'red' }); }
            });
        };
    }

    /**
     * Opens a dialog to update an existing Cliche document.
     * @param {string} cliche_id - The name/ID of the Cliche document to update.
     */
    if (!window.updateCliche) {
        window.updateCliche = function(cliche_id) {
            var frm = cur_frm;
            frappe.call({
                method: "frappe.client.get_value",
                args: { doctype: "Cliche", fieldname: ["fich_maquette"], filters: { name: cliche_id } },
                callback: function(r) {
                    if (r.message) {
                        let current_values = r.message;
                        var d = new frappe.ui.Dialog({
                            title: __('Mettre à jour le document Cliché'),
                            fields: [
                                { fieldtype: 'HTML', fieldname: 'id_section', options: `<div style="display: flex; align-items: center; margin-bottom: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;"><div style="margin-right: 10px; font-weight: bold;">ID:</div><div style="flex-grow: 1; font-family: monospace; padding: 5px; background-color: #fff; border: 1px solid #d1d8dd; border-radius: 3px;">${cliche_id}</div><button class="btn btn-xs btn-default" title="${__('Copier ID')}" onclick="navigator.clipboard.writeText('${cliche_id}'); frappe.show_alert({message: __('ID copié'), indicator: 'green'}, 2); return false;" style="margin-left: 10px;"><i class="fa fa-copy"></i></button></div>`},
                                { label: __('Fichier Maquette'), fieldname: 'fich_maquette', fieldtype: 'Attach', reqd: 1, default: current_values.fich_maquette || "", description: __('Joignez le nouveau fichier') },
                                { fieldtype: 'HTML', fieldname: 'current_file_info_cliche', options: current_values.fich_maquette ? `<div style="margin-top: -10px; margin-bottom: 10px; font-size: 11px; color: var(--text-muted);">Fichier actuel: <a href="${current_values.fich_maquette}" target="_blank">${current_values.fich_maquette.split('/').pop()}</a></div>` : `<div style="margin-top: -10px; margin-bottom: 10px; font-size: 11px; color: #888;">Aucun fichier actuel.</div>`}
                            ],
                            primary_action_label: __('Mettre à jour'),
                            primary_action: function() {
                                var values = d.get_values();
                                if (!values.fich_maquette) {
                                     frappe.msgprint({ title: __('Validation'), message: __("Veuillez joindre le fichier de la maquette."), indicator: 'orange' });
                                     return;
                                }
                                frappe.call({
                                    method: "frappe.client.set_value",
                                    args: { doctype: "Cliche", name: cliche_id, fieldname: { fich_maquette: values.fich_maquette } },
                                    freeze: true, freeze_message: __("Mise à jour du Cliché..."),
                                    callback: function(r_update) {
                                        if (r_update.message) {
                                            frappe.show_alert({message:__('Cliché mis à jour avec succès.'), indicator:'green'}, 5);
                                            d.hide();
                                            load_flexo_linked_docs_html(frm);
                                            refresh_attached_files_flexo(frm);
                                        } else { frappe.msgprint({ title: __('Erreur'), message: __("Erreur lors de la mise à jour du Cliché."), indicator: 'red' }); }
                                    },
                                    error: function(err_update) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la mise à jour du Cliché.") + "<br>" + err_update.message, indicator: 'red' }); }
                                });
                            }
                        });
                        style_dialog_primary_button(d);
                        d.show();
                    } else { frappe.msgprint({ title: __('Erreur'), message: __("Impossible de récupérer les infos du Cliché:") + cliche_id, indicator: 'red' }); }
                },
                error: function(err) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la récupération des infos Cliché.") + "<br>" + err.message, indicator: 'red' }); }
            });
        };
    }

    // --- End of Action Functions ---

} // --- Fin de la fonction load_flexo_linked_docs_html ---

/**
 * Refreshes the local attachment fields on the Etude Faisabilite Flexo form 
 * based on the attached files in the linked documents.
 * @param {object} frm - The current form object.
 */
function refresh_attached_files_flexo(frm) {
    // Cette fonction peut être implémentée selon vos besoins
    // Pour l'instant, elle ne fait rien mais peut être étendue
    // pour synchroniser les champs de fichiers locaux avec les documents liés
} 