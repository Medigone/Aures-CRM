// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

/**
 * Client Script for Imposition Doctype
 * Affiche l'état de l'imposition (idéale ou non) dans le champ HTML
 */

frappe.ui.form.on('Imposition', {
	/**
	 * Refreshes the form view.
	 * @param {object} frm - The current form object.
	 */
	refresh: function(frm) {
		// Charger l'affichage HTML de l'état de l'imposition
		load_imposition_status_display(frm);
	},
	
	/**
	 * Triggered after form is saved.
	 * @param {object} frm - The current form object.
	 */
	after_save: function(frm) {
		// Rafraîchir le document pour refléter les changements du champ 'defaut'
		// Attendre un peu plus longtemps pour que le recalcul backend soit terminé
		setTimeout(() => {
			frm.reload_doc();
		}, 1000);
	},
	
	/**
	 * Triggered on form load.
	 * @param {object} frm - The current form object.
	 */
	onload: function(frm) {
		// Charger l'affichage HTML de l'état de l'imposition
		load_imposition_status_display(frm);
	},
	
	/**
	 * Triggered when taux_chutes field changes.
	 * @param {object} frm - The current form object.
	 */
	taux_chutes: function(frm) {
		// L'affichage sera mis à jour après la sauvegarde via after_save
	}
});

/**
 * Charge et affiche l'état de l'imposition (idéale ou non) dans le champ HTML.
 * @param {object} frm - The current form object.
 */
function load_imposition_status_display(frm) {
	const html_field = frm.fields_dict.html;
	if (!html_field) {
		console.warn("Le champ 'html' n'existe pas dans le formulaire Imposition.");
		return;
	}

	// Vider le contenu précédent
	html_field.$wrapper.html("");

	// Vérifier si les champs requis sont remplis
	if (!frm.doc.client || !frm.doc.article || !frm.doc.trace || !frm.doc.taux_chutes) {
		// Ne rien afficher si les champs obligatoires ne sont pas remplis ou si pas de taux
		return;
	}
	
	// Si le document n'est pas encore sauvegardé, ne pas afficher le statut
	if (!frm.doc.name || frm.doc.__islocal) {
		return;
	}

	// --- HTML Structure and Styling ---
	var html = `<div style='padding: 0;'>
		<style>
			.imp-status-container { 
				margin: 5px 0;
				display: flex;
				align-items: center;
				gap: 8px;
				flex-wrap: wrap;
			}
			.imp-badge {
				display: inline-flex;
				align-items: center;
				gap: 5px;
				padding: 4px 10px;
				border-radius: 12px;
				font-size: 12px;
				font-weight: 600;
			}
			.imp-badge-ideal {
				background-color: #d4edda;
				border: 1px solid #c3e6cb;
				color: #155724;
			}
			.imp-badge-not-ideal {
				background-color: #f8d7da;
				border: 1px solid #f5c6cb;
				color: #721c24;
			}
			.imp-badge-icon {
				font-size: 13px;
				line-height: 1;
			}
			.imp-details {
				font-size: 11px;
				color: #6c757d;
				display: inline;
			}
			.imp-link {
				display: inline-block;
				padding: 3px 8px;
				border: 1px solid #d1d8dd;
				border-radius: 3px;
				text-decoration: none;
				font-size: 11px;
				font-weight: 500;
				color: var(--text-color);
				background-color: white;
			}
			.imp-link:hover {
				background-color: #f8f9fa;
				text-decoration: none;
				color: var(--text-color);
			}
		</style>`;

	// Vérifier si c'est l'imposition idéale (1 ou true)
	if (frm.doc.defaut === 1 || frm.doc.defaut === '1' || frm.doc.defaut === true) {
		// Cette imposition EST l'idéale
		html += `
			<div class='imp-status-container'>
				<div class='imp-badge imp-badge-ideal'>
					<span class='imp-badge-icon'>✓</span>
					<span>Imposition idéale</span>
				</div>
				<span class='imp-details'>
					Taux de chutes le plus bas : ${frm.doc.taux_chutes || 0}%
				</span>
			</div>
		`;
		html += `</div>`; // Fermer le div principal
		html_field.$wrapper.html(html);
	} else {
		// Cette imposition n'est PAS l'idéale, chercher l'idéale
		frappe.call({
			method: 'aurescrm.aures_crm.doctype.imposition.imposition.get_imposition_ideale',
			args: {
				client: frm.doc.client,
				article: frm.doc.article,
				trace: frm.doc.trace,
				current_imposition: frm.doc.name
			},
			callback: function(r) {
				if (r.message) {
					// Il existe une imposition idéale
					let current_taux = frm.doc.taux_chutes || 0;
					let ideal_taux = r.message.taux_chutes || 0;
					let message = '';
					
					// Si les taux sont identiques, afficher un message différent
					if (current_taux === ideal_taux) {
						message = `Même taux (${current_taux}%), mais une imposition plus récente existe`;
					} else {
						message = `Taux actuel : ${current_taux}% | Taux idéal : ${ideal_taux}%`;
					}
					
					html += `
						<div class='imp-status-container'>
							<div class='imp-badge imp-badge-not-ideal'>
								<span class='imp-badge-icon'>⚠</span>
								<span>Imposition non optimale</span>
							</div>
							<span class='imp-details'>
								${message}
							</span>
							<a href='#' onclick="frappe.set_route('Form','Imposition','${r.message.name}'); return false;" 
							   class='imp-link'>
								Voir l'imposition idéale
							</a>
						</div>
					`;
					html += `</div>`; // Fermer le div principal
					html_field.$wrapper.html(html);
				} else {
					// Pas d'imposition idéale trouvée ou l'imposition actuelle est déjà l'idéale
					html_field.$wrapper.html('');
				}
			},
			error: function(err) {
				console.error("Erreur lors de la récupération de l'imposition idéale:", err);
				html_field.$wrapper.html('');
			}
		});
	}
}
