// Articles composés (Item) — transformation, création de sous-articles, liste HTML (onglet Sous Articles)
frappe.ui.form.on("Item", {
	refresh(frm) {
		frm.remove_custom_button(__("Créer Sous-Article"), __("Article composé"));
		frm.remove_custom_button(__("Transformer en article composé"), __("Article composé"));

		if (cint(frm.doc.custom_sous_article)) {
			frm.set_df_property("custom_article_compose", "read_only", 1);
		} else {
			frm.set_df_property("custom_article_compose", "read_only", 0);
		}

		if (!frm.is_new() && !cint(frm.doc.custom_sous_article)) {
			if (!cint(frm.doc.custom_article_compose)) {
				frm.add_custom_button(
					__("Transformer en article composé"),
					function () {
						frappe.confirm(
							__(
								"Cet article sera marqué comme article composé. Vous pourrez ensuite créer des sous-articles. Continuer ?"
							),
							function () {
								frm.set_value("custom_article_compose", 1);
								frm.save(null, function () {
									frappe.show_alert({
										message: __("Article composé activé."),
										indicator: "green",
									});
									render_sous_articles_html(frm);
								});
							},
							function () {
								// annulé
							}
						);
					},
					__("Article composé")
				);
			}
		}

		if (
			!frm.is_new() &&
			cint(frm.doc.custom_article_compose) &&
			!cint(frm.doc.custom_sous_article)
		) {
			frm.add_custom_button(
				__("Créer Sous-Article"),
				function () {
					frappe.prompt(
						[
							{
								fieldname: "designation",
								fieldtype: "Data",
								label: __("Désignation du sous-article"),
								reqd: 1,
							},
							{
								fieldname: "quantite",
								fieldtype: "Float",
								label: __("Quantité nécessaire pour l'article parent"),
								reqd: 1,
								default: 1,
							},
						],
						function (values) {
							frappe.call({
								method: "aurescrm.utils.create_sous_article",
								args: {
									parent_item: frm.doc.name,
									designation: values.designation,
									quantite: values.quantite,
								},
								freeze: true,
								freeze_message: __("Création du sous-article…"),
								callback(r) {
									if (!r.exc && r.message) {
										frappe.show_alert({
											message: __("Sous-article {0} créé.", [r.message]),
											indicator: "green",
										});
										frappe.set_route("Form", "Item", r.message);
									}
								},
							});
						},
						__("Nouveau sous-article"),
						__("Créer")
					);
				},
				__("Article composé")
			);
		}

		render_sous_articles_html(frm);
	},
});

function render_sous_articles_html(frm) {
	const field = frm.fields_dict.custom_html_liste_sous_articles;
	if (!field || !field.$wrapper) {
		return;
	}

	if (frm.is_new()) {
		field.$wrapper.html(
			`<p class="text-muted">${__("Enregistrez l'article pour afficher les sous-articles.")}</p>`
		);
		return;
	}

	if (cint(frm.doc.custom_sous_article)) {
		const parent = frm.doc.custom_article_parent;
		if (parent) {
			const href = frappe.utils.get_form_link("Item", parent);
			field.$wrapper.html(
				`<p class="text-muted">${__("Cet article est un sous-article.")}</p>
				<p><a href="${href}">${frappe.utils.escape_html(parent)}</a></p>`
			);
		} else {
			field.$wrapper.html(`<p class="text-muted">${__("Sous-article (parent non renseigné).")}</p>`);
		}
		return;
	}

	if (!cint(frm.doc.custom_article_compose)) {
		field.$wrapper.html(
			`<p class="text-muted">${__(
				"Cet article n'est pas un article composé. Utilisez « Transformer en article composé » pour activer la composition."
			)}</p>`
		);
		return;
	}

	frappe.call({
		method: "aurescrm.utils.get_sub_articles",
		args: { parent_item: frm.doc.name },
		callback(r) {
			if (!r.message || !r.message.length) {
				field.$wrapper.html(
					`<p class="text-muted">${__(
						"Aucun sous-article. Utilisez « Créer Sous-Article » dans le menu Article composé."
					)}</p>`
				);
				return;
			}

			const tableRows = r.message
				.map((row) => {
					const q =
						row.custom_quantite_sous_article != null && row.custom_quantite_sous_article !== ""
							? row.custom_quantite_sous_article
							: "";
					const desc = frappe.utils.escape_html(row.description || "");
					const code = frappe.utils.escape_html(row.name);
					const encName = encodeURIComponent(row.name || "");
					return `<tr class="sous-article-row" data-item-name="${encName}">
						<td><strong>${code}</strong></td>
						<td>${desc}</td>
						<td>${frappe.utils.escape_html(String(q))}</td>
					</tr>`;
				})
				.join("");

			// Même style que le tableau des contacts (Customer — custom_contact_html_custom)
			const css = `
				<style>
				#sous-articles-table-wrap {
					overflow-x: auto;
				}
				#sous-articles-table-inner {
					border-collapse: separate;
					border-spacing: 0;
					width: 100%;
					border: 0.4px solid #e9ecef;
					border-radius: 8px;
					overflow: hidden;
					font-size: 12px;
				}
				#sous-articles-table-inner th {
					background-color: #f2f2f2;
					border: 0.4px solid #e9ecef;
					padding: 8px;
					white-space: nowrap;
				}
				#sous-articles-table-inner td {
					border: 0.4px solid #e9ecef;
					padding: 8px;
					white-space: nowrap;
				}
				#sous-articles-table-inner thead tr:first-child th:first-child {
					border-top-left-radius: 8px;
				}
				#sous-articles-table-inner thead tr:first-child th:last-child {
					border-top-right-radius: 8px;
				}
				#sous-articles-table-inner tbody tr:last-child td:first-child {
					border-bottom-left-radius: 8px;
				}
				#sous-articles-table-inner tbody tr:last-child td:last-child {
					border-bottom-right-radius: 8px;
				}
				#sous-articles-table-inner tbody tr.sous-article-row {
					cursor: pointer;
				}
				</style>`;

			const tableHtml = `
				<div id="sous-articles-table-wrap" style="margin-top: 10px;">
					<table id="sous-articles-table-inner">
						<thead>
							<tr>
								<th>${__("ID")}</th>
								<th>${__("Désignation")}</th>
								<th>${__("Quantité")}</th>
							</tr>
						</thead>
						<tbody>${tableRows}</tbody>
					</table>
				</div>`;

			field.$wrapper.html(css + tableHtml);

			field.$wrapper
				.find("#sous-articles-table-inner tbody")
				.off("click", "tr.sous-article-row")
				.on("click", "tr.sous-article-row", function () {
					const enc = $(this).attr("data-item-name");
					if (enc) {
						frappe.set_route("Form", "Item", decodeURIComponent(enc));
					}
				});
		},
	});
}
