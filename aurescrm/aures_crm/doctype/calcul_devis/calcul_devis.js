// Copyright (c) 2026, Aures Emballages and contributors
// For license information, please see license.txt

frappe.ui.form.on("Calcul Devis", {
	refresh: function (frm) {
		frm.set_query("imposition", function () {
			return {
				filters: {
					article: frm.doc.article,
				},
			};
		});
		render_postes_html(frm);
		render_resume_html(frm);
		render_html_fiche(frm);
	},

	quantite: function (frm) {
		calculate_all(frm);
	},

	nbr_poses: function (frm) {
		calculate_all(frm);
	},

	imposition: function (frm) {
		render_html_fiche(frm);
		setTimeout(() => {
			calculate_surface(frm);
			calculate_all(frm);
		}, 500);
	},

	format_imp: function (frm) {
		calculate_surface(frm);
		calculate_all(frm);
	},

	grammage: function (frm) {
		calculate_surface(frm);
		calculate_all(frm);
	},

	cout_support_kg: function (frm) {
		calculate_support_cost(frm);
		calculate_all(frm);
	},

	marge_percent: function (frm) {
		calculate_all(frm, { sync_prix_final: true });
	},

	prix_propose_final: function (frm) {
		calculate_prix_final(frm);
	},

	article: function (frm) {
		frm.set_value("imposition", "");
		frm.set_value("nbr_poses", 0);
		frm.set_value("taux_chutes", 0);
		frm.set_value("format_imp", "");
		frm.set_value("surface_feuille", 0);
		frm.set_value("poids_feuille", 0);
		render_html_fiche(frm);
	},

	devis: function (frm) {
		if (frm.doc.devis) {
			frappe.db.get_value("Quotation", frm.doc.devis, "custom_id_client", (r) => {
				if (r && r.custom_id_client) {
					frm.set_value("client", r.custom_id_client);
				}
			});
		}
	},
});

frappe.ui.form.on("Calcul Devis Poste", {
	postes_add: function (frm) {
		calculate_all(frm);
	},

	postes_remove: function (frm) {
		calculate_all(frm);
	},

	nombre_passages: function (frm) {
		calculate_all(frm);
	},

	cout_fixe: function (frm) {
		calculate_all(frm);
	},

	unite_calcul: function (frm) {
		calculate_all(frm);
	},

	cout_variable_unitaire: function (frm) {
		calculate_all(frm);
	},

	gache_feuilles: function (frm) {
		calculate_all(frm);
	},
});

function calculate_surface(frm) {
	let surface_feuille = 0;
	let poids_feuille = 0;

	if (frm.doc.format_imp) {
		try {
			let format_str = String(frm.doc.format_imp).toLowerCase().replace("×", "x");
			if (format_str.includes("x")) {
				let parts = format_str.split("x");
				let largeur = flt(parts[0].trim());
				let hauteur = flt(parts[1].trim());

				surface_feuille = (largeur * hauteur) / 1000000;

				let grammage = cint(frm.doc.grammage) || 0;
				if (grammage > 0 && surface_feuille > 0) {
					poids_feuille = surface_feuille * grammage;
				}
			}
		} catch (e) {
			// Ignorer les erreurs de parsing
		}
	}

	frm.set_value("surface_feuille", surface_feuille);
	frm.set_value("poids_feuille", poids_feuille);

	calculate_support_cost(frm);
}

function calculate_support_cost(frm) {
	let cout_support_feuille = 0;

	let poids_feuille = flt(frm.doc.poids_feuille) || 0;
	let cout_support_kg = flt(frm.doc.cout_support_kg) || 0;

	if (poids_feuille > 0 && cout_support_kg > 0) {
		cout_support_feuille = (poids_feuille / 1000) * cout_support_kg;
	}

	frm.set_value("cout_support_feuille", cout_support_feuille);
}

