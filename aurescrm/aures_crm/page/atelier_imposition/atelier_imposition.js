// Copyright (c) 2026, Medigo and contributors
// License: MIT

const ATELIER_ICON_PDF = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v6h6"/></svg>`;

frappe.pages["atelier-imposition"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Atelier d'imposition"),
		single_column: true,
	});
	const atelier = new AtelierImposition(page, wrapper);
	wrapper.atelier_imposition = atelier;
	atelier.demarrer();
};

frappe.pages["atelier-imposition"].refresh = function (wrapper) {
	if (wrapper.atelier_imposition) {
		wrapper.atelier_imposition.relire_route();
	}
};

class AtelierImposition {
	constructor(page, wrapper) {
		this.page = page;
		this.wrapper = wrapper;
		this.$body = $(`<div class="atelier-imposition"></div>`).appendTo(this.page.main);
		this.calcul = null;
		this.etude = null;
		this.contexte = {};
		this.resultat = null;
		this.formats = new ListeFormats(this);
		this.table = new TableScenarios(this);
		this.apercus = new ApercuPose(this);
		this.journal = new JournalCalcul(this);
		this.timer = null;
		this.recalcul_requis = false;
		this.droits = {};
		this._realtime_ok = false;
		this._silencieux = false;
		this._silencieux_n = 0;
		this._route_calcul = null;
		this._deja_charge = false;
		this._chiffre_obsolete = false;
		this._params_ouverts = false;
		this._champs_optionnels = [
			"pont",
			"sens_fibre",
			"trait_commun_autorise",
			"lisiere",
			"pince",
			"marge_arriere",
		];
	}

	demarrer() {
		this.setup_filters();
		this.ecouter_realtime();
		this.page.set_primary_action(__("Calculer"), () => this.lancer_calcul(), "play");
		this.page.add_inner_button(__("Paramètres"), () => this.basculer_parametres());
		this.page.add_inner_button(__("Créer l'Imposition"), () => this.creer_imposition());
		this.page.add_inner_button(__("Ouvrir le PDF"), () => this.ouvrir_pdf());
		this.page.add_inner_button(__("Historique"), () => this.charger_historique(true));
		this.page.add_inner_button(__("Ouvrir l'Étude"), () => this.ouvrir_etude());
		this.rendre_coquille();
		this._appliquer_visibilite_params();
		this.afficher_comparatif();
		this.rendre_simulation();
		this.relire_route();
		frappe.router.on("change", () => this.desarmer_secours());
	}

	relire_route() {
		const route = frappe.get_route() || [];
		const options = frappe.route_options;
		frappe.route_options = null;
		const calcul_route = (options && options.calcul) || route[1] || null;
		const etude_opt = options && options.etude;
		const article_opt = options && options.article;
		const meme =
			this._deja_charge &&
			calcul_route === this._route_calcul &&
			!etude_opt &&
			!article_opt;
		if (meme) {
			return;
		}
		this._deja_charge = true;
		this._route_calcul = calcul_route;
		if (calcul_route) {
			this.calcul = calcul_route;
		}
		if (etude_opt) {
			this.etude = etude_opt;
		}
		const demarrer = () =>
			this.charger_contexte({ preremplir: true }).then(() => {
				if (this.calcul) {
					return this.charger_calcul(this.calcul);
				}
			});
		if (article_opt) {
			this.set_val("article", article_opt).then(demarrer);
		} else {
			demarrer();
		}
	}

	setup_filters() {
		this.page.add_field({
			fieldname: "article",
			label: __("Article"),
			fieldtype: "Link",
			options: "Item",
			change: () => {
				if (!this._silencieux) {
					this.charger_contexte({ preremplir: false });
				}
			},
		});
		this.page.add_field({
			fieldname: "quantite",
			label: __("Quantité"),
			fieldtype: "Int",
			change: () => {
				if (!this._silencieux) {
					this.marquer_chiffre_obsolète();
				}
			},
		});
		this.page.add_field({
			fieldname: "pont",
			label: __("Pont mini (mm)"),
			fieldtype: "Float",
			default: 2.5,
			change: () => {
				if (!this._silencieux) {
					this.exiger_recalcul();
					this.preparer_si_trace();
				}
			},
		});
		this.page.add_field({
			fieldname: "sens_fibre",
			label: __("Sens fibre"),
			fieldtype: "Select",
			options: "Libre\n0°\n90°",
			default: "Libre",
			change: () => {
				if (!this._silencieux) {
					this.exiger_recalcul();
					this.preparer_si_trace();
				}
			},
		});
		this.page.add_field({
			fieldname: "trait_commun_autorise",
			label: __("Trait commun"),
			fieldtype: "Check",
			default: 1,
			change: () => {
				if (!this._silencieux) {
					this.exiger_recalcul();
					this.preparer_si_trace();
				}
			},
		});
		this.page.add_field({
			fieldname: "lisiere",
			label: __("Lisière (mm)"),
			fieldtype: "Float",
			default: 15.6,
			change: () => {
				if (!this._silencieux) {
					this.exiger_recalcul();
				}
			},
		});
		this.page.add_field({
			fieldname: "pince",
			label: __("Pince (mm)"),
			fieldtype: "Float",
			default: 10,
			change: () => {
				if (!this._silencieux) {
					this.exiger_recalcul();
				}
			},
		});
		this.page.add_field({
			fieldname: "marge_arriere",
			label: __("Marge arrière (mm)"),
			fieldtype: "Float",
			default: 15,
			change: () => {
				if (!this._silencieux) {
					this.exiger_recalcul();
				}
			},
		});
	}

	val(name) {
		const f = this.page.fields_dict[name];
		return f ? f.get_value() : null;
	}

	_entrer_silencieux() {
		this._silencieux_n = (this._silencieux_n || 0) + 1;
		this._silencieux = true;
	}

	_sortir_silencieux() {
		this._silencieux_n = Math.max(0, (this._silencieux_n || 1) - 1);
		if (!this._silencieux_n) {
			this._silencieux = false;
		}
	}

