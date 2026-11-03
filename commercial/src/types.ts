/** Données de l'instantané commercial (aurescrm/api/commercial_mobile.py). */

export type Client = {
	name: string
	/** Saisie locale pas encore envoyée au serveur. */
	_pending?: boolean
	customer_name: string
	statut: string | null
	groupe: string | null
	wilaya: string | null
	commune: string | null
	region: string | null
	lat: number | null
	lon: number | null
	telephone: string | null
	telephone_principal: string | null
	email: string | null
	contact_principal: string | null
	grand_compte: number
	groupe_societes: string | null
	qualite: number | null
	satisfaction: number | null
	commercial: string | null
	image: string | null
	derniere_visite: string | null
	nb_articles: number
	modified: string
}

export type Contact = {
	cle: string
	name: string
	client: string
	nom: string
	fonction: string | null
	mobile: string | null
	telephone: string | null
	email: string | null
	principal: number
}

export type Caracteristiques = { section: string; valeurs: { label: string; valeur: string | number }[] }[]

export type Article = {
	name: string
	designation: string
	description: string | null
	client: string
	code_client: string | null
	procede: string | null
	dimensions: string | null
	support: string | null
	image: string | null
	groupe: string | null
	parent: string | null
	sous_article: number
	compose: number
	fiche_technique: string | null
	trace_decoupe: string | null
	consommation_annuelle: number | null
	bat: { name: string; status: string; date: string | null } | null
	caracteristiques: Caracteristiques
	modified: string
}

export type Visite = {
	name: string
	/** Saisie locale pas encore envoyée au serveur. */
	_pending?: boolean
	status: string
	docstatus: number
	date: string
	client: string
	nom_client: string | null
	type_visite: string | null
	debut: string | null
	fin: string | null
	duree: string | null
	wilaya: string | null
	commune: string | null
	notes: string | null
	date_rdv: string | null
	utilisateur: string | null
	nom_utilisateur: string | null
	resultat_recouvrement: string | null
	montant_encaisse: number | null
	date_prochaine_relance: string | null
	creance_client?: string | null
	montant_reclame?: number | null
	type_paiement?: string | null
	date_paiement_negociee?: string | null
	numero_document_paiement?: string | null
	motif_non_paiement?: string | null
	gps_visite?: string | null
	/** Photo du document de paiement prise sur l'appareil, en attente d'envoi. */
	photo_document_paiement?: string | null
	photo_locale?: string | null
	modified: string
}

export type RendezVous = {
	name: string
	/** Saisie locale pas encore envoyée au serveur. */
	_pending?: boolean
	status: string
	date_heure: string | null
	client: string | null
	raison_sociale: string | null
	statut_client: string | null
	details: string | null
	commercial: string | null
	nom_commercial: string | null
	modified: string
}

export type Appel = {
	name: string
	/** Saisie locale pas encore envoyée au serveur. */
	_pending?: boolean
	status: string
	type: string | null
	date: string | null
	heure: string | null
	client: string | null
	notes: string | null
	date_rappel: string | null
	modified: string
}

export type References = {
	wilayas: { name: string; wilaya: string; code: string | null; region: string | null }[]
	communes: { name: string; commune: string; wilaya: string | null }[]
	types_visite: string[]
	statuts_client: string[]
	types_appel: string[]
	statuts_rdv: string[]
	statuts_appel?: string[]
	resultats_recouvrement?: string[]
	types_paiement?: string[]
}

export type Creance = {
	name: string
	client: string
	nom_client: string | null
	statut: string
	solde_restant: number | null
	date_prochaine_relance: string | null
	dernier_resultat_recouvrement: string | null
	modified: string
}

export type SyncMeta = {
	server_time: string
	user: { name: string; full_name: string; image: string | null; roles: string[]; exempt: boolean }
	references: References
	suivi_creances_actif?: boolean
}

export type Bundle = SyncMeta & {
	clients: Client[]
	contacts: Contact[]
	articles: Article[]
	visites: Visite[]
	rdv: RendezVous[]
	appels: Appel[]
	creances: Creance[]
	synced_at: string
}

type Ligne = { name: string; date?: string | null; status?: string | null; docstatus?: number; qty?: number; rate?: number; amount?: number; currency?: string }

/** Historique d'un article (en ligne, gardé par l'appareil). */
export type ArticleHistory = {
	article: string
	fetched_at: string
	devis: (Ligne & { statut_commande: string | null })[]
	commandes: (Ligne & { delivery_date: string | null; per_delivered: number; bon_commande_client: string | null })[]
	bat: { name: string; status: string; date: string | null; image: string | null; fichier_valide: string | null; code_bat_client: string | null; valide_par_nom: string | null }[]
	maquettes: { name: string; status: string; ver: number | null; fichier_maquette: string | null; date_activation: string | null; mode_couleur: string | null; resume_couleurs: string | null }[]
	sous_articles: { name: string; item_name: string | null; description: string | null; quantite: number | null }[]
	reclamations_client: { name: string; status: string; date_creation: string | null; type_reclamation: string | null; procede: string | null }[]
}