function calculate_all(frm, opts) {
	opts = opts || {};
	let nbr_poses = cint(frm.doc.nbr_poses) || 1;
	let quantite = flt(frm.doc.quantite) || 0;
	let quantite_feuilles = nbr_poses > 0 ? Math.ceil(quantite / nbr_poses) : 0;
	frm.set_value("quantite_feuilles", quantite_feuilles);

	let total_gache = 0;
	(frm.doc.postes || []).forEach((poste) => {
		total_gache += cint(poste.gache_feuilles) || 0;
	});
	frm.set_value("total_gache_feuilles", total_gache);

	let feuilles_avec_gache = quantite_feuilles + total_gache;
	frm.set_value("quantite_feuilles_gache", feuilles_avec_gache);

	let cout_support_total = flt(frm.doc.cout_support_feuille) * feuilles_avec_gache;
	frm.set_value("cout_support_total", cout_support_total);

	let total_fixes = 0;
	let total_variables = 0;

	(frm.doc.postes || []).forEach((poste) => {
		let passages = cint(poste.nombre_passages) || 1;
		total_fixes += flt(poste.cout_fixe) * passages;

		let quantite_reference = 1;
		if (poste.unite_calcul === "Par feuille") {
			quantite_reference = feuilles_avec_gache;
		} else if (poste.unite_calcul === "Par 1000 unités") {
			quantite_reference = quantite / 1000;
		}

		total_variables +=
			flt(poste.cout_variable_unitaire) * passages * quantite_reference;
	});

	frm.set_value("total_couts_fixes", total_fixes);
	frm.set_value("total_couts_variables", total_variables);

	let cout_total = cout_support_total + total_fixes + total_variables;
	frm.set_value("cout_total", cout_total);

	let cout_unitaire = 0;
	if (quantite > 0) {
		cout_unitaire = cout_total / quantite;
	}
	frm.set_value("cout_unitaire", cout_unitaire);

	let marge_multiplier = 1 + flt(frm.doc.marge_percent) / 100;
	let prix_unitaire = cout_unitaire * marge_multiplier;
	frm.set_value("prix_unitaire_propose", prix_unitaire);

	// Modification manuelle de la marge : réaligner le PU final sur le PU proposé
	if (opts.sync_prix_final) {
		frm.set_value("prix_propose_final", prix_unitaire);
	}

	let prix_total = prix_unitaire * quantite;
	frm.set_value("prix_total_propose", prix_total);

	calculate_prix_final(frm);
	render_postes_html(frm);
	render_resume_html(frm);
}

function calculate_prix_final(frm) {
	let quantite = flt(frm.doc.quantite) || 0;
	let prix_final = flt(frm.doc.prix_propose_final) || 0;
	let cout_unitaire = flt(frm.doc.cout_unitaire) || 0;

	frm.set_value("prix_total_final", prix_final * quantite);

	let marge_cout = 0;
	let marge_prix = 0;
	if (prix_final > 0 && cout_unitaire > 0) {
		marge_cout = ((prix_final - cout_unitaire) / cout_unitaire) * 100;
		marge_prix = ((prix_final - cout_unitaire) / prix_final) * 100;
	}

	frm.set_value("marge_commerciale_cout", marge_cout);
	frm.set_value("marge_commerciale_prix", marge_prix);
	render_resume_html(frm);
}

function escape_html(text) {
	if (text === null || text === undefined) {
		return "";
	}
	return frappe.utils.escape_html(String(text));
}

function format_money(value) {
	return format_currency(flt(value), frappe.defaults.get_default("currency"));
}

function format_pct(value) {
	return flt(value, 2).toFixed(2) + " %";
}

/**
 * Couleur de la marge / prix selon les seuils métier :
 * ≤ 25 % rouge, > 25 % et ≤ 60 % orange, > 60 % vert.
 * @param {number} marge_prix
 * @returns {string}
 */
function get_marge_prix_color(marge_prix) {
	const value = flt(marge_prix);
	if (value <= 25) {
		return "#dc2626";
	}
	if (value <= 60) {
		return "#ea580c";
	}
	return "#1b8a5a";
}

function get_postes_production_styles() {
	return `
<style>
.postes-production {
  width: 100%;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
}
.pp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid #ebebec;
}
.pp-title {
  font-size: 15px;
  font-weight: 700;
  color: #3f3f46;
}
.pp-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.pp-add-btn,
.pp-model-btn {
  border: none;
  font-size: 13px;
  font-weight: 600;
  padding: 9px 16px;
  border-radius: 7px;
  cursor: pointer;
}
.pp-add-btn {
  background: #3f3f46;
  color: #ffffff;
}
.pp-add-btn:hover { background: #27272a; }
.pp-model-btn {
  background: #ffffff;
  color: #3f3f46;
  border: 1px solid #d4d4d8;
}
.pp-model-btn:hover { background: #f4f4f5; }
.pp-list {
  display: flex;
  flex-direction: column;
}
.pp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 22px;
  border-bottom: 1px solid #f0f0f1;
}
.pp-row:last-child { border-bottom: none; }
.pp-row-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pp-row-title {
  font-size: 14px;
  font-weight: 700;
  color: #3f3f46;
}
.pp-row-meta {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}
.pp-meta-item {
  font-size: 13px;
  color: #71717a;
}
.pp-meta-value {
  color: #52525b;
  font-weight: 600;
}
.pp-num {
  font-variant-numeric: tabular-nums;
}
.pp-row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.pp-btn-edit {
  background: none;
  border: none;
  color: #71717a;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 8px 10px;
}
.pp-btn-edit:hover { color: #3f3f46; }
.pp-btn-delete {
  background: #fdf0ef;
  color: #b3411f;
  border: 1px solid #f5d9d4;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 14px;
  border-radius: 7px;
  cursor: pointer;
}
.pp-btn-delete:hover { background: #fbe3e0; }
.pp-empty {
  padding: 16px 22px;
  font-size: 13px;
  color: #71717a;
}
</style>`;
}

