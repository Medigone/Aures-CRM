<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import LucideCheck from '~icons/lucide/check'
import LucideInfo from '~icons/lucide/info'
import { ApiError } from '@shared/api'
import FormDialog from '@shared/components/FormDialog.vue'
import { fieldVisible } from '@shared/fiche'
import ClientPicker from './ClientPicker.vue'
import FicheInput from './FicheInput.vue'
import { clearDraft, loadDraft, saveDraft } from '@/lib/articleDraft'
import { checkArticleDesignation, createArticle, getArticleOptions, updateArticle } from '@/lib/api'
import { changedFields, creationCards, ficheCards, ficheFormValues, procedeLabel, TYPE_GENERAL, validateArticle, type ArticleDetail, type ArticleField, type ArticleOptions } from '@/lib/articles'
import type { ClientChoice } from '@/types'

/**
 * Nouvel article en deux phases (informations de base, puis fiche technique), gardé en brouillon à chaque saisie.
 * Modification (`article`) : une seule phase, avec toute la fiche technique, sans brouillon.
 */
const props = defineProps<{ article?: ArticleDetail; initialClient?: ClientChoice }>()
const emit = defineEmits<{ close: []; created: [name: string]; saved: [article: ArticleDetail] }>()

const editing = computed(() => Boolean(props.article))
const draftClient = props.initialClient?.name
const draft = props.article ? null : loadDraft(draftClient)
const initial = {
	type: props.article?.type ?? 'Client',
	designation: props.article?.designation ?? '',
	procede: props.article?.procede ?? '',
	reference: props.article?.reference ?? '',
	groupe: props.article?.groupe ?? '',
	ancien_code: props.article?.ancien_code ?? '',
	consommation: props.article?.consommation ? String(props.article.consommation) : '',
}
const values = reactive({ ...initial, ...draft?.values })
const client = ref<ClientChoice | null>(props.initialClient ?? draft?.client ?? null)
const options = ref<ArticleOptions | null>(null)
const loadError = ref('')
const serverError = ref('')
const errors = ref<Partial<Record<ArticleField, string>>>({})
const busy = ref(false)
let initialFiche: Record<string, string> = {}
const fiche = ref<Record<string, string>>({ ...draft?.fiche })
const phase = ref<1 | 2>(draft?.phase ?? 1)
const ficheProcede = ref(draft?.ficheProcede ?? '')
const restoredAt = ref(draft?.savedAt ?? 0)
const confirmingReset = ref(false)

const general = computed(() => values.type === TYPE_GENERAL)
const schema = computed(() => options.value?.schema)
const phased = computed(() => !editing.value && !general.value)
const onFiche = computed(() => phased.value && phase.value === 2)

onMounted(async () => {
	try {
		const loaded = await getArticleOptions()
		initialFiche = ficheFormValues(props.article?.fiche ?? {}, loaded.schema)
		fiche.value = { ...initialFiche, ...fiche.value }
		options.value = loaded
		if (!editing.value && loaded.groupes.includes(loaded.groupe_defaut)) {
			// Prérempli : ce n'est pas une saisie, la fermeture ne demande pas de confirmation.
			initial.groupe = loaded.groupe_defaut
			if (!values.groupe) values.groupe = loaded.groupe_defaut
		}
	} catch (e) {
		loadError.value = (e as Error).message
	}
})

// Les conditions du Desk se recalculent à la saisie : changer de procédé change les champs proposés.
const doc = computed(() => {
	const checks = Object.fromEntries((schema.value?.groups ?? []).flatMap((group) => group.fields.filter((field) => field.fieldtype === 'Check').map((field) => [field.fieldname, Number(fiche.value[field.fieldname] ?? 0)])))
	return {
		custom_type_article: values.type,
		custom_procédé: values.procede,
		custom_article_compose: props.article?.compose ?? 0,
		custom_sous_article: props.article?.sous_article ?? 0,
		item_code: values.designation,
		item_name: values.designation,
		...fiche.value,
		...checks,
	}
})
const cards = computed(() => (editing.value && !general.value ? ficheCards(schema.value, doc.value) : []))
const phaseCards = computed(() =>
	onFiche.value
		? creationCards(schema.value, doc.value).map(({ title, fields }) => ({
				title,
				inputs: fields.filter((field) => field.fieldtype !== 'Check'),
				checks: fields.filter((field) => field.fieldtype === 'Check'),
			}))
		: [],
)
const savedName = computed(() => values.designation.trim().toUpperCase())
// Le groupe en place reste proposé, même s'il a quitté la liste.
const groupes = computed(() => {
	const list = options.value?.groupes ?? []
	return values.groupe && !list.includes(values.groupe) ? [values.groupe, ...list] : list
})

