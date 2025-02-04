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
                        let total_group_billed = 0;
                        let total_group_outstanding = 0;

                        let promises = customers.map(customer => {
                            return new Promise(resolve => {
                                frappe.call({
                                    method: "frappe.client.get_list",
                                    args: {
                                        doctype: "Sales Invoice",
                                        filters: {
                                            "customer": customer.name,
                                            "docstatus": 1  // Factures validées
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

                                        // Ajout des valeurs au total du groupe
                                        total_group_billed += total_billed;
                                        total_group_outstanding += outstanding_amount;

                                        customerData.push({
                                            customer_id: customer.name, // ID Client
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
                            // Trier les clients par 'customer_name' pour un affichage cohérent
                            customerData.sort((a, b) => a.customer_name.localeCompare(b.customer_name));

                            // Réassigner la numérotation après le tri
                            customerData.forEach((customer, index) => {
                                customer.index = index + 1; // Assigne des numéros consécutifs
                            });

                            // Détermination des couleurs
                            let solde_color = total_group_outstanding > 0 ? "#e63946" : "#2a9d8f"; // Rouge si dette, Vert si OK
                            let ca_color = "#007bff"; // Bleu pour le CA

                            let html = `
                                <style>
                                    .summary-container {
                                        display: flex;
                                        justify-content: space-between;
                                        gap: 15px;
                                        margin-bottom: 15px;
                                    }
                                    .summary-card {
                                        flex: 1;
                                        display: flex;
                                        align-items: center;
                                        background: #f9fafb;
                                        border: 1px solid #e5e7eb;
                                        border-radius: 10px;
                                        padding: 10px 15px;
                                        font-size: 10px;
                                        font-weight: bold;
                                    }
                                    .summary-icon {
                                        width: 20px;
                                        height: 20px;
                                        border-radius: 50%;
                                        background: #ffffff;
                                        border: 1px solid #d1d5db;
                                        display: flex;
                                        justify-content: center;
                                        align-items: center;
                                        margin-right: 10px;
                                    }
                                    .summary-content {
                                        font-size: 12px;
                                    }
                                    .summary-content p {
                                        margin: 0;
                                        font-weight: normal;
                                        color: #4b5563;
                                    }
                                    .table-container {
                                        margin-top: 15px;
                                        margin-bottom: 20px;
                                        border: 1px solid #e5e7eb;
                                        border-radius: 10px;
                                        overflow-x: auto; /* Permet de scroller horizontalement sur mobile */
                                        background: white;
                                    }
                                    table {
                                        width: 100%;
                                        border-collapse: collapse;
                                        border-spacing: 0;
                                        font-size: 12px;
                                    }
                                    thead {
                                        background: #f9fafb;
                                        border-bottom: 1px solid #e5e7eb;
                                    }
                                    th, td {
                                        padding: 10px;
                                        text-align: left;
                                        border-bottom: 1px solid #e5e7eb;
                                    }
                                    tbody tr:last-child td {
                                        border-bottom: none;
                                    }
                                    tr {
                                        cursor: pointer;
                                    }
                                    tr:hover {
                                        background: #f9fafb;
                                    }
                                    .col-number {
                                        width: 50px;
                                        text-align: center;
                                    }

                                    /* Responsive Design */
                                    @media screen and (max-width: 768px) {
                                        .summary-container {
                                            flex-direction: column;
                                            gap: 10px;
                                        }
                                        .summary-card {
                                            flex-direction: column;
                                            text-align: center;
                                            padding: 8px;
                                            font-size: 12px;
                                        }
                                        table {
                                            font-size: 10px;
                                        }
                                        th, td {
                                            padding: 8px;
                                        }
                                        .hide-on-mobile {
                                            display: none;
                                        }
                                    }
                                </style>

                                <div class="summary-container">
                                    <div class="summary-card">
                                        <div class="summary-icon" style="background: ${ca_color};">
                                            <i class="fa fa-bar-chart" style="color: #ffffff;"></i>
                                        </div>
                                        <div class="summary-content">
                                            <p>Chiffre d'Affaires Global :
                                            <strong>${format_currency(total_group_billed, frappe.defaults.get_default("currency"))}</strong>
                                            </p>
                                        </div>
                                    </div>

                                    <div class="summary-card">
                                        <div class="summary-icon" style="background: ${solde_color};">
                                            <i class="fa fa-balance-scale" style="color: #ffffff;"></i>
                                        </div>
                                        <div class="summary-content">
                                            <p>Solde Global :
                                            <strong>${format_currency(total_group_outstanding, frappe.defaults.get_default("currency"))}</strong>
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div class="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th class="col-number">Nº</th>
                                                <th class="hide-on-mobile">ID Client</th>
                                                <th>Nom du Client</th>
                                                <th>Chiffre d'Affaires</th>
                                                <th>Solde Actuel</th>
                                            </tr>
                                        </thead>
                                        <tbody>`;

                            customerData.forEach(customer => {
                                html += `<tr onclick="frappe.set_route('Form', 'Customer', '${customer.customer_id}')">
                                            <td class="col-number">${customer.index}</td>
                                            <td class="hide-on-mobile">${customer.customer_id}</td>
                                            <td>${customer.customer_name}</td>
                                            <td>${format_currency(customer.total_billed, frappe.defaults.get_default("currency"))}</td>
                                            <td>${format_currency(customer.outstanding_amount, frappe.defaults.get_default("currency"))}</td>
                                         </tr>`;
                            });

                            html += `</tbody></table></div>`;

                            frm.set_df_property('html', 'options', html);
                        });
                    }
                }
            });
        }
    }
});