function render_postes_html(frm) {
	const field = frm.get_field("html_postes");
	if (!field || !field.$wrapper) {
		return;
	}

	const editable = frm.doc.docstatus === 0;
	const postes = frm.doc.postes || [];

	let html = get_postes_production_styles();
	html += `<div class="postes-production">`;
	html += `<div class="pp-header">`;
	html += `<div class="pp-title">${__("Postes de Production")}</div>`;
	if (editable) {
		html += `<div class="pp-header-actions">`;
		html += `<button type="button" class="pp-model-btn">${__("Ajouter depuis un modèle")}</button>`;
		html += `<button type="button" class="pp-add-btn">+ ${__("Ajouter un poste")}</button>`;
		html += `</div>`;
	}
	html += `</div>`;
	html += `<div class="pp-list">`;

	if (!postes.length) {
		html += `<div class="pp-empty">${__("Aucun poste. Ajoutez un poste depuis le barème de coût fixe.")}</div>`;
	} else {
		postes.forEach((poste, idx) => {
			html += `
    <div class="pp-row">
      <div class="pp-row-main">
        <div class="pp-row-title">${escape_html(poste.libelle || __("Sans libellé"))}</div>
        <div class="pp-row-meta">
          <span class="pp-meta-item">${__("Machine")}: <span class="pp-meta-value">${escape_html(poste.machine || "—")}</span></span>
          <span class="pp-meta-item">${__("Passages")}: <span class="pp-meta-value">${cint(poste.nombre_passages) || 1}</span></span>
          <span class="pp-meta-item">${__("Gâche")}: <span class="pp-meta-value pp-num">${cint(poste.gache_feuilles) || 0}</span></span>
          <span class="pp-meta-item">${__("Coût fixe")}: <span class="pp-meta-value pp-num">${format_money(poste.cout_fixe)}</span></span>
          <span class="pp-meta-item">${__("Unité")}: <span class="pp-meta-value">${escape_html(poste.unite_calcul || "—")}</span></span>
          <span class="pp-meta-item">${__("Coût variable")}: <span class="pp-meta-value pp-num">${format_money(poste.cout_variable_unitaire)}</span></span>
        </div>
      </div>
      ${
			editable
				? `<div class="pp-row-actions">
        <button type="button" class="pp-btn-edit" data-idx="${idx}">${__("Modifier")}</button>
        <button type="button" class="pp-btn-delete" data-idx="${idx}">${__("Supprimer")}</button>
      </div>`
				: ""
		}
    </div>`;
		});
	}

	html += `</div></div>`;
	field.$wrapper.html(html);
	bind_postes_actions(frm);
}

function bind_postes_actions(frm) {
	const wrapper = frm.get_field("html_postes").$wrapper;
	wrapper.find(".pp-add-btn").off("click").on("click", function () {
		open_poste_dialog(frm, null);
	});
	wrapper.find(".pp-model-btn").off("click").on("click", function () {
		open_modele_postes_dialog(frm);
	});
	wrapper.find(".pp-btn-edit").off("click").on("click", function () {
		const idx = cint($(this).data("idx"));
		const poste = (frm.doc.postes || [])[idx];
		if (poste) {
			open_poste_dialog(frm, poste, idx);
		}
	});
	wrapper.find(".pp-btn-delete").off("click").on("click", function () {
		const idx = cint($(this).data("idx"));
		remove_poste(frm, idx);
	});
}

function open_modele_postes_dialog(frm) {
	if (frm.doc.docstatus !== 0) {
		frappe.msgprint(__("Les postes ne peuvent être ajoutés que sur un brouillon."));
		return;
	}

	const d = new frappe.ui.Dialog({
		title: __("Ajouter depuis un modèle"),
		fields: [
			{
				fieldname: "modele",
				fieldtype: "Link",
				label: __("Modèle de postes"),
				options: "Modele Postes Devis",
				reqd: 1,
				get_query: function () {
					return { filters: { is_active: 1 } };
				},
			},
		],
		primary_action_label: __("Appliquer"),
		primary_action(values) {
			if (!values.modele) {
				frappe.msgprint(__("Sélectionnez un modèle de postes."));
				return;
			}
			d.hide();
			apply_modele_postes(frm, values.modele);
		},
	});
	d.show();
}

