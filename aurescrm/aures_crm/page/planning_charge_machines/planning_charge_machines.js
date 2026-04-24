// Copyright (c) 2026, Medigo and contributors
// License: MIT

/** Icône calendrier (colonne date : en-tête + lignes). */
const PLANNING_DATE_ICON_SVG = `<svg class="planning-date-icon" width="12" height="12" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M15 4V2M15 4V6M15 4H10.5M3 10V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V10H3Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M3 10V6C3 4.89543 3.89543 4 5 4H7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M7 2V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M21 10V6C21 4.89543 20.1046 4 19 4H18.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;

/** Icône machine / presse (en-tête colonnes machines). */
const PLANNING_MACHINE_ICON_SVG = `<svg class="planning-machine-icon" width="12" height="12" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M12 11H14.5H17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M12 7H14.5H17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M8 15V3.6C8 3.26863 8.26863 3 8.6 3H20.4C20.7314 3 21 3.26863 21 3.6V17C21 19.2091 19.2091 21 17 21V21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M5 15H8H12.4C12.7314 15 13.0031 15.2668 13.0298 15.5971C13.1526 17.1147 13.7812 21 17 21H8H6C4.34315 21 3 19.6569 3 18V17C3 15.8954 3.89543 15 5 15Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;

/** Livraison (carte job). */
const PLANNING_JOB_DELIVERY_ICON_SVG = `<svg class="planning-job-icon" width="12" height="12" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M8 19C9.10457 19 10 18.1046 10 17C10 15.8954 9.10457 15 8 15C6.89543 15 6 15.8954 6 17C6 18.1046 6.89543 19 8 19Z" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M18 19C19.1046 19 20 18.1046 20 17C20 15.8954 19.1046 15 18 15C16.8954 15 16 15.8954 16 17C16 18.1046 16.8954 19 18 19Z" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M10.05 17H15V6.6C15 6.26863 14.7314 6 14.4 6H1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M5.65 17H3.6C3.26863 17 3 16.7314 3 16.4V11.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M2 9L6 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M15 9H20.6101C20.8472 9 21.0621 9.13964 21.1584 9.35632L22.9483 13.3836C22.9824 13.4604 23 13.5434 23 13.6273V16.4C23 16.7314 22.7314 17 22.4 17H20.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M15 17H16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg>`;

/** Planification (calendrier + coche) sur carte job. */
const PLANNING_JOB_PLANIF_ICON_SVG = `<svg class="planning-job-icon" width="12" height="12" viewBox="0 0 24 24" stroke-width="1.5" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M13 21H5C3.89543 21 3 20.1046 3 19V10H21V15M15 4V2M15 4V6M15 4H10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M3 10V6C3 4.89543 3.89543 4 5 4H7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M7 2V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M21 10V6C21 4.89543 20.1046 4 19 4H18.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M16 20L18 22L22 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;

/** Édition planif. (machine / date) sur carte job. */
const PLANNING_EDIT_ICON_SVG = `<svg class="job-planning-edit-icon" width="12" height="12" viewBox="0 0 24 24" stroke-width="1.5" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M10 21H5C3.89543 21 3 20.1046 3 19V10H21M15 4V2M15 4V6M15 4H10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M3 10V6C3 4.89543 3.89543 4 5 4H7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M7 2V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M21 10V6C21 4.89543 20.1046 4 19 4H18.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M21.6669 16.6667C21.0481 15.097 19.635 14 17.9906 14C16.2322 14 14.7382 15.2545 14.1973 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M19.9951 16.772H21.4001C21.7314 16.772 22.0001 16.5034 22.0001 16.172V14.5498" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M14.3341 19.3333C14.9529 20.903 16.366 22 18.0103 22C19.7687 22 21.2628 20.7455 21.8037 19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M16.0049 19.228H14.5999C14.2686 19.228 13.9999 19.4966 13.9999 19.828V21.4502" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;

frappe.pages["planning-charge-machines"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Planning charge machines"),
		single_column: true,
	});

	const planning_page = new PlanningChargeMachinesPage(page, wrapper);
	wrapper.planning_page = planning_page;

	page.set_primary_action(__("Actualiser"), () => planning_page.refresh(), "refresh");

	page.add_inner_button(__("CSV"), () => planning_page.export_csv(), __("Exporter"));
	page.add_inner_button(__("Excel"), () => planning_page.export_excel(), __("Exporter"));

	planning_page.setup_filters();
	planning_page.refresh();
};

