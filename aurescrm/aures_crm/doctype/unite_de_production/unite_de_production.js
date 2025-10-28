// Copyright (c) 2025, AURES Technologies and contributors
// For license information, please see license.txt

frappe.ui.form.on('Unite de Production', {
	refresh: function(frm) {
		// Bouton Générer QR Code
		if (frm.doc.name && !frm.doc.qr_code) {
			frm.add_custom_button(__('Générer QR Code'), function() {
				frappe.call({
					method: 'generer_qr_code',
					doc: frm.doc,
					callback: function(r) {
						frm.reload_doc();
						frappe.show_alert({
							message: __('QR Code généré'),
							indicator: 'green'
						});
					}
				});
			});
		}
		
		// Bouton Imprimer Étiquette
		if (frm.doc.name && frm.doc.qr_code) {
			frm.add_custom_button(__('Imprimer Étiquette'), function() {
				imprimer_etiquette(frm);
			});
		}
		
		// Bouton Scanner Entrée
		if (frm.doc.name && frm.doc.statut === 'En production') {
			frm.add_custom_button(__('Scanner Entrée Étape'), function() {
				dialogue_scan_entree(frm);
			}, __('Scanner'));
			
			frm.add_custom_button(__('Scanner Sortie Étape'), function() {
				dialogue_scan_sortie(frm);
			}, __('Scanner'));
		}
		
		// Afficher le QR code si disponible
		if (frm.doc.qr_code) {
			afficher_qr_code(frm);
		}
	},
	
	onload: function(frm) {
		// Filtres
		frm.set_query('ordre_production', function() {
			return {
				filters: {
					'statut': ['in', ['Planifié', 'En Production']]
				}
			};
		});
	}
});

function dialogue_scan_entree(frm) {
	let d = new frappe.ui.Dialog({
		title: __('Scanner Entrée Étape'),
		fields: [
			{
				fieldname: 'etape',
				fieldtype: 'Data',
				label: __('Nom de l\'étape'),
				reqd: 1
			},
			{
				fieldname: 'operateur',
				fieldtype: 'Link',
				label: __('Opérateur'),
				options: 'User',
				default: frappe.session.user
			}
		],
		primary_action_label: __('Scanner'),
		primary_action: function(values) {
			frappe.call({
				method: 'scan_entree_etape',
				doc: frm.doc,
				args: {
					etape: values.etape,
					operateur: values.operateur
				},
				callback: function(r) {
					d.hide();
					frm.reload_doc();
				}
			});
		}
	});
	
	d.show();
}

function dialogue_scan_sortie(frm) {
	let d = new frappe.ui.Dialog({
		title: __('Scanner Sortie Étape'),
		fields: [
			{
				fieldname: 'etape',
				fieldtype: 'Data',
				label: __('Nom de l\'étape'),
				reqd: 1
			},
			{
				fieldname: 'quantite_ok',
				fieldtype: 'Int',
				label: __('Quantité OK'),
				default: 0
			},
			{
				fieldname: 'quantite_rebut',
				fieldtype: 'Int',
				label: __('Quantité rebut'),
				default: 0
			},
			{
				fieldname: 'observations',
				fieldtype: 'Small Text',
				label: __('Observations')
			}
		],
		primary_action_label: __('Scanner'),
		primary_action: function(values) {
			frappe.call({
				method: 'scan_sortie_etape',
				doc: frm.doc,
				args: {
					etape: values.etape,
					quantite_ok: values.quantite_ok,
					quantite_rebut: values.quantite_rebut,
					observations: values.observations
				},
				callback: function(r) {
					d.hide();
					frm.reload_doc();
				}
			});
		}
	});
	
	d.show();
}

function imprimer_etiquette(frm) {
	frappe.call({
		method: 'imprimer_etiquette',
		doc: frm.doc,
		callback: function(r) {
			if (r.message) {
				// Créer une fenêtre d'impression
				let print_window = window.open('', '_blank');
				print_window.document.write(`
					<html>
					<head>
						<title>Étiquette - ${r.message.numero}</title>
						<style>
							body { font-family: Arial, sans-serif; padding: 20px; }
							.etiquette { border: 2px solid #000; padding: 20px; width: 400px; }
							.qr-code { text-align: center; margin: 20px 0; }
							.qr-code img { width: 200px; height: 200px; }
							.info { margin: 10px 0; }
							.info strong { display: inline-block; width: 150px; }
						</style>
					</head>
					<body>
						<div class="etiquette">
							<h2>Unité de Production</h2>
							<div class="info"><strong>Numéro:</strong> ${r.message.numero}</div>
							<div class="info"><strong>Ordre:</strong> ${r.message.ordre_production}</div>
							<div class="info"><strong>Article:</strong> ${r.message.article}</div>
							<div class="info"><strong>Type:</strong> ${r.message.type_unite}</div>
							<div class="info"><strong>Quantité:</strong> ${r.message.quantite} pièces</div>
							<div class="info"><strong>Date:</strong> ${r.message.date_creation}</div>
							<div class="qr-code">
								<img src="${r.message.qr_code}" />
							</div>
						</div>
						<script>
							window.print();
						</script>
					</body>
					</html>
				`);
				print_window.document.close();
			}
		}
	});
}

function afficher_qr_code(frm) {
	// Ajouter le QR code dans un champ HTML personnalisé si nécessaire
	if (frm.fields_dict.qr_code && frm.doc.qr_code) {
		let html = `
			<div style="text-align: center; padding: 20px;">
				<img src="${frm.doc.qr_code}" style="max-width: 300px;" />
				<p><small>Scannez ce code pour accéder à l'unité de production</small></p>
			</div>
		`;
		// Peut être ajouté dans un champ HTML si nécessaire
	}
}