function apply_modele_postes(frm, modele_name) {
	frappe.call({
		method:
			"aurescrm.aures_crm.doctype.modele_postes_devis.modele_postes_devis.get_postes_from_modele",
		args: { modele_name: modele_name },
		freeze: true,
		freeze_message: __("Application du modèle..."),
		callback: function (r) {
			if (!r.message || !r.message.postes) {
				return;
			}

			const existing = frm.doc.postes || [];
			const existing_baremes = new Set(
				existing.filter((p) => p.bareme).map((p) => p.bareme)
			);
			const existing_libelles = new Set(
				existing
					.filter((p) => p.libelle)
					.map((p) => String(p.libelle).trim().toLowerCase())
			);

			let added = 0;
			let skipped = 0;

			(r.message.postes || []).forEach((poste) => {
				const libelle_key = String(poste.libelle || "")
					.trim()
					.toLowerCase();
				const already_present =
					(poste.bareme && existing_baremes.has(poste.bareme)) ||
					(libelle_key && existing_libelles.has(libelle_key));

				if (already_present) {
					skipped += 1;
					return;
				}

				const row = frm.add_child("postes");
				Object.assign(row, {
					bareme: poste.bareme || "",
					libelle: poste.libelle,
					machine: poste.machine || "",
					nombre_passages: cint(poste.nombre_passages) || 1,
					cout_fixe: flt(poste.cout_fixe) || 0,
					gache_feuilles: cint(poste.gache_feuilles) || 0,
					unite_calcul: poste.unite_calcul || "Forfait",
					cout_variable_unitaire: flt(poste.cout_variable_unitaire) || 0,
					description: poste.description || "",
				});

				if (poste.bareme) {
					existing_baremes.add(poste.bareme);
				}
				if (libelle_key) {
					existing_libelles.add(libelle_key);
				}
				added += 1;
			});

			frm.refresh_field("postes");
			frm.dirty();
			calculate_all(frm);

			if (added > 0) {
				autosave_calcul_devis(frm);
			}

			frappe.msgprint({
				title: __("Modèle appliqué"),
				message: __(
					"{0} poste(s) ajouté(s), {1} déjà présent(s) ignoré(s).",
					[added, skipped]
				),
				indicator: added > 0 ? "green" : "blue",
			});
		},
	});
}

function get_poste_dialog_fields(values, is_edit) {
	values = values || {};
	return [
		{
			fieldname: "bareme",
			fieldtype: "Link",
			label: __("Barème Coût Fixe"),
			options: "Bareme Cout Fixe",
			reqd: !is_edit,
			default: values.bareme || "",
			get_query: function () {
				return { filters: { is_active: 1 } };
			},
			onchange: function () {
				const dialog = cur_dialog;
				if (!dialog || dialog._suppress_bareme_fill) {
					return;
				}
				const bareme_name = this.get_value();
				if (!bareme_name) {
					return;
				}
				fill_from_bareme(dialog, bareme_name);
			},
		},
		{ fieldtype: "Section Break" },
		{
			fieldname: "libelle",
			fieldtype: "Data",
			label: __("Libellé"),
			reqd: 1,
			default: values.libelle || "",
		},
		{
			fieldname: "machine",
			fieldtype: "Link",
			label: __("Machine (info)"),
			options: "Machine",
			default: values.machine || "",
		},
		{
			fieldname: "gache_feuilles",
			fieldtype: "Int",
			label: __("Gâche (feuilles)"),
			default: values.gache_feuilles != null ? values.gache_feuilles : 0,
			non_negative: 1,
			description: __("Gâche de calage de cette étape (non multipliée par les passages)."),
		},
		{ fieldtype: "Column Break" },
		{
			fieldname: "nombre_passages",
			fieldtype: "Int",
			label: __("Nombre de passages"),
			default: values.nombre_passages != null ? values.nombre_passages : 1,
			non_negative: 1,
		},
		{
			fieldname: "cout_fixe",
			fieldtype: "Currency",
			label: __("Coût fixe (calage/lancement)"),
			default: values.cout_fixe || 0,
		},
		{ fieldtype: "Column Break" },
		{
			fieldname: "unite_calcul",
			fieldtype: "Select",
			label: __("Unité de calcul"),
			options: "Par feuille\nPar 1000 unités\nForfait",
			default: values.unite_calcul || "Forfait",
		},
		{
			fieldname: "cout_variable_unitaire",
			fieldtype: "Currency",
			label: __("Coût variable unitaire"),
			default: values.cout_variable_unitaire || 0,
		},
		{ fieldtype: "Section Break" },
		{
			fieldname: "description",
			fieldtype: "Small Text",
			label: __("Description"),
			default: values.description || "",
		},
	];
}