frappe.pages["planning-charge-machines"].refresh = function (wrapper) {
	if (wrapper.planning_page) {
		wrapper.planning_page.refresh();
	}
};

class PlanningChargeMachinesPage {
	constructor(page, wrapper) {
		this.page = page;
		this.wrapper = wrapper;
		this.$body = $(`<div class="planning-charge-machines planning-charge-root"></div>`).appendTo(
			this.page.main
		);
		this.last_data = null;
	}

	setup_filters() {
		const today = frappe.datetime.get_today();
		const in30 = frappe.datetime.add_days(today, 30);

		this.df_from = this.page.add_field({
			fieldname: "date_from",
			label: __("Du"),
			fieldtype: "Date",
			default: frappe.datetime.add_days(today, -30),
			change: () => this.refresh(),
		});

		this.df_to = this.page.add_field({
			fieldname: "date_to",
			label: __("Au"),
			fieldtype: "Date",
			default: in30,
			change: () => this.refresh(),
		});

		this.df_granularity = this.page.add_field({
			fieldname: "granularity",
			label: __("Regroupement (jour / semaine / mois)"),
			fieldtype: "Select",
			options: ["Jour", "Semaine", "Mois"].join("\n"),
			default: "Jour",
			change: () => this.refresh(),
		});

		this.df_machine = this.page.add_field({
			fieldname: "machine",
			label: __("Machine"),
			fieldtype: "Link",
			options: "Machine",
			description: __(
				"Vide : toutes les presses offset. Sinon : filtrer sur cette machine (recherche parmi les presses offset)."
			),
			get_query: () => ({
				filters: {
					type_equipement: "Presse Offset",
					procede: "Offset",
				},
			}),
			change: () => this.refresh(),
		});

		this.df_temporal_basis = this.page.add_field({
			fieldname: "temporal_basis",
			label: __("Origine des dates"),
			fieldtype: "Select",
			options: ["Planification", "Livraison"].join("\n"),
			default: "Planification",
			description: __(
				"Planning limité au procédé offset et aux presses offset. Planification : échéances / dates planif. Livraison : dates de livraison (commande)."
			),
			change: () => this.refresh(),
		});

		this.df_urgence = this.page.add_field({
			fieldname: "niveau_urgence",
			label: __("Urgence"),
			fieldtype: "Select",
			options: ["", "U0", "U1", "U2", "U3"].join("\n"),
			change: () => this.refresh(),
		});

		this.df_src_fais = this.page.add_field({
			fieldname: "src_faisabilite",
			label: __("Inclure faisabilité"),
			fieldtype: "Check",
			default: 1,
			change: () => this.refresh(),
		});

		this.df_src_tech = this.page.add_field({
			fieldname: "src_technique",
			label: __("Inclure étude technique"),
			fieldtype: "Check",
			default: 1,
			change: () => this.refresh(),
		});

	}

	/** Convertit la valeur du select français vers l’API (day/week/month). */
	granularity_api_value() {
		const v = this.df_granularity.get_value();
		const map = { Jour: "day", Semaine: "week", Mois: "month" };
		return map[v] || "day";
	}

	get_sources() {
		const s = [];
		if (this.df_src_fais.get_value()) s.push("faisabilite");
		if (this.df_src_tech.get_value()) s.push("technique");
		return s;
	}

	/** Paramètres d’export (chaînes) pour POST / Excel — évite null JSON dans le formulaire. */
	build_export_form_params() {
		const sources = this.get_sources();
		return {
			date_from: this.df_from.get_value() || "",
			date_to: this.df_to.get_value() || "",
			temporal_basis: this.df_temporal_basis.get_value() || "",
			granularity: this.granularity_api_value(),
			machine: this.df_machine.get_value() || "",
			niveau_urgence: this.df_urgence.get_value() || "",
			sources: sources.join(","),
		};
	}

