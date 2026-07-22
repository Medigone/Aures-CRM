// Copyright (c) 2026, Aures Emballages and contributors
// For license information, please see license.txt

frappe.ui.form.on("Modele Postes Devis", {
	setup: function (frm) {
		frm.set_query("bareme", "postes", function () {
			return {
				filters: {
					is_active: 1,
				},
			};
		});
	},

	refresh: function (frm) {
		frm.clear_custom_buttons();
		setup_active_button(frm);
		render_postes_html(frm);

		if (!frm.is_new() && !frm.doc.is_active) {
			frm.dashboard.set_headline_alert(
				__("Ce modèle est inactif et ne pourra pas être appliqué aux Calculs Devis."),
				"orange"
			);
		} else {
			frm.dashboard.clear_headline();
		}
	},

	is_active: function (frm) {
		frm.set_value("status", cint(frm.doc.is_active) ? "Actif" : "Inactif");
	},
});

function setup_active_button(frm) {
	if (frm.is_new()) {
		return;
	}

	const is_active = cint(frm.doc.is_active);
	const action_text = is_active ? __("Désactiver") : __("Activer");
	const new_value = is_active ? 0 : 1;

	frm.add_custom_button(action_text, function () {
		frappe.confirm(
			__("Êtes-vous sûr de vouloir {0} ce modèle ?", [action_text.toLowerCase()]),
			function () {
				frm.set_value("is_active", new_value);
				frm.set_value("status", new_value ? "Actif" : "Inactif");
				frm.save().then(() => {
					frappe.show_alert({
						message: is_active
							? __("Le modèle a été désactivé.")
							: __("Le modèle a été activé."),
						indicator: "green",
					});
				});
			}
		);
	});
}

function escape_html(text) {
	if (text === null || text === undefined) {
		return "";
	}
	return frappe.utils.escape_html(String(text));
}

function count_postes_by_categorie(postes) {
	const counts = {};
	(postes || []).forEach((poste) => {
		const cat = (poste.categorie || "").trim() || __("Sans catégorie");
		counts[cat] = (counts[cat] || 0) + 1;
	});
	return Object.keys(counts)
		.sort((a, b) => a.localeCompare(b, "fr"))
		.map((categorie) => ({ categorie, count: counts[categorie] }));
}

function get_modele_postes_styles() {
	return `
<style>
.mpod-postes {
  width: 100%;
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}
.mpod-recap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--subtle-fg, #f8f8f9);
}
.mpod-recap-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: #fff;
  font-size: 12px;
  color: var(--text-color);
}
.mpod-recap-chip strong {
  font-weight: 700;
  color: var(--text-color);
}
.mpod-recap-empty {
  font-size: 12px;
  color: var(--text-muted);
}
.mpod-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--fg-color);
}
.mpod-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
}
.mpod-table {
  width: 100%;
  border-collapse: collapse;
  margin: 0;
}
.mpod-table th,
.mpod-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
  vertical-align: middle;
  font-size: 13px;
}
.mpod-table th {
  background: var(--subtle-fg);
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
}
.mpod-table tr:last-child td {
  border-bottom: none;
}
.mpod-table .mpod-num {
  text-align: center;
  width: 72px;
}
.mpod-table .mpod-actions {
  text-align: right;
  white-space: nowrap;
  width: 160px;
}
.mpod-empty {
  padding: 28px 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}
.mpod-btn {
  border: 1px solid var(--border-color);
  background: var(--btn-default-bg, #fff);
  color: var(--text-color);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  margin-left: 6px;
}
.mpod-btn:hover {
  background: var(--bg-light-gray, #f3f3f3);
}
.mpod-btn-primary {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.mpod-btn-primary:hover {
  filter: brightness(0.95);
}
.mpod-btn-danger {
  color: var(--danger);
  border-color: var(--danger);
}
</style>`;
}

function render_categorie_recap(postes) {
	const counts = count_postes_by_categorie(postes);
	let html = `<div class="mpod-recap">`;
	if (!counts.length) {
		html += `<span class="mpod-recap-empty">${__("Aucun poste — récapitulatif par catégorie indisponible.")}</span>`;
	} else {
		counts.forEach(({ categorie, count }) => {
			html += `<span class="mpod-recap-chip">${escape_html(categorie)} <strong>${count}</strong></span>`;
		});
	}
	html += `</div>`;
	return html;
}

function render_postes_html(frm) {
	const field = frm.get_field("html_postes");
	if (!field || !field.$wrapper) {
		return;
	}

	const postes = (frm.doc.postes || []).slice().sort((a, b) => {
		const oa = cint(a.ordre) || 0;
		const ob = cint(b.ordre) || 0;
		if (oa !== ob) {
			return oa - ob;
		}
		return (a.idx || 0) - (b.idx || 0);
	});

	let html = get_modele_postes_styles();
	html += `<div class="mpod-postes">`;
	html += render_categorie_recap(postes);
	html += `<div class="mpod-header">`;
	html += `<div class="mpod-title">${__("Postes du modèle")} (${postes.length})</div>`;
	html += `<button type="button" class="mpod-btn mpod-btn-primary mpod-add-btn">+ ${__("Ajouter un poste")}</button>`;
	html += `</div>`;

	if (!postes.length) {
		html += `<div class="mpod-empty">${__("Aucun poste. Ajoutez un poste depuis le barème de coût fixe.")}</div>`;
	} else {
		html += `<table class="mpod-table">`;
		html += `<thead><tr>
			<th class="mpod-num">${__("Ordre")}</th>
			<th>${__("Libellé")}</th>
			<th>${__("Catégorie")}</th>
			<th class="mpod-num">${__("Passages")}</th>
			<th class="mpod-actions">${__("Actions")}</th>
		</tr></thead><tbody>`;

		postes.forEach((poste) => {
			const idx = (frm.doc.postes || []).indexOf(poste);
			html += `<tr>
				<td class="mpod-num">${cint(poste.ordre) || 0}</td>
				<td>${escape_html(poste.libelle || __("Sans libellé"))}</td>
				<td>${escape_html(poste.categorie || "—")}</td>
				<td class="mpod-num">${cint(poste.nombre_passages) || 1}</td>
				<td class="mpod-actions">
					<button type="button" class="mpod-btn mpod-btn-edit" data-idx="${idx}">${__("Modifier")}</button>
					<button type="button" class="mpod-btn mpod-btn-danger mpod-btn-delete" data-idx="${idx}">${__("Supprimer")}</button>
				</td>
			</tr>`;
		});

		html += `</tbody></table>`;
	}

	html += `</div>`;
	field.$wrapper.html(html);
	bind_postes_actions(frm);
}

