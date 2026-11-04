/** Fenêtre de création d'un ticket : aides de saisie et contrôles. Les règles restent côté serveur. */

export interface NewTicketForm {
	client: string | null
	type: string
	site: string
	description: string
}

export type NewTicketErrors = Partial<Record<keyof NewTicketForm, string>>

export function validateNewTicket(form: NewTicketForm): NewTicketErrors {
	const errors: NewTicketErrors = {}
	if (!form.client) errors.client = 'Choisissez le client.'
	if (!form.type) errors.type = 'Choisissez le type de demande.'
	if (!form.site) errors.site = 'Choisissez le site de production.'
	if (!form.description.trim()) errors.description = 'Décrivez la demande.'
	return errors
}

const GUIDES: Record<string, { hint?: string; placeholder: string }> = {
	'Bon de commande': { hint: 'Joignez le bon de commande du client. La créance sera vérifiée ensuite.', placeholder: 'Articles, quantités, référence du devis, date souhaitée…' },
	'Demande de devis': { hint: 'Indiquez les articles et les quantités à chiffrer.', placeholder: 'Article, format, support, quantités à chiffrer…' },
	Conception: { hint: "Joignez les fichiers du client s'il en a fourni.", placeholder: 'Produit, format, éléments fournis par le client…' },
	Réclamation: { hint: 'Joignez une photo du défaut et indiquez les quantités impactées.', placeholder: 'Défaut constaté, lot, quantités impactées…' },
	'Essai Blanc': { hint: 'Indiquez les articles concernés.', placeholder: 'Article, format, carton à essayer…' },
	'Information Production': { placeholder: 'Commande concernée, question du client…' },
	'Mise à jour données': { placeholder: 'Donnée à corriger et nouvelle valeur…' },
}

export function typeGuide(type: string) {
	return GUIDES[type] ?? { placeholder: 'Demande du client…' }
}