	set_val(name, value) {
		const f = this.page.fields_dict[name];
		if (!f || value === undefined || value === null) {
			return Promise.resolve();
		}
		this._entrer_silencieux();
		return Promise.resolve(f.set_value(value)).finally(() => this._sortir_silencieux());
	}

	_prefill_marges(c) {
		const b = (c && c.bornes) || {};
		const jobs = [];
		if (b.lisiere) {
			jobs.push(this.set_val("lisiere", b.lisiere));
		}
		if (b.pince) {
			jobs.push(this.set_val("pince", b.pince));
		}
		if (b.marge_arriere) {
			jobs.push(this.set_val("marge_arriere", b.marge_arriere));
		}
		return Promise.all(jobs);
	}

	peut_calculer() {
		return !!(this.fichier_trace && this.formats_coches().length);
	}

	basculer_parametres() {
		this._params_ouverts = !this._params_ouverts;
		this._appliquer_visibilite_params();
	}

	_appliquer_visibilite_params() {
		(this._champs_optionnels || []).forEach((name) => {
			const f = this.page.fields_dict[name];
			if (f && f.wrapper) {
				$(f.wrapper).toggleClass("atelier-param-cache", !this._params_ouverts);
			}
		});
	}

	afficher_comparatif() {
		this.$body.find(".atelier-formats").show();
		const on = this.peut_calculer();
		if (this.page.btn_primary) {
			this.page.btn_primary.toggle(true);
			this.page.btn_primary.prop("disabled", !on || !this.droits.creer);
		}
	}

	_args_marges() {
		return {
			lisiere: this.val("lisiere"),
			pince: this.val("pince"),
			marge_arriere: this.val("marge_arriere"),
			ignorer_contraintes_machine: 1,
		};
	}

	_args_trace() {
		return Object.assign(
			{
				fichier_trace: this.fichier_trace,
				pont: this.val("pont"),
				trait_commun_autorise: this.val("trait_commun_autorise"),
				sens_fibre: this.val("sens_fibre"),
				quantite: this.val("quantite"),
				article: this.val("article"),
				client: this.client,
				trace: this.trace,
				etude: this.etude,
				calcul: this.calcul,
				support_technique: this.contexte && this.contexte.support_technique,
			},
			this._args_marges()
		);
	}

	preparer_si_trace() {
		if (!this.fichier_trace) {
			return Promise.resolve();
		}
		return frappe.call({
			method: "aurescrm.imposition.api.preparer_trace",
			args: this._args_trace(),
			freeze: true,
			freeze_message: __("Lecture du tracé…"),
		}).then((r) => {
			const msg = r.message || {};
			this.calcul = msg.name || this.calcul;
			this._route_calcul = this.calcul;
			this.resultat = msg;
			if (this.calcul) {
				frappe.set_route("atelier-imposition", this.calcul);
			}
			return this.appliquer_contexte(msg).then(() => {
				this.rendre_entete(msg);
				this.apercus.rendre(msg);
				this.rendre_simulation();
				this.journal.rendre(msg.log_calcul);
				this.afficher_resultat_net();
				this.afficher_comparatif();
				this.griser_boutons();
				this.charger_historique();
			});
		});
	}

	rendre_coquille() {
		this.$body.html(`
			<div class="atelier-source sans-pdf">
				<div class="atelier-source-actions">
					<button class="btn btn-default btn-sm btn-deposer">${ATELIER_ICON_PDF} ${__("Déposer un PDF")}</button>
					<button class="btn btn-default btn-sm btn-trace">${__("Choisir un Tracé")}</button>
					<span class="atelier-fichier-nom text-muted">${__("Aucun PDF — déposez un tracé Esko (noir = coupe, rouge = rainage).")}</span>
					<a class="atelier-fichier-lien hidden" target="_blank">${__("Ouvrir")}</a>
				</div>
			</div>
			<div class="atelier-simulation"></div>
			<div class="atelier-formats"></div>
			<div class="atelier-entete"></div>
			<div class="atelier-corps">
				<div class="atelier-scenarios"></div>
				<div class="atelier-apercus"></div>
			</div>
			<div class="atelier-pied">
				<div class="atelier-historique"></div>
				<div class="atelier-journal"></div>
			</div>
		`);
		this.$body.find(".btn-deposer").on("click", () => this.deposer_pdf());
		this.$body.find(".btn-trace").on("click", () => this.choisir_trace());
	}

	deposer_pdf() {
		new frappe.ui.FileUploader({
			allow_multiple: false,
			restrictions: { allowed_file_types: [".pdf"], max_file_size: 40 * 1024 * 1024 },
			make_attachments_public: false,
			on_success: (file) => {
				this.fichier_trace = file.file_url;
				this.afficher_fichier(file.file_url, file.file_name);
				this.preparer_si_trace();
			},
		});
	}

	choisir_trace() {
		const d = new frappe.ui.Dialog({
			title: __("Choisir un Tracé"),
			fields: [{ fieldname: "trace", fieldtype: "Link", options: "Trace", label: __("Tracé"), reqd: 1 }],
			primary_action_label: __("Utiliser"),
			primary_action: (values) => {
				d.hide();
				this.trace = values.trace;
				this.charger_contexte({ preremplir: true }).then(() => this.preparer_si_trace());
			},
		});
		d.show();
	}

	afficher_fichier(url, nom) {
		const $src = this.$body.find(".atelier-source");
		$src.removeClass("sans-pdf");
		this.$body.find(".atelier-fichier-nom").text(nom || (url || "").split("/").pop());
		const $a = this.$body.find(".atelier-fichier-lien");
		if (url) {
			$a.attr("href", url).removeClass("hidden");
		} else {
			$a.addClass("hidden");
		}
	}

