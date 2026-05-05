/**
 * Client Script for Etude Faisabilite Doctype
 * Handles dynamic filters, HTML field updates with Trace/Imposition links and actions (Create/Update/Open). // <-- Updated comment
 */

frappe.ui.form.on('Etude Faisabilite', {
    refresh: function(frm) {
        set_filters(frm);
        load_trace_imposition_links(frm);
        refresh_attached_files(frm);
        load_machine_panel(frm, true);
    },

    client: function(frm) {
        set_filters(frm);
    },

    article: function(frm) {
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
        set_filters(frm);
        load_trace_imposition_links(frm);
        refresh_attached_files(frm);
        load_machine_panel(frm, true);
    },

    quantite: function(frm) {
        load_machine_panel(frm, false);
    },

    machine_prevue: function(frm) {
        set_filters(frm);
        load_machine_panel(frm, true);
    },

    status: function(frm) {
        load_trace_imposition_links(frm);
    }
});

/**
 * Sets dynamic query filters for link fields (Article, Trace, Imposition).
 * @param {object} frm - The current form object.
 */
function set_filters(frm) {
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

    frm.set_query("machine_prevue", function() {
        var filters = {
            status: ['!=', 'Désactivé'],
            type_equipement: 'Presse Offset'
        };
        if (frm.doc.procede) {
            filters.procede = frm.doc.procede;
        }
        return { filters: filters };
    });

    frm.fields_dict.imposition.get_query = function(doc) {
        if (!doc.article || !doc.trace) {
             frappe.throw(__("Veuillez d'abord sélectionner un Article et un Tracé."));
        }
        var filters = {
            article: doc.article,
            trace: doc.trace
        };
        if (doc.machine_prevue) {
            return {
                query: 'aurescrm.aures_crm.doctype.etude_faisabilite.etude_faisabilite.get_compatible_impositions',
                filters: {
                    article: doc.article,
                    trace: doc.trace,
                    machine: doc.machine_prevue
                }
            };
        }
        return { filters: filters };
    };
    frm.set_query("imposition");
}

function _ef_esc(s) {
    return frappe.utils.escape_html(s == null ? '' : String(s));
}

/** Classes `indicator-pill` alignées sur les états du DocType Machine. */
function _ef_machine_status_pill_class(status) {
    return (
        {
            Operationnelle: 'green',
            'En Maintenance': 'orange',
            'En Panne': 'red',
            'Hors Service': 'gray',
            Désactivé: 'gray',
        }[status] || 'gray'
    );
}

/** Style bouton primaire noir (hors thème couleur accent). */
var AURES_BTN_PRIMARY_BLACK_STYLE =
    'background:#1f1f1f !important;border-color:#1f1f1f !important;color:#fff !important;';

/** Styles minimalistes partagés (fiche + liste de choix). */
var AURES_MACHINE_CARD_CSS =
    '<style>' +
    '.aures-mui{--line:rgba(15,23,42,.08);--muted:#6b7280;--txt:#111827;--surface:#fafbfc;--surface-2:#f4f6f8}' +
    '.aures-mcard{background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:0 1px 2px rgba(15,23,42,.04);overflow:hidden}' +
    '.aures-mcard-h{padding:14px 16px 12px;border-bottom:1px solid var(--line);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}' +
    '.aures-mcard-h-main{min-width:0;flex:1}' +
    '.aures-mcard-title-row{display:flex;align-items:center;justify-content:flex-start;gap:10px;flex-wrap:wrap}' +
    '.aures-mcard-title{margin:0;font-size:1.08rem;font-weight:600;color:var(--txt);letter-spacing:-.02em;line-height:1.25;flex:0 1 auto;min-width:0;max-width:100%}' +
    '.aures-mcard-title-row .indicator-pill{flex-shrink:0}' +
    '.aures-mcard-sub{margin-top:6px;font-size:12px;color:var(--muted);line-height:1.45}' +
    '.aures-mcard-id{margin-top:4px;font-size:12px;color:var(--muted)}' +
    '.aures-mcard-id a{color:var(--muted);text-decoration:none}' +
    '.aures-mcard-id a:hover{color:var(--link-color);text-decoration:underline}' +
    '.aures-mcard-b{padding:12px 14px 14px;display:grid;grid-template-columns:minmax(104px,124px) 1fr;gap:14px;align-items:start}' +
    '@media(max-width:520px){.aures-mcard-b{grid-template-columns:1fr}}' +
    '.aures-mcard-img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;background:var(--surface-2);border:1px solid var(--line)}' +
    '.aures-mcard-ph{display:flex;align-items:center;justify-content:center;color:#cbd5e1;font-size:30px}' +
    '.aures-mcard-al{display:flex;align-items:center;margin-top:10px;padding:10px 12px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;color:#7f1d1d;font-size:12px;line-height:1.45;min-height:40px;box-sizing:border-box}' +
    '.aures-mcard-al ul{margin:0;padding:0 0 0 18px;list-style-position:outside;flex:1;min-width:0}' +
    '.aures-mcard-al li{margin:0;padding:2px 0}' +
    '.aures-mcard-specg{display:grid;grid-template-columns:repeat(auto-fill,minmax(152px,1fr));gap:6px 10px}' +
    '.aures-mcard-spec{font-size:11px;line-height:1.25}' +
    '.aures-mcard-spec-k{display:block;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:1px}' +
    '.aures-mcard-spec-v{color:var(--txt);font-weight:500}' +
    '.aures-mcard-cta{flex-shrink:0;display:flex;align-items:flex-start;justify-content:flex-end}' +
    '.aures-mcard-media{min-width:0}' +
    '.aures-mcard-main{min-width:0}' +
    '.aures-mpick{display:flex;gap:14px;align-items:stretch;padding:14px 16px;margin-bottom:12px;border:1px solid var(--line);border-radius:14px;background:var(--surface);transition:border-color .15s ease,box-shadow .15s ease}' +
    '.aures-mpick:hover{border-color:rgba(15,23,42,.14);box-shadow:0 2px 10px rgba(15,23,42,.06)}' +
    '.aures-mpick--on{border-color:var(--primary);box-shadow:0 0 0 1px var(--primary)}' +
    '.aures-mpick-med{flex:0 0 88px;width:88px;min-width:88px;min-height:88px;flex-shrink:0;overflow:hidden;border-radius:10px}' +
    '.aures-mpick-img{display:block;width:100%;height:88px;min-height:88px;object-fit:cover;border-radius:10px;background:var(--surface-2);border:1px solid var(--line)}' +
    '.aures-mpick-med .aures-mcard-ph{height:88px;border-radius:10px;border:1px solid var(--line)}' +
    '.aures-mpick-bd{flex:1;min-width:0;font-size:13px}' +
    '.aures-mpick-top{display:flex;justify-content:flex-start;align-items:center;gap:10px;flex-wrap:wrap;row-gap:6px}' +
    '.aures-mpick-top .aures-mpick-t{margin-bottom:0}' +
    '.aures-mpick-top .indicator-pill{flex-shrink:0}' +
    '.aures-mpick-t{font-weight:600;color:var(--txt);margin:0 0 4px;line-height:1.3;font-size:14px;flex:0 1 auto;min-width:0;max-width:100%}' +
    '.aures-mpick-sub{margin-top:6px;font-size:12px;color:var(--muted);line-height:1.45}' +
    '.aures-mpick-ch{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px}' +
    '.aures-mpick-chip{font-size:11px;padding:3px 8px;border-radius:999px;background:rgba(15,23,42,.05);color:var(--muted);font-weight:500}' +
    '.aures-mpick-ct{flex:0 0 auto;align-self:center}' +
    '</style>';

