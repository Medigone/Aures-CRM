// Copyright (c) 2026, Medigo and contributors
// License: MIT

frappe.pages["organigramme-rh"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Organigramme RH"),
		single_column: true,
	});

	const org_page = new OrganigrammeRHPage(page, wrapper);
	wrapper.org_page = org_page;

	page.set_primary_action(__("Actualiser"), () => org_page.refresh(), "refresh");
	page.add_inner_button(__("Tout ouvrir"), () => org_page.expand_all());
	page.add_inner_button(__("Tout fermer"), () => org_page.collapse_all());

	org_page.setup_filters();
	org_page.refresh();
};

frappe.pages["organigramme-rh"].refresh = function (wrapper) {
	if (wrapper.org_page) {
		wrapper.org_page.refresh();
	}
};

class OrganigrammeRHPage {
	constructor(page, wrapper) {
		this.page = page;
		this.wrapper = wrapper;
		this.$body = $(`<div class="organigramme-rh-root"></div>`).appendTo(this.page.main);
		this.last_data = null;
		this.expanded = new Set();

		$(window).on("resize.organigramme-rh", () => {
			clearTimeout(this._resize_timer);
			this._resize_timer = setTimeout(() => this.draw_connectors(), 150);
		});
	}

	setup_filters() {
		this.df_mode = this.page.add_field({
			fieldname: "mode",
			label: __("Vue"),
			fieldtype: "Select",
			options: ["Hiérarchie", "Départements", "Sites"].join("\n"),
			default: "Hiérarchie",
			change: () => {
				this.sync_filter_visibility();
				this.refresh();
			},
		});

		this.df_employe = this.page.add_field({
			fieldname: "employe",
			label: __("Employé"),
			fieldtype: "Link",
			options: "Employe",
			get_query: () => {
				const filters = {};
				const statut = this.df_statut.get_value();
				if (statut) filters.statut = statut;
				return { filters };
			},
			change: () => this.refresh(),
		});

		this.df_statut = this.page.add_field({
			fieldname: "statut",
			label: __("Statut"),
			fieldtype: "Select",
			options: ["", "Actif", "Pré-intégré", "Inactif", "Sorti"].join("\n"),
			default: "Actif",
			change: () => this.refresh(),
		});

		this.df_departement = this.page.add_field({
			fieldname: "departement",
			label: __("Département"),
			fieldtype: "Link",
			options: "Departement RH",
			get_query: () => ({ filters: { actif: 1 } }),
			change: () => this.refresh(),
		});

		this.df_site = this.page.add_field({
			fieldname: "site",
			label: __("Site"),
			fieldtype: "Link",
			options: "Site RH",
			get_query: () => ({ filters: { actif: 1 } }),
			change: () => this.refresh(),
		});

		this.sync_filter_visibility();
	}

	get_mode() {
		const mode_label = this.df_mode.get_value() || "Hiérarchie";
		if (mode_label === "Départements") return "departements";
		if (mode_label === "Sites") return "sites";
		return "hierarchie";
	}

	sync_filter_visibility() {
		const mode = this.get_mode();
		const is_hierarchie = mode === "hierarchie";
		const is_sites = mode === "sites";

		if (this.df_employe && this.df_employe.$wrapper) {
			this.df_employe.$wrapper.toggle(is_hierarchie);
		}
		if (this.df_departement && this.df_departement.$wrapper) {
			this.df_departement.$wrapper.toggle(!is_sites);
		}

		if (!is_hierarchie && this.df_employe.get_value()) {
			this.df_employe.set_value("");
		}
		if (is_sites && this.df_departement.get_value()) {
			this.df_departement.set_value("");
		}
	}

	get_filters() {
		const mode = this.get_mode();
		const filters = {
			mode,
			statut: this.df_statut.get_value() || "",
			departement: this.df_departement.get_value() || "",
			site: this.df_site.get_value() || "",
		};
		if (mode === "hierarchie") {
			filters.employe = this.df_employe.get_value() || "";
		}
		return filters;
	}