	charger_contexte(opts) {
		opts = opts || {};
		const preremplir = !!opts.preremplir;
		const args = {
			article: this.val("article"),
			trace: this.trace,
			etude: this.etude,
		};
		if (preremplir) {
			args.calcul = this.calcul;
		}
		return frappe.call({
			method: "aurescrm.aures_crm.page.atelier_imposition.atelier_imposition.get_contexte",
			args: args,
		}).then((r) => {
			const ctx = r.message || {};
			this.droits = ctx.droits || {};
			const apres = () => {
				this.charger_historique();
				this.afficher_comparatif();
				this.griser_boutons();
			};
			if (preremplir) {
				this.contexte = ctx;
				return this.appliquer_contexte(ctx).then(() => {
					this.formats.rendre(ctx.formats_proposes || []);
					apres();
				});
			}
			this.contexte = Object.assign({}, this.contexte, {
				formats_proposes: ctx.formats_proposes,
				support_technique: ctx.support_technique,
				grammage: ctx.grammage,
				pont_mini: ctx.pont_mini,
				client: ctx.client || this.contexte.client,
				droits: ctx.droits,
			});
			this.client = this.contexte.client;
			this.formats.rendre(ctx.formats_proposes || [], null, { conserver: true });
			if (!this.val("pont") && ctx.pont_mini) {
				return this.set_val("pont", ctx.pont_mini).then(() => this._prefill_marges(ctx).then(apres));
			}
			return this._prefill_marges(ctx).then(apres);
		});
	}

	appliquer_contexte(c) {
		this._entrer_silencieux();
		const jobs = [];
		if (c.article) jobs.push(this.set_val("article", c.article));
		if (c.quantite) jobs.push(this.set_val("quantite", c.quantite));
		if (c.pont) jobs.push(this.set_val("pont", c.pont));
		if (c.sens_fibre) jobs.push(this.set_val("sens_fibre", c.sens_fibre));
		if (c.lisiere != null && c.lisiere !== "") jobs.push(this.set_val("lisiere", c.lisiere));
		if (c.pince != null && c.pince !== "") jobs.push(this.set_val("pince", c.pince));
		if (c.marge_arriere != null && c.marge_arriere !== "") {
			jobs.push(this.set_val("marge_arriere", c.marge_arriere));
		}
		if (c.trait_commun_autorise !== undefined) {
			jobs.push(this.set_val("trait_commun_autorise", c.trait_commun_autorise));
		}
		this.fichier_trace = c.fichier_trace || this.fichier_trace;
		this.trace = c.trace || this.trace;
		this.etude = c.etude || this.etude;
		this.client = c.client;
		if (this.fichier_trace) {
			this.afficher_fichier(this.fichier_trace);
		}
		return Promise.all(jobs).finally(() => this._sortir_silencieux());
	}

	_restaurer_formats() {
		const coches = this.resultat.formats_etudies || [];
		const proposes = (this.contexte.formats_proposes || []).map((p) => {
			const coche = coches.some(
				(f) =>
					Math.abs(flt(f.laize) - flt(p.laize)) < 2 &&
					Math.abs(flt(f.depl) - flt(p.depl)) < 2 &&
					cint(f.bobine) === cint(p.bobine)
			);
			return Object.assign({}, p, { coche_par_defaut: coche });
		});
		coches.forEach((f) => {
			const deja = proposes.some(
				(p) =>
					Math.abs(flt(f.laize) - flt(p.laize)) < 2 &&
					Math.abs(flt(f.depl) - flt(p.depl)) < 2 &&
					cint(f.bobine) === cint(p.bobine)
			);
			if (!deja) {
				proposes.push({
					laize: f.laize,
					depl: f.depl,
					origine: f.origine || "Manuel",
					libelle: f.libelle,
					bobine: cint(f.bobine),
					coche_par_defaut: true,
				});
			}
		});
		this.formats.rendre(proposes);
	}

	formats_coches() {
		return this.formats.selection();
	}

	lancer_calcul() {
		if (!this.droits.creer) {
			frappe.msgprint(__("Permission insuffisante."));
			return;
		}
		if (!this.fichier_trace) {
			frappe.msgprint(__("Déposez d'abord un PDF de tracé."));
			return;
		}
		const formats = this.formats_coches();
		if (!formats.length) {
			frappe.msgprint(__("Cochez au moins un format du support."));
			return;
		}
		frappe.call({
			method: "aurescrm.imposition.api.lancer_calcul",
			args: Object.assign(
				{
					fichier_trace: this.fichier_trace,
					formats: formats,
					pont: this.val("pont"),
					trait_commun_autorise: this.val("trait_commun_autorise"),
					sens_fibre: this.val("sens_fibre"),
					quantite: this.val("quantite"),
					article: this.val("article"),
					client: this.client,
					trace: this.trace,
					etude: this.etude,
					calcul: this.calcul,
					support_technique: this.contexte.support_technique,
					inclure_sur_mesure: 0,
				},
				this._args_marges()
			),
			freeze: true,
			freeze_message: __("Lancement du calcul…"),
		}).then((r) => {
			const msg = r.message || {};
			this.calcul = msg.calcul;
			this._route_calcul = this.calcul;
			this.afficher_resultat_net();
			if (this.calcul) {
				frappe.set_route("atelier-imposition", this.calcul);
			}
			this.armer_secours();
			this.rendre_entete({ statut_calcul: "En cours" });
		});
	}

	charger_calcul(name) {
		this.calcul = name;
		return frappe.call({
			method: "aurescrm.imposition.api.get_calcul",
			args: { calcul: name },
		}).then((r) => {
			this.resultat = r.message || {};
			return this.appliquer_contexte(this.resultat).then(() => {
				this.afficher_fichier(this.resultat.fichier_trace);
				this.rendre_entete(this.resultat);
				this._restaurer_formats();
				this.table.rendre(this.resultat.scenarios || []);
				this.apercus.rendre(this.resultat);
				this.rendre_simulation();
				this.journal.rendre(this.resultat.log_calcul);
				this.afficher_resultat_net();
				this.afficher_comparatif();
				if (this.resultat.statut_calcul === "En cours") {
					this.armer_secours();
				} else {
					this.desarmer_secours();
				}
				this.griser_boutons();
				if (!this.resultat.cache_disponible && this.resultat.statut_calcul === "Terminé") {
					frappe.show_alert({
						message: __("Relancer le calcul pour activer la simulation."),
						indicator: "orange",
					});
				}
			});
		});
	}

