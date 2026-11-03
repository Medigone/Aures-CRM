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
	types_ticket?: string[]
	priorites_ticket?: string[]
	canaux_ticket?: string[]
	sites?: { name: string; title: string | null; procede: string | null }[]
	types_reclamation?: string[]
}

export type Ticket = {
	name: string
	_pending?: boolean
	status: string
	docstatus: number
	client: string
	customer_name: string | null
	request_type: string | null
	priority: string | null
	channel: string | null
	description: string | null
	echeance: string | null
	site: string | null
	niveau_urgence: string | null
	niveau_urgence_demande: string | null
	statut_demande_urgence: string | null
	commentaire_validation_urgence: string | null
	statut_creance: string | null
	motif_blocage_creance: string | null
	assigne_a_nom: string | null
	commercial: string | null
	nom_commercial: string | null
	creation_date: string | null
	creation: string | null
	modified: string
	/** Pièces jointes en attente d'envoi (nombre). */
	pieces_locales?: number
}

export type LigneVente = { item_code: string; item_name: string | null; qty: number; rate: number; amount: number; delivery_date?: string | null }

export type Devis = {
	name: string
	client: string
	customer_name: string | null
	date: string
	valid_till: string | null
	status: string
	docstatus: number
	statut_commande: string | null
	grand_total: number
	currency: string
	demande_faisabilite: string | null
	lignes: LigneVente[]
	modified: string
}

export type Fabrication = {
	dossier: { name: string; status: string } | null
	etudes: { name: string; status: string; article: string | null; nom_article: string | null; date_echeance: string | null }[]
	ordres: {
		name: string
		status: string
		article: string | null
		machine: string | null
		quantite_a_produire: number | null
		quantite_produite: number | null
		date_debut_prevue: string | null
		date_fin_prevue: string | null
		date_fin_reelle: string | null
		priorite: string | null
	}[]
}

export type Commande = {
	name: string
	client: string
	customer_name: string | null
	date: string
	delivery_date: string | null
	status: string
	docstatus: number
	per_delivered: number
	per_billed: number
	grand_total: number
	currency: string
	bon_commande_client: string | null
	date_bon_commande: string | null
	devis: string | null
	lignes: LigneVente[]
	fabrication: Fabrication | null
	modified: string
}

export type Reclamation = {
	name: string
	status: string
	docstatus: number
	client: string
	nom_client: string | null
	type_reclamation: string | null
	procede: string | null
	date_creation: string | null
	date_echeance: string | null
	date_resolution: string | null
	visite: string | null
	observations: string | null
	traitement: string | null
	modified: string
}

export type Bat = {
	name: string
	status: string
	date: string | null
	client: string
	article: string
	designation_article: string | null
	image: string | null
	fichier_valide: string | null
	code_bat_client: string | null
	valide_par_nom: string | null
	modified: string
}

type CycleSales = { doctype: string; name: string; status?: string | null; docstatus?: number; bon_de_commande_client?: string | null; delivery_date?: string | null }
type CycleEtude = { doctype?: string; name: string; status?: string | null; article?: string | null }

/** Cycle d'un ticket (get_cycle_documents) : demandes de faisabilité ou dossiers Essai Blanc. */
export type TicketCycle = {
	ticket: string
	fetched_at: string
	demandes: { name: string; status: string; type: string | null; etudes: CycleEtude[]; sales_documents: CycleSales[] }[]
	dossiers: { name: string; status: string; etudes: CycleEtude[]; sales_documents: CycleSales[] }[]
}

export type CreanceDetail = {
	creance: string
	fetched_at: string
	solde_restant: number | null
	montant_initial: number | null
	total_recouvre: number | null
	statut: string
	observations: string | null
	mouvements: { name: string; date_mouvement: string | null; type_mouvement: string | null; sens: string | null; montant: number; type_paiement: string | null; source_visite: string | null }[]
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
	tickets: Ticket[]
	devis: Devis[]
	commandes: Commande[]
	reclamations: Reclamation[]
	bats: Bat[]
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

/** Pièce jointe prise sur l'appareil (data URL), envoyée avec la saisie. */
export type Attachment = { filename: string; data: string }
