<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import LucidePlay from '~icons/lucide/play'
import LucideCheck from '~icons/lucide/check'
import LucideCamera from '~icons/lucide/camera'
import PageHeader from '@/components/PageHeader.vue'
import StatusPill from '@/components/StatusPill.vue'
import NotesField from '@/components/NotesField.vue'
import { useCommercialStore } from '@/stores/commercial'
import { currentPosition } from '@/lib/geo'
import { formatDay, formatTime, parseServerDate, toServerDateTime } from '@/lib/format'
import { refTo } from '@/lib/mutations'
import { compressPhoto } from '@/lib/photo'
import { fileUrl, formatMoney, gpsText, htmlToText, stripHtml } from '@/lib/text'

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
	},
	{ immediate: true },
)

const recouvrement = computed(() => form.type_visite === 'Recouvrement')
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
	error.value = null
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
	router.replace(client.value ? { name: 'Client', params: { id: client.value.name } } : { name: 'Today' })
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
		<PageHeader title="Visite introuvable" :back="{ name: 'Today' }" />
		Cette visite n'est pas (ou plus) sur cet appareil.
	</div>
	<div v-else class="pb-24">
		<PageHeader :title="visite.nom_client || client?.customer_name || visite.client" :subtitle="`${visite.type_visite || 'Visite'} · ${formatDay(visite.date)}`" :back="{ name: 'Today' }">
			<template #actions>
				<span v-if="visite._pending" class="pending-dot" title="En attente d'envoi" />
				<StatusPill :status="visite.status" />
			</template>
		</PageHeader>

		<div v-if="client" class="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
			<RouterLink :to="{ name: 'Client', params: { id: client.name } }" class="text-accent">Voir la fiche client</RouterLink>
			<RouterLink :to="{ name: 'NewTicket', query: { client: client.name, type: 'Réclamation', visite: visite.name } }" class="text-accent">Déclarer une réclamation</RouterLink>
			<RouterLink :to="{ name: 'NewTicket', query: { client: client.name, visite: visite.name } }" class="text-accent">Créer un ticket</RouterLink>
		</div>

		<div v-if="visite.status === 'En Cours'" class="card mb-4 flex items-center justify-between p-3">
			<span class="text-sm text-ink-gray-6">Commencée à {{ formatTime(visite.debut) }}</span>
			<span class="font-semibold tabular-nums">{{ elapsed }}</span>
		</div>

		<!-- Visite terminée : lecture seule. -->
		<template v-if="visite.docstatus === 1">
			<section class="card mb-4 divide-y divide-outline-gray-1 text-sm">
				<div class="flex justify-between px-3 py-2.5"><span class="text-ink-gray-6">Début</span><span>{{ formatTime(visite.debut) }}</span></div>
				<div class="flex justify-between px-3 py-2.5"><span class="text-ink-gray-6">Fin</span><span>{{ formatTime(visite.fin) }}</span></div>
				<div v-if="visite.duree" class="flex justify-between px-3 py-2.5"><span class="text-ink-gray-6">Durée</span><span>{{ visite.duree }} min</span></div>
				<div v-if="visite.resultat_recouvrement" class="flex justify-between px-3 py-2.5"><span class="text-ink-gray-6">Recouvrement</span><span>{{ visite.resultat_recouvrement }}</span></div>
				<div v-if="visite.montant_encaisse" class="flex justify-between px-3 py-2.5"><span class="text-ink-gray-6">Encaissé</span><span>{{ formatMoney(visite.montant_encaisse) }}</span></div>
			</section>
			<p v-if="visite.notes" class="card mb-4 whitespace-pre-line p-3 text-sm">{{ htmlToText(visite.notes) }}</p>
			<img v-if="visite.photo_locale || visite.photo_document_paiement" :src="visite.photo_locale || fileUrl(visite.photo_document_paiement) || undefined" alt="Document de paiement" class="mb-4 max-h-64 w-full rounded-xl object-contain" />
			<button type="button" class="btn-danger w-full" @click="cancel">Annuler la visite</button>
		</template>

		<!-- Nouvelle ou en cours : saisie. -->
		<template v-else>
			<div class="space-y-4">
				<div>
					<span class="field-label">Type de visite</span>
					<div class="chip-scroller">
						<button v-for="t in types" :key="t" type="button" :class="form.type_visite === t ? 'chip-on' : 'chip-off'" @click="form.type_visite = t">{{ t }}</button>
					</div>
				</div>

				<NotesField v-model="form.notes" placeholder="Interlocuteur, besoins, prochaines étapes…" />

				<section v-if="recouvrement" class="card space-y-3 p-3">
					<h2 class="section-title">Recouvrement</h2>
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

				<div class="flex gap-2">
					<button type="button" class="btn-secondary flex-1" @click="save">Enregistrer</button>
					<button type="button" class="btn-danger flex-1" @click="cancel">Supprimer</button>
				</div>
			</div>

			<div class="action-bar flex-col">
				<p v-if="error" class="text-sm text-ink-red-3" role="alert">{{ error }}</p>
				<button v-if="visite.status === 'Nouveau'" type="button" class="btn-primary w-full" :disabled="busy" @click="start">
					<LucidePlay class="h-5 w-5" aria-hidden="true" />{{ busy ? 'Localisation…' : 'Démarrer la visite' }}
				</button>
				<button v-else type="button" class="btn-primary w-full" @click="finish">
					<LucideCheck class="h-5 w-5" aria-hidden="true" />Terminer la visite
				</button>
			</div>
		</template>
	</div>
</template>