	ecouter_realtime() {
		if (this.wrapper.__atelier_realtime) {
			return;
		}
		this.wrapper.__atelier_realtime = true;
		frappe.realtime.on("imposition_calcul_termine", (data) => {
			if (!data || data.calcul !== this.calcul) {
				return;
			}
			frappe.show_alert({
				message:
					data.statut_calcul === "Terminé"
						? __("Calcul terminé.")
						: __("Le calcul a échoué — voir le journal."),
				indicator: data.statut_calcul === "Terminé" ? "green" : "red",
			}, 6);
			this.charger_calcul(this.calcul);
			this.charger_historique();
		});
	}

	armer_secours() {
		this.desarmer_secours();
		this.timer = setInterval(() => {
			if (!this.calcul) {
				return;
			}
			this.charger_calcul(this.calcul);
		}, 5000);
	}

	desarmer_secours() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	exiger_recalcul() {
		if (this._silencieux) {
			return;
		}
		if (this.resultat && this.resultat.statut_calcul === "Terminé") {
			this.recalcul_requis = true;
			this.afficher_badge_recalcul(true);
			this.$body.find(".atelier-scenarios, .atelier-apercus").css("opacity", 0.45);
		}
	}

	afficher_resultat_net() {
		this.recalcul_requis = false;
		this._chiffre_obsolete = false;
		this.afficher_badge_recalcul(false);
		this.$body.find(".atelier-scenarios, .atelier-apercus").css("opacity", 1);
		this.$body.find(".atelier-hint-quantite").removeClass("visible");
	}

	marquer_chiffre_obsolète() {
		this._chiffre_obsolete = true;
		this.$body.find(".atelier-hint-quantite").addClass("visible");
	}

	afficher_badge_recalcul(on) {
		const $b = this.$body.find(".atelier-badge-recalcul");
		$b.toggleClass("visible", !!on);
	}

	rendre_entete(data) {
		const d = data || {};
		const rempl = flt(d.remplissage_bbox);
		this.$body.find(".atelier-entete").html(`
			<div class="atelier-entete-mesures">
				<div>
					<div class="text-muted">${__("Développé calculé")}</div>
					<strong>${frappe.utils.escape_html(fmt_mm(d.developpe_l))} × ${frappe.utils.escape_html(fmt_mm(d.developpe_d))} mm</strong>
				</div>
				<div>
					<div class="text-muted">${__("Surface utile")}</div>
					<strong>${frappe.utils.escape_html(fmt_num(d.surface_utile))} cm²</strong>
				</div>
				<div>
					<div class="text-muted">${__("Statut")}</div>
					<span class="indicator-pill ${d.statut_calcul === "Terminé" ? "green" : d.statut_calcul === "Échec" ? "red" : "orange"}">${frappe.utils.escape_html(d.statut_calcul || "—")}</span>
					<span class="atelier-badge-recalcul indicator-pill yellow">${__("Recalcul requis")}</span>
					<span class="atelier-hint-quantite indicator-pill blue">${__("Chiffrage à resimuler")}</span>
				</div>
				<div class="atelier-jauge">
					<div class="text-muted">${__("Remplissage bbox")} ${rempl ? rempl.toFixed(0) + " %" : ""}</div>
					<div class="atelier-jauge-barre"><div class="atelier-jauge-plein" style="width:${Math.min(100, rempl || 0)}%"></div></div>
				</div>
			</div>
		`);
		this.afficher_badge_recalcul(this.recalcul_requis);
		this.$body.find(".atelier-hint-quantite").toggleClass("visible", !!this._chiffre_obsolete);
	}

	rendre_simulation() {
		const cache = this.resultat && this.resultat.cache_disponible;
		this.$body.find(".atelier-simulation").html(`
			<h5>${__("Simulation interactive")}</h5>
			<p class="text-muted">${
				cache
					? __("Saisissez un format ou une grille. Rien n'est enregistré tant que vous ne cliquez pas « Garder ce scénario ».")
					: __("Déposez un PDF de tracé, puis saisissez un format (laize × déplacement) ou une grille.")
			}</p>
			<div class="atelier-sim-champs">
				<div class="frappe-control">
					<label>${__("Laize")}</label>
					<input type="number" class="form-control input-sim-laize" step="0.1" ${cache ? "" : "disabled"}>
				</div>
				<div class="frappe-control">
					<label>${__("Déplacement")}</label>
					<input type="number" class="form-control input-sim-depl" step="0.1" ${cache ? "" : "disabled"}>
				</div>
				<button class="btn btn-default btn-sm btn-sim-format" ${cache ? "" : "disabled"}>${__("Évaluer le format")}</button>
				<div class="frappe-control">
					<label>${__("Rotation")}</label>
					<select class="form-control input-sim-rot" ${cache ? "" : "disabled"}><option>0</option><option>90</option></select>
				</div>
				<div class="frappe-control">
					<label>${__("Colonnes")}</label>
					<input type="number" class="form-control input-sim-col" value="1" min="1" max="12" ${cache ? "" : "disabled"}>
				</div>
				<div class="frappe-control">
					<label>${__("Rangs")}</label>
					<input type="number" class="form-control input-sim-rang" value="1" min="1" max="12" ${cache ? "" : "disabled"}>
				</div>
				<button class="btn btn-default btn-sm btn-sim-grille" ${cache ? "" : "disabled"}>${__("Évaluer la grille")}</button>
				<button class="btn btn-primary btn-sm btn-garder" disabled>${__("Garder ce scénario")}</button>
			</div>
			<div class="atelier-sim-resultat text-muted" style="margin-top:8px;"></div>
		`);
		this.simulation_courante = null;
		this.$body.find(".btn-sim-format").on("click", () => this.simuler("format"));
		this.$body.find(".btn-sim-grille").on("click", () => this.simuler("grille"));
		this.$body.find(".btn-garder").on("click", () => this.garder_scenario());
	}

