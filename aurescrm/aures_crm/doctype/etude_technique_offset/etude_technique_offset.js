// Copyright (c) 2024, Medigo and contributors
// For license information, please see license.txt


frappe.ui.form.on('Etude Technique Offset', {
    setup: function(frm) {
        frm.set_query('article', function() {
            return {
                filters: [
                    ["Item", "custom_procédé", "=", "Offset"],
                    ["Item", "custom_client", "=", frm.doc.client]
                ]
            };
        });
    }
});