	refresh() {
		const sources = this.get_sources();
		if (!sources.length) {
			this.last_data = null;
			this.$body.html(
				`<div class="planning-charge-print-region">${this.build_print_banner_html({})}<div class="text-muted">${__(
					"Sélectionnez au moins une source."
				)}</div></div>`
			);
			return;
		}

		frappe.call({
			method: "aurescrm.aures_crm.page.planning_charge_machines.planning_charge_machines.get_planning_charge",
			args: {
				date_from: this.df_from.get_value(),
				date_to: this.df_to.get_value(),
				temporal_basis: this.df_temporal_basis.get_value(),
				granularity: this.granularity_api_value(),
				machine: this.df_machine.get_value() || null,
				niveau_urgence: this.df_urgence.get_value() || null,
				sources: sources.join(","),
			},
			freeze: true,
			callback: (r) => {
				if (!r.exc) {
					this.last_data = r.message;
					this.render_pivot(r.message);
				}
			},
		});
	}

	/** Classe CSS fond très clair selon urgence (U0–U3). */
	urgenceRowClass(raw) {
		let u = (raw || "U0").toString().trim().toUpperCase();
		if (!["U0", "U1", "U2", "U3"].includes(u)) u = "U0";
		return `job-row--urg-${u.toLowerCase()}`;
	}

	/** Trait vertical gauche : couleurs alignées sur la légende (faisabilité / étude technique). */
	sourceStripeClass(sourceKey) {
		const k = (sourceKey || "").toString().trim().toLowerCase();
		if (k === "faisabilite") return "job-row--src-faisabilite";
		if (k === "technique") return "job-row--src-technique";
		return "";
	}

	normalizeIndicator(ind) {
		const x = (ind || "gray")
			.toString()
			.toLowerCase()
			.replace(/\s+/g, "");
		const greyMap = { grey: "gray", darkgrey: "gray" };
		const k = greyMap[x] || x;
		const ok = ["green", "blue", "orange", "red", "yellow", "gray", "purple", "pink"];
		return ok.includes(k) ? k : "gray";
	}

	/** Badge pastille unique (statut dossier, statut machine) : même forme que Q.ART / Q.F. */
	renderIndicatorPill(badge, titleHint) {
		if (!badge || !badge.label) return "";
		const ind = this.normalizeIndicator(badge.indicator);
		const esc = frappe.utils.escape_html;
		const hint = titleHint ? `${titleHint}: ${badge.label}` : badge.label;
		return `<span class="planning-pill planning-pill--compact planning-pill--ind-${ind}" title="${esc(hint)}">${esc(
			badge.label
		)}</span>`;
	}

	/** Bandeau réservé à l’impression : titre, horodatage, filtres appliqués. */
	build_print_banner_html(meta) {
		const esc = frappe.utils.escape_html;
		const metaIn = meta || {};
		const du = this.df_from.get_value();
		const au = this.df_to.get_value();
		const nowDt = frappe.datetime.str_to_user(frappe.datetime.now_datetime(), true, true);
		const srcParts = [];
		if (this.df_src_fais.get_value()) {
			srcParts.push(__("Faisabilité"));
		}
		if (this.df_src_tech.get_value()) {
			srcParts.push(__("Étude technique"));
		}
		const filtRows = [
			[
				__("Période"),
				`${frappe.datetime.str_to_user(du, true, true)} — ${frappe.datetime.str_to_user(au, true, true)}`,
			],
			[
				__("Fenêtre serveur (max. 90 j.)"),
				metaIn.date_from && metaIn.date_to
					? `${metaIn.date_from} — ${metaIn.date_to}`
					: __("—"),
			],
			[__("Regroupement"), this.df_granularity.get_value() || __("—")],
			[__("Machine"), this.df_machine.get_value() || __("Toutes")],
			[__("Origine des dates"), this.df_temporal_basis.get_value() || __("—")],
			[__("Urgence"), this.df_urgence.get_value() || __("Toutes")],
			[__("Sources"), srcParts.length ? srcParts.join(", ") : __("—")],
		];
		const filtBody = filtRows
			.map(([k, v]) => {
				const vs = v == null || v === "" ? __("—") : String(v);
				return `<tr><th scope="row" class="planning-print-filters-k">${esc(k)}</th><td class="planning-print-filters-v">${esc(
					vs
				)}</td></tr>`;
			})
			.join("");
		return `<header class="planning-print-header" aria-label="${esc(__("En-tête d’impression"))}">
			<h1 class="planning-print-title">${esc(__("Planning charge machines"))}</h1>
			<p class="planning-print-datetime">${esc(__("Imprimé le"))} ${esc(nowDt)}</p>
			<table class="planning-print-filters-table">${filtBody}</table>
		</header>`;
	}