/** URL utilisable en src pour fichiers / chemins Attach (y compris URL absolue renvoyée par le serveur). */
function _ef_resolve_machine_image_src(imagePath) {
    var p = imagePath == null ? '' : String(imagePath).trim();
    if (!p) {
        return '';
    }
    if (p.indexOf('http://') === 0 || p.indexOf('https://') === 0) {
        return p;
    }
    var normalized = frappe.utils.get_file_link(p);
    return frappe.urllib.get_full_url(normalized);
}

function _ef_machine_image_html(imagePath, alt, variant) {
    var imgCls = variant === 'pick' ? 'aures-mpick-img' : 'aures-mcard-img';
    var src = _ef_resolve_machine_image_src(imagePath);
    if (src) {
        var lazyAttr = variant === 'pick' ? '' : ' loading="lazy"';
        return (
            '<img class="' +
            imgCls +
            '" src="' +
            _ef_esc(src) +
            '" alt="' +
            _ef_esc(alt || '') +
            '"' +
            lazyAttr +
            ' />'
        );
    }
    return (
        '<div class="' +
        imgCls +
        ' aures-mcard-ph" aria-hidden="true"><span class="fa fa-cubes"></span></div>'
    );
}

/** True si l'utilisateur peut enregistrer un nouveau choix de machine sur ce document. */
function _ef_can_pick_machine(frm) {
    if (frm.read_only) {
        return false;
    }
    if (typeof frm.has_perm === 'function' && !frm.has_perm('write')) {
        return false;
    }
    return true;
}

/** Bouton toujours visible ; désactivé si modification interdite (workflow, droits, etc.). */
function machine_panel_btn_select_html(frm) {
    var can = _ef_can_pick_machine(frm);
    var cls = can ? 'btn btn-primary btn-sm' : 'btn btn-default btn-sm';
    var extra = can ? '' : ' disabled title="' + _ef_esc(__('Modification non autorisée')) + '"';
    var st = can ? ' style="' + AURES_BTN_PRIMARY_BLACK_STYLE + '"' : '';
    return (
        '<button type="button" class="' +
        cls +
        ' aures-btn-select-machine"' +
        st +
        extra +
        '>' +
        _ef_esc(__('Sélectionner Machine')) +
        '</button>'
    );
}

function bind_machine_panel_select_button(frm) {
    var html_field = frm.fields_dict.html_machine || (frm.get_field && frm.get_field('html_machine'));
    if (!html_field || !html_field.$wrapper) {
        return;
    }
    html_field.$wrapper.off('click.auresSelectMachine').on('click.auresSelectMachine', '.aures-btn-select-machine', function (ev) {
        ev.preventDefault();
        if ($(this).prop('disabled')) {
            return;
        }
        if (!_ef_can_pick_machine(frm)) {
            frappe.msgprint({
                title: __('Action impossible'),
                message: __('Vous ne pouvez pas modifier la machine sur ce document.'),
                indicator: 'orange',
            });
            return;
        }
        show_machine_picker_dialog(frm);
    });
}

function show_machine_picker_dialog(frm) {
    if (!_ef_can_pick_machine(frm)) {
        frappe.msgprint({
            title: __('Action impossible'),
            message: __('Vous ne pouvez pas modifier la machine sur ce document.'),
            indicator: 'orange',
        });
        return;
    }
    var d = new frappe.ui.Dialog({
        title: __('Choisir une machine'),
        size: 'large',
        fields: [
            {
                fieldtype: 'HTML',
                fieldname: 'machine_list',
                options: '<p class="text-muted">' + _ef_esc(__('Chargement…')) + '</p>',
            },
        ],
    });
    d.show();
    frappe.call({
        method: 'aurescrm.aures_crm.doctype.etude_faisabilite.etude_faisabilite.get_machines_for_etude_selection',
        args: { procede: frm.doc.procede || '' },
        callback: function (r) {
            var list = r.message || [];
            var w = d.fields_dict.machine_list.$wrapper;

            function bind_dialog_machine_actions() {
                w.off('click.auresDlg').on('click.auresDlg', '.aures-pick-machine-row', function () {
                    var mn = $(this).attr('data-machine');
                    if (!mn) {
                        return;
                    }
                    if (frm.doc.machine_prevue !== mn) {
                        frm.set_value('machine_prevue', mn);
                    }
                    d.hide();
                    load_machine_panel(frm, true);
                });
                w.off('click.auresDlgClear').on('click.auresDlgClear', '.aures-clear-machine', function () {
                    if (frm.doc.machine_prevue) {
                        frm.set_value('machine_prevue', '');
                    }
                    d.hide();
                    load_machine_panel(frm, true);
                });
            }

            var footer =
                '<div class="aures-machine-dialog-footer" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-color);text-align:center;">' +
                '<button type="button" class="btn btn-default btn-sm aures-clear-machine">' +
                _ef_esc(__('Aucune')) +
                '</button>' +
                '</div>';

            if (!list.length) {
                w.html(
                    '<p class="text-muted">' +
                        _ef_esc(__('Aucune machine ne correspond aux critères.')) +
                        '</p>' +
                        footer
                );
                bind_dialog_machine_actions();
                return;
            }
            var current = frm.doc.machine_prevue || '';
            var scrollHint =
                list.length > 8
                    ? '<p class="text-muted" style="font-size:12px;margin:0 0 8px 0;">' +
                      _ef_esc(__('Liste longue : faites défiler pour voir toutes les machines.')) +
                      '</p>'
                    : '';
            var blocks = [
                AURES_MACHINE_CARD_CSS,
                scrollHint,
                '<div class="aures-machine-dialog-scroll aures-mui" style="max-height:min(55vh,520px);overflow-y:auto;overflow-x:hidden;padding:4px 8px 8px 0;scrollbar-gutter:stable;">',
            ];
            list.forEach(function (mc) {
                var is_current = current && mc.name === current;
                var statut = mc.status || '';
                var pill_class = _ef_machine_status_pill_class(statut);
                var title = mc.nom || mc.name;
                var mm = [mc.marque, mc.modele].filter(Boolean).join(' ');
                var proc = [mc.procede, mc.type_presse].filter(Boolean).join(' · ');
                var sub1 = [mc.type_equipement, mm].filter(Boolean).join(' · ');
                var sub2 = proc;
                var chips = [];
                if (mc.format_max_laize && mc.format_max_developpement) {
                    chips.push(
                        __('Format max') +
                            ' ' +
                            mc.format_max_laize +
                            '×' +
                            mc.format_max_developpement
                    );
                }
                if (mc.vitesse_max) {
                    chips.push(__('Vitesse') + ' ' + mc.vitesse_max + ' u/h');
                }
                if (mc.min_qt) {
                    chips.push(__('Min') + ' ' + mc.min_qt);
                }
                if (mc.site_production) {
                    chips.push(mc.site_production);
                }
                var chipsHtml = chips
                    .map(function (c) {
                        return '<span class="aures-mpick-chip">' + _ef_esc(c) + '</span>';
                    })
                    .join('');
                var btn =
                    '<button type="button" class="btn btn-default btn-sm" disabled>' +
                    _ef_esc(__('Machine actuelle')) +
                    '</button>';
                if (!is_current) {
                    btn =
                        '<button type="button" class="btn btn-primary btn-sm aures-pick-machine-row" style="' +
                        AURES_BTN_PRIMARY_BLACK_STYLE +
                        '" data-machine="' +
                        _ef_esc(mc.name) +
                        '">' +
                        _ef_esc(__('Sélectionner')) +
                        '</button>';
                }
                var subHtml =
                    '<div class="aures-mpick-sub">' +
                    (sub1 ? _ef_esc(sub1) : '') +
                    (sub1 && sub2 ? '<br>' : '') +
                    (sub2 ? _ef_esc(sub2) : '') +
                    '<span style="opacity:.75;">' +
                    (sub1 || sub2 ? ' · ' : '') +
                    _ef_esc(mc.name) +
                    '</span></div>';
                blocks.push(
                    '<div class="aures-mpick' +
                        (is_current ? ' aures-mpick--on' : '') +
                        '">' +
                        '<div class="aures-mpick-med">' +
                        _ef_machine_image_html(mc.image_href || mc.image, title, 'pick') +
                        '</div>' +
                        '<div class="aures-mpick-bd">' +
                        '<div class="aures-mpick-top">' +
                        '<div class="aures-mpick-t">' +
                        _ef_esc(title) +
                        '</div>' +
                        (statut
                            ? '<span class="indicator-pill ' + pill_class + '">' + _ef_esc(statut) + '</span>'
                            : '') +
                        '</div>' +
                        subHtml +
                        (chipsHtml ? '<div class="aures-mpick-ch">' + chipsHtml + '</div>' : '') +
                        '</div>' +
                        '<div class="aures-mpick-ct">' +
                        btn +
                        '</div></div>'
                );
            });
            blocks.push('</div>');
            blocks.push(footer);
            w.html(blocks.join(''));
            bind_dialog_machine_actions();
        },
    });
}

