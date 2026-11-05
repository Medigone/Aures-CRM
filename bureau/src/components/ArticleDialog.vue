<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import LucideInfo from '~icons/lucide/info'
import FormDialog from '@shared/components/FormDialog.vue'
import ClientPicker from './ClientPicker.vue'
import FicheInput from './FicheInput.vue'
import { createArticle, getArticleOptions, updateArticle } from '@/lib/api'
import { changedFields, createFields, ficheCards, ficheFormValues, TYPE_GENERAL, validateArticle, type ArticleDetail, type ArticleField, type ArticleOptions } from '@/lib/articles'
import type { ClientChoice } from '@/types'

/** Nouvel article, ou modification (`article`) : la même fenêtre, avec toute la fiche technique pour un article existant. */
const props = defineProps<{ article?: ArticleDetail; initialClient?: ClientChoice }>()
const emit = defineEmits<{ close: []; created: [name: string]; saved: [article: ArticleDetail] }>()

const editing = computed(() => Boolean(props.article))
const initial = {
	type: props.article?.type ?? 'Client',
	designation: props.article?.designation ?? '',
	procede: props.article?.procede ?? '',
	reference: props.article?.reference ?? '',
	groupe: props.article?.groupe ?? '',
	ancien_code: props.article?.ancien_code ?? '',
	consommation: props.article?.consommation ? String(props.article.consommation) : '',
}
const values = reactive({ ...initial })
const client = ref<ClientChoice | null>(props.initialClient ?? null)
const options = ref<ArticleOptions | null>(null)
const loadError = ref('')
const serverError = ref('')
const errors = ref<Partial<Record<ArticleField, string>>>({})
const busy = ref(false)
let initialFiche: Record<string, string> = {}
const fiche = ref<Record<string, string>>({})

const general = computed(() => values.type === TYPE_GENERAL)
const schema = computed(() => options.value?.schema)

onMounted(async () => {
	try {
		const loaded = await getArticleOptions()
		initialFiche = ficheFormValues(props.article?.fiche ?? {}, loaded.schema)
		fiche.value = { ...initialFiche }
		options.value = loaded
		if (!editing.value && !values.groupe && loaded.groupes.includes(loaded.groupe_defaut)) {
			// Prérempli : ce n'est pas une saisie, la fermeture ne demande pas de confirmation.
			initial.groupe = loaded.groupe_defaut
			values.groupe = loaded.groupe_defaut
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
const shortFields = computed(() => (editing.value || general.value ? [] : createFields(schema.value, values.procede)))
const savedName = computed(() => values.designation.trim().toUpperCase())
// Le groupe en place reste proposé, même s'il a quitté la liste.
const groupes = computed(() => {
	const list = options.value?.groupes ?? []
	return values.groupe && !list.includes(values.groupe) ? [values.groupe, ...list] : list
})

const changes = computed(() => changedFields(initial, values))
const ficheChanges = computed(() => changedFields(initialFiche, fiche.value))
const dirty = computed(() => Object.keys(changes.value).length > 0 || Object.keys(ficheChanges.value).length > 0 || (!editing.value && client.value?.name !== props.initialClient?.name))

watch(
	() => values.designation,
	() => delete errors.value.designation,
)
watch(client, () => delete errors.value.client)

async function submit() {
	if (busy.value) return
	errors.value = validateArticle({ ...values, client: client.value?.name }, editing.value)
	serverError.value = ''
	if (Object.keys(errors.value).length) {
		await nextTick()
		document.querySelector<HTMLElement>('.dialog [aria-invalid="true"]')?.focus()
		return
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
				: { type: values.type, designation: values.designation, client: client.value?.name, procede: values.procede, reference: values.reference, groupe: values.groupe, fiche: ficheChanges.value as Record<string, string> }
			const { name } = await createArticle(payload)
			emit('created', name)
		}
		emit('close')
	} catch (e) {
		// La saisie reste en place : rien n'est perdu si le serveur refuse.
		serverError.value = (e as Error).message
	} finally {
		busy.value = false
	}
}
</script>

<template>
	<FormDialog :title="editing ? 'Modifier l\'article' : 'Nouvel article'" :dirty="dirty" :busy="busy" :hint="editing ? 'Ctrl + Entrée pour enregistrer' : 'Ctrl + Entrée pour créer'" @close="emit('close')" @submit="submit">
		<p v-if="loadError" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ loadError }}</p>

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
				<button v-for="item in options?.procedes ?? []" :key="item" type="button" :aria-pressed="values.procede === item" :aria-invalid="Boolean(errors.procede)" @click="values.procede = item; delete errors.procede">{{ item === 'Salle Blanche Pharma' ? 'Salle blanche' : item }}</button>
			</div>
			<p v-if="errors.procede" class="field-error" role="alert">{{ errors.procede }}</p>
		</div>

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

		<template v-if="shortFields.length">
			<h3 class="form-section">Fiche technique {{ values.procede === 'Salle Blanche Pharma' ? 'Salle blanche' : values.procede }}</h3>
			<div class="form-grid">
				<FicheInput v-for="field in shortFields" :key="field.fieldname" v-model="fiche[field.fieldname]" :field="field" />
			</div>
			<p class="field-note"><LucideInfo class="mt-px h-3.5 w-3.5 flex-none" aria-hidden="true" /><span>Le reste de la fiche technique se complète ensuite avec Modifier.</span></p>
		</template>

		<template v-for="card in cards" :key="card.title">
			<h3 class="form-section">{{ card.title }}</h3>
			<div class="form-grid">
				<FicheInput v-for="field in card.fields" :key="field.fieldname" v-model="fiche[field.fieldname]" :field="field" />
			</div>
		</template>

		<p v-if="serverError" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ serverError }}</p>

		<template #actions>
			<button type="button" class="btn-primary" :disabled="busy" @click="submit">{{ busy ? 'Enregistrement…' : editing ? 'Enregistrer' : "Créer l'article" }}</button>
		</template>
	</FormDialog>
</template>