function fill_from_bareme(dialog, bareme_name) {
	if (!bareme_name) {
		return;
	}
	frappe.db.get_doc("Bareme Cout Fixe", bareme_name).then((doc) => {
		dialog.set_values({
			libelle: doc.libelle || "",
			machine: doc.machine || "",
			cout_fixe: doc.cout_fixe || 0,
			unite_calcul: doc.unite_calcul || "Forfait",
			cout_variable_unitaire: doc.cout_variable_unitaire || 0,
			gache_feuilles: cint(doc.gache_feuilles) || 0,
			description: doc.notes || "",
		});
	});
}

function open_poste_dialog(frm, poste, idx) {
	const is_edit = !!poste;
	const d = new frappe.ui.Dialog({
		title: is_edit ? __("Modifier le poste") : __("Ajouter un poste"),
		fields: get_poste_dialog_fields(poste || {}, is_edit),
		primary_action_label: is_edit ? __("Enregistrer") : __("Ajouter"),
		primary_action(values) {
			if (!is_edit && !values.bareme) {
				frappe.msgprint(__("Sélectionnez un barème de coût fixe."));
				return;
			}
			if (!values.libelle) {
				frappe.msgprint(__("Le libellé est obligatoire."));
				return;
			}
			apply_poste_values(frm, values, is_edit ? idx : null);
			d.hide();
		},
	});

	// Évite que le préremplissage du barème écrase les valeurs du poste à l'ouverture.
	d._suppress_bareme_fill = true;
	d.show();

	const finish_open = () => {
		setTimeout(() => {
			d._suppress_bareme_fill = false;
		}, 300);
	};

	if (is_edit && poste) {
		const apply_dialog_values = (bareme_name) => {
			d.set_values({
				bareme: bareme_name || poste.bareme || "",
				libelle: poste.libelle || "",
				machine: poste.machine || "",
				nombre_passages: cint(poste.nombre_passages) || 1,
				cout_fixe: flt(poste.cout_fixe) || 0,
				gache_feuilles: cint(poste.gache_feuilles) || 0,
				unite_calcul: poste.unite_calcul || "Forfait",
				cout_variable_unitaire: flt(poste.cout_variable_unitaire) || 0,
				description: poste.description || "",
			});
			finish_open();
		};

		if (poste.bareme) {
			apply_dialog_values(poste.bareme);
		} else if (poste.libelle) {
			frappe.db
				.get_value("Bareme Cout Fixe", { libelle: poste.libelle }, "name")
				.then((r) => {
					apply_dialog_values((r && r.message && r.message.name) || "");
				})
				.catch(() => apply_dialog_values(""));
		} else {
			apply_dialog_values("");
		}
	} else {
		finish_open();
	}
}

function autosave_calcul_devis(frm) {
	if (frm.doc.docstatus !== 0) {
		return;
	}
	frappe.run_serially([
		() => frappe.timeout(0.2),
		() => frm.save(),
	]);
}

function apply_poste_values(frm, values, idx) {
	const data = {
		bareme: values.bareme || "",
		libelle: values.libelle,
		machine: values.machine || "",
		nombre_passages: cint(values.nombre_passages) || 1,
		cout_fixe: flt(values.cout_fixe) || 0,
		gache_feuilles: cint(values.gache_feuilles) || 0,
		unite_calcul: values.unite_calcul || "Forfait",
		cout_variable_unitaire: flt(values.cout_variable_unitaire) || 0,
		description: values.description || "",
	};

	if (idx != null && frm.doc.postes && frm.doc.postes[idx]) {
		Object.assign(frm.doc.postes[idx], data);
	} else {
		const row = frm.add_child("postes");
		Object.assign(row, data);
	}

	frm.refresh_field("postes");
	frm.dirty();
	calculate_all(frm);
	autosave_calcul_devis(frm);
}

function remove_poste(frm, idx) {
	const poste = (frm.doc.postes || [])[idx];
	if (!poste) {
		return;
	}
	frappe.confirm(
		__("Supprimer le poste « {0} » ?", [poste.libelle || __("Sans libellé")]),
		function () {
			const grid = frm.get_field("postes").grid;
			if (grid && grid.grid_rows && grid.grid_rows[idx]) {
				grid.grid_rows[idx].remove();
			} else {
				frm.doc.postes.splice(idx, 1);
				frm.refresh_field("postes");
			}
			frm.dirty();
			calculate_all(frm);
			autosave_calcul_devis(frm);
		}
	);
}