	simuler(mode) {
		if (!this.calcul) {
			frappe.msgprint(__("Déposez d'abord un PDF de tracé."));
			return;
		}
		const args =
			mode === "grille"
				? {
						method: "aurescrm.imposition.api.simuler_grille",
						args: Object.assign(
							{
								calcul: this.calcul,
								rotation: this.$body.find(".input-sim-rot").val(),
								n_col: this.$body.find(".input-sim-col").val(),
								n_rang: this.$body.find(".input-sim-rang").val(),
								quantite: this.val("quantite"),
							},
							this._args_marges()
						),
				  }
				: {
						method: "aurescrm.imposition.api.simuler",
						args: Object.assign(
							{
								calcul: this.calcul,
								laize: this.$body.find(".input-sim-laize").val(),
								depl: this.$body.find(".input-sim-depl").val(),
								quantite: this.val("quantite"),
							},
							this._args_marges()
						),
				  };
		frappe.call(args).then((r) => {
			const msg = r.message || {};
			const $out = this.$body.find(".atelier-sim-resultat");
			if (!msg.scenario) {
				$out.text(msg.message || __("Aucune pose."));
				this.simulation_courante = null;
				this.$body.find(".btn-garder").prop("disabled", true);
				return;
			}
			this.simulation_courante = msg.scenario;
			const s = msg.scenario;
			$out.html(
				`${frappe.utils.escape_html(s.libelle)} — ${s.nb_poses} ${__("poses")} (${s.n_col}×${s.n_rang}), ${s.taux_chutes} % ${__("chutes")}`
			);
			this.$body.find(".btn-garder").prop("disabled", false);
			this.apercus.ajouter_simulation(s);
		});
	}

	garder_scenario() {
		if (!this.simulation_courante || !this.calcul) {
			return;
		}
		frappe.call({
			method: "aurescrm.imposition.api.enregistrer_scenario",
			args: { calcul: this.calcul, scenario: this.simulation_courante },
		}).then(() => this.charger_calcul(this.calcul));
	}

	retenir(idx) {
		if (!this.resultat || !this.resultat.scenarios) {
			return;
		}
		this.resultat.scenarios.forEach((s) => {
			s.retenu = cint(s.idx) === cint(idx) ? 1 : 0;
		});
		this.table.rendre(this.resultat.scenarios);
		this.apercus.montrer(idx);
		this.griser_boutons();
	}

	creer_imposition() {
		if (!this.calcul) {
			return;
		}
		const retenus = (this.resultat.scenarios || []).filter((s) => cint(s.retenu));
		if (retenus.length !== 1) {
			frappe.msgprint(__("Retenez une ligne du tableau avant de créer l'Imposition."));
			return;
		}
		if (!this.val("article") || !this.client) {
			frappe.msgprint(__("Article et client requis pour créer l'Imposition."));
			return;
		}
		const scenario = retenus[0];
		const lancer = (message) => {
			frappe.confirm(message, () => {
				frappe.call({
					method: "aurescrm.imposition.api.creer_imposition",
					args: { calcul: this.calcul, scenario_idx: scenario.idx },
					freeze: true,
					freeze_message: __("Génération du PDF d'imposition…"),
				}).then((r) => {
					const msg = r.message || {};
					if (msg.avertissement_ideale) {
						frappe.msgprint(msg.avertissement_ideale);
					}
					if (msg.imposition) {
						frappe.show_alert({
							message: __("Imposition {0} créée", [msg.imposition]),
							indicator: "green",
						});
						this.charger_historique();
						frappe.set_route("Form", "Imposition", msg.imposition);
					}
				});
			});
		};
		frappe.db
			.get_list("Imposition", {
				filters: { article: this.val("article"), defaut: 1 },
				fields: ["name", "taux_chutes", "client", "trace"],
				limit: 5,
			})
			.then((rows) => {
				const match = (rows || []).find(
					(r) => r.client === this.client && r.trace === (this.trace || r.trace)
				);
				let message = __(
					"Cette Imposition pourra devenir l'Idéale et être reprise par les prochains Calculs Devis. Continuer ?"
				);
				if (!rows || !rows.length) {
					message = __(
						"Cette Imposition deviendra l'Idéale et sera reprise par les prochains Calculs Devis. Continuer ?"
					);
				} else if (match && flt(scenario.taux_chutes) < flt(match.taux_chutes)) {
					message = __(
						"Cette Imposition deviendra l'Idéale ({0} % < {1} %) et sera reprise par les prochains Calculs Devis. Continuer ?",
						[fmt_num(scenario.taux_chutes), fmt_num(match.taux_chutes)]
					);
				}
				lancer(message);
			});
	}

	ouvrir_pdf() {
		if (this.fichier_trace) {
			window.open(this.fichier_trace, "_blank");
		}
	}

	ouvrir_etude() {
		if (this.etude) {
			frappe.set_route("Form", "Etude Faisabilite", this.etude);
		}
	}

	charger_historique(scroll) {
		frappe.call({
			method: "aurescrm.aures_crm.page.atelier_imposition.atelier_imposition.get_historique",
			args: { article: this.val("article"), trace: this.trace, limit: 20 },
		}).then((r) => {
			const rows = r.message || [];
			let html = `<h5>${__("Historique")}</h5>`;
			if (!rows.length) {
				html += `<p class="text-muted">${__("Aucun calcul pour cet article.")}</p>`;
			} else {
				html += `<table class="table table-condensed"><thead><tr>
					<th>${__("Calcul")}</th><th>${__("Date")}</th><th>${__("Statut")}</th>
					<th>${__("Développé")}</th><th>${__("Imposition")}</th>
				</tr></thead><tbody>`;
				rows.forEach((row) => {
					html += `<tr data-calcul="${frappe.utils.escape_html(row.name)}">
						<td>${frappe.utils.escape_html(row.name)}</td>
						<td>${frappe.datetime.str_to_user(row.creation)}</td>
						<td>${frappe.utils.escape_html(row.statut_calcul || "")}</td>
						<td>${fmt_mm(row.developpe_l)} × ${fmt_mm(row.developpe_d)}</td>
						<td>${frappe.utils.escape_html(row.imposition_creee || "")}</td>
					</tr>`;
				});
				html += `</tbody></table>`;
			}
			this.$body.find(".atelier-historique").html(html);
			this.$body.find(".atelier-historique tr[data-calcul]").on("click", (e) => {
				const name = $(e.currentTarget).data("calcul");
				frappe.set_route("atelier-imposition", name);
			});
			if (scroll) {
				this.$body.find(".atelier-historique")[0].scrollIntoView({ behavior: "smooth" });
			}
		});
	}

