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

    // Filter Maquette based on the selected Article (only active versions)
    if (frm.fields_dict.maquette) {
        frm.fields_dict.maquette.get_query = function(doc) {
            if (!doc.article) {
                 frappe.throw(__("Veuillez d'abord sélectionner un Article."));
            }
            return {
                filters: {
                    article: doc.article,
                    status: "Version Activée"
                }
            };
        };
        frm.set_query("maquette");
    }

    // Filter Cliche based on the selected Article (only active versions)
    if (frm.fields_dict.cliche) {
        frm.fields_dict.cliche.get_query = function(doc) {
            if (!doc.article) {
                 frappe.throw(__("Veuillez d'abord sélectionner un Article."));
            }
            return {
                filters: {
                    article: doc.article,
                    version_active: 1
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
 * Function to get status colors based on status value and doctype
 * @param {string} status - The status value
 * @param {string} doctype - The doctype (Cliche, Maquette, etc.)
 * @returns {object} - Object containing background, border and text colors
 */
function getStatusColors(status, doctype = 'Cliche') {
    // Cliche status colors
    const clicheStatusColors = {
        'Nouveau': { 
            background: '#f8f9fa', 
            border: '#6c757d', 
            text: '#495057' 
        },
        'En Cours': { 
            background: '#e3f2fd', 
            border: '#2196f3', 
            text: '#1565c0' 
        },
        'En Devis': { 
            background: '#fff8e1', 
            border: '#ff9800', 
            text: '#e65100' 
        },
        'Devis Prêt': { 
            background: '#e8f5e8', 
            border: '#4caf50', 
            text: '#2e7d32' 
        },
        'Devis Accepté': { 
            background: '#e8f5e8', 
            border: '#4caf50', 
            text: '#2e7d32' 
        },
        'Devis Rejeté': { 
            background: '#ffebee', 
            border: '#f44336', 
            text: '#c62828' 
        },
        'A Réaliser': { 
            background: '#e0f2f1', 
            border: '#009688', 
            text: '#00695c' 
        },
        'Réalisé': { 
            background: '#e8f5e8', 
            border: '#4caf50', 
            text: '#2e7d32' 
        },
        'Archivé': { 
            background: '#f8f9fa', 
            border: '#6c757d', 
            text: '#495057' 
        },
        'Annulé': { 
            background: '#ffebee', 
            border: '#f44336', 
            text: '#c62828' 
        }
    };

    // Maquette status colors
    const maquetteStatusColors = {
        'A référencer': { 
            background: '#fff8e1', 
            border: '#ff9800', 
            text: '#e65100' 
        },
        'Référencée': { 
            background: '#e3f2fd', 
            border: '#2196f3', 
            text: '#1565c0' 
        },
        'Version Activée': { 
            background: '#e8f5e8', 
            border: '#4caf50', 
            text: '#2e7d32' 
        },
        'Obsolète': { 
            background: '#ffebee', 
            border: '#f44336', 
            text: '#c62828' 
        }
    };

    const statusColors = doctype === 'Maquette' ? maquetteStatusColors : clicheStatusColors;
    
    return statusColors[status] || { 
        background: '#f8f9fa', 
        border: '#6c757d', 
        text: '#495057' 
    };
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

    // Function to load cliche status and check for new versions
    function loadClicheStatusAndUpdateHTML() {
        if (frm.doc.cliche) {
            // Load status
            frappe.call({
                method: "frappe.client.get_value",
                args: { doctype: "Cliche", fieldname: ["status", "version_active"], filters: { name: frm.doc.cliche } },
                callback: function(r) {
                    if (r.message && r.message.status) {
                        const statusElement = document.getElementById(`cliche-status-${frm.doc.cliche}`);
                        if (statusElement) {
                            const statusColors = getStatusColors(r.message.status, 'Cliche');
                            statusElement.style.backgroundColor = statusColors.background;
                            statusElement.style.borderColor = statusColors.border;
                            statusElement.style.color = statusColors.text;
                            statusElement.textContent = r.message.status;
                        }
                    }
                }
            });
            
            // Check for newer versions
            frappe.call({
                method: "aurescrm.aures_crm.doctype.etude_faisabilite_flexo.etude_faisabilite_flexo.check_new_cliche_versions",
                args: { article: frm.doc.article },
                callback: function(r) {
                    if (r.message && r.message.newer_versions && r.message.newer_versions.length > 0) {
                        const clicheCardContent = document.querySelector(`#cliche-card-${frm.doc.cliche} .ef-card-content`);
                        if (clicheCardContent) {
                            const newVersionsCount = r.message.newer_versions.length;
                            const alertHtml = `
                                <div class="version-notification" style="background: #fff3e0; 
                                     border-left: 3px solid #ff9800; padding: 8px 12px; margin: 10px 0 15px 0; 
                                     font-size: 11px; color: #e65100; display: flex; align-items: center; justify-content: space-between;">
                                    <div style="display: flex; align-items: center;">
                                        <i class="fa fa-exclamation-triangle" style="margin-right: 6px;"></i>
                                        <span>${newVersionsCount} nouvelle${newVersionsCount > 1 ? 's' : ''} version${newVersionsCount > 1 ? 's' : ''} disponible${newVersionsCount > 1 ? 's' : ''}</span>
                                    </div>
                                    <div style="display: flex; gap: 8px;">
                                        <button class="btn btn-xs" style="background: #ff9800; color: white; border: none; padding: 2px 8px;" 
                                                onclick="showVersionSelector('Cliche', '${frm.doc.article}', '${frm.doc.name}'); return false;" title="Voir toutes les versions disponibles">
                                            Voir
                                        </button>
                                        <button class="btn btn-xs" style="background: #ff9800; color: white; border: none; padding: 2px 8px;" 
                                                onclick="showQuickVersionChange('Cliche', '${frm.doc.article}', '${frm.doc.name}'); return false;" title="Changer rapidement de version">
                                            Changer
                                        </button>
                                    </div>
                                </div>
                            `;
                            
                            // Insérer après le premier élément (l'ID et les boutons)
                            const firstItem = clicheCardContent.querySelector('.ef-item');
                            if (firstItem) {
                                firstItem.insertAdjacentHTML('afterend', alertHtml);
                            } else {
                                clicheCardContent.insertAdjacentHTML('afterbegin', alertHtml);
                            }
                        }
                    }
                }
            });
        }
    }

    // Function to load maquette status and check for new versions
    function loadMaquetteStatusAndUpdateHTML() {
        if (frm.doc.maquette) {
            // Load status
            frappe.call({
                method: "frappe.client.get_value",
                args: { doctype: "Maquette", fieldname: ["status"], filters: { name: frm.doc.maquette } },
                callback: function(r) {
                    if (r.message && r.message.status) {
                        const statusElement = document.getElementById(`maquette-status-${frm.doc.maquette}`);
                        if (statusElement) {
                            const statusColors = getStatusColors(r.message.status, 'Maquette');
                            statusElement.style.backgroundColor = statusColors.background;
                            statusElement.style.borderColor = statusColors.border;
                            statusElement.style.color = statusColors.text;
                            statusElement.textContent = r.message.status;
                        }
                    }
                }
            });
            
            // Check for newer versions
            frappe.call({
                method: "aurescrm.aures_crm.doctype.etude_faisabilite_flexo.etude_faisabilite_flexo.check_new_maquette_versions",
                args: { article: frm.doc.article },
                callback: function(r) {
                    if (r.message && r.message.newer_versions && r.message.newer_versions.length > 0) {
                        const maquetteCardContent = document.querySelector(`#maquette-card-${frm.doc.maquette} .ef-card-content`);
                        if (maquetteCardContent) {
                            const newVersionsCount = r.message.newer_versions.length;
                            const alertHtml = `
                                <div class="version-notification" style="background: #fff3e0; 
                                     border-left: 3px solid #ff9800; padding: 8px 12px; margin: 10px 0 15px 0; 
                                     font-size: 11px; color: #e65100; display: flex; align-items: center; justify-content: space-between;">
                                    <div style="display: flex; align-items: center;">
                                        <i class="fa fa-exclamation-triangle" style="margin-right: 6px;"></i>
                                        <span>${newVersionsCount} nouvelle${newVersionsCount > 1 ? 's' : ''} version${newVersionsCount > 1 ? 's' : ''} disponible${newVersionsCount > 1 ? 's' : ''}</span>
                                    </div>
                                    <div style="display: flex; gap: 8px;">
                                        <button class="btn btn-xs" style="background: #ff9800; color: white; border: none; padding: 2px 8px;" 
                                                onclick="showVersionSelector('Maquette', '${frm.doc.article}', '${frm.doc.name}'); return false;" title="Voir toutes les versions disponibles">
                                            Voir
                                        </button>
                                        <button class="btn btn-xs" style="background: #ff9800; color: white; border: none; padding: 2px 8px;" 
                                                onclick="showQuickVersionChange('Maquette', '${frm.doc.article}', '${frm.doc.name}'); return false;" title="Changer rapidement de version">
                                            Changer
                                        </button>
                                    </div>
                                </div>
                            `;
                            
                            // Insérer après le premier élément (l'ID et les boutons)
                            const firstItem = maquetteCardContent.querySelector('.ef-item');
                            if (firstItem) {
                                firstItem.insertAdjacentHTML('afterend', alertHtml);
                            } else {
                                maquetteCardContent.insertAdjacentHTML('afterbegin', alertHtml);
                            }
                        }
                    }
                }
            });
        }
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
                display: flex; 
                align-items: center; 
                justify-content: flex-start; 
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
            
            /* Styles pour les notifications de versions */
            .version-notification {
                border-radius: 4px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            
            .version-notification .btn {
                transition: all 0.2s ease;
                font-weight: 500;
            }
            
            .version-notification .btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                background: #f57c00 !important;
            }
            
            /* Responsive pour les notifications */
            @media (max-width: 767px) {
                .version-notification {
                    flex-direction: column;
                    gap: 8px;
                }
                
                .version-notification > div:last-child {
                    justify-content: flex-end;
                }
            }
            
            /* Styles pour les tables de versions */
            .version-table {
                font-size: 11px;
            }
            
            .version-table .current-version {
                background-color: #e8f5e8;
                font-weight: 500;
            }
            
            .version-table .active-indicator {
                color: #28a745;
                font-size: 12px;
                margin-left: 5px;
            }
            
            .version-table .current-indicator {
                color: #007bff;
                font-size: 10px;
                margin-left: 5px;
            }
        </style>
        
        <!-- Bouton Fiche Technique Article placé avant les sections -->
        ${frm.doc.article ? `<div class='ef-specs-btn'>
            <button class='btn btn-primary' onclick="show_flexo_technical_specs('${frm.doc.article}'); return false;">
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
                <div class='ef-card' id='maquette-card-${frm.doc.maquette || 'none'}'>
                    <div class='ef-card-header'>
                        <span class='ef-card-title'>Maquette</span>
                        ${frm.doc.maquette ? `<span id="maquette-status-${frm.doc.maquette}" style="margin-left: 10px; padding: 4px 8px; background-color: #f8f9fa; color: #495057; border: 1px solid #6c757d; border-radius: 8px; font-size: 10px; font-weight: 500;">Chargement...</span>` : ''}
                    </div>
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
                <div class='ef-card' id='cliche-card-${frm.doc.cliche || 'none'}'>
                    <div class='ef-card-header'>
                        <span class='ef-card-title'>Cliché</span>
                        ${frm.doc.cliche ? `<span id="cliche-status-${frm.doc.cliche}" style="margin-left: 10px; padding: 4px 8px; background-color: #f8f9fa; color: #495057; border: 1px solid #6c757d; border-radius: 8px; font-size: 10px; font-weight: 500;">Chargement...</span>` : ''}
                    </div>
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

    // Load status badges after HTML is injected
    loadClicheStatusAndUpdateHTML();
    loadMaquetteStatusAndUpdateHTML();

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
     * First checks if a Trace already exists for the article and links it instead.
     * @param {string} docname - Name of the current Etude Faisabilite Flexo document.
     */
    if (!window.createTrace) {
        window.createTrace = function(docname) {
            var frm = cur_frm; // Get current form instance
            if (!frm.doc.client || !frm.doc.article) {
                frappe.msgprint({ title: __('Prérequis manquants'), message: __('Veuillez remplir les champs Client et Article avant de créer une Trace.'), indicator: 'orange' });
                return;
            }
            
            // First check if a Trace already exists for this article
            frappe.call({
                method: "aurescrm.aures_crm.doctype.etude_faisabilite_flexo.etude_faisabilite_flexo.get_existing_trace_for_article",
                args: { article: frm.doc.article },
                callback: function(r) {
                    if (r.message) {
                        // Trace already exists, link it
                        var existing_trace_id = r.message;
                        frm.set_value("trace", existing_trace_id);
                        
                        frappe.show_alert({
                            message: __('Tracé existant lié automatiquement: {0}', [existing_trace_id]),
                            indicator: 'green'
                        }, 5);
                        
                        // Save the Etude Faisabilite to persist the link, then refresh UI
                        frm.save()
                            .then(() => {
                                load_flexo_linked_docs_html(frm);
                                refresh_attached_files_flexo(frm);
                            })
                            .catch((err) => { console.error("Save failed after linking existing Trace:", err); });
                    } else {
                        // No existing trace, create a new one
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
                    }
                },
                error: function(err) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la vérification du Tracé existant.") + "<br>" + err.message, indicator: 'red' }); }
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
     * First checks if a Plan Flexo already exists for the article and links it instead.
     * @param {string} docname - Name of the current Etude Faisabilite Flexo document.
     */
    if (!window.createPlanFlexo) {
        window.createPlanFlexo = function(docname) {
            var frm = cur_frm;
            if (!frm.doc.client || !frm.doc.article) {
                frappe.msgprint({ title: __('Prérequis manquants'), message: __('Veuillez remplir les champs Client et Article avant de créer un Plan Flexo.'), indicator: 'orange' });
                return;
            }
            
            // First check if a Plan Flexo already exists for this article
            frappe.call({
                method: "aurescrm.aures_crm.doctype.etude_faisabilite_flexo.etude_faisabilite_flexo.get_existing_plan_flexo_for_article",
                args: { article: frm.doc.article },
                callback: function(r) {
                    if (r.message) {
                        // Plan Flexo already exists, link it
                        var existing_plan_id = r.message;
                        frm.set_value("plan_flexo", existing_plan_id);
                        
                        frappe.show_alert({
                            message: __('Plan Flexo existant lié automatiquement: {0}', [existing_plan_id]),
                            indicator: 'green'
                        }, 5);
                        
                        // Save the Etude Faisabilite to persist the link, then refresh UI
                        frm.save()
                            .then(() => {
                                load_flexo_linked_docs_html(frm);
                                refresh_attached_files_flexo(frm);
                            })
                            .catch((err) => { console.error("Save failed after linking existing Plan Flexo:", err); });
                    } else {
                        // No existing plan flexo, create a new one
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
                    }
                },
                error: function(err) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la vérification du Plan Flexo existant.") + "<br>" + err.message, indicator: 'red' }); }
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
     * First checks if a Maquette already exists for the article and links it instead.
     * @param {string} docname - Name of the current Etude Faisabilite Flexo document.
     */
    if (!window.createMaquette) {
        window.createMaquette = function(docname) {
            var frm = cur_frm;
            if (!frm.doc.client || !frm.doc.article) {
                frappe.msgprint({ title: __('Prérequis manquants'), message: __('Veuillez remplir les champs Client et Article avant de créer une Maquette.'), indicator: 'orange' });
                return;
            }
            
            // First check if a Maquette already exists for this article
            frappe.call({
                method: "aurescrm.aures_crm.doctype.etude_faisabilite_flexo.etude_faisabilite_flexo.get_existing_maquette_for_article",
                args: { article: frm.doc.article },
                callback: function(r) {
                    if (r.message) {
                        // Maquette already exists, link it
                        var existing_maquette_id = r.message;
                        frm.set_value("maquette", existing_maquette_id);
                        
                        frappe.show_alert({
                            message: __('Maquette existante liée automatiquement: {0}', [existing_maquette_id]),
                            indicator: 'green'
                        }, 5);
                        
                        // Save the Etude Faisabilite to persist the link, then refresh UI
                        frm.save()
                            .then(() => {
                                load_flexo_linked_docs_html(frm);
                                refresh_attached_files_flexo(frm);
                            })
                            .catch((err) => { console.error("Save failed after linking existing Maquette:", err); });
                    } else {
                        // No existing maquette, create a new one
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
                    }
                },
                error: function(err) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la vérification de la Maquette existante.") + "<br>" + err.message, indicator: 'red' }); }
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
     * First checks if a Cliche already exists for the article and links it instead.
     * @param {string} docname - Name of the current Etude Faisabilite Flexo document.
     */
    if (!window.createCliche) {
        window.createCliche = function(docname) {
            var frm = cur_frm;
            if (!frm.doc.client || !frm.doc.article) {
                frappe.msgprint({ title: __('Prérequis manquants'), message: __('Veuillez remplir les champs Client et Article avant de créer un Cliché.'), indicator: 'orange' });
                return;
            }
            
            // First check if a Cliche already exists for this article
            frappe.call({
                method: "aurescrm.aures_crm.doctype.etude_faisabilite_flexo.etude_faisabilite_flexo.get_existing_cliche_for_article",
                args: { article: frm.doc.article },
                callback: function(r) {
                    if (r.message) {
                        // Cliche already exists, link it
                        var existing_cliche_id = r.message;
                        frm.set_value("cliche", existing_cliche_id);
                        
                        frappe.show_alert({
                            message: __('Cliché existant lié automatiquement: {0}', [existing_cliche_id]),
                            indicator: 'green'
                        }, 5);
                        
                        // Save the Etude Faisabilite to persist the link, then refresh UI
                        frm.save()
                            .then(() => {
                                load_flexo_linked_docs_html(frm);
                                refresh_attached_files_flexo(frm);
                            })
                            .catch((err) => { console.error("Save failed after linking existing Cliche:", err); });
                    } else {
                        // No existing cliche, create a new one
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
                                            { label: __('Laize'), fieldname: 'laize', fieldtype: 'Data', description: __('Laize en mm') },
                                            { label: __('Nombre de Couleurs'), fieldname: 'nbr_couleurs', fieldtype: 'Data', description: __('Nombre de couleurs') },
                                            { label: __('Développement Machine'), fieldname: 'developpement', fieldtype: 'Link', options: 'Developpement', description: __('Sélectionnez le développement machine') },
                                            { label: __('Maquette'), fieldname: 'maquette', fieldtype: 'Link', options: 'Maquette', description: __('Sélectionnez la maquette associée') },
                                            { label: __('Site de Production'), fieldname: 'site_prod', fieldtype: 'Link', options: 'Site Production', description: __('Sélectionnez le site de production') },
                                            { label: __('Hauteur Cliché'), fieldname: 'hauteur_cliche', fieldtype: 'Data', description: __('Hauteur du cliché en mm (pour calcul devis)') }
                                        ],
                                        primary_action_label: __('Enregistrer et Fermer'),
                                        primary_action: function() {
                                            var values = d.get_values();
                                            // Validation optionnelle - on peut créer un cliché sans tous les champs
                                            frappe.call({
                                                method: "frappe.client.set_value",
                                                args: { 
                                                    doctype: "Cliche", 
                                                    name: cliche_id, 
                                                    fieldname: {
                                                        laize: values.laize,
                                                        nbr_couleurs: values.nbr_couleurs,
                                                        developpement: values.developpement,
                                                        maquette: values.maquette,
                                                        site_prod: values.site_prod,
                                                        hauteur_cliche: values.hauteur_cliche
                                                    }
                                                },
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
                    }
                },
                error: function(err) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la vérification du Cliché existant.") + "<br>" + err.message, indicator: 'red' }); }
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
                args: { doctype: "Cliche", fieldname: ["laize", "nbr_couleurs", "developpement", "maquette", "site_prod", "hauteur_cliche"], filters: { name: cliche_id } },
                callback: function(r) {
                    if (r.message) {
                        let current_values = r.message;
                        var d = new frappe.ui.Dialog({
                            title: __('Mettre à jour le document Cliché'),
                            fields: [
                                { fieldtype: 'HTML', fieldname: 'id_section', options: `<div style="display: flex; align-items: center; margin-bottom: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;"><div style="margin-right: 10px; font-weight: bold;">ID:</div><div style="flex-grow: 1; font-family: monospace; padding: 5px; background-color: #fff; border: 1px solid #d1d8dd; border-radius: 3px;">${cliche_id}</div><button class="btn btn-xs btn-default" title="${__('Copier ID')}" onclick="navigator.clipboard.writeText('${cliche_id}'); frappe.show_alert({message: __('ID copié'), indicator: 'green'}, 2); return false;" style="margin-left: 10px;"><i class="fa fa-copy"></i></button></div>`},
                                { label: __('Laize'), fieldname: 'laize', fieldtype: 'Data', default: current_values.laize || "", description: __('Laize en mm') },
                                { label: __('Nombre de Couleurs'), fieldname: 'nbr_couleurs', fieldtype: 'Data', default: current_values.nbr_couleurs || "", description: __('Nombre de couleurs') },
                                { label: __('Développement Machine'), fieldname: 'developpement', fieldtype: 'Link', options: 'Developpement', default: current_values.developpement || "", description: __('Sélectionnez le développement machine') },
                                { label: __('Maquette'), fieldname: 'maquette', fieldtype: 'Link', options: 'Maquette', default: current_values.maquette || "", description: __('Sélectionnez la maquette associée') },
                                { label: __('Site de Production'), fieldname: 'site_prod', fieldtype: 'Link', options: 'Site Production', default: current_values.site_prod || "", description: __('Sélectionnez le site de production') },
                                { label: __('Hauteur Cliché'), fieldname: 'hauteur_cliche', fieldtype: 'Data', default: current_values.hauteur_cliche || "", description: __('Hauteur du cliché en mm (pour calcul devis)') }
                            ],
                            primary_action_label: __('Mettre à jour'),
                            primary_action: function() {
                                var values = d.get_values();
                                frappe.call({
                                    method: "frappe.client.set_value",
                                    args: { 
                                        doctype: "Cliche", 
                                        name: cliche_id, 
                                        fieldname: {
                                            laize: values.laize,
                                            nbr_couleurs: values.nbr_couleurs,
                                            developpement: values.developpement,
                                            maquette: values.maquette,
                                            site_prod: values.site_prod,
                                            hauteur_cliche: values.hauteur_cliche
                                        }
                                    },
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

    // --- Version Selection Functions ---

    /**
     * Affiche un modal avec toutes les versions disponibles pour un doctype
     * @param {string} doctype - Type de document (Cliche ou Maquette)
     * @param {string} article - Article concerné
     * @param {string} etude_id - ID de l'étude de faisabilité
     */
    if (!window.showVersionSelector) {
        window.showVersionSelector = function(doctype, article, etude_id) {
            if (!doctype || !article || !etude_id) {
                frappe.msgprint({ title: __('Erreur'), message: __('Paramètres manquants pour afficher les versions.'), indicator: 'red' });
                return;
            }

            const method = doctype === 'Cliche' ? 
                'aurescrm.aures_crm.doctype.etude_faisabilite_flexo.etude_faisabilite_flexo.get_all_cliche_versions' :
                'aurescrm.aures_crm.doctype.etude_faisabilite_flexo.etude_faisabilite_flexo.get_all_maquette_versions';

            frappe.call({
                method: method,
                args: { article: article },
                callback: function(r) {
                    if (r.message && r.message.length > 0) {
                        const versions = r.message;
                        const currentDocId = doctype === 'Cliche' ? cur_frm.doc.cliche : cur_frm.doc.maquette;
                        
                        // Construire le HTML du modal
                                                 let versionHtml = `
                             <div style="max-height: 400px; overflow-y: auto;">
                                 <table class="table table-bordered version-table" style="margin-bottom: 0;">
                                     <thead>
                                         <tr style="background-color: #f8f9fa;">
                                             <th style="width: 15%;">Version</th>
                                             <th style="width: 20%;">Statut</th>
                                             <th style="width: 25%;">Créé par</th>
                                             <th style="width: 20%;">Date</th>
                                             <th style="width: 20%;">Action</th>
                                         </tr>
                                     </thead>
                                     <tbody>
                         `;

                        versions.forEach(version => {
                            const versionNum = doctype === 'Cliche' ? version.version : version.ver;
                            const isActive = doctype === 'Cliche' ? version.version_active : (version.status === 'Version Activée');
                            const isCurrent = version.name === currentDocId;
                            const statusColors = getStatusColors(version.status, doctype);
                            
                                                         versionHtml += `
                                 <tr class="${isCurrent ? 'current-version' : ''}">
                                     <td>
                                         <strong>V${versionNum}</strong>
                                         ${isActive ? ' <span class="active-indicator">●</span>' : ''}
                                         ${isCurrent ? ' <span class="current-indicator">(Actuelle)</span>' : ''}
                                     </td>
                                    <td>
                                        <span style="padding: 2px 6px; background-color: ${statusColors.background}; color: ${statusColors.text}; border: 1px solid ${statusColors.border}; border-radius: 3px; font-size: 10px;">
                                            ${version.status}
                                        </span>
                                    </td>
                                    <td style="font-size: 11px;">${version.created_by || 'N/A'}</td>
                                    <td style="font-size: 11px;">${frappe.datetime.str_to_user(version.creation)}</td>
                                    <td>
                                        ${!isCurrent ? `
                                            <button class="btn btn-xs btn-primary" onclick="changeVersionFromSelector('${doctype}', '${etude_id}', '${version.name}'); return false;" title="Sélectionner cette version">
                                                <i class="fa fa-check" style="margin-right: 3px;"></i>Sélectionner
                                            </button>
                                        ` : `
                                            <span style="color: #6c757d; font-size: 10px;">Version actuelle</span>
                                        `}
                                    </td>
                                </tr>
                            `;
                            
                            // Ajouter la description si elle existe
                                                         if (version.desc_changements) {
                                 versionHtml += `
                                     <tr class="${isCurrent ? 'current-version' : ''}">
                                         <td colspan="5" style="padding: 5px 15px; font-size: 10px; color: #6c757d; border-top: none;">
                                             <i class="fa fa-info-circle" style="margin-right: 5px;"></i>
                                             ${version.desc_changements}
                                         </td>
                                     </tr>
                                 `;
                             }
                        });

                        versionHtml += `
                                    </tbody>
                                </table>
                            </div>
                        `;

                        const d = new frappe.ui.Dialog({
                            title: __('Versions disponibles - {0}', [doctype]),
                            fields: [
                                {
                                    fieldtype: 'HTML',
                                    fieldname: 'versions_html',
                                    options: versionHtml
                                }
                            ],
                            primary_action_label: __('Fermer'),
                            primary_action: function() {
                                d.hide();
                            }
                        });

                        d.show();
                    } else {
                        frappe.msgprint({ title: __('Aucune version'), message: __('Aucune version trouvée pour cet article.'), indicator: 'blue' });
                    }
                }
            });
        };
    }

    /**
     * Affiche un sélecteur rapide pour changer de version
     * @param {string} doctype - Type de document (Cliche ou Maquette)
     * @param {string} article - Article concerné
     * @param {string} etude_id - ID de l'étude de faisabilité
     */
    if (!window.showQuickVersionChange) {
        window.showQuickVersionChange = function(doctype, article, etude_id) {
            if (!doctype || !article || !etude_id) {
                frappe.msgprint({ title: __('Erreur'), message: __('Paramètres manquants pour changer de version.'), indicator: 'red' });
                return;
            }

            const method = doctype === 'Cliche' ? 
                'aurescrm.aures_crm.doctype.etude_faisabilite_flexo.etude_faisabilite_flexo.get_all_cliche_versions' :
                'aurescrm.aures_crm.doctype.etude_faisabilite_flexo.etude_faisabilite_flexo.get_all_maquette_versions';

            frappe.call({
                method: method,
                args: { article: article },
                callback: function(r) {
                    if (r.message && r.message.length > 0) {
                        const versions = r.message;
                        const currentDocId = doctype === 'Cliche' ? cur_frm.doc.cliche : cur_frm.doc.maquette;
                        
                        // Créer les options pour le sélecteur avec ID réel comme valeur
                        const options = versions.map(version => {
                            const versionNum = doctype === 'Cliche' ? version.version : version.ver;
                            const isActive = doctype === 'Cliche' ? version.version_active : (version.status === 'Version Activée');
                            const isCurrent = version.name === currentDocId;
                            
                            return {
                                value: version.name,
                                label: `V${versionNum} - ${version.status}${isActive ? ' (Active)' : ''}${isCurrent ? ' (Actuelle)' : ''}`
                            };
                        });

                        const d = new frappe.ui.Dialog({
                            title: __('Changer de version - {0}', [doctype]),
                            fields: [
                                {
                                    fieldtype: 'Select',
                                    fieldname: 'selected_version',
                                    label: __('Sélectionner une version'),
                                    options: options,
                                    default: currentDocId,
                                    reqd: 1
                                },
                                {
                                    fieldtype: 'HTML',
                                    fieldname: 'info_html',
                                    options: '<div style="margin-top: 10px; padding: 8px; background-color: #f8f9fa; border-radius: 4px; font-size: 11px; color: #6c757d;"><i class="fa fa-info-circle" style="margin-right: 5px;"></i>Sélectionnez une version différente pour changer le lien dans cette étude de faisabilité.</div>'
                                }
                            ],
                            primary_action_label: __('Changer'),
                            primary_action: function() {
                                const values = d.get_values();
                                if (values.selected_version && values.selected_version !== currentDocId) {
                                    changeVersionFromSelector(doctype, etude_id, values.selected_version);
                                    d.hide();
                                } else {
                                    frappe.msgprint({ title: __('Aucun changement'), message: __('Veuillez sélectionner une version différente.'), indicator: 'orange' });
                                }
                            }
                        });

                        d.show();
                    } else {
                        frappe.msgprint({ title: __('Aucune version'), message: __('Aucune version trouvée pour cet article.'), indicator: 'blue' });
                    }
                }
            });
        };
    }

    /**
     * Change la version sélectionnée depuis le sélecteur
     * @param {string} doctype - Type de document (Cliche ou Maquette)
     * @param {string} etude_id - ID de l'étude de faisabilité
     * @param {string} new_doc_id - ID du nouveau document à lier
     */
    if (!window.changeVersionFromSelector) {
        window.changeVersionFromSelector = function(doctype, etude_id, new_doc_id) {
            if (!doctype || !etude_id || !new_doc_id) {
                frappe.msgprint({ title: __('Erreur'), message: __('Paramètres manquants pour changer de version.'), indicator: 'red' });
                return;
            }

            const method = doctype === 'Cliche' ? 
                'aurescrm.aures_crm.doctype.etude_faisabilite_flexo.etude_faisabilite_flexo.change_cliche_version' :
                'aurescrm.aures_crm.doctype.etude_faisabilite_flexo.etude_faisabilite_flexo.change_maquette_version';

            frappe.confirm(
                __('Êtes-vous sûr de vouloir changer vers cette version ?'),
                function() {
                    frappe.call({
                        method: method,
                        args: { 
                            etude_id: etude_id, 
                            new_cliche_id: doctype === 'Cliche' ? new_doc_id : undefined,
                            new_maquette_id: doctype === 'Maquette' ? new_doc_id : undefined
                        },
                        freeze: true,
                        freeze_message: __('Changement de version...'),
                        callback: function(r) {
                            if (r.message && r.message.success) {
                                frappe.show_alert({
                                    message: r.message.message,
                                    indicator: 'green'
                                }, 5);
                                
                                // Rafraîchir le formulaire
                                cur_frm.reload_doc();
                                
                                // Recharger le HTML pour mettre à jour les données
                                setTimeout(() => {
                                    load_flexo_linked_docs_html(cur_frm);
                                }, 500);
                                
                                // Fermer tous les dialogs ouverts
                                $('.modal').modal('hide');
                            } else {
                                frappe.msgprint({ title: __('Erreur'), message: __('Erreur lors du changement de version.'), indicator: 'red' });
                            }
                        },
                        error: function(err) {
                            frappe.msgprint({ title: __('Erreur Serveur'), message: err.message || __('Erreur serveur lors du changement de version.'), indicator: 'red' });
                        }
                    });
                }
            );
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