	render_pivot(data) {
		const machines = data.machines || [];
		const dates = data.dates || [];
		const cells = data.cells || {};
		const totals = data.totals || {};
		const by_m = totals.by_machine || {};

		if (!machines.length) {
			const emptyBanner = this.build_print_banner_html(data.meta || {});
			this.$body.html(
				`<div class="planning-charge-print-region">${emptyBanner}<div class="text-muted">${__(
					"Aucune machine / charge pour ces filtres."
				)}</div></div>`
			);
			return;
		}

		const meta = data.meta || {};
		const printBanner = this.build_print_banner_html(meta);
		const tbLbl = meta.temporal_basis_label || "";
		const axisHint =
			meta.temporal_basis === "livraison_client"
				? `${tbLbl} — ${__("dates de livraison (commande / étude)")}`
				: `${tbLbl} — ${__("charge machines offset (échéances / planif.)")}`;
		let html = printBanner;
		html += `<p class="text-muted small planning-axis-hint">${frappe.utils.escape_html(axisHint)}</p>`;
		html += `<div class="planning-charge-scroll"><table class="table table-bordered planning-pivot"><thead><tr>`;
		html += `<th class="sticky-corner"><span class="planning-th-date-label">${PLANNING_DATE_ICON_SVG}<span class="planning-th-date-text">${frappe.utils.escape_html(
			__("Date")
		)}</span></span></th>`;
		for (const m of machines) {
			const tm = by_m[m.name] || { jobs: 0, feuilles: 0 };
			const headBadges = this.render_totals_pills_html(
				tm.jobs,
				tm.feuilles,
				__("Total jobs pour cette machine"),
				__("Total feuilles pour cette machine")
			);
			const stLbl = (m.machine_status_label || "").trim();
			const thTitle = stLbl
				? `${frappe.utils.escape_html(m.label)} — ${frappe.utils.escape_html(__("Statut machine"))}: ${frappe.utils.escape_html(stLbl)}`
				: frappe.utils.escape_html(m.label);
			const mIconWrap = `<span class="planning-machine-icon-wrap" aria-hidden="true">${PLANNING_MACHINE_ICON_SVG}</span>`;
			const stInd =
				m.machine_status_indicator != null && String(m.machine_status_indicator).trim() !== ""
					? this.normalizeIndicator(m.machine_status_indicator)
					: "gray";
			const stTitleAttr =
				stLbl !== ""
					? frappe.utils.escape_html(`${__("Statut machine")}: ${stLbl}`)
					: "";
			const statusDot =
				stLbl !== ""
					? `<span class="machine-head-status-dot machine-head-status-dot--ind-${stInd}" title="${stTitleAttr}" aria-label="${stTitleAttr}" role="img"></span>`
					: "";
			const nameRow = `<div class="machine-head-name-row"><span class="machine-head-text">${frappe.utils.escape_html(
				m.label
			)}</span>${statusDot}</div>`;
			const line1Left = `<div class="machine-head-line1-left">${mIconWrap}${nameRow}</div>`;
			html += `<th class="machine-col" title="${thTitle}">
				<div class="machine-head-row">
					<div class="machine-head-line1">
						${line1Left}
						<div class="date-cell-badges machine-head-badges">${headBadges}</div>
					</div>
				</div>
			</th>`;
		}
		html += `</tr></thead><tbody>`;

		for (const d of dates) {
			const dk = d.key;
			const row_tot = totals.by_date[dk] || { jobs: 0, feuilles: 0 };
			html += `<tr><td class="date-cell sticky-date">${this.render_date_column_header(
				d.label,
				row_tot.jobs,
				row_tot.feuilles
			)}</td>`;
			for (const m of machines) {
				const cell = (cells[dk] && cells[dk][m.name]) || { jobs: [], job_count: 0, feuilles_sum: 0 };
				html += `<td class="pivot-cell" data-date="${frappe.utils.escape_html(dk)}" data-machine="${frappe.utils.escape_html(
					m.name
				)}">`;
				html += this.render_cell_jobs(cell.jobs || []);
				html += `<div class="cell-foot text-muted small">${cell.job_count} · <strong>${format_fe(
					cell.feuilles_sum
				)}</strong> ${__("f.")}</div>`;
				html += `</td>`;
			}
			html += `</tr>`;
		}

		html += `</tbody>`;

		html += `</table></div>`;
		html += `<div class="planning-legend text-muted small mt-2">
			<span class="legend-item"><span class="legend-dot" style="background:#3498db"></span> ${__(
				"Faisabilité (prévu)"
			)}</span>
			<span class="legend-item"><span class="legend-dot" style="background:#f39c12"></span> ${__(
				"Étude technique"
			)}</span>
		</div>`;

		this.$body.html(`<div class="planning-charge-print-region">${html}</div>`);
		this.bind_cell_clicks();
	}

