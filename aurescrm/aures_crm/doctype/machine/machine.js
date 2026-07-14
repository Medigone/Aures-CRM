function set_total_couleurs(frm) {
	frm.set_value(
		'total_couleurs',
		cint(frm.doc.nb_couleurs_recto) + cint(frm.doc.nb_couleurs_verso)
	);
}

frappe.ui.form.on('Machine', {
	refresh: function(frm) {
		frm.set_query('site_production', function() {
			return {
				filters: {
					status: 'Actif'
				}
			};
		});

		if (!frm.is_new() && frappe.model.can_write('Machine')) {
			const statut = __('Statut');
			const status_field = frappe.meta.get_docfield('Machine', 'status');
			const options = (status_field && status_field.options
				? status_field.options.split('\n')
				: []
			)
				.map((value) => value.trim())
				.filter(Boolean);

			options.forEach((value) => {
				if (frm.doc.status === value) {
					return;
				}
				frm.add_custom_button(__(value), function() {
					frappe.confirm(
						__('Confirmer le passage au statut « {0} » ?', [value]),
						function() {
							frm.set_value('status', value);
							frm.save();
						}
					);
				}, statut);
			});
		}
	},

	type_equipement: function(frm) {
		if (frm.doc.type_equipement !== 'Presse Offset') {
			frm.set_value('procede', '');
			frm.set_value('type_presse', '');
			frm.set_value('retiration', 0);
			frm.set_value('nb_couleurs_recto', 0);
			frm.set_value('nb_couleurs_verso', 0);
			frm.set_value('total_couleurs', 0);
			frm.set_value('gache_calage', 0);
			frm.set_value('taux_gache_production', 0);
			frm.set_value('format_max_laize', 0);
			frm.set_value('format_max_developpement', 0);
			frm.set_value('format_min_laize', 0);
			frm.set_value('format_min_developpement', 0);
			frm.set_value('grammage_min', 0);
			frm.set_value('grammage_max', 0);
			frm.set_value('marge_pince', 0);
			frm.set_value('vernis', 0);
		}
	},

	nb_couleurs_recto: set_total_couleurs,
	nb_couleurs_verso: set_total_couleurs
});