	griser_boutons() {
		const peut_creer =
			this.droits.creer_imposition &&
			this.resultat &&
			(this.resultat.scenarios || []).filter((s) => cint(s.retenu)).length === 1 &&
			this.val("article") &&
			this.client;
		this.page.btn_secondary && this.page.btn_secondary.prop("disabled", !peut_creer);
		const $btns = this.page.inner_toolbar.find("button");
		$btns.each((_, b) => {
			const t = $(b).text();
			if (t.indexOf("Imposition") >= 0 && t.indexOf("Créer") >= 0) {
				$(b).prop("disabled", !peut_creer);
			}
			if (t.indexOf("Étude") >= 0) {
				$(b).prop("disabled", !this.etude);
			}
		});
		if (!this.droits.creer) {
			this.page.btn_primary.prop("disabled", true);
		}
		this.afficher_comparatif();
	}
}

class ListeFormats {
	constructor(atelier) {
		this.atelier = atelier;
		this.proposes = [];
	}

	rendre(proposes, _sur_mesure, opts) {
		opts = opts || {};
		if (_sur_mesure && typeof _sur_mesure === "object" && !opts.conserver) {
			opts = _sur_mesure;
		}
		proposes = (proposes || []).map((p) => Object.assign({}, p));
		const conserver = !!opts.conserver;
		const cle = JSON.stringify(
			proposes.map((p) => [Number(p.laize), Number(p.depl), p.origine || "", cint(p.bobine)])
		);
		if (conserver && cle === this._cle && this.atelier.$body.find(".chk-format").length) {
			return;
		}
		if (conserver && this.atelier.$body.find(".chk-format").length) {
			const coches = this.selection();
			const anciens = this.proposes || [];
			proposes.forEach((p) => {
				const etait = anciens.some(
					(a) =>
						Math.abs(flt(a.laize) - flt(p.laize)) < 2 &&
						Math.abs(flt(a.depl) - flt(p.depl)) < 2 &&
						cint(a.bobine) === cint(p.bobine)
				);
				if (etait) {
					p.coche_par_defaut = coches.some(
						(c) =>
							Math.abs(flt(c.laize) - flt(p.laize)) < 2 &&
							Math.abs(flt(c.depl) - flt(p.depl)) < 2 &&
							cint(c.bobine) === cint(p.bobine)
					);
				}
			});
		}
		this._cle = cle;
		this.proposes = proposes;
		let html = `<h5>${__("Formats du support")}</h5>`;
		if (!this.proposes.length) {
			html += `<p class="text-muted">${
				this.atelier.val("article")
					? __("Aucun format de feuille sur le Support Technique de cet article.")
					: __("Choisissez un article pour lister les formats de son support.")
			}</p>`;
		} else {
			this.proposes.forEach((p) => {
				html += `<label class="atelier-format-ligne">
					<input type="checkbox" class="chk-format" data-laize="${p.laize}" data-depl="${p.depl}"
						data-bobine="${cint(p.bobine)}"
						data-origine="${frappe.utils.escape_html(p.origine || "Stock")}" data-libelle="${frappe.utils.escape_html(p.libelle || "")}"
						${p.coche_par_defaut ? "checked" : ""}>
					${frappe.utils.escape_html(p.libelle || `${p.laize} × ${p.depl}`)}
				</label>`;
			});
		}
		this.atelier.$body.find(".atelier-formats").html(html);
		this.atelier.$body.find(".chk-format").on("change", () => this.atelier.afficher_comparatif());
		this.atelier.afficher_comparatif();
	}

	selection() {
		const out = [];
		this.atelier.$body.find(".chk-format:checked").each((_, el) => {
			const $el = $(el);
			out.push({
				laize: flt($el.data("laize")),
				depl: flt($el.data("depl")),
				origine: $el.data("origine"),
				libelle: $el.data("libelle"),
				bobine: cint($el.data("bobine")),
			});
		});
		return out;
	}
}

class TableScenarios {
	constructor(atelier) {
		this.atelier = atelier;
		this.tri = { champ: "taux_chutes", dir: 1 };
		this.ref_idx = null;
	}

	rendre(scenarios) {
		this.scenarios = (scenarios || []).slice();
		const champ = this.tri.champ;
		this.scenarios.sort((a, b) => {
			const va = a[champ] || 0;
			const vb = b[champ] || 0;
			return (va - vb) * this.tri.dir;
		});
		const colonnes = [
			["retenu", ""],
			["libelle", __("Format / scénario")],
			["origine", __("Origine")],
			["nb_poses", __("Poses")],
			["grille", __("Grille")],
			["pas_laize", __("Pas")],
			["trait_commun", __("Trait commun")],
			["surface_par_pose", __("Surface / pose")],
			["taux_chutes", __("% chutes")],
			["nb_feuilles", __("Feuilles")],
			["alerte", __("Alerte")],
		];
		let html = `<table class="table table-condensed"><thead><tr>`;
		colonnes.forEach(([c, lab]) => {
			html += `<th data-champ="${c}">${frappe.utils.escape_html(lab)}</th>`;
		});
		html += `</tr></thead><tbody>`;
		this.scenarios.forEach((s) => {
			const cls = cint(s.retenu) ? "retenu" : "";
			html += `<tr class="${cls}" data-idx="${s.idx}">
				<td><input type="radio" name="atelier-retenu" ${cint(s.retenu) ? "checked" : ""}></td>
				<td>${frappe.utils.escape_html(s.libelle || "")}<div class="text-muted">${fmt_mm(s.laize)} × ${fmt_mm(s.depl)}</div></td>
				<td>${frappe.utils.escape_html(s.origine || "")}</td>
				<td>${s.nb_poses || ""}</td>
				<td>${s.n_col || "?"} × ${s.n_rang || "?"}</td>
				<td>${fmt_mm(s.pas_laize)} × ${fmt_mm(s.pas_depl)}</td>
				<td>${this._trait(s)}</td>
				<td>${fmt_num(s.surface_par_pose)}</td>
				<td>${fmt_num(s.taux_chutes)}</td>
				<td>${s.nb_feuilles || ""}</td>
				<td class="text-muted">${frappe.utils.escape_html(s.alerte || "")}</td>
			</tr>`;
		});
		html += `</tbody></table>
			<p class="text-muted">${__("Aucune ligne n'est marquée recommandée : c'est vous qui retenez.")}</p>`;
		this.atelier.$body.find(".atelier-scenarios").html(html);
		this.atelier.$body.find(".atelier-scenarios th[data-champ]").on("click", (e) => {
			const c = $(e.currentTarget).data("champ");
			if (this.tri.champ === c) {
				this.tri.dir *= -1;
			} else {
				this.tri.champ = c;
				this.tri.dir = 1;
			}
			this.rendre(this.scenarios);
		});
		this.atelier.$body.find(".atelier-scenarios tbody tr").on("click", (e) => {
			const idx = $(e.currentTarget).data("idx");
			this.atelier.retenir(idx);
		});
	}