const changes = computed(() => changedFields(initial, values))
const ficheChanges = computed(() => changedFields(initialFiche, fiche.value))
const dirty = computed(() => Object.keys(changes.value).length > 0 || Object.keys(ficheChanges.value).length > 0 || (!editing.value && client.value?.name !== props.initialClient?.name))

/** Seuls les champs proposés pour le procédé retenu partent au serveur. */
const creationFiche = computed(() => {
	const sent = creationCards(schema.value, doc.value).flatMap((card) => card.fields.map((field) => field.fieldname))
	return Object.fromEntries(sent.filter((name) => name in ficheChanges.value).map((name) => [name, ficheChanges.value[name]!]))
})
/** Valeurs saisies pour un autre procédé : gardées si on y revient, mais pas enregistrées avec celui-ci. */
const lostCount = computed(() => {
	if (!ficheProcede.value || ficheProcede.value === values.procede) return 0
	const before = { ...doc.value, custom_procédé: ficheProcede.value }
	const kept = new Set(creationCards(schema.value, before).flatMap((card) => card.fields.map((field) => field.fieldname)))
	const fields = (schema.value?.groups ?? []).flatMap((group) => group.fields)
	return fields.filter((field) => kept.has(field.fieldname) && field.fieldname in ficheChanges.value && !fieldVisible(field, doc.value)).length
})
const restoredLabel = computed(() => new Date(restoredAt.value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }))
const hint = computed(() => {
	if (editing.value) return 'Ctrl + Entrée pour enregistrer'
	if (onFiche.value) return 'Les champs vides se complètent ensuite avec Modifier.'
	return general.value ? 'Ctrl + Entrée pour créer' : 'Ctrl + Entrée pour continuer'
})

watch(
	() => values.designation,
	() => delete errors.value.designation,
)
watch(client, () => delete errors.value.client)
watch(
	fiche,
	() => {
		if (onFiche.value && Object.keys(ficheChanges.value).length) ficheProcede.value = values.procede
	},
	{ deep: true },
)
// À chaque saisie, sans attendre : une coupure ou une page fermée ne perd que la dernière frappe.
watch(
	[values, client, fiche, phase, ficheProcede],
	() => {
		if (editing.value) return
		if (!dirty.value) clearDraft(draftClient)
		else saveDraft({ savedAt: Date.now(), phase: phase.value, values: { ...values }, client: client.value, fiche: fiche.value, ficheProcede: ficheProcede.value }, draftClient)
	},
	{ deep: true },
)

async function focusInvalid() {
	await nextTick()
	document.querySelector<HTMLElement>('.dialog [aria-invalid="true"]')?.focus()
}
function validate() {
	errors.value = validateArticle({ ...values, client: client.value?.name }, editing.value)
	serverError.value = ''
	return !Object.keys(errors.value).length
}

async function goToFiche() {
	if (busy.value) return
	if (!validate()) return focusInvalid()
	if (!options.value) return
	busy.value = true
	try {
		const { message } = await checkArticleDesignation(values.designation, client.value?.name)
		if (message) {
			errors.value.designation = message
			return focusInvalid()
		}
	} catch {
		// Contrôle impossible : la saisie continue, le serveur contrôle encore à la création.
	} finally {
		busy.value = false
	}
	phase.value = 2
	await nextTick()
	const body = document.querySelector<HTMLElement>('.dialog-body')
	if (body) body.scrollTop = 0
	body?.querySelector<HTMLElement>('input,select')?.focus()
}

async function backToBase() {
	if (busy.value) return
	phase.value = 1
	serverError.value = ''
	await nextTick()
	document.querySelector<HTMLElement>('.dialog-body input')?.focus()
}

function discard() {
	clearDraft(draftClient)
	emit('close')
}

function startOver() {
	Object.assign(values, initial)
	client.value = props.initialClient ?? null
	fiche.value = { ...initialFiche }
	phase.value = 1
	ficheProcede.value = ''
	errors.value = {}
	serverError.value = ''
	restoredAt.value = 0
	confirmingReset.value = false
	clearDraft(draftClient)
}

function submit() {
	return phased.value && phase.value === 1 ? goToFiche() : save()
}