	/** Badges jobs + feuilles (ligne date, en-tête machine, etc.). */
	render_totals_pills_html(jobCount, feuillesSum, titleJobs, titleFeuilles) {
		const tj = titleJobs || __("Total jobs sur cette ligne");
		const tf = titleFeuilles || __("Total feuilles sur cette ligne");
		const jobsPill = `<span class="planning-pill planning-pill-row-jobs" title="${frappe.utils.escape_html(tj)}">
			<span class="planning-pill-label">${__("Jobs")}</span>
			<span class="planning-pill-value">${jobCount}</span>
		</span>`;
		const feuillesPill = `<span class="planning-pill planning-pill-row-feuilles" title="${frappe.utils.escape_html(tf)}">
			<span class="planning-pill-label">${__("F.")}</span>
			<span class="planning-pill-value">${format_fe(feuillesSum)}</span>
		</span>`;
		return `${jobsPill}${feuillesPill}`;
	}

	/** Première colonne corps : libellé de date + badges totaux pour la ligne. */
	render_date_column_header(label, jobCount, feuillesSum) {
		const lbl = frappe.utils.escape_html(label);
		return `<div class="date-cell-inner">
			<div class="date-cell-title-row">${PLANNING_DATE_ICON_SVG}<span class="date-cell-title">${lbl}</span></div>
			<div class="date-cell-badges date-cell-badges--stack">${this.render_totals_pills_html(jobCount, feuillesSum)}</div>
		</div>`;
	}

