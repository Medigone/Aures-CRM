// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Generation Suivi Creance", {
	refresh(frm) {
		$(frm.fields_dict.html_bouton_generer.wrapper)
			.empty()
			.append(`
				<div style="
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
							<path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
					</div>
					<h2 style="
						color: var(--text-color);
						font-size: 1.875rem;
						font-weight: 700;
						line-height: 2.25rem;
						margin-bottom: 1rem;
					">
						Génération Suivi Créances
					</h2>
					<p style="
						color: var(--text-muted);
						margin-bottom: 2rem;
						font-size: 1rem;
						line-height: 1.625;
					">
						Ce processus va générer automatiquement des suivis de créances pour tous les clients 
						ayant des factures impayées.
					</p>
					<button id="btn-generer" style="
						background-color: var(--primary);
						color: var(--white);
						font-weight: 600;
						padding: 0.75rem 1.5rem;
						border-radius: 0.375rem;
						border: none;
						transition: background-color 0.2s;
						display: inline-flex;
						align-items: center;
						gap: 0.5rem;
						cursor: pointer;
					"
					onmouseover="this.style.backgroundColor='var(--gray-600)'"
					onmouseout="this.style.backgroundColor='var(--primary)'"
					>
						<svg width="1.25rem" height="1.25rem" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"/>
						</svg>
						Générer
					</button>
				</div>
			`);

		$(frm.fields_dict.html_bouton_generer.wrapper).find("#btn-generer").on("click", function() {
			frappe.confirm(
				'Êtes-vous sûr de vouloir générer les suivis de créances ?<br><br>' +
				'<small class="text-muted">Cette action va créer un nouveau suivi pour chaque client ' +
				'ayant des factures impayées.</small>',
				function() {
					frappe.call({
						method: "aurescrm.aures_crm.doctype.generation_suivi_creance.generation_suivi_creance.generer_suivis_creances",
						freeze: true,
						freeze_message: "Génération des suivis de créances en cours...",
						callback: function(r) {
							if (!r.exc) {
								let nb_suivis = r.message;
								let message = nb_suivis > 0 
									? `${nb_suivis} nouveau(x) suivi(s) de créances généré(s) avec succès`
									: "Aucun nouveau suivi de créances n'a été généré";
								
								frappe.show_alert({
									message: message,
									indicator: nb_suivis > 0 ? 'green' : 'blue'
								});
							}
						}
					});
				}
			);
		});
	}
});