	refresh() {
		const filters = this.get_filters();
		this.$body.html(`<div class="text-muted organigramme-loading">${__("Chargement…")}</div>`);

		frappe.call({
			method: "aurescrm.ressources_humaines.page.organigramme_rh.organigramme_rh.get_organigramme",
			args: filters,
			callback: (r) => {
				this.last_data = r.message || { tree: [], meta: {} };
				this.expanded = new Set();
				const focus = this.last_data.focus_employee || (this.last_data.meta || {}).focus_employee;
				if (focus) {
					// Chaîne filtrée : ouvrir tous les nœuds pour voir le chemin jusqu'au PDG.
					const walk = (nodes) => {
						(nodes || []).forEach((n) => {
							this.expanded.add(n.id);
							walk(n.children);
						});
					};
					walk(this.last_data.tree);
				} else {
					// Racines ouvertes par défaut, le reste replié pour rester lisible.
					(this.last_data.tree || []).forEach((n) => this.expanded.add(n.id));
				}
				this.render();
			},
			error: () => {
				this.$body.html(
					`<div class="organigramme-empty">${__("Impossible de charger l'organigramme.")}</div>`
				);
			},
		});
	}

	expand_all() {
		if (!this.last_data) return;
		this.expanded = new Set();
		const walk = (nodes) => {
			(nodes || []).forEach((n) => {
				this.expanded.add(n.id);
				walk(n.children);
			});
		};
		walk(this.last_data.tree);
		this.render();
	}

	collapse_all() {
		this.expanded = new Set();
		this.render();
	}

	toggle_node(id) {
		if (this.expanded.has(id)) {
			this.expanded.delete(id);
		} else {
			this.expanded.add(id);
		}
		this.render_keep_position(id);
	}

	/** Re-rend l'arbre en conservant la position visuelle du nœud cliqué, pour éviter que la page ne remonte en haut. */
	render_keep_position(anchor_id) {
		const $before = anchor_id ? this.find_node_el(anchor_id) : $();
		const rect_before = $before.length ? $before[0].getBoundingClientRect() : null;

		this.render();

		if (!rect_before) return;

		const $after = this.find_node_el(anchor_id);
		if (!$after.length) return;
		const el = $after[0];

		const apply_delta = () => {
			const rect_after = el.getBoundingClientRect();
			const delta_y = rect_after.top - rect_before.top;
			const delta_x = rect_after.left - rect_before.left;
			return { delta_y, delta_x };
		};

		let { delta_y, delta_x } = apply_delta();
		if (Math.abs(delta_y) < 1 && Math.abs(delta_x) < 1) return;

		const $tree = this.$body.find(".organigramme-tree");
		if ($tree.length) {
			$tree[0].scrollTop += delta_y;
			$tree[0].scrollLeft += delta_x;
		}

		// Si le défilement interne de l'arbre n'a pas pu absorber tout le déplacement
		// (butée haute/basse), compenser le reste sur le défilement de la page.
		({ delta_y, delta_x } = apply_delta());
		if (Math.abs(delta_y) > 1 || Math.abs(delta_x) > 1) {
			const scroller = document.scrollingElement || document.documentElement;
			scroller.scrollTop += delta_y;
			scroller.scrollLeft += delta_x;
		}
	}

	find_node_el(id) {
		return this.$body.find(`.org-tree-node[data-id="${this.css_escape(id)}"]`);
	}

