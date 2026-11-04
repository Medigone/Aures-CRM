<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, RouterLink, useRouter } from 'vue-router'
import LucidePlay from '~icons/lucide/play'
import LucideCheck from '~icons/lucide/check'
import LucideCamera from '~icons/lucide/camera'
import LucideTicket from '~icons/lucide/ticket'
import LucideTriangleAlert from '~icons/lucide/triangle-alert'
import LucideBuilding2 from '~icons/lucide/building-2'
import LucidePhone from '~icons/lucide/phone'
import LucideMapPin from '~icons/lucide/map-pin'
import LucidePackagePlus from '~icons/lucide/package-plus'
import PageHeader from '@/components/PageHeader.vue'
import StatusPill from '@/components/StatusPill.vue'
import NotesField from '@/components/NotesField.vue'
import VisiteContexte from '@/components/VisiteContexte.vue'
import { useCommercialStore } from '@/stores/commercial'
import { currentPosition } from '@/lib/geo'
import { formatDay, formatTime, parseServerDate, toServerDateTime } from '@/lib/format'
import { refTo } from '@/lib/mutations'
import { compressPhoto } from '@/lib/photo'
import { fileUrl, formatMoney, gpsText, htmlToText, stripHtml, todayIso } from '@/lib/text'
import { clientItineraire, clientTelephone, dureeVisite, ticketsDeVisite, visiteARePlanifier, visiteContexte, visiteOubliee } from '@/lib/visites'

const props = defineProps<{ id: string }>()
const store = useCommercialStore()
const router = useRouter()

// Une visite créée sur l'appareil change de clé quand le serveur la confirme : la page suit.
const key = computed(() => store.resolveKey(props.id))
watch(key, (next) => {
	if (next !== props.id) router.replace({ name: 'Visit', params: { id: next } })
})
const visite = computed(() => store.visitesByName.get(key.value) ?? null)
const client = computed(() => (visite.value ? store.clientsByName.get(visite.value.client) ?? null : null))
const types = computed(() => store.references?.types_visite ?? [])
const resultats = computed(() => store.references?.resultats_recouvrement ?? [])
const paiements = computed(() => store.references?.types_paiement ?? [])
const creances = computed(() => (visite.value ? store.creancesByClient.get(visite.value.client) ?? [] : []))
const suiviCreances = computed(() => store.bundle?.suivi_creances_actif ?? true)

const today = todayIso()
const titre = computed(() => visite.value?.nom_client || client.value?.customer_name || visite.value?.client || '')
const telephone = computed(() => clientTelephone(client.value))
const itineraire = computed(() => clientItineraire(client.value))
const aReplanifier = computed(() => !!visite.value && visiteARePlanifier(visite.value, today))
const oubliee = computed(() => !!visite.value && visiteOubliee(visite.value, today))
const compteRendu = computed(() => htmlToText(visite.value?.notes).trim())
const tickets = computed(() => (visite.value ? ticketsDeVisite(store.ticketsByClient.get(visite.value.client) ?? [], visite.value.name) : []))
const contexte = computed(() =>
	visite.value
		? visiteContexte(visite.value, { visites: store.visites, tickets: store.tickets, commandes: store.commandes, reclamations: store.reclamations, creances: store.creances }, today)
		: null,
)

const form = reactive({
	type_visite: '',
	notes: '',
	creance_client: '',
	resultat_recouvrement: '',
	montant_reclame: null as number | null,
	montant_encaisse: null as number | null,
	type_paiement: '',
	numero_document_paiement: '',
	date_paiement_negociee: '',
	date_prochaine_relance: '',
	motif_non_paiement: '',
})
const photo = ref<{ filename: string; data: string } | null>(null)
const loadedFor = ref<string | null>(null)
/** Dernier état enregistré du formulaire : ce qui a changé depuis est enregistré en quittant la page. */
const enregistre = ref('')

const recouvrement = computed(() => form.type_visite === 'Recouvrement')

