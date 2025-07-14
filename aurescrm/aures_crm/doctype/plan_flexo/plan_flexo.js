// Copyright (c) 2025, Medigo and contributors
// For license information, please see license.txt

frappe.ui.form.on("Plan Flexo", {
	refresh(frm) {
		// Initialiser le contenu HTML du champ de référence
		frm.trigger('setup_html_deroulement');
	},
	
	setup_html_deroulement(frm) {
		// Vérifier que le champ html_deroulement existe
		if (!frm.fields_dict.html_deroulement) {
			console.error('Le champ html_deroulement n\'existe pas dans le formulaire');
			return;
		}
		
		// Construire le contenu HTML avec l'image de référence
		const html_content = `
			<div style="
				text-align: center; 
				padding: 20px; 
				background: #ffffff; 
				border: 1px solid #e8ecef; 
				border-radius: 8px;
				margin: 10px 0;
			">
				
				<p style="
					margin: 5px 0 0 0; 
					font-size: 12px; 
					color: #6c757d;
					line-height: 1.4;
				">💡 Sélectionnez le sens de déroulement correspondant</p>
				<br/>

                <img 
					src="/assets/aurescrm/images/sens_deroulement.svg" 
					alt="Sens de déroulement" 
					style="
						max-width: 100%; 
						height: auto; 
						border: 1px solid #ddd; 
						border-radius: 8px;
						box-shadow: 0 2px 4px rgba(0,0,0,0.1);
					" 
				/>
			</div>
		`;
		
		// Injecter le HTML dans le champ
		frm.fields_dict.html_deroulement.$wrapper.html(html_content);
	}
});