async function save() {
	if (busy.value) return
	if (!validate()) {
		if (phased.value) phase.value = 1
		return focusInvalid()
	}
	if (props.article && !Object.keys(changes.value).length && !Object.keys(ficheChanges.value).length) {
		emit('close')
		return
	}
	busy.value = true
	try {
		if (props.article) {
			emit('saved', await updateArticle(props.article, { ...changes.value, fiche: ficheChanges.value as Record<string, string> }))
		} else {
			const payload = general.value
				? { type: values.type, designation: values.designation, groupe: values.groupe, ancien_code: values.ancien_code }
				: { type: values.type, designation: values.designation, client: client.value?.name, procede: values.procede, reference: values.reference, groupe: values.groupe, fiche: creationFiche.value }
			const { name } = await createArticle(payload)
			clearDraft(draftClient)
			emit('created', name)
		}
		emit('close')
	} catch (e) {
		// La saisie reste en place : rien n'est perdu si le serveur refuse.
		const offline = e instanceof ApiError && e.offline
		serverError.value = offline && !editing.value ? "Pas de connexion réseau : l'article n'est pas créé. Votre saisie reste en brouillon sur ce poste, réessayez quand le réseau revient." : (e as Error).message
	} finally {
		busy.value = false
	}
}
</script>

<template>
	<FormDialog :class="!editing && 'article-create'" :title="editing ? 'Modifier l\'article' : 'Nouvel article'" :dirty="dirty" :busy="busy" :hint="hint" :draft="!editing" @close="emit('close')" @discard="discard" @submit="submit">
		<template #top>
			<ol v-if="phased" class="phase-bar" aria-label="Phases de la création">
				<li>
					<button type="button" class="phase-step" :aria-current="phase === 1 ? 'step' : undefined" :data-done="phase === 2" @click="backToBase">
						<span class="phase-num"><LucideCheck v-if="phase === 2" class="h-3 w-3" aria-hidden="true" /><template v-else>1</template></span>Informations de base
					</button>
				</li>
				<li class="phase-sep" aria-hidden="true"></li>
				<li>
					<button type="button" class="phase-step" :aria-current="phase === 2 ? 'step' : undefined" @click="phase === 1 && goToFiche()">
						<span class="phase-num">2</span>Fiche technique {{ procedeLabel(values.procede) }}
					</button>
				</li>
			</ol>
			<div v-if="restoredAt" class="draft-note">
				<template v-if="confirmingReset">
					<span>Effacer cette saisie ?</span>
					<button type="button" class="btn-ghost" @click="confirmingReset = false">Garder</button>
					<button type="button" class="btn-danger" @click="startOver">Effacer</button>
				</template>
				<template v-else>
					<span>Brouillon repris, enregistré le {{ restoredLabel }}.</span>
					<button type="button" class="btn-ghost" @click="confirmingReset = true">Repartir de zéro</button>
				</template>
			</div>
			<div v-if="onFiche" class="phase-recap"><strong>{{ savedName }}</strong><span>{{ client?.label }}</span><span>{{ values.groupe }}</span></div>
			<p v-if="onFiche && serverError" role="alert" class="phase-alert tone-red">{{ serverError }}</p>
		</template>

		<p v-if="loadError" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ loadError }}</p>

		<template v-if="onFiche">
			<template v-for="(card, index) in phaseCards" :key="card.title">
				<h3 class="form-section" :class="index === 0 && 'mt-0 border-t-0 pt-0'">{{ card.title }}</h3>
				<div v-if="card.inputs.length" class="form-grid form-grid-3">
					<FicheInput v-for="field in card.inputs" :key="field.fieldname" v-model="fiche[field.fieldname]" :field="field" />
				</div>
				<div v-if="card.checks.length" class="form-checks">
					<FicheInput v-for="field in card.checks" :key="field.fieldname" v-model="fiche[field.fieldname]" :field="field" />
				</div>
			</template>
		</template>

		<template v-else>
			<div v-if="!editing && !initialClient" class="form-field">
				<span class="field-label">Type d'article</span>
				<div class="seg self-start" role="group" aria-label="Type d'article">
					<button v-for="item in options?.types ?? ['Client', TYPE_GENERAL]" :key="item" type="button" :aria-pressed="values.type === item" @click="values.type = item">{{ item }}</button>
				</div>
			</div>

			<div class="form-field">
				<label class="field-label" for="article-designation">Désignation <span class="req">obligatoire</span></label>
				<input id="article-designation" v-model="values.designation" class="field-input" autocomplete="off" :aria-invalid="Boolean(errors.designation)" />
				<p v-if="errors.designation" class="field-error" role="alert">{{ errors.designation }}</p>
				<p v-else-if="savedName" class="field-note"><LucideInfo class="mt-px h-3.5 w-3.5 flex-none" aria-hidden="true" /><span>Enregistrée ainsi : {{ savedName }}</span></p>
			</div>

			<div v-if="!editing && !general" class="form-field">
				<label class="field-label" for="article-client">Client <span class="req">obligatoire</span></label>
				<ClientPicker v-model="client" input-id="article-client" :invalid="Boolean(errors.client)" @error="serverError = $event" />
				<p v-if="errors.client" class="field-error" role="alert">{{ errors.client }}</p>
				<p v-else-if="client" class="field-note"><LucideInfo class="mt-px h-3.5 w-3.5 flex-none" aria-hidden="true" /><span>Le code de l'article est attribué à la création, à la suite de ceux du client.</span></p>
			</div>

			<div v-if="!general" class="form-field">
				<span class="field-label">Procédé <span class="req">obligatoire</span></span>
				<div class="seg self-start" role="group" aria-label="Procédé">
					<button v-for="item in options?.procedes ?? []" :key="item" type="button" :aria-pressed="values.procede === item" :aria-invalid="Boolean(errors.procede)" @click="values.procede = item; delete errors.procede">{{ procedeLabel(item) }}</button>
				</div>
				<p v-if="errors.procede" class="field-error" role="alert">{{ errors.procede }}</p>
				<p v-else-if="phased" class="field-note"><LucideInfo class="mt-px h-3.5 w-3.5 flex-none" aria-hidden="true" /><span>Il décide des champs de la phase suivante.</span></p>
			</div>
			<p v-if="lostCount" role="status" class="rounded-control tone-amber px-3 py-2 text-sm">{{ lostCount > 1 ? `${lostCount} valeurs saisies pour ${procedeLabel(ficheProcede)} ne seront pas enregistrées` : `1 valeur saisie pour ${procedeLabel(ficheProcede)} ne sera pas enregistrée` }} avec un article {{ procedeLabel(values.procede) }}. Reprenez {{ procedeLabel(ficheProcede) }} pour les retrouver.</p>

			<div class="form-grid">
				<div class="form-field">
					<label class="field-label" for="article-groupe">Groupe d'article <span class="req">obligatoire</span></label>
					<select id="article-groupe" v-model="values.groupe" class="field-input" :aria-invalid="Boolean(errors.groupe)" @change="delete errors.groupe">
						<option value="">Choisir…</option>
						<option v-for="item in groupes" :key="item" :value="item">{{ item }}</option>
					</select>
					<p v-if="errors.groupe" class="field-error" role="alert">{{ errors.groupe }}</p>
				</div>
				<div v-if="!general" class="form-field">
					<label class="field-label" for="article-reference">Réf. article client</label>
					<input id="article-reference" v-model="values.reference" class="field-input" autocomplete="off" />
				</div>
				<div v-if="general" class="form-field">
					<label class="field-label" for="article-ancien">Ancien code ERP</label>
					<input id="article-ancien" v-model="values.ancien_code" class="field-input" autocomplete="off" />
				</div>
				<div v-if="editing && !general" class="form-field">
					<label class="field-label" for="article-consommation">Consommation annuelle</label>
					<input id="article-consommation" v-model="values.consommation" class="field-input tabular-nums" type="number" min="0" step="1" autocomplete="off" />
				</div>
			</div>

			<template v-for="card in cards" :key="card.title">
				<h3 class="form-section">{{ card.title }}</h3>
				<div class="form-grid">
					<FicheInput v-for="field in card.fields" :key="field.fieldname" v-model="fiche[field.fieldname]" :field="field" />
				</div>
			</template>

			<p v-if="serverError" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ serverError }}</p>
		</template>

		<template #actions>
			<button v-if="onFiche" type="button" class="btn-secondary" :disabled="busy" @click="backToBase">Précédent</button>
			<button type="button" class="btn-primary" :disabled="busy" @click="submit">{{ busy ? (phased && phase === 1 ? 'Vérification…' : 'Enregistrement…') : editing ? 'Enregistrer' : phased && phase === 1 ? 'Continuer' : "Créer l'article" }}</button>
		</template>
	</FormDialog>
</template>