/** Formulaire rempli depuis la visite à l'ouverture (pas à chaque synchro : la saisie en cours est gardée). */
watch(
	visite,
	(v) => {
		if (!v || loadedFor.value === v.name) return
		loadedFor.value = v.name
		form.type_visite = v.type_visite || ''
		form.notes = stripHtml(v.notes)
		form.creance_client = v.creance_client || ''
		form.resultat_recouvrement = v.resultat_recouvrement || ''
		form.montant_reclame = v.montant_reclame ?? null
		form.montant_encaisse = v.montant_encaisse ?? null
		form.type_paiement = v.type_paiement || ''
		form.numero_document_paiement = v.numero_document_paiement || ''
		form.date_paiement_negociee = v.date_paiement_negociee || ''
		form.date_prochaine_relance = v.date_prochaine_relance || ''
		form.motif_non_paiement = v.motif_non_paiement || ''
		enregistre.value = JSON.stringify(fields())
	},
	{ immediate: true },
)

const creance = computed(() => creances.value.find((c) => c.name === form.creance_client) ?? null)
// Passage en recouvrement : la créance unique du client et son solde sont proposés.
watch(
	[recouvrement, creance],
	([isRecouvrement, c]) => {
		if (!isRecouvrement) return
		if (!form.creance_client && creances.value.length === 1) form.creance_client = creances.value[0].name
		if (c && form.montant_reclame == null && c.solde_restant) form.montant_reclame = c.solde_restant
	},
	{ immediate: true },
)

// Durée de la visite en cours, rafraîchie chaque minute.
const now = ref(Date.now())
const timer = setInterval(() => (now.value = Date.now()), 30000)
onBeforeUnmount(() => clearInterval(timer))
const elapsed = computed(() => {
	const start = parseServerDate(visite.value?.debut)
	if (!start) return null
	const minutes = Math.max(0, Math.round((now.value - start.getTime()) / 60000))
	return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
})

const busy = ref(false)
const error = ref<string | null>(null)

function fields() {
	const data: Record<string, any> = { type_visite: form.type_visite || null, notes: form.notes ? `<p>${escapeHtml(form.notes)}</p>` : null }
	if (recouvrement.value) {
		Object.assign(data, {
			creance_client: form.creance_client || null,
			resultat_recouvrement: form.resultat_recouvrement || null,
			montant_reclame: form.montant_reclame,
			montant_encaisse: form.montant_encaisse,
			type_paiement: form.type_paiement || null,
			numero_document_paiement: form.numero_document_paiement || null,
			date_paiement_negociee: form.date_paiement_negociee || null,
			date_prochaine_relance: form.date_prochaine_relance || null,
			motif_non_paiement: form.motif_non_paiement || null,
		})
	}
	return data
}

function escapeHtml(text: string) {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
}

/** Mêmes règles que VisiteCommerciale._validate_recouvrement : refusé ici plutôt qu'à la synchro. */
function recouvrementError(): string | null {
	if (!recouvrement.value) return null
	const reclame = Number(form.montant_reclame || 0)
	const encaisse = Number(form.montant_encaisse || 0)
	if (suiviCreances.value && !form.creance_client) return 'Sélectionnez la créance du client.'
	if (!form.resultat_recouvrement) return 'Indiquez le résultat du recouvrement.'
	if (suiviCreances.value && reclame <= 0) return 'Le montant réclamé doit être supérieur à 0.'
	if (encaisse < 0) return 'Le montant encaissé ne peut pas être négatif.'
	if (form.resultat_recouvrement === 'Paiement obtenu' && encaisse <= 0) return 'Indiquez le montant encaissé.'
	if (reclame > 0 && encaisse > reclame) return 'Le montant encaissé ne peut pas dépasser le montant réclamé.'
	if (['Promesse de paiement', 'À relancer'].includes(form.resultat_recouvrement) && !form.date_paiement_negociee) return 'Indiquez la date de paiement négociée.'
	if (['Refus de paiement', 'Litige', 'Client absent'].includes(form.resultat_recouvrement) && !form.motif_non_paiement.trim()) return 'Le motif est obligatoire pour ce résultat.'
	return null
}