function bind_postes_actions(frm) {
	const wrapper = frm.get_field("html_postes").$wrapper;

	wrapper.find(".mpod-add-btn").off("click").on("click", function () {
		open_poste_dialog(frm, null);
	});

	wrapper.find(".mpod-btn-edit").off("click").on("click", function () {
		const idx = cint($(this).data("idx"));
		const poste = (frm.doc.postes || [])[idx];
		if (poste) {
			open_poste_dialog(frm, poste, idx);
		}
	});

	wrapper.find(".mpod-btn-delete").off("click").on("click", function () {
		const idx = cint($(this).data("idx"));
		remove_poste(frm, idx);
	});
}

function next_ordre(frm) {
	const postes = frm.doc.postes || [];
	if (!postes.length) {
		return 1;
	}
	return Math.max(...postes.map((p) => cint(p.ordre) || 0)) + 1;
}

function open_poste_dialog(frm, poste, idx) {
	const is_edit = !!poste;
	const defaults = poste || {};

	const d = new frappe.ui.Dialog({
		title: is_edit ? __("Modifier le poste") : __("Ajouter un poste"),
		fields: [
			{
				fieldname: "bareme",
				fieldtype: "Link",
				label: __("Barème Coût Fixe"),
				options: "Bareme Cout Fixe",
				reqd: 1,
				default: defaults.bareme || "",
				get_query: function () {
					return { filters: { is_active: 1 } };
				},
				onchange: function () {
					if (d._suppress_bareme_fill) {
						return;
					}
					const bareme_name = this.get_value();
					if (!bareme_name) {
						return;
					}
					frappe.db.get_value(
						"Bareme Cout Fixe",
						bareme_name,
						["libelle", "categorie"],
						(r) => {
							if (!r) {
								return;
							}
							d.set_value("libelle", r.libelle || "");
							d.set_value("categorie", r.categorie || "");
						}
					);
				},
			},
			{
				fieldname: "libelle",
				fieldtype: "Data",
				label: __("Libellé"),
				read_only: 1,
				default: defaults.libelle || "",
			},
			{
				fieldname: "categorie",
				fieldtype: "Data",
				label: __("Catégorie"),
				read_only: 1,
				default: defaults.categorie || "",
			},
			{
				fieldname: "ordre",
				fieldtype: "Int",
				label: __("Ordre"),
				reqd: 1,
				default: defaults.ordre != null ? defaults.ordre : next_ordre(frm),
				non_negative: 1,
			},
			{
				fieldname: "nombre_passages",
				fieldtype: "Int",
				label: __("Nombre de passages"),
				reqd: 1,
				default: defaults.nombre_passages != null ? defaults.nombre_passages : 1,
				non_negative: 1,
			},
		],
		primary_action_label: is_edit ? __("Enregistrer") : __("Ajouter"),
		primary_action(values) {
			if (!values.bareme) {
				frappe.msgprint(__("Sélectionnez un barème de coût fixe."));
				return;
			}
			if (cint(values.nombre_passages) < 1) {
				frappe.msgprint(__("Le nombre de passages doit être au moins 1."));
				return;
			}
			if (cint(values.ordre) < 0) {
				frappe.msgprint(__("L'ordre doit être positif."));
				return;
			}

			const duplicate = (frm.doc.postes || []).some((row, i) => {
				if (is_edit && i === idx) {
					return false;
				}
				return row.bareme === values.bareme;
			});
			if (duplicate) {
				frappe.msgprint(__("Ce barème est déjà présent dans le modèle."));
				return;
			}

			apply_poste_values(frm, values, is_edit ? idx : null);
			d.hide();
		},
	});

	d._suppress_bareme_fill = true;
	d.show();
	setTimeout(() => {
		d._suppress_bareme_fill = false;
	}, 300);
}

function apply_poste_values(frm, values, idx) {
	const payload = {
		bareme: values.bareme,
		libelle: values.libelle || "",
		categorie: values.categorie || "",
		ordre: cint(values.ordre) || 1,
		nombre_passages: cint(values.nombre_passages) || 1,
	};

	if (idx == null) {
		const row = frm.add_child("postes");
		Object.assign(row, payload);
	} else {
		const row = (frm.doc.postes || [])[idx];
		if (!row) {
			return;
		}
		Object.assign(row, payload);
	}

	frm.refresh_field("postes");
	frm.dirty();
	render_postes_html(frm);
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
			render_postes_html(frm);
		}
	);
}
