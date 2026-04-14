frappe.ui.form.on('Machine', {
	refresh: function(frm) {
		frm.set_query('site_production', function() {
			return {
				filters: {
					status: 'Actif'
				}
			};
		});
	},

	type_equipement: function(frm) {
		if (frm.doc.type_equipement !== 'Presse Offset') {
			frm.set_value('procede', '');
			frm.set_value('type_presse', '');
			frm.set_value('retiration', 0);
			frm.set_value('nb_couleurs_recto', 0);
			frm.set_value('nb_couleurs_verso', 0);
			frm.set_value('gache_calage', 0);
			frm.set_value('format_max_laize', 0);
			frm.set_value('format_max_developpement', 0);
			frm.set_value('format_min_laize', 0);
			frm.set_value('format_min_developpement', 0);
		}
	}
});