	render_cell_jobs(jobs) {
		if (!jobs.length) return `<div class="cell-empty">—</div>`;
		let h = `<div class="cell-jobs">`;
		const urgTitle = (code) => {
			const u = (code || "U0").toString().trim().toUpperCase();
			const c = ["U0", "U1", "U2", "U3"].includes(u) ? u : "U0";
			const labels = {
				U0: __("Aucune urgence"),
				U1: __("Faible"),
				U2: __("Modérée"),
				U3: __("Critique"),
			};
			return `${c} — ${labels[c]}`;
		};
		for (const j of jobs) {
			const urgCls = this.urgenceRowClass(j.urgence);
			const srcCls = this.sourceStripeClass(j.source_key);
			const cardUrgTitle = frappe.utils.escape_html(urgTitle(j.urgence));
			const clientCode = frappe.utils.escape_html(j.client_code || "");
			const clientName = frappe.utils.escape_html(j.client_label || "");
			const itemCode = frappe.utils.escape_html(j.item_code || "");
			const itemName = frappe.utils.escape_html(j.article_label || "");
			const qty = format_int(j.qte_article);
			const fe = format_fe(j.qte_feuilles || 0);
			const livDateStr = j.dt_livraison
				? frappe.datetime.str_to_user(j.dt_livraison, false, true)
				: "";
			const planDateStr = j.dt_planification
				? frappe.datetime.str_to_user(j.dt_planification, false, true)
				: "";
			const datesCornerParts = [];
			if (livDateStr) {
				datesCornerParts.push(
					`<span class="job-date-item" title="${frappe.utils.escape_html(__("Date de livraison"))}">${PLANNING_JOB_DELIVERY_ICON_SVG}<span class="job-date-text">${frappe.utils.escape_html(
						livDateStr
					)}</span></span>`
				);
			}
			if (planDateStr) {
				datesCornerParts.push(
					`<span class="job-date-item" title="${frappe.utils.escape_html(__("Date planification production"))}">${PLANNING_JOB_PLANIF_ICON_SVG}<span class="job-date-text">${frappe.utils.escape_html(
						planDateStr
					)}</span></span>`
				);
			}
			const datesCorner =
				datesCornerParts.length > 0
					? `<div class="job-dates-corner">${datesCornerParts.join("")}</div>`
					: "";

			const statusPill = this.renderIndicatorPill(j.status_badge, __("État dossier"));
			const qtyPill = `<span class="planning-pill planning-pill--ind-blue" title="${__(
				"Quantité article"
			)}"><span class="planning-pill-label">${__("Q.ART")}</span><span class="planning-pill-value">${qty}</span></span>`;
			const feuillesPill = `<span class="planning-pill planning-pill--ind-green" title="${__(
				"Quantité feuilles"
			)}"><span class="planning-pill-label">${__("Q.F")}</span><span class="planning-pill-value">${fe}</span></span>`;
			const metaPills = [statusPill, qtyPill, feuillesPill].filter(Boolean);
			const metaRow = metaPills.length
				? `<div class="job-meta-badges">${metaPills.join("")}</div>`
				: "";

			const clientSep =
				clientCode && clientName ? `<span class="job-inline-sep" aria-hidden="true">·</span>` : "";
			const clientBlock =
				clientCode || clientName
					? `<div class="job-client-line">${clientCode ? `<span class="job-client-code">${clientCode}</span>` : ""}${clientSep}${
							clientName ? `<span class="job-client-name">${clientName}</span>` : ""
						}</div>`
					: "";
			const articleSep =
				itemCode && itemName ? `<span class="job-inline-sep" aria-hidden="true">·</span>` : "";
			const articleBlock =
				itemCode || itemName
					? `<div class="job-article-line">${itemCode ? `<span class="job-item-code">${itemCode}</span>` : ""}${articleSep}${
							itemName ? `<span class="job-item-name">${itemName}</span>` : ""
						}</div>`
					: "";

			const editTitle = frappe.utils.escape_html(__("Modifier machine / date de planification"));
			const editBtn = `<button type="button" class="btn btn-xs job-planning-edit-btn" title="${editTitle}" aria-label="${editTitle}">${PLANNING_EDIT_ICON_SVG}</button>`;
			const headerRow =
				metaRow || datesCorner
					? `<div class="job-row-header">${metaRow || '<span class="job-meta-spacer"></span>'}${datesCorner || ""}</div>`
					: "";

			h += `<div class="job-row ${urgCls}${srcCls ? ` ${srcCls}` : ""}" data-source="${frappe.utils.escape_html(
				j.source
			)}" data-name="${frappe.utils.escape_html(j.doc_name)}" title="${cardUrgTitle}">
				${editBtn}
				${headerRow}
				${clientBlock}
				${articleBlock}
			</div>`;
		}
		h += `</div>`;
		return h;
	}

	_find_job_in_last_data(source, name) {
		const data = this.last_data;
		if (!data || !data.cells) {
			return null;
		}
		for (const dk of Object.keys(data.cells)) {
			const row = data.cells[dk];
			if (!row) {
				continue;
			}
			for (const mk of Object.keys(row)) {
				const cell = row[mk];
				for (const j of cell.jobs || []) {
					if (j.doc_name === name && j.source === source) {
						return j;
					}
				}
			}
		}
		return null;
	}

	bind_cell_clicks() {
		const self = this;
		this.$body.off("click", ".job-planning-edit-btn");
		this.$body.on("click", ".job-planning-edit-btn", function (e) {
			e.preventDefault();
			e.stopPropagation();
			const $row = $(this).closest(".job-row");
			const job = self._find_job_in_last_data($row.data("source"), $row.data("name"));
			if (job) {
				self.open_planning_job_edit(job);
			}
		});
		this.$body.off("click", ".job-row");
		this.$body.on("click", ".job-row", function () {
			const doctype = $(this).data("source");
			const name = $(this).data("name");
			if (doctype && name) {
				frappe.set_route("Form", doctype, name);
			}
		});
	}