async function start() {
	if (!visite.value) return
	busy.value = true
	// Preuve de présence : la position est demandée au démarrage (la visite démarre même sans).
	const position = await currentPosition(10000)
	store.enqueue('visite_start', { ...refTo('visite', visite.value.name), debut: toServerDateTime(), gps: gpsText(position) }, visite.value.name)
	busy.value = false
}

function save() {
	if (!visite.value) return
	store.enqueue('visite_update', { ...refTo('visite', visite.value.name), ...fields() }, visite.value.name)
	enregistre.value = JSON.stringify(fields())
	error.value = null
}

// La saisie en cours n'est jamais perdue : menu du compte, retour, navigation hors de la fiche.
onBeforeRouteLeave(() => {
	if (visite.value?.docstatus === 0 && JSON.stringify(fields()) !== enregistre.value) save()
})

function replanifier(event: Event) {
	const date = (event.target as HTMLInputElement).value
	if (!visite.value || !date || date < today) return
	store.enqueue('visite_update', { ...refTo('visite', visite.value.name), date }, visite.value.name)
}

/** Ticket depuis la visite : le compte rendu est enregistré d'abord, le ticket reprend client et texte. */
function createTicket(type?: string) {
	if (!visite.value) return
	save()
	router.push({ name: 'NewTicket', query: { client: visite.value.client, visite: visite.value.name, ...(type ? { type } : {}) } })
}

function newArticle() {
	if (!visite.value) return
	save()
	router.push({ name: 'NewArticle', query: { client: visite.value.client } })
}

function finish() {
	if (!visite.value) return
	if (!form.type_visite) {
		error.value = 'Choisissez le type de visite.'
		return
	}
	error.value = recouvrementError()
	if (error.value) return
	store.enqueue(
		'visite_finish',
		{
			...refTo('visite', visite.value.name),
			...fields(),
			fin: toServerDateTime(),
			...(recouvrement.value && photo.value ? { photo_document_paiement: photo.value } : {}),
		},
		visite.value.name,
	)
}

function cancel() {
	if (!visite.value) return
	const message = visite.value.docstatus === 1 ? 'Annuler cette visite terminée ?' : 'Supprimer cette visite ?'
	if (!window.confirm(message)) return
	store.enqueue('visite_cancel', refTo('visite', visite.value.name), visite.value.name)
	router.replace({ name: 'Visites' })
}

async function onPhoto(event: Event) {
	const file = (event.target as HTMLInputElement).files?.[0]
	if (!file) return
	try {
		photo.value = await compressPhoto(file)
	} catch (e) {
		error.value = (e as Error).message
	}
}
</script>