	_trait(s) {
		const parts = [];
		if (cint(s.trait_commun_laize)) {
			parts.push(__("laize"));
		}
		if (cint(s.trait_commun_depl)) {
			parts.push(__("dép."));
		}
		return parts.length ? parts.join(" + ") : "—";
	}
}

class ApercuPose {
	constructor(atelier) {
		this.atelier = atelier;
		this.uid = 0;
		this.vues = [];
		this.actif = null;
		this.silhouette = null;
		this.bornes = {};
	}

	rendre(resultat) {
		this.silhouette = (resultat && resultat.silhouette) || null;
		this.bornes = (resultat && resultat.bornes) || {};
		const scenarios = ((resultat && resultat.scenarios) || []).filter((s) => s.nb_poses);
		const sims = (this.vues || []).filter((v) => String(v.cle).indexOf("sim-") === 0);
		this.vues = scenarios.map((s) => ({ cle: String(s.idx), scenario: s }));
		sims.forEach((sim) => {
			if (!this.vues.some((v) => this._meme_pose(v.scenario, sim.scenario))) {
				this.vues.push(sim);
			}
		});
		if (!this.silhouette || !this.vues.length) {
			this.atelier.$body.find(".atelier-apercus").html(
				`<p class="text-muted">${__("L'aperçu s'affichera après un calcul ou une simulation.")}</p>`
			);
			return;
		}
		const encore = this.actif && this.vues.some((v) => v.cle === String(this.actif));
		if (encore) {
			this.montrer(this.actif);
			return;
		}
		const retenu = this.vues.find((v) => cint(v.scenario.retenu));
		this.montrer(retenu ? retenu.cle : this.vues[0].cle);
	}

	ajouter_simulation(s) {
		const r = this.atelier.resultat;
		if (r && r.silhouette) {
			this.silhouette = r.silhouette;
			this.bornes = r.bornes || this.bornes;
		}
		if (!this.silhouette) {
			return;
		}
		this.uid += 1;
		const cle = `sim-${this.uid}`;
		this.vues = this.vues || [];
		this.vues.push({
			cle: cle,
			scenario: Object.assign({}, s, { origine: s.origine || "Simulation" }),
		});
		this.montrer(cle);
	}

	montrer(cle) {
		const cible = String(cle);
		const vue = (this.vues || []).find((v) => String(v.cle) === cible);
		if (!vue || !this.silhouette) {
			return;
		}
		this.actif = cible;
		this._dessiner();
	}

	_meme_pose(a, b) {
		return (
			Math.abs(flt(a.laize) - flt(b.laize)) < 2 &&
			Math.abs(flt(a.depl) - flt(b.depl)) < 2 &&
			cint(a.n_col) === cint(b.n_col) &&
			cint(a.n_rang) === cint(b.n_rang) &&
			cint(a.rotation) === cint(b.rotation)
		);
	}

	_libelle_onglet(s) {
		return `${fmt_mm(s.laize)}×${fmt_mm(s.depl)} · ${s.n_col || "?"}×${s.n_rang || "?"}`;
	}

