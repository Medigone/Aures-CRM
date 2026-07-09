// Copyright (c) 2026, Medigo and contributors
// License: MIT

frappe.pages["organigramme-rh"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Organigramme"),
		single_column: true,
	});

	const organigramme = new OrganigrammeRH(page);
	wrapper.organigramme = organigramme;

	page.set_primary_action(__("Actualiser"), () => organigramme.refresh(), "refresh");
	page.add_inner_button(__("Tout déplier"), () => organigramme.toggle_all(true));
	page.add_inner_button(__("Tout replier"), () => organigramme.toggle_all(false));

	organigramme.setup_filters();
	organigramme.refresh();
};

frappe.pages["organigramme-rh"].refresh = function (wrapper) {
	if (wrapper.organigramme) {
		wrapper.organigramme.refresh();
	}
};

class OrganigrammeRH {
	constructor(page) {
		this.page = page;
		this.$container = $('<div class="org-rh-container"></div>').appendTo(this.page.main);
	}

	setup_filters() {
		this.site_field = this.page.add_field({
			fieldname: "site",
			label: __("Site"),
			fieldtype: "Link",
			options: "Site RH",
			change: () => this.refresh(),
		});
		this.departement_field = this.page.add_field({
			fieldname: "departement",
			label: __("Département"),
			fieldtype: "Link",
			options: "Departement RH",
			change: () => this.refresh(),
		});
		this.pre_integres_field = this.page.add_field({
			fieldname: "inclure_pre_integres",
			label: __("Inclure pré-intégrés"),
			fieldtype: "Check",
			change: () => this.refresh(),
		});
	}

	async refresh() {
		const r = await frappe.call({
			method:
				"aurescrm.ressources_humaines.page.organigramme_rh.organigramme_rh.get_organigramme_data",
			args: {
				site: this.site_field.get_value() || null,
				departement: this.departement_field.get_value() || null,
				inclure_pre_integres: this.pre_integres_field.get_value() ? 1 : 0,
			},
			freeze: true,
			freeze_message: __("Chargement de l'organigramme..."),
		});
		this.build_tree(r.message || []);
		this.render();
	}

	build_tree(employes) {
		this.employes = employes;
		this.by_name = {};
		this.children_map = {};

		employes.forEach((emp) => {
			this.by_name[emp.name] = emp;
		});
		employes.forEach((emp) => {
			const manager = emp.responsable_hierarchique;
			// Un employé dont le responsable n'est pas affiché (filtré, sorti...)
			// devient une racine de l'arbre.
			if (manager && this.by_name[manager]) {
				(this.children_map[manager] = this.children_map[manager] || []).push(emp);
			}
		});
		this.roots = employes.filter(
			(emp) =>
				!emp.responsable_hierarchique || !this.by_name[emp.responsable_hierarchique]
		);

		// Trier les racines : les plus grosses équipes d'abord.
		const count_descendants = (emp) => {
			const children = this.children_map[emp.name] || [];
			return children.reduce((total, child) => total + 1 + count_descendants(child), 0);
		};
		this.descendants_count = {};
		employes.forEach((emp) => {
			this.descendants_count[emp.name] = count_descendants(emp);
		});
		this.roots.sort(
			(a, b) => this.descendants_count[b.name] - this.descendants_count[a.name]
		);
	}

	render() {
		this.$container.empty();

		if (!this.employes.length) {
			this.$container.append(`
				<div class="org-rh-empty text-muted">
					${__("Aucun employé actif à afficher.")}
					${__("Renseignez le champ « Responsable hiérarchique » sur les fiches employés pour construire l'organigramme.")}
				</div>
			`);
			return;
		}

		const $tree = $('<div class="org-rh-tree"></div>');
		this.roots.forEach((root) => $tree.append(this.render_node(root, 0)));
		this.$container.append($tree);
	}

	render_node(emp, depth) {
		const children = this.children_map[emp.name] || [];
		// Trier les enfants : équipes les plus grosses d'abord, puis alphabétique.
		children.sort(
			(a, b) =>
				this.descendants_count[b.name] - this.descendants_count[a.name] ||
				(a.nom_complet || "").localeCompare(b.nom_complet || "")
		);

		const $node = $('<div class="org-rh-node"></div>');
		const $card = $(this.get_card_html(emp, children.length));
		$node.append($card);

		if (children.length) {
			const $children = $('<div class="org-rh-children"></div>');
			children.forEach((child) => $children.append(this.render_node(child, depth + 1)));
			$node.append($children);

			// Par défaut : niveau racine déplié, le reste replié (à ouvrir au clic).
			const expanded = depth < 1;
			$node.toggleClass("org-rh-collapsed", !expanded);

			$card.find(".org-rh-toggle").on("click", (e) => {
				e.stopPropagation();
				$node.toggleClass("org-rh-collapsed");
			});
		}

		$card.find(".org-rh-name a").on("click", (e) => {
			e.preventDefault();
			frappe.set_route("Form", "Employe", emp.name);
		});

		return $node;
	}

	get_card_html(emp, direct_reports) {
		const esc = frappe.utils.escape_html;
		const nom = esc(emp.nom_complet || emp.name);
		const details = [emp.poste, emp.departement, emp.site]
			.filter(Boolean)
			.map((v) => esc(v))
			.join(" · ");
		const total = this.descendants_count[emp.name];

		const toggle = direct_reports
			? `<button class="btn btn-xs org-rh-toggle" title="${__("Déplier / replier")}">
					<span class="org-rh-chevron">▸</span>
					<span class="org-rh-count">${direct_reports}</span>
				</button>`
			: "";

		const badge_pre_integre =
			emp.statut === "Pré-intégré"
				? `<span class="indicator-pill orange org-rh-badge">${__("Pré-intégré")}</span>`
				: "";

		const total_html =
			total && total !== direct_reports
				? `<span class="org-rh-total text-muted" title="${__("Effectif total sous ce responsable")}">${total}</span>`
				: "";

		return `
			<div class="org-rh-card">
				${this.get_avatar_html(emp)}
				<div class="org-rh-info">
					<div class="org-rh-name">
						<a href="/app/employe/${encodeURIComponent(emp.name)}">${nom}</a>
						${badge_pre_integre}
					</div>
					<div class="org-rh-details text-muted">${details || __("Poste non renseigné")}</div>
				</div>
				${total_html}
				${toggle}
			</div>
		`;
	}

	get_avatar_html(emp) {
		if (emp.photo) {
			return `<img class="org-rh-avatar" src="${encodeURI(emp.photo)}" alt="">`;
		}
		const initials = (emp.nom_complet || "?")
			.split(" ")
			.filter(Boolean)
			.map((word) => word[0])
			.slice(0, 2)
			.join("")
			.toUpperCase();
		return `<div class="org-rh-avatar org-rh-avatar-initials">${frappe.utils.escape_html(initials)}</div>`;
	}

	toggle_all(expand) {
		this.$container
			.find(".org-rh-node")
			.toggleClass("org-rh-collapsed", !expand);
	}
}
