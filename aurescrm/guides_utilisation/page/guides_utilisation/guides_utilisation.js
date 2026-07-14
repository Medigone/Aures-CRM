// Copyright (c) 2026, Medigo and contributors
// License: MIT

frappe.pages["guides-utilisation"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Guides d'utilisation"),
		single_column: true,
	});

	const guides_page = new GuidesUtilisationPage(page, wrapper);
	wrapper.guides_page = guides_page;
	guides_page.setup_actions();
	guides_page.load_catalogue();
};

frappe.pages["guides-utilisation"].refresh = function (wrapper) {
	if (wrapper.guides_page) {
		wrapper.guides_page.load_catalogue();
	}
};

class GuidesUtilisationPage {
	constructor(page, wrapper) {
		this.page = page;
		this.wrapper = wrapper;
		this.catalogue = [];
		this.filtered = [];
		this.slug_to_id = {};
		this.current_id = null;
		this.can_manage = false;
		this.search = "";
		this.category = "";

		this.$root = $(`
			<div class="guides-utilisation-root">
				<aside class="guides-nav">
					<div class="guides-nav-header">${__("Catalogue")}</div>
					<div class="guides-nav-filters">
						<input type="search" class="form-control guides-search"
							placeholder="${__("Rechercher…")}" />
						<select class="form-control guides-category-filter">
							<option value="">${__("Toutes les catégories")}</option>
						</select>
					</div>
					<div class="guides-nav-list"></div>
				</aside>
				<section class="guides-content">
					<div class="guides-placeholder">
						${__("Sélectionnez un guide dans le catalogue.")}
					</div>
					<article class="guides-article" style="display:none;"></article>
				</section>
			</div>
		`).appendTo(this.page.main);

		this.$nav = this.$root.find(".guides-nav-list");
		this.$placeholder = this.$root.find(".guides-placeholder");
		this.$article = this.$root.find(".guides-article");
		this.$search = this.$root.find(".guides-search");
		this.$category = this.$root.find(".guides-category-filter");

		this.$search.on("input", () => {
			this.search = (this.$search.val() || "").trim().toLowerCase();
			this.apply_filters();
		});
		this.$category.on("change", () => {
			this.category = this.$category.val() || "";
			this.apply_filters();
		});
	}

	setup_actions() {
		frappe.call({
			method: "aurescrm.guides_utilisation.api.user_can_manage_guides",
			callback: (r) => {
				this.can_manage = !!r.message;
				if (!this.can_manage) {
					return;
				}
				this.page.set_secondary_action(__("Gérer les guides"), () => {
					frappe.set_route("List", "Guide Utilisation");
				});
				this.page.set_primary_action(__("Nouveau guide"), () => {
					frappe.new_doc("Guide Utilisation");
				});
			},
		});
	}

	load_catalogue() {
		this.$nav.html(`<div class="guides-loading">${__("Chargement…")}</div>`);

		frappe.call({
			method: "aurescrm.guides_utilisation.api.get_guides_catalogue",
			callback: (r) => {
				this.catalogue = r.message || [];
				this.slug_to_id = {};
				this.catalogue.forEach((g) => {
					this.slug_to_id[g.slug || g.id] = g.id;
				});
				this.populate_categories();
				this.apply_filters(false);

				const route_opts = frappe.route_options || {};
				const initial_id =
					route_opts.guide || (this.filtered[0] && this.filtered[0].id);
				frappe.route_options = null;
				if (initial_id) {
					this.open_guide(initial_id);
				} else if (!this.filtered.length) {
					this.$placeholder
						.text(__("Aucun guide publié n'est disponible pour le moment."))
						.show();
					this.$article.hide().empty();
				}
			},
			error: () => {
				this.$nav.html(
					`<div class="guides-empty">${__("Impossible de charger le catalogue.")}</div>`
				);
			},
		});
	}

	populate_categories() {
		const categories = [];
		this.catalogue.forEach((g) => {
			if (g.category && !categories.includes(g.category)) {
				categories.push(g.category);
			}
		});
		categories.sort();
		const current = this.category;
		this.$category.find("option:not(:first)").remove();
		categories.forEach((category) => {
			this.$category.append(
				`<option value="${frappe.utils.escape_html(category)}">${frappe.utils.escape_html(
					category
				)}</option>`
			);
		});
		this.$category.val(current);
	}

