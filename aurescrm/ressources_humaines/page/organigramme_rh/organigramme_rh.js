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
			if (name) frappe.set_route("Form", "Departement RH", name);
		});

		$wrap.on("click", ".org-open-site", (e) => {
			e.preventDefault();
			e.stopPropagation();
			const name = $(e.currentTarget).data("name");
			if (name) frappe.set_route("Form", "Site RH", name);
		});
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
			<div class="org-card org-card-site org-open-site" data-name="${frappe.utils.escape_html(node.id)}" role="button" tabindex="0">
				<div class="org-card-top">
					<div class="org-avatar org-avatar-site">
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