/**
 * Affiche dans html_machine les infos machine utiles à l'étude + alertes (formats, min. feuilles).
 * Met à jour les champs masqués statut_machine_prevue et format_machine (skip_dirty : dérivés du lien machine).
 * @param {boolean} [immediate=true] — si false, différé (saisie quantité).
 */
function load_machine_panel(frm, immediate) {
    var run = function () {
        var html_field = frm.fields_dict.html_machine || (frm.get_field && frm.get_field('html_machine'));
        if (!html_field || !html_field.$wrapper) {
            return;
        }

        if (!frm.doc.machine_prevue) {
            frm.set_value('statut_machine_prevue', '', undefined, true);
            frm.set_value('format_machine', '', undefined, true);
            var btn0 = machine_panel_btn_select_html(frm);
            html_field.$wrapper.html(
                '<div style="padding:8px 0;">' +
                    '<p class="text-muted small" style="margin-bottom:10px;">' +
                    _ef_esc(__('Sélectionnez une machine pour afficher le détail et les contrôles.')) +
                    '</p>' +
                    '<div>' +
                    btn0 +
                    '</div>' +
                    '</div>'
            );
            bind_machine_panel_select_button(frm);
            return;
        }

        var machine_fields = [
            'nom',
            'image',
            'type_equipement',
            'marque',
            'modele',
            'status',
            'procede',
            'type_presse',
            'min_qt',
            'format_max_laize',
            'format_max_developpement',
            'format_min_laize',
            'format_min_developpement',
            'vitesse_max',
            'temps_calage',
            'nb_couleurs_recto',
            'nb_couleurs_verso',
            'gache_calage',
            'site_production',
            'retiration'
        ];

        frappe.call({
            method: 'frappe.client.get_value',
            args: {
                doctype: 'Machine',
                filters: { name: frm.doc.machine_prevue },
                fieldname: machine_fields
            },
            callback: function (r) {
                if (!r.message) {
                    var btnErr = machine_panel_btn_select_html(frm);
                    html_field.$wrapper.html(
                        '<div class="text-danger small">' +
                            _ef_esc(__('Machine introuvable.')) +
                            '</div>' +
                            '<div style="margin-top:10px;">' +
                            btnErr +
                            '</div>'
                    );
                    bind_machine_panel_select_button(frm);
                    return;
                }
                var m = r.message;

                frm.set_value('statut_machine_prevue', m.status || '', undefined, true);
                var fmt_machine = '';
                if (m.format_max_laize && m.format_max_developpement) {
                    fmt_machine = String(m.format_max_laize) + 'x' + String(m.format_max_developpement);
                }
                frm.set_value('format_machine', fmt_machine, undefined, true);

                var finish = function (imp) {
                    var alerts = [];

                    if (imp && m) {
                        if (
                            imp.format_laize &&
                            m.format_max_laize &&
                            parseFloat(imp.format_laize) > parseFloat(m.format_max_laize)
                        ) {
                            alerts.push(
                                __(
                                    "La laize de l'imposition ({0} mm) dépasse le format max machine ({1} mm).",
                                    [imp.format_laize, m.format_max_laize]
                                )
                            );
                        }
                        if (
                            imp.format_developpement &&
                            m.format_max_developpement &&
                            parseFloat(imp.format_developpement) > parseFloat(m.format_max_developpement)
                        ) {
                            alerts.push(
                                __(
                                    "Le développement de l'imposition ({0} mm) dépasse le format max machine ({1} mm).",
                                    [imp.format_developpement, m.format_max_developpement]
                                )
                            );
                        }
                        var min_qt = m.min_qt != null ? parseFloat(m.min_qt) : 0;
                        var nbr_poses = imp.nbr_poses != null ? parseFloat(imp.nbr_poses) : 0;
                        var q = frm.doc.quantite != null ? parseFloat(frm.doc.quantite) : 0;
                        if (min_qt > 0 && nbr_poses > 0 && q > 0) {
                            var nbr_feuilles_calc = Math.ceil(q / nbr_poses);
                            if (nbr_feuilles_calc > 0 && nbr_feuilles_calc < min_qt) {
                                alerts.push(
                                    __(
                                        'Nombre de feuilles ({0}) sous le minimum machine ({1} feuilles).',
                                        [nbr_feuilles_calc, min_qt]
                                    )
                                );
                            }
                        }
                    }

                    var statut = m.status || '';
                    var pill_class = _ef_machine_status_pill_class(statut);

                    var specs = [];
                    function addSpec(label, val) {
                        if (val === null || val === undefined || val === '') {
                            return;
                        }
                        specs.push({
                            k: label,
                            v: val,
                        });
                    }

                    addSpec(__("Type d'équipement"), m.type_equipement);
                    addSpec(__('Marque'), m.marque);
                    addSpec(__('Modèle'), m.modele);
                    addSpec(__('Site de production'), m.site_production);

                    if (m.format_max_laize && m.format_max_developpement) {
                        addSpec(
                            __('Format max (laize × développement)'),
                            m.format_max_laize + ' × ' + m.format_max_developpement + ' mm'
                        );
                    }
                    if (m.format_min_laize && m.format_min_developpement) {
                        addSpec(
                            __('Format min (laize × développement)'),
                            m.format_min_laize + ' × ' + m.format_min_developpement + ' mm'
                        );
                    }

                    if (m.type_equipement === 'Presse Offset') {
                        addSpec(__('Procédé'), m.procede);
                        addSpec(__('Type de presse'), m.type_presse);
                        addSpec(__('Couleurs recto'), m.nb_couleurs_recto);
                        addSpec(__('Couleurs verso'), m.nb_couleurs_verso);
                        addSpec(__('Gâche calage (feuilles)'), m.gache_calage);
                        if (m.retiration) {
                            addSpec(__('Rétiration'), __('Oui'));
                        }
                    }

                    addSpec(__('Vitesse max (u/h)'), m.vitesse_max);
                    addSpec(__('Temps de calage (min)'), m.temps_calage);
                    if (m.min_qt) {
                        addSpec(__('Quantité minimale (feuilles)'), m.min_qt);
                    }

                    if (frm.doc.nbr_feuilles != null && frm.doc.nbr_feuilles !== '') {
                        addSpec(__('Nombre de feuilles (étude)'), frm.doc.nbr_feuilles);
                    }
                    if (imp && imp.nbr_poses != null && imp.nbr_poses !== '') {
                        addSpec(__('Poses par feuille (imposition)'), imp.nbr_poses);
                    }

                    var specsHtml = specs
                        .map(function (s) {
                            return (
                                '<div class="aures-mcard-spec">' +
                                '<span class="aures-mcard-spec-k">' +
                                _ef_esc(s.k) +
                                '</span>' +
                                '<span class="aures-mcard-spec-v">' +
                                _ef_esc(s.v) +
                                '</span>' +
                                '</div>'
                            );
                        })
                        .join('');

                    var alert_block = '';
                    if (alerts.length) {
                        alert_block = '<div class="aures-mcard-al"><ul>';
                        alerts.forEach(function (t) {
                            alert_block += '<li>' + _ef_esc(t) + '</li>';
                        });
                        alert_block += '</ul></div>';
                    }

                    var route = frappe.utils.get_form_link('Machine', frm.doc.machine_prevue);
                    var btnHdr = machine_panel_btn_select_html(frm);
                    var title = m.nom || frm.doc.machine_prevue;
                    var subParts = [m.type_equipement, [m.marque, m.modele].filter(Boolean).join(' ')].filter(
                        Boolean
                    );
                    var sub = subParts.join(' · ');
                    var docName = String(frm.doc.machine_prevue || '').trim();
                    var titleTrim = String(title || '').trim();
                    var idLine =
                        '<div class="aures-mcard-id">' +
                        '<a href="' +
                        _ef_esc(route) +
                        '">' +
                        _ef_esc(docName === titleTrim ? __('Voir la fiche') : frm.doc.machine_prevue) +
                        '</a></div>';
                    var html =
                        AURES_MACHINE_CARD_CSS +
                        '<div class="aures-mui aures-mcard">' +
                        '<header class="aures-mcard-h">' +
                        '<div class="aures-mcard-h-main">' +
                        '<div class="aures-mcard-title-row">' +
                        '<h3 class="aures-mcard-title">' +
                        _ef_esc(title) +
                        '</h3>' +
                        '<span class="indicator-pill ' +
                        pill_class +
                        '">' +
                        _ef_esc(statut || '—') +
                        '</span></div>' +
                        (sub
                            ? '<div class="aures-mcard-sub">' + _ef_esc(sub) + '</div>'
                            : '') +
                        idLine +
                        alert_block +
                        '</div>' +
                        '<div class="aures-mcard-cta">' +
                        btnHdr +
                        '</div></header>' +
                        '<div class="aures-mcard-b">' +
                        '<div class="aures-mcard-media">' +
                        _ef_machine_image_html(m.image, title, 'detail') +
                        '</div>' +
                        '<div class="aures-mcard-main">' +
                        '<div class="aures-mcard-specg">' +
                        specsHtml +
                        '</div></div></div></div>';

                    html_field.$wrapper.html(html);
                    bind_machine_panel_select_button(frm);
                };

                if (frm.doc.imposition) {
                    frappe.call({
                        method: 'frappe.client.get_value',
                        args: {
                            doctype: 'Imposition',
                            filters: { name: frm.doc.imposition },
                            fieldname: ['format_laize', 'format_developpement', 'nbr_poses']
                        },
                        callback: function (r2) {
                            finish(r2.message || null);
                        }
                    });
                } else {
                    finish(null);
                }
            }
        });
    };

    if (immediate === false) {
        if (frm._aures_machine_panel_timer) {
            clearTimeout(frm._aures_machine_panel_timer);
        }
        frm._aures_machine_panel_timer = setTimeout(run, 450);
        return;
    }
    run();
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
                    <div class="ef-trace-cotations-warning-slot" style="margin-top: 8px;"></div>
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
                        ${frm.doc.status === "En étude" && frm.doc.trace ? `<button class='btn btn-xs btn-primary' onclick="changeImposition('${frm.docname}'); return false;" title="${__('Changer l\'imposition sélectionnée')}">Changer d'imposition</button>` : ''}
                    </div>
                 </div>`;
    } else {
        html += `<p style='font-size: 11px; color: var(--text-muted);'>Aucune imposition liée.</p>`;
        // Show "Create/Select Imposition" button only if status allows, trace exists, and imposition doesn't
        if (frm.doc.status === "En étude" && frm.doc.trace && !frm.doc.imposition) {
            html += `<div class='ef-create-btn'>
                        <button class='btn btn-xs btn-primary' onclick="createImposition('${frm.docname}'); return false;">Créer/Sélectionner Imposition</button>
                     </div>`;
        } else if (frm.doc.status === "En étude" && !frm.doc.trace) {
            html += `<p style='font-size: 11px; color: var(--text-muted);'>Créez ou liez un Tracé pour créer une Imposition.</p>`;
        }
    }
    html += `</div></div></div>`; // End Imposition section

    html += `</div>`; // End ef-container
    html += `</div>`; // End outer div
    html_field.$wrapper.html(html); // Inject HTML

    if (frm.doc.trace && frm.doc.article) {
        frappe.call({
            method: "aurescrm.item_cotations.trace_cotations_differ_from_item",
            args: { trace_name: frm.doc.trace, article: frm.doc.article },
            callback: function (rw) {
                const slot = html_field.$wrapper.find(".ef-trace-cotations-warning-slot");
                if (!slot.length) {
                    return;
                }
                if (rw.message && rw.message.show_warning) {
                    slot.html(
                        `<div style="color: #c0392b; font-size: 12px; line-height: 1.35;">${__(
                            "Les cotations de l'article ont été modifiées sur la fiche Article et ne correspondent plus aux dimensions enregistrées sur ce tracé."
                        )}</div>`
                    );
                } else {
                    slot.empty();
                }
            },
        });
    }

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

                        frappe.call({
                            method: "frappe.client.get_value",
                            args: {
                                doctype: "Item",
                                filters: { name: frm.doc.article },
                                fieldname: "custom_cotations_article"
                            },
                            callback: function(rv) {
                                var defaultDims = "";
                                if (rv.message && rv.message.custom_cotations_article) {
                                    defaultDims = rv.message.custom_cotations_article;
                                }

                                var d = new frappe.ui.Dialog({
                                    title: __('Compléter les informations de la Trace'),
                                    fields: [
                                        { fieldtype: 'HTML', fieldname: 'id_section', options: `<div style="display: flex; align-items: center; margin-bottom: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;"><div style="margin-right: 10px; font-weight: bold;">ID:</div><div style="flex-grow: 1; font-family: monospace; padding: 5px; background-color: #fff; border: 1px solid #d1d8dd; border-radius: 3px;">${trace_id}</div><button class="btn btn-xs btn-default" title="${__('Copier ID')}" onclick="navigator.clipboard.writeText('${trace_id}'); frappe.show_alert({message: __('ID copié'), indicator: 'green'}, 2); return false;" style="margin-left: 10px;"><i class="fa fa-copy"></i></button></div>`},
                                        { label: __('Dimensions'), fieldname: 'dimensions', fieldtype: 'Data', reqd: 1, default: defaultDims, description: __('Même format que les cotations article : 56×280 ou 56,3×280 ; 80×35×118 ; séparateur x ou × ; décimales . ou , ; sans mm.') },
                                        { label: __('Points colle'), fieldname: 'points_colle', fieldtype: 'Int', description: __('Nombre de points de colle') },
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
                                            args: { doctype: "Trace", name: trace_id, fieldname: { dimensions: values.dimensions, points_colle: values.points_colle, fichier_trace: values.fichier_trace } },
                                            freeze: true, freeze_message: __("Mise à jour de la Trace..."),
                                            callback: function(r_update) {
                                                if (r_update.message) {
                                                    frappe.call({
                                                        method: "aurescrm.item_cotations.sync_item_cotations_from_trace",
                                                        args: {
                                                            article: frm.doc.article,
                                                            dimensions: values.dimensions
                                                        },
                                                        callback: function(r_item) {
                                                            if (r_item.exc) {
                                                                frappe.msgprint({ title: __('Cotations article'), message: __("Impossible de synchroniser les dimensions vers l'article. Vérifiez le format (ex. 56×280, 56,3×280, 80×35×118 ; x ou × ; . ou ,)."), indicator: 'red' });
                                                                return;
                                                            }
                                                            // Synchroniser les points de colle vers l'Etude Faisabilite
                                                            frappe.call({
                                                                method: "aurescrm.aures_crm.doctype.trace.trace.sync_points_colle_to_etude",
                                                                args: {
                                                                    trace_name: trace_id,
                                                                    etude_faisabilite_name: frm.doc.name
                                                                },
                                                                callback: function(r_sync) {
                                                                    if (r_sync.message && r_sync.message.success) {
                                                                        // Mettre à jour le champ local points_colle
                                                                        frm.set_value('points_colle', r_sync.message.points_colle);
                                                                    }
                                                                    frappe.show_alert({message:__('Trace créée et mise à jour avec succès.'), indicator:'green'}, 5);
                                                                    d.hide();
                                                                    // Save the Etude Faisabilite to persist the link and points_colle, then refresh UI
                                                                    frm.save()
                                                                        .then(() => {
                                                                            load_trace_imposition_links(frm);
                                                                            refresh_attached_files(frm);
                                                                        })
                                                                        .catch((err) => { console.error("Save failed after linking existing Trace:", err); });
                                                                }
                                                            });
                                                        },
                                                        error: function() {
                                                            frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur lors de la synchronisation des cotations vers l'article."), indicator: 'red' });
                                                        }
                                                    });
                                                } else { frappe.msgprint({ title: __('Erreur'), message: __("Erreur lors de la mise à jour de la Trace."), indicator: 'red' }); }
                                            },
                                            error: function(err_update) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la mise à jour de la Trace.") + "<br>" + err_update.message, indicator: 'red' });}
                                        });
                                    }
                                });
                                style_dialog_primary_button(d); // Apply default styling (no-op now)
                                d.show();
                            },
                            error: function() {
                                frappe.msgprint({ title: __('Erreur'), message: __("Impossible de charger les cotations de l'article."), indicator: 'red' });
                            }
                        });
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
                args: { doctype: "Trace", fieldname: ["dimensions", "points_colle", "fichier_trace"], filters: { name: trace_id } },
                callback: function(r) {
                    if (r.message) {
                        let current_values = r.message;
                        frappe.call({
                            method: "aurescrm.item_cotations.trace_cotations_differ_from_item",
                            args: { trace_name: trace_id, article: frm.doc.article },
                            callback: function (rw) {
                                const showWarn = rw.message && rw.message.show_warning;
                                const mismatchHtml =
                                    '<p style="color:#c0392b;font-size:12px;line-height:1.35;margin-bottom:10px;margin-top:-4px;">' +
                                    __(
                                        "Les cotations de l'article ont été modifiées sur la fiche Article et ne correspondent plus aux dimensions enregistrées sur ce tracé. Vérifiez le champ Dimensions avant d'enregistrer."
                                    ) +
                                    "</p>";
                                var fields = [
                                    {
                                        fieldtype: "HTML",
                                        fieldname: "id_section",
                                        options: `<div style="display: flex; align-items: center; margin-bottom: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;"><div style="margin-right: 10px; font-weight: bold;">ID:</div><div style="flex-grow: 1; font-family: monospace; padding: 5px; background-color: #fff; border: 1px solid #d1d8dd; border-radius: 3px;">${trace_id}</div><button class="btn btn-xs btn-default" title="${__(
                                            "Copier ID"
                                        )}" onclick="navigator.clipboard.writeText('${trace_id}'); frappe.show_alert({message: __('ID copié'), indicator: 'green'}, 2); return false;" style="margin-left: 10px;"><i class="fa fa-copy"></i></button></div>`,
                                    },
                                    {
                                        label: __("Dimensions"),
                                        fieldname: "dimensions",
                                        fieldtype: "Data",
                                        reqd: 1,
                                        default: current_values.dimensions || "",
                                        description: __("Même format que les cotations article : 56×280 ou 56,3×280 ; 80×35×118 ; x ou × ; . ou , ; sans mm."),
                                    },
                                ];
                                if (showWarn) {
                                    fields.push({
                                        fieldtype: "HTML",
                                        fieldname: "cotations_mismatch_notice",
                                        options: mismatchHtml,
                                    });
                                }
                                fields.push(
                                    {
                                        label: __("Points colle"),
                                        fieldname: "points_colle",
                                        fieldtype: "Int",
                                        default: current_values.points_colle || 0,
                                        description: __("Nombre de points de colle"),
                                    },
                                    {
                                        label: __("Fichier Tracé"),
                                        fieldname: "fichier_trace",
                                        fieldtype: "Attach",
                                        reqd: 1,
                                        default: current_values.fichier_trace || "",
                                        description: __("Joignez le nouveau fichier"),
                                    },
                                    {
                                        fieldtype: "HTML",
                                        fieldname: "current_file_info",
                                        options: current_values.fichier_trace
                                            ? `<div style="margin-top: -10px; margin-bottom: 10px; font-size: 11px; color: var(--text-muted);">Fichier actuel: <a href="${current_values.fichier_trace}" target="_blank">${current_values.fichier_trace.split("/").pop()}</a></div>`
                                            : `<div style="margin-top: -10px; margin-bottom: 10px; font-size: 11px; color: #888;">Aucun fichier actuel.</div>`,
                                    }
                                );
                                // 2. Show update dialog
                                var d = new frappe.ui.Dialog({
                                    title: __("Mettre à jour le document Trace"),
                                    fields: fields,
                                    primary_action_label: __("Mettre à jour"),
                                    primary_action: function() {
                                var values = d.get_values();
                                if (!values.dimensions || !values.fichier_trace) {
                                     frappe.msgprint({ title: __('Validation'), message: __("Veuillez remplir tous les champs obligatoires."), indicator: 'orange' });
                                     return;
                                }
                                // 3. Update the document
                                frappe.call({
                                    method: "frappe.client.set_value",
                                    args: { doctype: "Trace", name: trace_id, fieldname: { dimensions: values.dimensions, points_colle: values.points_colle, fichier_trace: values.fichier_trace } },
                                    freeze: true, freeze_message: __("Mise à jour du Tracé..."),
                                    callback: function(r_update) {
                                        if (r_update.message) {
                                            frappe.call({
                                                method: "aurescrm.item_cotations.sync_item_cotations_from_trace",
                                                args: {
                                                    article: frm.doc.article,
                                                    dimensions: values.dimensions
                                                },
                                                callback: function(r_item) {
                                                    if (r_item.exc) {
                                                        frappe.msgprint({ title: __('Cotations article'), message: __("Impossible de synchroniser les dimensions vers l'article. Vérifiez le format (ex. 56×280, 56,3×280, 80×35×118 ; x ou × ; . ou ,)."), indicator: 'red' });
                                                        return;
                                                    }
                                                    // Synchroniser les points de colle vers l'Etude Faisabilite
                                                    frappe.call({
                                                        method: "aurescrm.aures_crm.doctype.trace.trace.sync_points_colle_to_etude",
                                                        args: {
                                                            trace_name: trace_id,
                                                            etude_faisabilite_name: frm.doc.name
                                                        },
                                                        callback: function(r_sync) {
                                                            if (r_sync.message && r_sync.message.success) {
                                                                // Mettre à jour le champ local points_colle
                                                                frm.set_value('points_colle', r_sync.message.points_colle);
                                                            }
                                                            frappe.show_alert({message:__('Trace mise à jour avec succès.'), indicator:'green'}, 5);
                                                            d.hide();
                                                            // Sauvegarder l'Etude Faisabilite pour persister les points_colle, puis rafraîchir
                                                            frm.save()
                                                                .then(() => {
                                                                    load_trace_imposition_links(frm); // Refresh HTML links/buttons
                                                                    refresh_attached_files(frm);    // Refresh local file field
                                                                })
                                                                .catch((err) => { console.error("Save failed after Trace update:", err); });
                                                        }
                                                    });
                                                },
                                                error: function() {
                                                    frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur lors de la synchronisation des cotations vers l'article."), indicator: 'red' });
                                                }
                                            });
                                        } else { frappe.msgprint({ title: __('Erreur'), message: __("Erreur lors de la mise à jour de la Trace."), indicator: 'red' }); }
                                    },
                                    error: function(err_update) { frappe.msgprint({ title: __('Erreur Serveur'), message: __("Erreur serveur lors de la mise à jour de la Trace.") + "<br>" + err_update.message, indicator: 'red' }); }
                                });
                            }
                        });
                                style_dialog_primary_button(d);
                                d.show();
                            },
                            error: function () {
                                frappe.msgprint({
                                    title: __("Erreur Serveur"),
                                    message: __("Impossible de vérifier l'écart cotations article / tracé."),
                                    indicator: "red",
                                });
                            },
                        });
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
            
            // Récupérer toutes les impositions disponibles pour ce trace
            frappe.call({
                method: 'aurescrm.aures_crm.doctype.imposition.imposition.get_all_impositions_for_trace',
                args: {
                    client: frm.doc.client,
                    article: frm.doc.article,
                    trace: frm.doc.trace
                },
                callback: function(r_check) {
                    if (r_check.message && r_check.message.length > 0) {
                        // Des impositions existent, afficher la liste
                        show_impositions_list_dialog(frm, r_check.message);
                    } else {
                        // Aucune imposition, créer directement
                        create_new_imposition(frm);
                    }
                }
            });
        };
    }
    
    /**
     * Ouvre la fenêtre de sélection pour changer l'imposition sélectionnée
     * @param {string} docname - Name of the current Etude Faisabilite document.
     */
    if (!window.changeImposition) {
        window.changeImposition = function(docname) {
            var frm = cur_frm;
            if (!frm.doc.client || !frm.doc.article || !frm.doc.trace) {
                frappe.msgprint({ title: __('Prérequis manquants'), message: __('Veuillez remplir Client, Article et Tracé avant de changer l\'Imposition.'), indicator: 'orange' });
                return;
            }
            
            // Récupérer toutes les impositions disponibles pour ce trace
            frappe.call({
                method: 'aurescrm.aures_crm.doctype.imposition.imposition.get_all_impositions_for_trace',
                args: {
                    client: frm.doc.client,
                    article: frm.doc.article,
                    trace: frm.doc.trace
                },
                callback: function(r_check) {
                    if (r_check.message && r_check.message.length > 0) {
                        // Des impositions existent, afficher la liste
                        show_impositions_list_dialog(frm, r_check.message);
                    } else {
                        // Aucune imposition, proposer de créer une nouvelle
                        frappe.confirm(
                            __('Aucune imposition disponible pour ce trace. Voulez-vous en créer une nouvelle ?'),
                            function() {
                                // Oui - créer une nouvelle imposition
                                create_new_imposition(frm);
                            },
                            function() {
                                // Non - annuler
                            }
                        );
                    }
                }
            });
        };
    }
    
    /**
     * Affiche un dialogue listant toutes les impositions disponibles avec possibilité de sélection ou création
     */
    if (!window.show_impositions_list_dialog) {
        window.show_impositions_list_dialog = function(frm, impositions) {
            // Construire le HTML du tableau
            let tableRows = '';
            const currentImposition = frm.doc.imposition;
            impositions.forEach(function(imp) {
                const isCurrent = imp.name === currentImposition;
                const badgeHtml = imp.defaut === 1 || imp.defaut === '1' || imp.defaut === true
                    ? `<span style="padding: 2px 8px; background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; border-radius: 8px; font-size: 11px; font-weight: 600;">Idéale</span>`
                    : '';
                const currentBadgeHtml = isCurrent
                    ? `<span style="padding: 2px 8px; background-color: #cfe2ff; border: 1px solid #9ec5fe; color: #084298; border-radius: 8px; font-size: 11px; font-weight: 600; margin-left: 5px;">Actuelle</span>`
                    : '';
                const rowStyle = isCurrent ? 'border-bottom: 1px solid #d1d8dd; background-color: #f0f7ff;' : 'border-bottom: 1px solid #d1d8dd;';
                
                tableRows += `
                    <tr style="${rowStyle}">
                        <td style="padding: 12px; vertical-align: middle; text-align: center;">
                            ${imp.format_imp || 'N/A'}
                        </td>
                        <td style="padding: 12px; vertical-align: middle; text-align: center;">
                            ${imp.nbr_poses || 0}
                        </td>
                        <td style="padding: 12px; vertical-align: middle; text-align: center;">
                            ${imp.taux_chutes != null ? imp.taux_chutes : 0}%
                        </td>
                        <td style="padding: 12px; vertical-align: middle; text-align: center;">
                            ${badgeHtml}${currentBadgeHtml}
                        </td>
                        <td style="padding: 12px; vertical-align: middle; text-align: center;">
                            <button class="btn btn-xs btn-primary" onclick="selectImposition('${imp.name}', ${imp.taux_chutes != null ? imp.taux_chutes : 0}); return false;" ${isCurrent ? 'disabled' : ''}>
                                ${isCurrent ? 'Sélectionnée' : 'Sélectionner'}
                            </button>
                        </td>
                    </tr>
                `;
            });
            
            const tableHtml = `
                <div style="margin-bottom: 20px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead>
                            <tr style="background-color: #f8f9fa; border-bottom: 2px solid #d1d8dd;">
                                <th style="padding: 12px; text-align: center; font-weight: 600;">Dimensions</th>
                                <th style="padding: 12px; text-align: center; font-weight: 600;">Nombre de poses</th>
                                <th style="padding: 12px; text-align: center; font-weight: 600;">Taux de chutes</th>
                                <th style="padding: 12px; text-align: center; font-weight: 600;">Statut</th>
                                <th style="padding: 12px; text-align: center; font-weight: 600;">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            `;
            
            var list_dialog = new frappe.ui.Dialog({
                title: __('Sélectionner une Imposition'),
                fields: [
                    {
                        fieldtype: 'HTML',
                        fieldname: 'impositions_table',
                        options: tableHtml
                    }
                ],
                primary_action_label: __('Créer une nouvelle imposition'),
                primary_action: function() {
                    list_dialog.hide();
                    create_new_imposition(frm);
                },
                secondary_action_label: __('Annuler'),
                secondary_action: function() {
                    list_dialog.hide();
                }
            });
            
            // Fonction pour sélectionner une imposition (définie dans le scope de la fonction pour accéder à list_dialog)
            var selectImposition = function(imposition_name, taux_chutes) {
                frm.set_value('imposition', imposition_name);
                frm.set_value('taux_chutes', taux_chutes);
                frappe.show_alert({message: __('Imposition sélectionnée avec succès'), indicator: 'green'}, 3);
                list_dialog.hide();
                // Sauvegarder et rafraîchir
                frm.save()
                    .then(() => {
                        load_trace_imposition_links(frm);
                        refresh_attached_files(frm);
                    });
            };
            
            // Exposer la fonction globalement pour qu'elle soit accessible depuis les boutons onclick
            window.selectImposition = selectImposition;
            
            list_dialog.show();
        };
    }
    
    /**
     * Crée une nouvelle imposition
     */
    if (!window.create_new_imposition) {
        window.create_new_imposition = function(frm) {
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
                                { label: __('Laize/Palette'), fieldname: 'laize_pal', fieldtype: 'Select', options: 'Laize\nPalette', reqd: 1, description: __('Sélectionnez le type') },
                                { label: __('Format Laize/Palette'), fieldname: 'format_laize_palette', fieldtype: 'Data', reqd: 1, description: __('Pour Laize: chiffres uniquement (ex: 720.5). Pour Palette: format dimensions (ex: 720.2x1000)') },
                                { label: __('Format Imposition'), fieldname: 'format_imp', fieldtype: 'Data', reqd: 1, description: __('Entrez le format (ex: 720x450)') },
                                { label: __('Nombre de poses'), fieldname: 'nbr_poses', fieldtype: 'Int', reqd: 1, description: __('Entrez le nombre total de poses') },
                                { label: __('Taux de chutes'), fieldname: 'taux_chutes', fieldtype: 'Percent', description: __('Entrez le taux de chutes (%)') },
                                { label: __('Fichier Imposition'), fieldname: 'fichier_imp', fieldtype: 'Attach', reqd: 1, description: __('Joignez le fichier d\'imposition') }
                            ],
                            primary_action_label: __('Enregistrer et Fermer'),
                            primary_action: function() {
                                var values = d.get_values();
                                if (!values.format_imp || !values.format_laize_palette || !values.laize_pal || !values.nbr_poses || !values.fichier_imp) {
                                    frappe.msgprint({ title: __('Validation'), message: __("Veuillez remplir tous les champs obligatoires."), indicator: 'orange' });
                                    return;
                                }
                                
                                // Valider le format des dimensions
                                if (!validateDimensionFormat(values.format_imp, __('Format Imposition'))) {
                                    return;
                                }
                                if (!validateLaizePaletteFormat(values.format_laize_palette, values.laize_pal, __('Format Laize/Palette'))) {
                                    return;
                                }
                                // Update the newly created Imposition document
                                frappe.call({
                                    method: "frappe.client.set_value",
                                    args: { doctype: "Imposition", name: imposition_id, fieldname: { format_imp: values.format_imp, format_laize_palette: values.format_laize_palette, laize_pal: values.laize_pal, nbr_poses: values.nbr_poses, taux_chutes: values.taux_chutes, fichier_imp: values.fichier_imp } },
                                    freeze: true, freeze_message: __("Mise à jour de l'Imposition..."),
                                    callback: function(r_update) {
                                        if (r_update.message) {
                                            // Synchroniser le taux de chutes vers l'Etude Faisabilite
                                            frappe.call({
                                                method: "aurescrm.aures_crm.doctype.imposition.imposition.sync_taux_chutes_to_etude",
                                                args: {
                                                    imposition_name: imposition_id,
                                                    etude_faisabilite_name: frm.doc.name
                                                },
                                                callback: function(r_sync) {
                                                    if (r_sync.message && r_sync.message.success) {
                                                        frm.set_value('taux_chutes', r_sync.message.taux_chutes);
                                                        if (r_sync.message.nbr_feuilles != null) {
                                                            frm.set_value('nbr_feuilles', r_sync.message.nbr_feuilles);
                                                        }
                                                    }
                                                    frappe.show_alert({message:__('Imposition créée et mise à jour avec succès.'), indicator:'green'}, 5);
                                                    d.hide();
                                                    // Save the Etude Faisabilite to persist the link and taux_chutes, then refresh UI
                                                    frm.save()
                                                        .then(() => {
                                                            load_trace_imposition_links(frm);
                                                            refresh_attached_files(frm);
                                                        })
                                                        .catch((err) => { console.error("Save failed after Imposition creation:", err); });
                                                }
                                            });
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
                args: { doctype: "Imposition", fieldname: ["format_imp", "format_laize_palette", "laize_pal", "nbr_poses", "taux_chutes", "fichier_imp"], filters: { name: imposition_id } },
                callback: function(r) {
                    if (r.message) {
                        let current_values = r.message;
                        // 2. Show update dialog
                        var d = new frappe.ui.Dialog({
                            title: __('Mettre à jour le document Imposition'),
                            fields: [
                                { fieldtype: 'HTML', fieldname: 'id_section', options: `<div style="display: flex; align-items: center; margin-bottom: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;"><div style="margin-right: 10px; font-weight: bold;">ID:</div><div style="flex-grow: 1; font-family: monospace; padding: 5px; background-color: #fff; border: 1px solid #d1d8dd; border-radius: 3px;">${imposition_id}</div><button class="btn btn-xs btn-default" title="${__('Copier ID')}" onclick="navigator.clipboard.writeText('${imposition_id}'); frappe.show_alert({message: __('ID copié'), indicator: 'green'}, 2); return false;" style="margin-left: 10px;"><i class="fa fa-copy"></i></button></div>`},
                                { label: __('Laize/Palette'), fieldname: 'laize_pal', fieldtype: 'Select', options: 'Laize\nPalette', reqd: 1, default: current_values.laize_pal || "", description: __('Sélectionnez le type') },
                                { label: __('Format Laize/Palette'), fieldname: 'format_laize_palette', fieldtype: 'Data', reqd: 1, default: current_values.format_laize_palette || "", description: __('Pour Laize: chiffres uniquement (ex: 720.5). Pour Palette: format dimensions (ex: 720.2x1000)') },
                                { label: __('Format Imposition'), fieldname: 'format_imp', fieldtype: 'Data', reqd: 1, default: current_values.format_imp || "", description: __('Entrez le format (ex: 720x450)') },
                                { label: __('Nombre de poses'), fieldname: 'nbr_poses', fieldtype: 'Int', reqd: 1, default: current_values.nbr_poses || 0, description: __('Entrez le nombre total de poses') },
                                { label: __('Taux de chutes'), fieldname: 'taux_chutes', fieldtype: 'Percent', default: current_values.taux_chutes || 0, description: __('Entrez le taux de chutes (%)') },
                                { label: __('Fichier Imposition'), fieldname: 'fichier_imp', fieldtype: 'Attach', reqd: 1, default: current_values.fichier_imp || "", description: __('Joignez le nouveau fichier') },
                                { fieldtype: 'HTML', fieldname: 'current_file_info_imp', options: current_values.fichier_imp ? `<div style="margin-top: -10px; margin-bottom: 10px; font-size: 11px; color: var(--text-muted);">Fichier actuel: <a href="${current_values.fichier_imp}" target="_blank">${current_values.fichier_imp.split('/').pop()}</a></div>` : `<div style="margin-top: -10px; margin-bottom: 10px; font-size: 11px; color: #888;">Aucun fichier actuel.</div>`}
                            ],
                            primary_action_label: __('Mettre à jour'),
                            primary_action: function() {
                                var values = d.get_values();
                                if (!values.format_imp || !values.format_laize_palette || !values.laize_pal || !values.nbr_poses || !values.fichier_imp) {
                                     frappe.msgprint({ title: __('Validation'), message: __("Veuillez remplir tous les champs obligatoires."), indicator: 'orange' });
                                     return;
                                }
                                
                                // Valider le format des dimensions
                                if (!validateDimensionFormat(values.format_imp, __('Format Imposition'))) {
                                    return;
                                }
                                if (!validateLaizePaletteFormat(values.format_laize_palette, values.laize_pal, __('Format Laize/Palette'))) {
                                    return;
                                }
                                // 3. Update the document
                                frappe.call({
                                    method: "frappe.client.set_value",
                                    args: { doctype: "Imposition", name: imposition_id, fieldname: { format_imp: values.format_imp, format_laize_palette: values.format_laize_palette, laize_pal: values.laize_pal, nbr_poses: values.nbr_poses, taux_chutes: values.taux_chutes, fichier_imp: values.fichier_imp } },
                                    freeze: true, freeze_message: __("Mise à jour de l'Imposition..."),
                                    callback: function(r_update) {
                                        if (r_update.message) {
                                            // Synchroniser le taux de chutes vers l'Etude Faisabilite
                                            frappe.call({
                                                method: "aurescrm.aures_crm.doctype.imposition.imposition.sync_taux_chutes_to_etude",
                                                args: {
                                                    imposition_name: imposition_id,
                                                    etude_faisabilite_name: frm.doc.name
                                                },
                                                callback: function(r_sync) {
                                                    if (r_sync.message && r_sync.message.success) {
                                                        frm.set_value('taux_chutes', r_sync.message.taux_chutes);
                                                        if (r_sync.message.nbr_feuilles != null) {
                                                            frm.set_value('nbr_feuilles', r_sync.message.nbr_feuilles);
                                                        }
                                                    }
                                                    frappe.show_alert({message:__('Imposition mise à jour avec succès.'), indicator:'green'}, 5);
                                                    d.hide();
                                                    // Sauvegarder l'Etude Faisabilite pour persister le taux_chutes, puis rafraîchir
                                                    frm.save()
                                                        .then(() => {
                                                            load_trace_imposition_links(frm); // Refresh HTML links/buttons
                                                            refresh_attached_files(frm);    // Refresh local file field
                                                        })
                                                        .catch((err) => { console.error("Save failed after Imposition update:", err); });
                                                }
                                            });
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
 * Valide le format des dimensions (ex: 720x450 ou 720.2x1000)
 * @param {string} value - La valeur à valider
 * @param {string} fieldName - Le nom du champ pour les messages d'erreur
 * @returns {boolean} - True si le format est valide
 */
function validateDimensionFormat(value, fieldName) {
    if (!value || typeof value !== 'string') {
        return false;
    }
    
    // Pattern pour valider le format: chiffres avec ou sans point, puis 'x', puis chiffres avec ou sans point
    const pattern = /^\d+(\.\d+)?x\d+(\.\d+)?$/;
    
    if (!pattern.test(value.trim())) {
        frappe.msgprint({
            title: __('Format invalide'),
            message: __('Le champ "{0}" doit respecter le format: 720x450 ou 720.2x1000', [fieldName]),
            indicator: 'red'
        });
        return false;
    }
    
    return true;
}

/**
 * Valide le format laize/palette selon le type sélectionné
 * @param {string} value - La valeur à valider
 * @param {string} laizePalValue - La valeur du champ Laize/Palette ('Laize' ou 'Palette')
 * @param {string} fieldName - Le nom du champ pour les messages d'erreur
 * @returns {boolean} - True si le format est valide
 */
function validateLaizePaletteFormat(value, laizePalValue, fieldName) {
    if (!value || typeof value !== 'string') {
        return false;
    }
    
    if (laizePalValue === 'Laize') {
        // Pour Laize: validation simple (chiffres uniquement)
        const pattern = /^\d+(\.\d+)?$/;
        if (!pattern.test(value.trim())) {
            frappe.msgprint({
                title: __('Format invalide'),
                message: __('Pour une Laize, le champ "{0}" doit contenir uniquement des chiffres (ex: 720 ou 720.5)', [fieldName]),
                indicator: 'red'
            });
            return false;
        }
    } else if (laizePalValue === 'Palette') {
        // Pour Palette: validation avec format dimensions
        const pattern = /^\d+(\.\d+)?x\d+(\.\d+)?$/;
        if (!pattern.test(value.trim())) {
            frappe.msgprint({
                title: __('Format invalide'),
                message: __('Pour une Palette, le champ "{0}" doit respecter le format: 720x450 ou 720.2x1000', [fieldName]),
                indicator: 'red'
            });
            return false;
        }
    }
    
    return true;
}


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
                    "custom_nombre_passages",
                    "custom_pelliculage", 
                    "custom_marquage_à_chaud", 
                    "custom_couleur_marquage_à_chaud", 
                    "custom_notice", 
                    "custom_cotations_article",
                    // "custom_largeur", 
                    // "custom_hauteur", 
                    // "custom_longueur", 
                    "custom_acrylique", 
                    "custom_uv", 
                    "custom_sélectif", 
                    "custom_drip_off", 
                    "custom_mat_gras", 
                    "custom_blister",
                    "custom_vernis_serigraphique",
                    "custom_recto_verso",
                    "custom_fenêtre",
                    "custom_pvc_fenêtre",
                    "custom_cotations_fenetre",
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
                    "custom_nombre_passages",
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
                        "custom_nombre_passages",
                        "custom_pelliculage", 
                        "custom_marquage_à_chaud", 
                        "custom_couleur_marquage_à_chaud", 
                        "custom_notice", 
                        "custom_cotations_article",
                        // "custom_largeur", 
                        // "custom_hauteur", 
                        // "custom_longueur", 
                        "custom_acrylique", 
                        "custom_uv", 
                        "custom_sélectif", 
                        "custom_drip_off", 
                        "custom_mat_gras",
                        "custom_blister",
                        "custom_vernis_serigraphique",
                        "custom_recto_verso",
                        "custom_fenêtre",
                        "custom_pvc_fenêtre",
                        "custom_cotations_fenetre",
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
                        "custom_nombre_passages",
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