	open_planning_job_edit(j) {
		const self = this;
		const planDefault =
			j.stored_plan_date || j.dt_planification || frappe.datetime.get_today();
		const dateLabel =
			j.source_key === "faisabilite"
				? __("Date d'échéance (planification charge)")
				: __("Date planification production");
		const d = new frappe.ui.Dialog({
			title: __("Modifier la planification"),
			fields: [
				{
					fieldname: "machine",
					label: __("Machine (presse offset)"),
					fieldtype: "Link",
					options: "Machine",
					description: __("Laisser vide pour retirer l'affectation machine."),
					get_query: () => ({
						filters: {
							type_equipement: "Presse Offset",
							procede: "Offset",
						},
					}),
					default: j.machine_doc || null,
				},
				{
					fieldname: "plan_date",
					label: dateLabel,
					fieldtype: "Date",
					reqd: 1,
					default: planDefault,
				},
			],
			primary_action_label: __("Enregistrer"),
			primary_action(values) {
				const docLabel = `${j.source} · ${j.doc_name}`;
				frappe.confirm(
					__(
						"Enregistrer la nouvelle planification ? Le document « {0} » sera mis à jour (machine et/ou date).",
						[docLabel]
					),
					() => {
						frappe.call({
							method: "aurescrm.aures_crm.page.planning_charge_machines.planning_charge_machines.update_planning_charge_job",
							args: {
								doctype: j.source,
								name: j.doc_name,
								machine: values.machine || "",
								plan_date: values.plan_date,
							},
							freeze: true,
							callback(r) {
								if (!r.exc) {
									d.hide();
									frappe.show_alert({
										message: r.message?.message || __("Planification mise à jour"),
										indicator: "green",
									});
									self.refresh();
								}
							},
						});
					},
					() => {}
				);
			},
		});
		d.show();
	}

	export_csv() {
		if (!this.last_data || !this.last_data.cells) {
			frappe.show_alert({ message: __("Rien à exporter"), indicator: "orange" });
			return;
		}
		const rows = [];
		rows.push([
			__("Date"),
			__("Machine"),
			__("Source"),
			__("Statut"),
			__("Document"),
			__("Code client"),
			__("Client"),
			__("Code article"),
			__("Article"),
			__("Qté article"),
			__("Qté feuilles"),
			__("Date livraison"),
			__("Date planif. production"),
			__("Urgence"),
		]);
		const data = this.last_data;
		for (const d of data.dates || []) {
			for (const m of data.machines || []) {
				const cell = (data.cells[d.key] && data.cells[d.key][m.name]) || {};
				for (const j of cell.jobs || []) {
					rows.push([
						d.label,
						m.label,
						j.source,
						(j.status_badge && j.status_badge.label) || j.statut || "",
						j.doc_name,
						j.client_code || "",
						j.client_label,
						j.item_code || "",
						j.article_label,
						j.qte_article,
						j.qte_feuilles,
						j.dt_livraison || "",
						j.dt_planification || "",
						j.urgence || "",
					]);
				}
			}
		}
		frappe.tools.downloadify(rows, null, __("planning_charge_machines"));
		frappe.show_alert({ message: __("Export CSV lancé"), indicator: "green" });
	}

	export_excel() {
		const sources = this.get_sources();
		if (!sources.length) {
			frappe.show_alert({
				message: __("Sélectionnez au moins une source."),
				indicator: "orange",
			});
			return;
		}
		open_url_post(frappe.request.url, {
			cmd: "aurescrm.aures_crm.page.planning_charge_machines.planning_charge_machines.export_planning_charge_excel",
			...this.build_export_form_params(),
		});
		frappe.show_alert({ message: __("Export Excel lancé"), indicator: "green" });
	}
}

function format_fe(v) {
	const n = parseFloat(v) || 0;
	if (Math.abs(n - Math.round(n)) < 0.001) return String(Math.round(n));
	return n.toFixed(1);
}

function format_int(v) {
	const n = parseInt(v, 10) || 0;
	return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
