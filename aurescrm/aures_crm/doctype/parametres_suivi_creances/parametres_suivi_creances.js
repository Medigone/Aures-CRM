// Copyright (c) 2026, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Parametres Suivi Creances", {
	refresh(frm) {
		render_generate_section(frm);
		load_stats(frm);
	},
});

function load_stats(frm) {
	frappe.call({
		method:
			"aurescrm.aures_crm.doctype.parametres_suivi_creances.parametres_suivi_creances.get_stats",
		callback(r) {
			if (!r.message) {
				return;
			}
			const { nb_clients_actifs, nb_creances_existantes } = r.message;
			let changed = false;
			if ((frm.doc.nb_clients_actifs || 0) !== nb_clients_actifs) {
				frm.doc.nb_clients_actifs = nb_clients_actifs;
				changed = true;
			}
			if ((frm.doc.nb_creances_existantes || 0) !== nb_creances_existantes) {
				frm.doc.nb_creances_existantes = nb_creances_existantes;
				changed = true;
			}
			if (changed) {
				frm.refresh_field("nb_clients_actifs");
				frm.refresh_field("nb_creances_existantes");
			}
		},
	});
}

function render_generate_section(frm) {
	const wrap = frm.fields_dict.html_bouton_generer?.wrapper;
	if (!wrap) {
		return;
	}

	$(wrap)
		.empty()
		.append(
			`<div style="
				max-width: 32rem;
				margin: 2rem auto;
				background-color: var(--card-bg);
				border-radius: 0.5rem;
				border: 0.5px solid var(--gray-300);
				padding: 2rem;
				text-align: center;
			">
				<div style="
					display: inline-flex;
					align-items: center;
					justify-content: center;
					background-color: var(--gray-100);
					border-radius: 9999px;
					padding: 0.5rem;
					margin-bottom: 1.5rem;
				">
					<svg width="1.5rem" height="1.5rem" viewBox="0 0 24 24" fill="none" style="color: var(--primary);">
						<path d="M12 4v16m8-8H4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
					</svg>
				</div>
				<h2 style="color: var(--text-color); font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">
					${__("Génération des fiches Créance Client")}
				</h2>
				<p style="color: var(--text-muted); margin-bottom: 1.5rem; font-size: 0.95rem; line-height: 1.6;">
					${__(
						"Crée une fiche « Créance Client » vide pour chaque client actif qui n’en possède pas encore. Les fiches existantes sont ignorées."
					)}
				</p>
				<button type="button" id="btn-gen-creances" class="btn btn-primary">
					${__("Générer les fiches manquantes")}
				</button>
			</div>`
		);

	$(wrap)
		.find("#btn-gen-creances")
		.on("click", () => {
			if (!frm.doc.suivi_creances_actif) {
				frappe.msgprint({
					title: __("Suivi désactivé"),
					message: __("Activez d’abord « Suivi des créances actif »."),
					indicator: "orange",
				});
				return;
			}
			frappe.confirm(
				__(
					"Confirmer la création des fiches Créance Client pour tous les clients actifs qui n’en ont pas encore ?"
				),
				() => {
					frappe.call({
						method:
							"aurescrm.aures_crm.doctype.parametres_suivi_creances.parametres_suivi_creances.generer_creances_par_client",
						freeze: true,
						freeze_message: __("Génération en cours…"),
						callback(r) {
							if (r.exc) {
								return;
							}
							const m = r.message || {};
							let msg = __("Créées : {0} — Déjà existantes (ignorées) : {1} — Total clients actifs : {2}").format(
								m.created || 0,
								m.skipped || 0,
								m.total || 0
							);
							if (m.errors && m.errors.length) {
								msg +=
									"<br><br><b>" +
									__("Erreurs") +
									":</b><ul class='mb-0'>" +
									m.errors
										.map(
											(e) =>
												"<li>" +
												frappe.utils.escape_html(e.client || "") +
												" — " +
												frappe.utils.escape_html(e.message || "") +
												"</li>"
										)
										.join("") +
									"</ul>";
							}
							frappe.msgprint({ message: msg, title: __("Résultat"), indicator: m.created ? "green" : "blue" });
							frm.reload_doc();
						},
					});
				}
			);
		});
}