<template>
	<div v-if="!visite" class="py-10 text-center text-ink-gray-6">
		<PageHeader title="Visite introuvable" :back="{ name: 'Visites' }" />
		Cette visite n'est pas (ou plus) sur cet appareil.
	</div>
	<div v-else :class="visite.docstatus !== 1 && 'pb-24'">
		<PageHeader :title="titre" :subtitle="`${visite.type_visite || 'Visite'} · ${formatDay(visite.date)}`" :back="{ name: 'Visites' }">
			<template #meta>
				<StatusPill :status="visite.status" :tone="oubliee ? 'red' : undefined" />
				<span v-if="visite._pending" class="inline-flex items-center gap-1 text-xs text-ink-gray-6"><span class="pending-dot" />À envoyer</span>
			</template>
		</PageHeader>

		<div class="quick-actions mb-4">
			<a v-if="telephone" :href="`tel:${telephone}`" class="quick-action"><LucidePhone aria-hidden="true" />Appeler</a>
			<a v-if="itineraire" :href="itineraire" target="_blank" rel="noopener" class="quick-action"><LucideMapPin aria-hidden="true" />Itinéraire</a>
			<RouterLink v-if="client" :to="{ name: 'Client', params: { id: client.name } }" class="quick-action"><LucideBuilding2 aria-hidden="true" />Fiche client</RouterLink>
		</div>

		<!-- Visite terminée : lecture seule. -->
		<div v-if="visite.docstatus === 1" class="space-y-4">
			<section class="card grid grid-cols-3 px-2 py-3.5 text-center">
				<div><p class="text-xs text-ink-gray-6">Début</p><p class="mt-0.5 text-lg font-semibold tabular-nums">{{ formatTime(visite.debut) }}</p></div>
				<div><p class="text-xs text-ink-gray-6">Fin</p><p class="mt-0.5 text-lg font-semibold tabular-nums">{{ formatTime(visite.fin) }}</p></div>
				<div><p class="text-xs text-ink-gray-6">Durée</p><p class="mt-0.5 text-lg font-semibold tabular-nums">{{ dureeVisite(visite) || '—' }}</p></div>
			</section>

			<section v-if="visite.resultat_recouvrement || visite.montant_encaisse" class="card space-y-2.5 px-4 py-3.5">
				<div class="flex items-center justify-between gap-2">
					<h2 class="text-base font-semibold">Recouvrement</h2>
					<StatusPill :status="visite.resultat_recouvrement" :tone="visite.resultat_recouvrement === 'Paiement obtenu' ? 'green' : 'amber'" />
				</div>
				<div v-if="visite.montant_encaisse">
					<p class="text-xs text-ink-gray-6">Encaissé</p>
					<p class="mt-0.5 text-2xl font-bold tabular-nums tracking-tight">{{ formatMoney(visite.montant_encaisse) }}</p>
					<p v-if="visite.montant_reclame" class="mt-0.5 text-[13px] text-ink-gray-6">sur {{ formatMoney(visite.montant_reclame) }} réclamés</p>
				</div>
				<div class="space-y-2 border-t border-outline-gray-1 pt-2.5 text-sm">
					<div v-if="visite.type_paiement" class="flex justify-between gap-3"><span class="text-ink-gray-6">Paiement</span><span class="text-right">{{ visite.type_paiement }}<template v-if="visite.numero_document_paiement"> n° {{ visite.numero_document_paiement }}</template></span></div>
					<div v-if="visite.date_paiement_negociee" class="flex justify-between gap-3"><span class="text-ink-gray-6">Paiement négocié</span><span>{{ formatDay(visite.date_paiement_negociee) }}</span></div>
					<div v-if="visite.date_prochaine_relance" class="flex justify-between gap-3"><span class="text-ink-gray-6">Prochaine relance</span><span>{{ formatDay(visite.date_prochaine_relance) }}</span></div>
					<div v-if="visite.motif_non_paiement" class="flex justify-between gap-3"><span class="shrink-0 text-ink-gray-6">Motif</span><span class="text-right">{{ visite.motif_non_paiement }}</span></div>
				</div>
				<img v-if="visite.photo_locale || visite.photo_document_paiement" :src="visite.photo_locale || fileUrl(visite.photo_document_paiement) || undefined" alt="Document de paiement" class="max-h-64 w-full rounded-xl object-contain" />
			</section>

			<section>
				<h2 class="mb-2 text-base font-semibold">Compte rendu</h2>
				<p v-if="compteRendu" class="card whitespace-pre-line px-4 py-3.5 text-sm leading-relaxed text-ink-gray-8">{{ compteRendu }}</p>
				<p v-else class="card px-4 py-3.5 text-sm text-ink-gray-6">Aucun compte rendu saisi.</p>
			</section>

			<section v-if="tickets.length">
				<h2 class="mb-2 text-base font-semibold">Issu de cette visite</h2>
				<div class="card divide-y divide-outline-gray-1 overflow-hidden">
					<RouterLink v-for="t in tickets" :key="t.name" :to="{ name: 'Ticket', params: { id: t.name } }" class="flex min-h-14 items-center justify-between gap-2.5 px-4 py-2.5 active:bg-surface-gray-2">
						<span class="min-w-0">
							<span class="block truncate text-base font-medium">{{ t.request_type || 'Ticket' }}</span>
							<span class="block text-[13px] text-ink-gray-6">Ticket du {{ formatDay(t.creation_date) }}</span>
						</span>
						<StatusPill :status="t.status" class="shrink-0" />
					</RouterLink>
				</div>
			</section>

			<section v-if="contexte">
				<h2 class="mb-2 text-base font-semibold">Le client aujourd'hui</h2>
				<VisiteContexte :client="visite.client" :contexte="contexte" />
			</section>

			<div class="space-y-2">
				<RouterLink :to="{ name: 'NewVisit', query: { client: visite.client } }" class="btn-primary w-full">Planifier la prochaine visite</RouterLink>
				<RouterLink :to="{ name: 'NewTicket', query: { client: visite.client, visite: visite.name } }" class="btn-secondary w-full">Créer un ticket</RouterLink>
			</div>
			<button type="button" class="status-ink mx-auto block min-h-11 px-4 text-sm font-medium text-ink-red-3" @click="cancel">Annuler la visite</button>
		</div>

		<!-- À faire ou en cours : saisie. -->
		<div v-else class="space-y-4">
			<section v-if="aReplanifier" class="status-ink space-y-2.5 rounded-[20px] bg-surface-amber-2 px-4 py-3.5">
				<p class="text-sm font-medium text-ink-amber-3">Prévue le {{ formatDay(visite.date) }}, la date est dépassée.</p>
				<label class="block">
					<span class="field-label text-ink-amber-3">Replanifier au</span>
					<input type="date" class="field-input" :value="visite.date" :min="today" @change="replanifier" />
				</label>
			</section>

			<section v-if="visite.status === 'En Cours'" class="card flex items-center justify-between gap-3 px-4 py-3.5">
				<span class="status-ink inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold" :class="oubliee ? 'bg-surface-red-2 text-ink-red-3' : 'bg-surface-green-2 text-ink-green-3'">
					<span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
					<template v-if="oubliee">Commencée le {{ formatDay(visite.date) }}</template>
					<template v-else>Démarrée à {{ formatTime(visite.debut) }} · {{ elapsed }}</template>
				</span>
				<span v-if="visite.gps_visite" class="whitespace-nowrap text-xs text-ink-gray-6">GPS enregistré</span>
			</section>

			<section>
				<h2 class="mb-2 text-base font-semibold">Type de visite</h2>
				<div class="chip-scroller">
					<button v-for="t in types" :key="t" type="button" class="whitespace-nowrap" :class="form.type_visite === t ? 'chip-on' : 'chip-off'" :aria-pressed="form.type_visite === t" @click="form.type_visite = t">{{ t }}</button>
				</div>
			</section>

			<NotesField
				v-if="visite.status === 'En Cours' || form.notes"
				v-model="form.notes"
				:label="visite.status === 'En Cours' ? 'Compte rendu' : 'Notes'"
				:subtitle="titre"
				placeholder="Interlocuteur, besoins, prochaines étapes…"
				@dictated="save"
			/>

			<section v-if="client && visite.status === 'En Cours'">
				<h2 class="mb-2 text-base font-semibold">Pendant la visite</h2>
				<div class="grid grid-cols-2 gap-2">
					<button type="button" class="col-span-2 flex min-h-14 items-center gap-3 rounded-[18px] bg-primary px-4 text-left text-on-primary transition active:scale-[0.98]" @click="createTicket()">
						<LucideTicket class="h-[22px] w-[22px] shrink-0" aria-hidden="true" />
						<span class="text-[15px] font-semibold">Créer un ticket</span>
					</button>
					<button type="button" class="card flex min-h-[52px] items-center justify-center gap-2 !rounded-[18px] text-sm font-semibold transition active:scale-[0.98]" @click="createTicket('Réclamation')">
						<LucideTriangleAlert class="h-[18px] w-[18px]" aria-hidden="true" />Réclamation
					</button>
					<button type="button" class="card flex min-h-[52px] items-center justify-center gap-2 !rounded-[18px] text-sm font-semibold transition active:scale-[0.98]" @click="newArticle">
						<LucidePackagePlus class="h-[18px] w-[18px]" aria-hidden="true" />Nouvel article
					</button>
				</div>
			</section>

			<section v-if="recouvrement && visite.status === 'En Cours'" class="card space-y-3 px-4 py-3.5">
				<h2 class="text-base font-semibold">Recouvrement</h2>
				<label class="block">
					<span class="field-label">Créance</span>
					<select v-model="form.creance_client" class="field-input">
						<option value="">{{ creances.length ? 'Choisir…' : 'Aucune créance ouverte' }}</option>
						<option v-for="c in creances" :key="c.name" :value="c.name">{{ c.name }} · {{ formatMoney(c.solde_restant) }} ({{ c.statut }})</option>
					</select>
				</label>
				<div class="grid grid-cols-2 gap-3">
					<label class="block">
						<span class="field-label">Montant réclamé</span>
						<input v-model.number="form.montant_reclame" type="number" inputmode="decimal" min="0" class="field-input" />
					</label>
					<label class="block">
						<span class="field-label">Montant encaissé</span>
						<input v-model.number="form.montant_encaisse" type="number" inputmode="decimal" min="0" class="field-input" />
					</label>
				</div>
				<label class="block">
					<span class="field-label">Résultat</span>
					<select v-model="form.resultat_recouvrement" class="field-input">
						<option value="">Choisir…</option>
						<option v-for="r in resultats" :key="r" :value="r">{{ r }}</option>
					</select>
				</label>
				<div v-if="form.montant_encaisse" class="grid grid-cols-2 gap-3">
					<label class="block">
						<span class="field-label">Type de paiement</span>
						<select v-model="form.type_paiement" class="field-input">
							<option value="">—</option>
							<option v-for="t in paiements" :key="t" :value="t">{{ t }}</option>
						</select>
					</label>
					<label class="block">
						<span class="field-label">N° document</span>
						<input v-model="form.numero_document_paiement" type="text" class="field-input" />
					</label>
				</div>
				<label v-if="['Promesse de paiement', 'À relancer'].includes(form.resultat_recouvrement)" class="block">
					<span class="field-label">Date de paiement négociée</span>
					<input v-model="form.date_paiement_negociee" type="date" class="field-input" />
				</label>
				<label v-if="['Refus de paiement', 'Litige', 'Client absent'].includes(form.resultat_recouvrement)" class="block">
					<span class="field-label">Motif</span>
					<textarea v-model="form.motif_non_paiement" rows="2" class="field-input" />
				</label>
				<label class="block">
					<span class="field-label">Prochaine relance</span>
					<input v-model="form.date_prochaine_relance" type="date" class="field-input" />
				</label>
				<label class="btn-secondary w-full cursor-pointer">
					<LucideCamera class="h-4 w-4" aria-hidden="true" />{{ photo ? 'Changer la photo' : 'Photo du document de paiement' }}
					<input type="file" accept="image/*" capture="environment" class="sr-only" @change="onPhoto" />
				</label>
				<img v-if="photo" :src="photo.data" alt="Document de paiement" class="max-h-48 w-full rounded-lg object-contain" />
			</section>

			<section v-if="contexte">
				<h2 class="mb-2 text-base font-semibold">{{ visite.status === 'En Cours' ? "Le client aujourd'hui" : "À savoir avant d'y aller" }}</h2>
				<VisiteContexte :client="visite.client" :contexte="contexte" />
			</section>

			<button type="button" class="status-ink mx-auto block min-h-11 px-4 text-sm font-medium text-ink-red-3" @click="cancel">{{ visite.status === 'En Cours' ? 'Annuler la visite' : 'Supprimer la visite' }}</button>

			<div class="action-bar flex-col">
				<p v-if="error" class="text-sm text-ink-red-3" role="alert">{{ error }}</p>
				<button v-if="visite.status === 'Nouveau'" type="button" class="btn-primary w-full" :disabled="busy" @click="start">
					<LucidePlay class="h-5 w-5" aria-hidden="true" />{{ busy ? 'Localisation…' : 'Démarrer la visite' }}
				</button>
				<div v-else class="flex gap-2">
					<button type="button" class="btn-secondary flex-1" @click="save">Enregistrer</button>
					<button type="button" class="btn-primary flex-[2]" @click="finish">
						<LucideCheck class="h-5 w-5" aria-hidden="true" />Terminer la visite
					</button>
				</div>
			</div>
		</div>
	</div>
</template>