	_dessiner() {
		const vue = this.vues.find((v) => v.cle === this.actif) || this.vues[0];
		let onglets = "";
		this.vues.forEach((v) => {
			const actif = v.cle === this.actif ? " actif" : "";
			onglets += `<button type="button" class="atelier-apercu-onglet${actif}" data-cle="${frappe.utils.escape_html(String(v.cle))}">${frappe.utils.escape_html(this._libelle_onglet(v.scenario))}</button>`;
		});
		this.uid += 1;
		this.atelier.$body.find(".atelier-apercus").html(
			`<div class="atelier-apercu-onglets"><div class="atelier-apercu-pastilles">${onglets}</div><button type="button" class="btn btn-default btn-sm atelier-apercu-telecharger">${__("Télécharger")}</button></div>${this._svg(vue.scenario, this.silhouette, this.bornes, this.uid)}`
		);
		this.atelier.$body.find(".atelier-apercu-onglet").on("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.montrer($(e.currentTarget).attr("data-cle"));
		});
		this.atelier.$body.find(".atelier-apercu-telecharger").on("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this._exporter();
		});
		this._zoom(this.atelier.$body.find(".atelier-apercus svg"));
	}

	_exporter() {
		if (!this.atelier.calcul) {
			frappe.msgprint(__("Déposez d'abord un PDF de tracé."));
			return;
		}
		if (!this.vues.length) {
			frappe.msgprint(__("Aucune simulation à exporter."));
			return;
		}
		const champs = this.vues.map((v, i) => ({
			fieldtype: "Check",
			fieldname: `vue_${i}`,
			label: this._libelle_onglet(v.scenario),
			default: String(v.cle) === String(this.actif) ? 1 : 0,
		}));
		champs.push({ fieldtype: "Section Break" });
		champs.push({
			fieldtype: "Select",
			fieldname: "format_export",
			label: __("Format"),
			options: "PDF\nCFF2",
			default: "PDF",
			reqd: 1,
		});
		const d = new frappe.ui.Dialog({
			title: __("Exporter les simulations"),
			fields: champs,
			primary_action_label: __("Exporter"),
			primary_action: (values) => {
				const scenarios = this.vues
					.filter((v, i) => cint(values[`vue_${i}`]))
					.map((v) => {
						const s = v.scenario;
						return {
							libelle: s.libelle,
							laize: s.laize,
							depl: s.depl,
							n_col: s.n_col,
							n_rang: s.n_rang,
							pas_laize: s.pas_laize,
							pas_depl: s.pas_depl,
							rotation: s.rotation,
							trait_commun_laize: s.trait_commun_laize,
							trait_commun_depl: s.trait_commun_depl,
						};
					});
				if (!scenarios.length) {
					frappe.msgprint(__("Cochez au moins une simulation."));
					return;
				}
				const fmt = String(values.format_export || "PDF").toLowerCase() === "cff2" ? "cff2" : "pdf";
				frappe.call({
					method: "aurescrm.imposition.api.exporter_simulations",
					args: {
						calcul: this.atelier.calcul,
						scenarios: scenarios,
						format: fmt,
						format_export: fmt,
					},
					freeze: true,
					freeze_message: __("Export…"),
				}).then((r) => {
					const msg = r.message || {};
					if (!msg.file_url) {
						return;
					}
					d.hide();
					window.open(msg.file_url);
				});
			},
		});
		d.show();
		this.vues.forEach((v, i) => {
			d.set_value(`vue_${i}`, String(v.cle) === String(this.actif) ? 1 : 0);
		});
	}

	_svg(s, silhouette, bornes, uid) {
		const rot = String(s.rotation || 0);
		const paths = silhouette[rot] || silhouette["0"] || {};
		const laize = s.laize || 1020;
		const depl = s.depl || 720;
		const lisiere = bornes.lisiere || 15.6;
		const pince = bornes.pince || 10;
		const id = `pose-${uid}-${rot}`;
		const n_col = cint(s.n_col) || 1;
		const n_rang = cint(s.n_rang) || 1;
		const poses = n_col * n_rang;
		const bw = paths.l || 50;
		const bh = paths.d || 50;
		let uses = "";
		for (let i = 0; i < n_col; i++) {
			for (let j = 0; j < n_rang; j++) {
				const x = lisiere + i * (s.pas_laize || 0);
				const y = pince + j * (s.pas_depl || 0);
				if (poses > 60 && !(i === 0 && j === 0)) {
					uses += `<rect class="bbox-pose" x="${x}" y="${y}" width="${bw}" height="${bh}" fill="none" stroke="#888" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
				} else {
					uses += `<use href="#${id}" x="${x}" y="${y}"/>`;
				}
			}
		}
		return `<div class="atelier-apercu-panneau">
			<svg viewBox="0 0 ${laize} ${depl}" data-orig-viewbox="0 0 ${laize} ${depl}" preserveAspectRatio="xMidYMid meet" style="aspect-ratio:${laize} / ${depl};">
				<defs>
					<g id="${id}">
						<path d="${frappe.utils.escape_html(paths.path_coupe || "")}" stroke="#111" stroke-width="1" fill="none" vector-effect="non-scaling-stroke"/>
						<path d="${frappe.utils.escape_html(paths.path_rainage || "")}" stroke="#e11" stroke-width="1.2" fill="none" vector-effect="non-scaling-stroke"/>
					</g>
				</defs>
				<g transform="translate(0,${depl}) scale(1,-1)">
					<rect class="feuille" x="0" y="0" width="${laize}" height="${depl}" fill="#fff8fc" stroke="#e0a0e0" stroke-width="1" vector-effect="non-scaling-stroke"/>
					<rect class="zone-utile" x="${lisiere}" y="${pince}" width="${laize - 2 * lisiere}" height="${depl - pince - (bornes.marge_arriere || 15)}" fill="none" stroke="#ccc" stroke-width="1" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>
					${uses}
				</g>
			</svg>
			<div class="atelier-apercu-bandeau">${frappe.utils.escape_html(s.libelle || "")} — ${s.n_col}×${s.n_rang} — ${fmt_mm(s.laize)} × ${fmt_mm(s.depl)} mm</div>
		</div>`;
	}

	_zoom($svgs) {
		$svgs.each((_, svg) => {
			const el = svg;
			let dragging = false;
			let last = null;
			el.addEventListener("wheel", (ev) => {
				ev.preventDefault();
				const vb = el.viewBox.baseVal;
				const f = ev.deltaY > 0 ? 1.1 : 0.9;
				const nw = vb.width * f;
				const nh = vb.height * f;
				vb.x += (vb.width - nw) / 2;
				vb.y += (vb.height - nh) / 2;
				vb.width = nw;
				vb.height = nh;
			}, { passive: false });
			el.addEventListener("mousedown", (ev) => {
				dragging = true;
				last = { x: ev.clientX, y: ev.clientY };
			});
			window.addEventListener("mouseup", () => {
				dragging = false;
			});
			el.addEventListener("mousemove", (ev) => {
				if (!dragging || !last) {
					return;
				}
				const vb = el.viewBox.baseVal;
				const dx = ((ev.clientX - last.x) * vb.width) / (el.clientWidth || 1);
				const dy = ((ev.clientY - last.y) * vb.height) / (el.clientHeight || 1);
				vb.x -= dx;
				vb.y -= dy;
				last = { x: ev.clientX, y: ev.clientY };
			});
			el.addEventListener("dblclick", () => {
				const orig = el.getAttribute("data-orig-viewbox");
				if (orig) {
					el.setAttribute("viewBox", orig);
				}
			});
		});
	}
}

class JournalCalcul {
	constructor(atelier) {
		this.atelier = atelier;
	}

	rendre(log) {
		const texte = frappe.utils.escape_html(log || "");
		this.atelier.$body.find(".atelier-journal").html(
			`<details><summary>${__("Journal de calcul")}</summary><pre style="white-space:pre-wrap;font-size:12px;">${texte}</pre></details>`
		);
	}
}

function fmt_mm(v) {
	if (v === undefined || v === null || v === "") {
		return "—";
	}
	return Number(v).toFixed(1).replace(/\.0$/, "");
}

function fmt_num(v, d) {
	if (v === undefined || v === null || v === "") {
		return "—";
	}
	return Number(v).toFixed(d === undefined ? 1 : d);
}

function flt(v) {
	return parseFloat(v) || 0;
}

function cint(v) {
	return parseInt(v, 10) || 0;
}