function render_resume_html(frm) {
	const field = frm.get_field("html_resume");
	if (!field || !field.$wrapper) {
		return;
	}

	const cout_unitaire = flt(frm.doc.cout_unitaire);
	const prix_ref = flt(frm.doc.prix_unitaire_propose);

	let marge_cout_ref = 0;
	let marge_prix_ref = 0;
	if (prix_ref > 0 && cout_unitaire > 0) {
		marge_cout_ref = ((prix_ref - cout_unitaire) / cout_unitaire) * 100;
		marge_prix_ref = ((prix_ref - cout_unitaire) / prix_ref) * 100;
	}

	const marge_cout_final = flt(frm.doc.marge_commerciale_cout);
	const marge_prix_final = flt(frm.doc.marge_commerciale_prix);
	const marge_cout_color = "#3f3f46";
	const marge_prix_ref_color = get_marge_prix_color(marge_prix_ref);
	const marge_prix_final_color = get_marge_prix_color(marge_prix_final);

	const html = `
<div style="width:100%; background:white; border-radius:12px; padding:22px; box-shadow:0 1px 3px rgba(0,0,0,0.08); display:flex; flex-direction:column; gap:18px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <div style="display:flex; gap:12px;">
    <div style="flex:1; background:#f4f4f5; border-radius:8px; padding:14px 16px;">
      <div style="font-size:11px; color:#71717a; margin-bottom:6px;">${__("Coût total")}</div>
      <div style="font-size:20px; font-weight:700; color:#3f3f46; font-variant-numeric: tabular-nums;">${format_money(frm.doc.cout_total)}</div>
    </div>
    <div style="flex:1; background:#f4f4f5; border-radius:8px; padding:14px 16px;">
      <div style="font-size:11px; color:#71717a; margin-bottom:6px;">${__("Total final")}</div>
      <div style="font-size:20px; font-weight:700; color:#3454ba; font-variant-numeric: tabular-nums;">${format_money(frm.doc.prix_total_final)}</div>
    </div>
    <div style="flex:1; background:#f4f4f5; border-radius:8px; padding:14px 16px;">
      <div style="font-size:11px; color:#71717a; margin-bottom:6px;">${__("Marge / coût")}</div>
      <div style="font-size:20px; font-weight:700; color:${marge_cout_color}; font-variant-numeric: tabular-nums;">${format_pct(marge_cout_final)}</div>
    </div>
    <div style="flex:1; background:#f4f4f5; border-radius:8px; padding:14px 16px;">
      <div style="font-size:11px; color:#71717a; margin-bottom:6px;">${__("Marge / prix")}</div>
      <div style="font-size:20px; font-weight:700; color:${marge_prix_final_color}; font-variant-numeric: tabular-nums;">${format_pct(marge_prix_final)}</div>
    </div>
  </div>

  <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px;">

    <div style="display:flex; flex-direction:column; gap:8px;">
      <div style="font-size:11px; font-weight:700; letter-spacing:0.06em; color:#3f3f46; padding-bottom:6px; border-bottom:2px solid #3f3f46; margin-bottom:2px;">${__("COÛTS")}</div>
      <div style="display:flex; justify-content:space-between; padding:4px 6px; border-radius:5px;">
        <span style="font-size:13px; color:#52525b;">${__("Coût unitaire")}</span>
        <span style="font-size:13px; font-weight:600; font-variant-numeric: tabular-nums;">${format_money(frm.doc.cout_unitaire)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; padding:4px 6px; border-radius:5px; background:#f4f4f5;">
        <span style="font-size:13px; color:#52525b;">${__("Support/Papier")}</span>
        <span style="font-size:13px; font-weight:600; font-variant-numeric: tabular-nums;">${format_money(frm.doc.cout_support_total)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; padding:4px 6px; border-radius:5px;">
        <span style="font-size:13px; color:#52525b;">${__("Fixes")}</span>
        <span style="font-size:13px; font-weight:600; font-variant-numeric: tabular-nums;">${format_money(frm.doc.total_couts_fixes)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; padding:4px 6px; border-radius:5px; background:#f4f4f5;">
        <span style="font-size:13px; color:#52525b;">${__("Variables")}</span>
        <span style="font-size:13px; font-weight:600; font-variant-numeric: tabular-nums;">${format_money(frm.doc.total_couts_variables)}</span>
      </div>
    </div>

    <div style="display:flex; flex-direction:column; gap:8px;">
      <div style="font-size:11px; font-weight:700; letter-spacing:0.06em; color:#3454ba; padding-bottom:6px; border-bottom:2px solid #3454ba; margin-bottom:2px;">${__("PRIX RÉF.")}</div>
      <div style="display:flex; justify-content:space-between; padding:4px 6px; border-radius:5px;">
        <span style="font-size:13px; color:#52525b;">${__("PU réf.")}</span>
        <span style="font-size:13px; font-weight:600; font-variant-numeric: tabular-nums;">${format_money(frm.doc.prix_unitaire_propose)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; padding:4px 6px; border-radius:5px; background:#f4f4f5;">
        <span style="font-size:13px; color:#52525b;">${__("Total réf.")}</span>
        <span style="font-size:13px; font-weight:600; font-variant-numeric: tabular-nums;">${format_money(frm.doc.prix_total_propose)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; padding:4px 6px; border-radius:5px;">
        <span style="font-size:13px; color:#52525b;">${__("Marge / coût")}</span>
        <span style="font-size:13px; font-weight:600; color:${marge_cout_color}; font-variant-numeric: tabular-nums;">${format_pct(marge_cout_ref)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; padding:4px 6px; border-radius:5px; background:#f4f4f5;">
        <span style="font-size:13px; color:#52525b;">${__("Marge / prix")}</span>
        <span style="font-size:13px; font-weight:600; color:${marge_prix_ref_color}; font-variant-numeric: tabular-nums;">${format_pct(marge_prix_ref)}</span>
      </div>
    </div>

    <div style="display:flex; flex-direction:column; gap:8px;">
      <div style="font-size:11px; font-weight:700; letter-spacing:0.06em; color:#1b8a5a; padding-bottom:6px; border-bottom:2px solid #1b8a5a; margin-bottom:2px;">${__("PRIX FINAL")}</div>
      <div style="display:flex; justify-content:space-between; padding:4px 6px; border-radius:5px;">
        <span style="font-size:13px; color:#52525b;">${__("PU final")}</span>
        <span style="font-size:13px; font-weight:700; font-variant-numeric: tabular-nums;">${format_money(frm.doc.prix_propose_final)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; padding:4px 6px; border-radius:5px; background:#f4f4f5;">
        <span style="font-size:13px; color:#52525b;">${__("Total final")}</span>
        <span style="font-size:13px; font-weight:600; font-variant-numeric: tabular-nums;">${format_money(frm.doc.prix_total_final)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; padding:4px 6px; border-radius:5px;">
        <span style="font-size:13px; color:#52525b;">${__("Marge / coût")}</span>
        <span style="font-size:13px; font-weight:600; color:${marge_cout_color}; font-variant-numeric: tabular-nums;">${format_pct(marge_cout_final)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; padding:4px 6px; border-radius:5px; background:#f4f4f5;">
        <span style="font-size:13px; color:#52525b;">${__("Marge / prix")}</span>
        <span style="font-size:13px; font-weight:600; color:${marge_prix_final_color}; font-variant-numeric: tabular-nums;">${format_pct(marge_prix_final)}</span>
      </div>
    </div>

  </div>
</div>
`;

	field.$wrapper.html(html);
}