	css_escape(value) {
		if (window.CSS && CSS.escape) return CSS.escape(String(value));
		return String(value).replace(/["\\]/g, "\\$&");
	}

	render() {
		const data = this.last_data || { tree: [], meta: {}, orphan_employees: [] };
		const meta = data.meta || {};
		const mode = data.mode || "hierarchie";

		const $wrap = $(`
			<div class="organigramme-rh">
				<div class="organigramme-toolbar">
					<span class="organigramme-meta text-muted">
						${frappe.utils.escape_html(
							mode === "departements"
								? __("{0} départements · {1} employés", [
										meta.department_count || 0,
										meta.employee_count || 0,
								  ])
								: mode === "sites"
								? __("{0} sites · {1} employés", [
										meta.site_count || 0,
										meta.employee_count || 0,
								  ])
								: meta.focus_employee
								? __("Chaîne hiérarchique · {0} personne(s)", [meta.chain_length || meta.employee_count || 0])
								: __("{0} employés · {1} racines", [
										meta.employee_count || 0,
										meta.root_count || 0,
								  ])
						)}
					</span>
				</div>
				<div class="organigramme-tree"></div>
			</div>
		`);

		const $tree = $wrap.find(".organigramme-tree");
		const roots = data.tree || [];

		if (!roots.length) {
			$tree.append(
				`<div class="organigramme-empty">${__(
					mode === "departements"
						? "Aucun département à afficher."
						: mode === "sites"
						? "Aucun site à afficher."
						: "Aucun élément à afficher. Vérifiez les filtres et que les responsables hiérarchiques sont renseignés."
				)}</div>`
			);
		} else {
			const $forest = $(`<div class="org-forest"></div>`);
			roots.forEach((node) => {
				$forest.append(this.render_tree_node(node, mode));
			});
			$tree.append($forest);

			if ((mode === "departements" || mode === "sites") && meta.orphan_count > 0) {
				$tree.append(
					`<div class="organigramme-orphan">
						<div class="organigramme-orphan-title">${__(
							mode === "sites"
								? "{0} employé(s) sans site"
								: "{0} employé(s) sans département",
							[meta.orphan_count]
						)}</div>
					</div>`
				);
			}
		}

		this.$body.empty().append($wrap);
		this.bind_events($wrap);
		this.draw_connectors();
	}

	/**
	 * Dessine les traits reliant chaque carte à ses enfants en mesurant les positions réelles
	 * après rendu (plutôt que des lignes CSS approximatives), pour que le trait ne dépasse
	 * jamais au-delà d'une carte réelle, quelle que soit la hauteur de chaque branche.
	 */
	draw_connectors() {
		const gap = this.get_gap_px();
		const line_color = this.get_line_color();

		this.$body.find(".org-children").each((_, children_el) => {
			const $children = $(children_el);
			const $tree_node = $children.parent();
			const $parent_card = $tree_node.children(".org-card");
			const child_cards = $children.children(".org-tree-node").children(".org-card").toArray();
			if (!$parent_card.length || !child_cards.length) return;

			const container_rect = children_el.getBoundingClientRect();
			const parent_rect = $parent_card[0].getBoundingClientRect();
			const parent_y = parent_rect.top + parent_rect.height / 2 - container_rect.top;

			const child_ys = child_cards.map((card) => {
				const r = card.getBoundingClientRect();
				return r.top + r.height / 2 - container_rect.top;
			});

			const $layer = $(`<div class="org-connector-layer"></div>`).appendTo($children);
			const draw_line = (top, left, width, height) => {
				$(`<div class="org-connector"></div>`)
					.css({ top, left, width, height })
					.appendTo($layer);
			};

			// Tronc vertical : uniquement entre les points de raccordement réels (jamais au-delà).
			const trunk_top = Math.min(parent_y, ...child_ys);
			const trunk_bottom = Math.max(parent_y, ...child_ys);
			if (trunk_bottom - trunk_top > 0.5) {
				draw_line(trunk_top, 0, 1, trunk_bottom - trunk_top);
			}

			// Tige horizontale de la carte parente vers le tronc.
			draw_line(parent_y, -gap, gap, 1);

			// Tige horizontale du tronc vers chaque carte enfant.
			child_ys.forEach((y) => draw_line(y, 0, gap, 1));

			$layer.find(".org-connector").css("background", line_color);
		});
	}

	get_gap_px() {
		if (this._gap_px) return this._gap_px;
		const raw = getComputedStyle(document.documentElement).getPropertyValue("--org-gap").trim();
		const px = parseFloat(raw);
		this._gap_px = Number.isFinite(px) && px > 0 ? px : 30;
		return this._gap_px;
	}

	get_line_color() {
		const raw = getComputedStyle(document.documentElement).getPropertyValue("--org-line-color").trim();
		return raw || "var(--border-color)";
	}

	bind_events($wrap) {
		$wrap.on("click", ".org-toggle-btn", (e) => {
			e.preventDefault();
			e.stopPropagation();
			const id = $(e.currentTarget).closest(".org-tree-node").data("id");
			if (id) this.toggle_node(String(id));
		});

		$wrap.on("click", ".org-edit-btn", (e) => {
			e.preventDefault();
			e.stopPropagation();
			const $btn = $(e.currentTarget);
			const doctype = $btn.data("doctype");
			const name = $btn.data("name");
			if (doctype && name) this.open_edit_dialog(String(doctype), String(name));
		});

		$wrap.on("click", ".org-open-employe", (e) => {
			e.preventDefault();
			e.stopPropagation();
			const name = $(e.currentTarget).data("name");
			if (name) frappe.set_route("Form", "Employe", name);
		});

		$wrap.on("click", ".org-open-departement", (e) => {
			e.preventDefault();
			e.stopPropagation();
			const name = $(e.currentTarget).data("name");
			if (name) this.open_employees_dialog("departement", String(name));
		});

		$wrap.on("click", ".org-open-site", (e) => {
			e.preventDefault();
			e.stopPropagation();
			const name = $(e.currentTarget).data("name");
			if (name) this.open_employees_dialog("site", String(name));
		});
	}

	build_edit_btn(doctype, name) {
		if (!frappe.model.can_write(doctype)) return "";
		return `<button type="button" class="org-edit-btn" data-doctype="${frappe.utils.escape_html(
			doctype
		)}" data-name="${frappe.utils.escape_html(name)}" title="${__("Modifier")}" aria-label="${__(
			"Modifier"
		)}"><span class="fa fa-pencil"></span></button>`;
	}

	open_employees_dialog(node_type, node_name) {
		const form_doctype = node_type === "site" ? "Site RH" : "Departement RH";
		const page_length = 25;
		frappe.call({
			method:
				"aurescrm.ressources_humaines.page.organigramme_rh.organigramme_rh.get_employees_for_node",
			args: {
				node_type,
				node_name,
				statut: this.df_statut.get_value() || "",
				start: 0,
				page_length,
				order_by: "nom_complet",
				order: "asc",
			},
			freeze: true,
			freeze_message: __("Chargement des employés…"),
			callback: (r) => {
				const data = r.message || {};
				this.show_employees_dialog({
					...data,
					node_type,
					node_name,
					form_doctype,
					statut: this.df_statut.get_value() || "",
					page_length,
				});
			},
		});
	}

	show_employees_dialog(initial) {
		const form_doctype = initial.form_doctype;
		const node_type = initial.node_type;
		const node_name = initial.node_name;
		const statut = initial.statut || "";
		const page_length = initial.page_length || 25;

		let employees = (initial.employees || []).slice();
		let total = initial.count || employees.length;
		let has_more = !!initial.has_more;
		let sort_key = initial.order_by || "nom_complet";
		let sort_asc = (initial.order || "asc") !== "desc";
		let loading = false;

		const columns = [
			{ key: "matricule", label: __("Matricule") },
			{ key: "nom_complet", label: __("Nom complet") },
			{ key: "poste", label: __("Poste") },
			{ key: "statut", label: __("Statut") },
			{ key: "departement", label: __("Département") },
			{ key: "site", label: __("Site") },
		];

		const label = initial.label || node_name || "";

		const dialog = new frappe.ui.Dialog({
			title: __("{0} — {1} employé(s)", [label, total]),
			size: "extra-large",
			fields: [
				{
					fieldtype: "HTML",
					fieldname: "employees_html",
				},
			],
			primary_action_label: __("Ouvrir la fiche"),
			primary_action: () => {
				dialog.hide();
				if (node_name) frappe.set_route("Form", form_doctype, node_name);
			},
		});

		const $html = dialog.fields_dict.employees_html.$wrapper;

		const fetch_page = ({ start, append, order_by, order }) => {
			if (loading) return;
			loading = true;
			render_table();

			frappe.call({
				method:
					"aurescrm.ressources_humaines.page.organigramme_rh.organigramme_rh.get_employees_for_node",
				args: {
					node_type,
					node_name,
					statut,
					start,
					page_length,
					order_by,
					order,
				},
				callback: (r) => {
					loading = false;
					const data = r.message || {};
					total = data.count || 0;
					has_more = !!data.has_more;
					sort_key = data.order_by || order_by;
					sort_asc = (data.order || order) !== "desc";
					if (append) {
						employees = employees.concat(data.employees || []);
					} else {
						employees = (data.employees || []).slice();
					}
					dialog.set_title(__("{0} — {1} employé(s)", [label, total]));
					render_table();
				},
				error: () => {
					loading = false;
					render_table();
				},
			});
		};

		const render_table = () => {
			const rows_html = employees.length
				? employees
						.map((emp) => {
							const name = frappe.utils.escape_html(emp.name || "");
							return `<tr class="org-emp-row" data-name="${name}" role="button" tabindex="0">
								<td>${frappe.utils.escape_html(emp.matricule || "")}</td>
								<td class="org-emp-name">${frappe.utils.escape_html(emp.nom_complet || emp.name || "")}</td>
								<td>${frappe.utils.escape_html(emp.poste || "")}</td>
								<td>${frappe.utils.escape_html(emp.statut || "")}</td>
								<td>${frappe.utils.escape_html(emp.departement || "")}</td>
								<td>${frappe.utils.escape_html(emp.site || "")}</td>
							</tr>`;
						})
						.join("")
				: `<tr><td colspan="6" class="text-muted text-center">${__(
						loading ? "Chargement…" : "Aucun employé"
				  )}</td></tr>`;

			const heads = columns
				.map((col) => {
					const active = col.key === sort_key;
					const arrow = active ? (sort_asc ? " ▲" : " ▼") : "";
					const cls = active ? " org-emp-th-active" : "";
					return `<th class="org-emp-th-sortable${cls}" data-sort="${frappe.utils.escape_html(
						col.key
					)}" title="${__("Trier")}">${frappe.utils.escape_html(col.label)}${arrow}</th>`;
				})
				.join("");

			const shown = employees.length;
			const footer =
				total > 0
					? `<div class="org-emp-list-footer">
						<span class="text-muted org-emp-list-meta">${__(
							"{0} sur {1} affiché(s)",
							[shown, total]
						)}</span>
						${
							has_more
								? `<button type="button" class="btn btn-default btn-sm org-emp-load-more" ${
										loading ? "disabled" : ""
								  }>${loading ? __("Chargement…") : __("Charger plus")}</button>`
								: ""
						}
					</div>`
					: "";

			$html.html(`
				<div class="org-emp-list-wrap">
					<table class="table table-bordered table-hover org-emp-list-table">
						<thead><tr>${heads}</tr></thead>
						<tbody>${rows_html}</tbody>
					</table>
				</div>
				${footer}
			`);
		};

		dialog.show();
		render_table();

		$html.on("click", ".org-emp-th-sortable", (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (loading) return;
			const key = $(e.currentTarget).data("sort");
			if (!key) return;
			let next_asc = true;
			if (sort_key === key) {
				next_asc = !sort_asc;
			}
			fetch_page({
				start: 0,
				append: false,
				order_by: key,
				order: next_asc ? "asc" : "desc",
			});
		});

		$html.on("click", ".org-emp-load-more", (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (loading || !has_more) return;
			fetch_page({
				start: employees.length,
				append: true,
				order_by: sort_key,
				order: sort_asc ? "asc" : "desc",
			});
		});

		$html.on("click", ".org-emp-row", (e) => {
			e.preventDefault();
			const emp_name = $(e.currentTarget).data("name");
			if (emp_name) {
				dialog.hide();
				frappe.set_route("Form", "Employe", emp_name);
			}
		});
	}

	open_edit_dialog(doctype, name) {
		const is_site = doctype === "Site RH";
		const fields = is_site
			? [
					"name",
					"nom_site",
					"site_parent",
					"type_site",
					"responsable_site",
					"couleur",
					"actif",
			  ]
			: [
					"name",
					"nom_departement",
					"departement_parent",
					"responsable_departement",
					"couleur",
					"actif",
			  ];

		frappe.db.get_value(doctype, name, fields).then((r) => {
			const doc = (r && r.message) || {};
			this.show_edit_dialog(doctype, name, doc);
		});
	}

	show_edit_dialog(doctype, name, doc) {
		const is_site = doctype === "Site RH";
		const parent_field = is_site ? "site_parent" : "departement_parent";
		const label_field = is_site ? "nom_site" : "nom_departement";
		const resp_field = is_site ? "responsable_site" : "responsable_departement";
		const current_label = doc[label_field] || name;

		const dialog_fields = [
			{
				fieldname: label_field,
				label: is_site ? __("Nom du site") : __("Nom du département"),
				fieldtype: "Data",
				reqd: 1,
				default: doc[label_field] || "",
			},
			{
				fieldname: parent_field,
				label: is_site ? __("Site parent") : __("Département parent"),
				fieldtype: "Link",
				options: doctype,
				default: doc[parent_field] || "",
				get_query: () => ({
					filters: {
						actif: 1,
						name: ["!=", name],
					},
				}),
			},
		];

		if (is_site) {
			dialog_fields.push({
				fieldname: "type_site",
				label: __("Type de site"),
				fieldtype: "Select",
				options: ["", "Siège", "Usine", "Atelier", "Dépôt", "Bureau", "Autre"].join("\n"),
				default: doc.type_site || "",
			});
		}

		dialog_fields.push(
			{
				fieldname: resp_field,
				label: is_site ? __("Responsable du site") : __("Responsable du département"),
				fieldtype: "Link",
				options: "Employe",
				default: doc[resp_field] || "",
				get_query: () => ({ filters: { statut: "Actif" } }),
			},
			{
				fieldname: "couleur",
				label: __("Couleur"),
				fieldtype: "Color",
				default: doc.couleur || "",
			},
			{
				fieldname: "actif",
				label: __("Actif"),
				fieldtype: "Check",
				default: doc.actif == null ? 1 : cint(doc.actif),
			}
		);

		const dialog = new frappe.ui.Dialog({
			title: __("Modifier — {0}", [current_label]),
			fields: dialog_fields,
			primary_action_label: __("Enregistrer"),
			primary_action: (values) => {
				frappe.confirm(
					__("Confirmer la modification de {0} ?", [current_label]),
					() => {
						frappe.call({
							method:
								"aurescrm.ressources_humaines.page.organigramme_rh.organigramme_rh.update_org_node",
							args: {
								doctype,
								name,
								values,
							},
							freeze: true,
							freeze_message: __("Enregistrement…"),
							callback: () => {
								dialog.hide();
								frappe.show_alert({
									message: __("{0} mis à jour", [current_label]),
									indicator: "green",
								});
								this.refresh();
							},
						});
					}
				);
			},
		});

		dialog.show();
	}

	render_tree_node(node, mode) {
		const children = node.children || [];
		const has_children = children.length > 0;
		const is_open = this.expanded.has(node.id);

		const $node = $(`<div class="org-tree-node" data-id="${frappe.utils.escape_html(node.id)}"></div>`);
		if (node.type === "departement") {
			$node.append(this.build_department_card(node, has_children));
		} else if (node.type === "site") {
			$node.append(this.build_site_card(node, has_children));
		} else {
			$node.append(this.build_employee_card(node, has_children));
		}

		if (has_children && is_open) {
			const $children = $(`<div class="org-children"></div>`);
			children.forEach((child) => {
				$children.append(this.render_tree_node(child, mode));
			});
			$node.append($children);
		}

		return $node;
	}

	build_toggle_btn(has_children, is_open, child_count) {
		if (!has_children) return "";
		const label = is_open ? "−" : child_count > 0 ? String(child_count) : "+";
		const title = is_open
			? __("Réduire")
			: child_count > 0
			? __("Ouvrir {0} sous-élément(s)", [child_count])
			: __("Développer");
		const count_class = !is_open && child_count > 0 ? " org-toggle-count" : "";
		return `<button type="button" class="org-toggle-btn${count_class}" title="${frappe.utils.escape_html(
			title
		)}" aria-label="${frappe.utils.escape_html(title)}">${frappe.utils.escape_html(label)}</button>`;
	}

	build_employee_card(node, has_children) {
		const is_open = this.expanded.has(node.id);
		const initials = this.get_initials(node.label);
		const photo = node.photo
			? `<img class="org-avatar-img" src="${frappe.utils.escape_html(node.photo)}" alt="">`
			: `<span class="org-avatar-initials">${frappe.utils.escape_html(initials)}</span>`;
		const level_badge = this.render_level_badge(node.niveau);
		const dept_label = node.departement
			? `<span class="org-dept-label" style="color:${frappe.utils.escape_html(
					node.departement_couleur || "#667085"
			  )}" title="${frappe.utils.escape_html(node.departement)}">${frappe.utils.escape_html(
					node.departement
			  )}</span>`
			: "";
		const is_resp = !!node.is_responsable_departement;
		const is_focus = !!node.is_focus;
		const dept_color = node.departement_couleur || "";
		const border_style = dept_color
			? ` style="border-left-color: ${frappe.utils.escape_html(dept_color)}"`
			: "";
		const card_classes = [
			"org-card",
			"org-open-employe",
			"org-card-emp",
			is_resp ? "org-card-responsable" : "",
			dept_color ? "org-card-has-dept" : "",
			is_focus ? "org-card-focus" : "",
		]
			.filter(Boolean)
			.join(" ");

		return $(`
			<div class="${card_classes}" data-name="${frappe.utils.escape_html(node.id)}" role="button" tabindex="0"${border_style}>
				<div class="org-card-top">
					<div class="org-avatar">${photo}${
						is_resp
							? `<span class="org-avatar-star" title="${__("Responsable de département")}">★</span>`
							: ""
					}</div>
					<div class="org-info">
						<div class="org-name">${frappe.utils.escape_html(node.label || node.id)}${
							is_focus
								? `<span class="org-focus-tag" title="${__("Employé sélectionné")}">${__("Sélectionné")}</span>`
								: ""
						}</div>
						${node.poste ? `<div class="org-poste">${frappe.utils.escape_html(node.poste)}</div>` : ""}
						${
							node.matricule || node.site
								? `<div class="org-matricule">${frappe.utils.escape_html(
										[node.matricule, node.site].filter(Boolean).join(" - ")
								  )}</div>`
								: ""
						}
					</div>
				</div>
				${
					dept_label || level_badge
						? `<div class="org-card-footer">
							${dept_label || `<span></span>`}
							${level_badge}
						</div>`
						: ""
				}
				${this.build_toggle_btn(has_children, is_open, node.child_count || 0)}
			</div>
		`);
	}

	build_department_card(node, has_children) {
		const is_open = this.expanded.has(node.id);
		const color = node.couleur || "#667085";
		const direct = node.employee_count || 0;
		const total = node.total_employee_count || direct;
		const emp_label =
			total > 0
				? total === direct
					? __("{0} employé(s)", [total])
					: __("{0} employé(s) · {1} direct(s)", [total, direct])
				: __("Aucun employé");
		const sub_label = node.child_count ? __("{0} sous-département(s)", [node.child_count]) : "";

		return $(`
			<div class="org-card org-card-dept org-open-departement" data-name="${frappe.utils.escape_html(node.id)}" role="button" tabindex="0" style="border-left-color: ${frappe.utils.escape_html(color)}">
				${this.build_edit_btn("Departement RH", node.id)}
				<div class="org-card-top">
					<div class="org-avatar org-avatar-dept" style="background: ${frappe.utils.escape_html(color)}">
						<span class="org-avatar-initials">${frappe.utils.escape_html(this.get_initials(node.label))}</span>
					</div>
					<div class="org-info">
						<div class="org-name">${frappe.utils.escape_html(node.label || node.id)}</div>
						${node.responsable_label ? `<div class="org-poste">${__("Resp.")}: ${frappe.utils.escape_html(node.responsable_label)}</div>` : ""}
						<div class="org-matricule">${frappe.utils.escape_html(emp_label)}</div>
					</div>
				</div>
				${
					sub_label
						? `<div class="org-card-footer"><span class="org-foot-text">${frappe.utils.escape_html(sub_label)}</span></div>`
						: ""
				}
				${this.build_toggle_btn(has_children, is_open, node.child_count || 0)}
			</div>
		`);
	}

	build_site_card(node, has_children) {
		const is_open = this.expanded.has(node.id);
		const color = node.couleur || "#0ea5e9";
		const direct = node.employee_count || 0;
		const total = node.total_employee_count || direct;
		const emp_label =
			total > 0
				? total === direct
					? __("{0} employé(s)", [total])
					: __("{0} employé(s) · {1} direct(s)", [total, direct])
				: __("Aucun employé");
		const sub_label = node.child_count ? __("{0} sous-site(s)", [node.child_count]) : "";

		return $(`
			<div class="org-card org-card-site org-open-site" data-name="${frappe.utils.escape_html(node.id)}" role="button" tabindex="0" style="border-left-color: ${frappe.utils.escape_html(color)}">
				${this.build_edit_btn("Site RH", node.id)}
				<div class="org-card-top">
					<div class="org-avatar org-avatar-site" style="background: ${frappe.utils.escape_html(color)}">
						<span class="org-avatar-initials">${frappe.utils.escape_html(this.get_initials(node.label))}</span>
					</div>
					<div class="org-info">
						<div class="org-name">${frappe.utils.escape_html(node.label || node.id)}</div>
						${node.type_site ? `<div class="org-poste">${frappe.utils.escape_html(node.type_site)}</div>` : ""}
						${node.responsable_label ? `<div class="org-poste">${__("Resp.")}: ${frappe.utils.escape_html(node.responsable_label)}</div>` : ""}
						<div class="org-matricule">${frappe.utils.escape_html(emp_label)}</div>
					</div>
				</div>
				${
					sub_label
						? `<div class="org-card-footer"><span class="org-foot-text">${frappe.utils.escape_html(sub_label)}</span></div>`
						: ""
				}
				${this.build_toggle_btn(has_children, is_open, node.child_count || 0)}
			</div>
		`);
	}

	render_level_badge(niveau) {
		const value = String(niveau || "").trim();
		if (!value || value.toLowerCase() === "autre") {
			return "";
		}
		return `<span class="org-niveau">${frappe.utils.escape_html(value)}</span>`;
	}

	get_initials(label) {
		const parts = String(label || "")
			.trim()
			.split(/\s+/)
			.filter(Boolean);
		if (!parts.length) return "?";
		if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
		return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
	}
}