	apply_filters(keep_selection = true) {
		this.filtered = this.catalogue.filter((g) => {
			if (this.category && g.category !== this.category) {
				return false;
			}
			if (!this.search) {
				return true;
			}
			const haystack = `${g.title || ""} ${g.description || ""} ${g.category || ""}`.toLowerCase();
			return haystack.includes(this.search);
		});
		this.render_nav();
		if (keep_selection && this.current_id) {
			const still_visible = this.filtered.some((g) => g.id === this.current_id);
			if (!still_visible) {
				this.current_id = null;
				this.$placeholder
					.text(__("Sélectionnez un guide dans le catalogue."))
					.show();
				this.$article.hide().empty();
			}
		}
	}

	render_nav() {
		this.$nav.empty();
		if (!this.filtered.length) {
			this.$nav.html(`<div class="guides-empty">${__("Aucun guide disponible.")}</div>`);
			return;
		}

		const by_category = {};
		this.filtered.forEach((g) => {
			if (!by_category[g.category]) {
				by_category[g.category] = [];
			}
			by_category[g.category].push(g);
		});

		Object.keys(by_category).forEach((category) => {
			const $group = $(`
				<div class="guides-nav-group">
					<div class="guides-nav-category">${frappe.utils.escape_html(category)}</div>
					<ul class="guides-nav-items"></ul>
				</div>
			`);
			const $ul = $group.find(".guides-nav-items");

			by_category[category].forEach((g) => {
				const $li = $(`
					<li>
						<a href="#" class="guides-nav-link" data-guide-id="${frappe.utils.escape_html(g.id)}">
							<span class="guides-nav-title">${frappe.utils.escape_html(g.title)}</span>
							${
								g.description
									? `<span class="guides-nav-desc">${frappe.utils.escape_html(g.description)}</span>`
									: ""
							}
						</a>
					</li>
				`);
				$li.find("a").on("click", (e) => {
					e.preventDefault();
					this.open_guide(g.id);
				});
				$ul.append($li);
			});

			this.$nav.append($group);
		});

		if (this.current_id) {
			this.$nav.find(`.guides-nav-link[data-guide-id="${this.current_id}"]`).addClass("active");
		}
	}

	open_guide(guide_id) {
		if (!guide_id) return;

		this.current_id = guide_id;
		this.$nav.find(".guides-nav-link").removeClass("active");
		this.$nav.find(`.guides-nav-link[data-guide-id="${guide_id}"]`).addClass("active");

		this.$placeholder.hide().text(__("Chargement…")).show();
		this.$article.hide().empty();

		frappe.call({
			method: "aurescrm.guides_utilisation.api.get_guide",
			args: { guide_id },
			callback: (r) => {
				const data = r.message;
				if (!data) {
					this.$placeholder.text(__("Guide introuvable.")).show();
					return;
				}
				this.render_article(data);
			},
			error: () => {
				this.$placeholder.text(__("Impossible de charger ce guide.")).show();
			},
		});
	}

	render_article(data) {
		this.$placeholder.hide();
		const meta = [];
		if (data.numero_version) {
			meta.push(`${__("Version")} ${frappe.utils.escape_html(String(data.numero_version))}`);
		}
		if (data.publie_le) {
			meta.push(frappe.datetime.str_to_user(data.publie_le));
		}

		this.$article
			.html(
				`
			<header class="guides-article-header">
				<div class="guides-article-category">${frappe.utils.escape_html(data.category || "")}</div>
				<h1>${frappe.utils.escape_html(data.title || "")}</h1>
				${meta.length ? `<div class="guides-article-meta">${meta.join(" · ")}</div>` : ""}
			</header>
			<div class="guides-article-body">${data.html || ""}</div>
		`
			)
			.show();

		this.rewire_guide_links();
	}

	rewire_guide_links() {
		this.$article.find(".guides-article-body a[href]").each((_, el) => {
			const $a = $(el);
			const href = ($a.attr("href") || "").trim();
			if (
				!href ||
				href.startsWith("#") ||
				href.startsWith("http://") ||
				href.startsWith("https://") ||
				href.startsWith("mailto:")
			) {
				return;
			}

			let slug = href.replace(/^\/+/, "");
			if (slug.endsWith(".md")) {
				slug = slug.split("/").pop().replace(/\.md$/i, "");
			}

			const guide_id = this.slug_to_id[slug] || this.slug_to_id[href];
			if (guide_id) {
				$a.attr("href", "#");
				$a.on("click", (e) => {
					e.preventDefault();
					this.open_guide(guide_id);
				});
			}
		});
	}
}