/**
 * Affiche le bouton Fiche Technique dans le champ HTML html_fiche.
 * @param {object} frm
 */
function render_html_fiche(frm) {
	const html_field = frm.fields_dict.html_fiche;
	if (!html_field) {
		return;
	}

	html_field.$wrapper.empty();

	if (!frm.doc.article) {
		html_field.$wrapper.html(`
			<div style="padding: 20px; text-align: center; background-color: #f8f9fa; border-radius: 8px; margin-bottom: 15px;">
				<div style="font-size: 14px; color: #8d99a6;">
					<i class="fa fa-info-circle" style="margin-right: 8px;"></i>
					${__("Aucun article sélectionné")}
				</div>
			</div>
		`);
		return;
	}

	html_field.$wrapper.html(`
		<div style="padding: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
			<button type="button" class="btn btn-primary btn-sm btn-fiche-technique-cd">
				${__("Fiche Technique")}
			</button>
			<button type="button" class="btn btn-secondary btn-sm btn-fichier-imposition-cd"
				${!frm.doc.imposition ? "disabled" : ""}
				title="${frm.doc.imposition ? __("Ouvrir le fichier d'imposition") : __("Aucune imposition sélectionnée")}">
				${__("Fichier Imposition")}
			</button>
		</div>
	`);

	html_field.$wrapper.find(".btn-fiche-technique-cd").on("click", function () {
		show_fiche_technique_readonly(frm.doc.article);
	});

	html_field.$wrapper.find(".btn-fichier-imposition-cd").on("click", function () {
		open_fichier_imposition(frm.doc.imposition);
	});
}

