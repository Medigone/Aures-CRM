// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Groupe de societes", {
// 	refresh(frm) {

// 	},
// });
frappe.ui.form.on('Groupe de societes', {
    refresh: function(frm) {
        if (!frm.doc.__islocal) {  // Vérifie si le document est enregistré
            frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Customer',
                    filters: {
                        'custom_groupe_de_sociétés': frm.doc.name
                    },
                    fields: ['name', 'customer_name']
                },
                callback: function(response) {
                    if (response.message) {
                        let customers = response.message;
                        let customerData = [];

                        let promises = customers.map(customer => {
                            return new Promise(resolve => {
                                frappe.call({
                                    method: "frappe.client.get_list",
                                    args: {
                                        doctype: "Sales Invoice",
                                        filters: {
                                            "customer": customer.name,
                                            "docstatus": 1  // Factures soumises
                                        },
                                        fields: ["grand_total", "outstanding_amount"]
                                    },
                                    callback: function(salesResponse) {
                                        let total_billed = 0;
                                        let outstanding_amount = 0;

                                        if (salesResponse.message) {
                                            salesResponse.message.forEach(invoice => {
                                                total_billed += invoice.grand_total;
                                                outstanding_amount += invoice.outstanding_amount;
                                            });
                                        }

                                        customerData.push({
                                            customer_name: customer.customer_name,
                                            total_billed: total_billed,
                                            outstanding_amount: outstanding_amount
                                        });

                                        resolve();
                                    }
                                });
                            });
                        });

                        Promise.all(promises).then(() => {
                            let html = `<table class="table table-bordered">
                                            <thead>
                                                <tr>
                                                    <th>Nom du Client</th>
                                                    <th>Chiffre d'Affaires</th>
                                                    <th>Solde Actuel</th>
                                                </tr>
                                            </thead>
                                            <tbody>`;

                            customerData.forEach(customer => {
                                html += `<tr>
                                            <td>${customer.customer_name}</td>
                                            <td>${format_currency(customer.total_billed, frappe.defaults.get_default("currency"))}</td>
                                            <td>${format_currency(customer.outstanding_amount, frappe.defaults.get_default("currency"))}</td>
                                         </tr>`;
                            });

                            html += `</tbody></table>`;

                            frm.set_df_property('html', 'options', html);
                        });
                    }
                }
            });
        }
    }
});