/**
 * Ouvre le fichier attaché (fichier_imp) de l'Imposition liée.
 * @param {string} imposition_name
 */
function open_fichier_imposition(imposition_name) {
	if (!imposition_name) {
		frappe.msgprint({
			title: __("Imposition non sélectionnée"),
			message: __("Veuillez d'abord sélectionner une imposition."),
			indicator: "orange",
		});
		return;
	}

	frappe.show_alert({ message: __("Récupération du lien fichier..."), indicator: "blue" }, 2);

	frappe.call({
		method: "frappe.client.get_value",
		args: {
			doctype: "Imposition",
			filters: { name: imposition_name },
			fieldname: "fichier_imp",
		},
		callback: function (r) {
			if (r.message && r.message.fichier_imp) {
				const file_path = r.message.fichier_imp;
				try {
					window.open(frappe.urllib.get_full_url(file_path), "_blank");
				} catch (e) {
					frappe.msgprint({
						title: __("Erreur"),
						message: __("Impossible de construire l'URL pour:") + ` ${file_path}`,
						indicator: "red",
					});
				}
			} else {
				frappe.msgprint({
					title: __("Fichier non trouvé"),
					message: __(
						"Aucun fichier attaché à l'imposition {0} dans le champ 'fichier_imp'.",
						[imposition_name]
					),
					indicator: "orange",
				});
			}
		},
		error: function (err) {
			frappe.msgprint({
				title: __("Erreur Serveur"),
				message: __("Erreur récupération chemin fichier.") + "<br>" + (err.message || ""),
				indicator: "red",
			});
		},
	});
}

/**
 * Affiche les spécifications techniques de l'article en lecture seule
 * (mêmes champs que Étude Faisabilité, sans possibilité de mise à jour).
 * @param {string} article_name
 */
function show_fiche_technique_readonly(article_name) {
	if (!article_name) {
		frappe.msgprint({
			title: __("Article non sélectionné"),
			message: __("Veuillez d'abord sélectionner un article."),
			indicator: "orange",
		});
		return;
	}

	frappe.call({
		method: "frappe.client.get",
		args: {
			doctype: "Item",
			name: article_name,
		},
		callback: function (r) {
			if (!r.message) {
				frappe.msgprint({
					title: __("Article non trouvé"),
					message: __("Impossible de trouver l'article sélectionné."),
					indicator: "red",
				});
				return;
			}

			const item = r.message;
			const procede = item.custom_procédé || "";

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
				"custom_marquage_à_froid",
				"custom_couleur_marquage_à_chaud",
				"custom_notice",
				"custom_cotations_article",
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
				"custom_texte_braille",
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
				"custom_poids_bobine",
			];

			const champsAfficher =
				procede === "Offset" ? champsOffset : procede === "Flexo" ? champsFlexo : [];

			frappe.model.with_doctype("Item", function () {
				const fields = [];
				const meta = frappe.get_meta("Item");
				let in_fiche_technique_tab = false;

				meta.fields.forEach((field) => {
					if (field.fieldtype === "Tab Break" && field.fieldname === "custom_fiche_technique") {
						in_fiche_technique_tab = true;
					} else if (field.fieldtype === "Tab Break" && in_fiche_technique_tab) {
						in_fiche_technique_tab = false;
					} else if (in_fiche_technique_tab) {
						if (
							["Section Break", "Column Break"].indexOf(field.fieldtype) === -1 &&
							(champsAfficher.length === 0 || champsAfficher.includes(field.fieldname))
						) {
							fields.push({
								label: __(field.label),
								fieldname: field.fieldname,
								fieldtype: field.fieldtype,
								options: field.options,
								default: item[field.fieldname],
								read_only: 1,
							});
						}
					}
				});

				if (fields.length === 0) {
					frappe.msgprint({
						title: __("Aucune spécification technique"),
						message: __(
							"Aucun champ n'a été trouvé dans l'onglet Fiche Technique pour cet article."
						),
						indicator: "blue",
					});
					return;
				}

				const d = new frappe.ui.Dialog({
					title: __("Spécifications Techniques - ") + item.item_name,
					fields: fields,
					secondary_action_label: __("Fermer"),
					secondary_action: function () {
						d.hide();
					},
				});

				d.show();
			});
		},
	});
}
