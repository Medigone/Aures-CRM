<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import { useCommercialStore } from '@/stores/commercial'
import { editableGroups, ficheDoc, groupTitle } from '@/lib/fiche'
import { normalizeSearch } from '@/lib/format'
import { refTo } from '@/lib/mutations'
import type { FicheField } from '@/types'

/**
 * Modification d'un article client, hors-ligne : seuls les champs du procédé choisi s'affichent (conditions du Desk),
 * et seuls les champs changés partent au serveur (une modification faite entre-temps dans le Desk sur un autre champ est gardée).
 */
const props = defineProps<{ id: string }>()
const store = useCommercialStore()
const router = useRouter()

const key = computed(() => store.resolveKey(props.id))
watch(key, (next) => {
	if (next !== props.id) router.replace({ name: 'EditArticle', params: { id: next } })
})
const article = computed(() => store.articlesByName.get(key.value) ?? null)
const client = computed(() => (article.value ? store.clientsByName.get(article.value.client) ?? null : null))
const schema = computed(() => store.references?.fiche_article)
const procedes = computed(() => (store.references?.procedes_article?.length ? store.references.procedes_article : ['Offset', 'Flexo', 'Salle Blanche Pharma', 'Numérique']))

const form = reactive({ designation: '', procede: '', code_client: '', consommation_annuelle: null as number | null })
const values = reactive<Record<string, any>>({})
const initial = ref<{ form: typeof form; values: Record<string, any> } | null>(null)

// Rempli une fois à l'ouverture : la saisie en cours n'est pas écrasée par une synchro.
watch(
	article,
	(a) => {
		if (!a || initial.value) return
		form.designation = a.designation
		form.procede = a.procede || ''
		form.code_client = a.code_client || ''
		form.consommation_annuelle = a.consommation_annuelle
		for (const name of schema.value?.fields ?? []) values[name] = a.fiche?.[name] ?? null
		initial.value = { form: { ...form }, values: { ...values } }
	},
	{ immediate: true },
)

const groups = computed(() =>
	article.value
		? editableGroups(schema.value, ficheDoc({ ...article.value, designation: form.designation, procede: form.procede }, values)).map((g) => ({
				label: g.label,
				fields: g.fields.filter((f) => f.fieldtype !== 'Check'),
				checks: g.fields.filter((f) => f.fieldtype === 'Check'),
			}))
		: [],
)

/** Liste courte (≤ 4 choix) : sélecteur segmenté ; sinon liste déroulante. */
const segmented = (f: FicheField) => f.fieldtype === 'Select' && (f.options?.length ?? 0) <= 4
const inputType = (f: FicheField) => (['Int', 'Float', 'Percent'].includes(f.fieldtype) ? 'number' : 'text')
function pick(f: FicheField, option: string) {
	values[f.fieldname] = values[f.fieldname] === option ? null : option
}
function toggleCheck(f: FicheField) {
	values[f.fieldname] = Number(values[f.fieldname]) ? 0 : 1
}
function onNumber(f: FicheField, event: Event) {
	const raw = (event.target as HTMLInputElement).value
	values[f.fieldname] = raw === '' ? null : Number(raw)
}

const same = (a: unknown, b: unknown) => (a ?? '') === (b ?? '') || (a == null && b === 0) || (a === 0 && b == null)
const changes = computed(() => {
	const start = initial.value
	if (!start) return null
	const payload: Record<string, any> = {}
	if (form.designation.trim().toUpperCase() !== start.form.designation.toUpperCase()) payload.designation = form.designation.trim()
	if (form.procede !== start.form.procede) payload.procede = form.procede
	if (form.code_client.trim() !== (start.form.code_client || '')) payload.code_client = form.code_client.trim() || null
	if (!same(form.consommation_annuelle, start.form.consommation_annuelle)) payload.consommation_annuelle = form.consommation_annuelle
	const fiche: Record<string, any> = {}
	for (const [name, value] of Object.entries(values)) if (!same(value, start.values[name])) fiche[name] = value
	if (Object.keys(fiche).length) payload.fiche = fiche
	return payload
})
const changeCount = computed(() => {
	const c = changes.value
	return c ? Object.keys(c).filter((k) => k !== 'fiche').length + Object.keys(c.fiche ?? {}).length : 0
})

const duplicate = computed(() => {
	const name = normalizeSearch(form.designation.trim())
	if (!name || !article.value) return null
	return (store.articlesByClient.get(article.value.client) ?? []).find((a) => a.name !== article.value!.name && normalizeSearch(a.designation) === name) ?? null
})
const error = ref<string | null>(null)

function save() {
	if (!article.value || !changes.value) return
	if (!form.designation.trim()) error.value = 'La désignation est obligatoire.'
	else if (!form.procede) error.value = 'Choisissez le procédé.'
	else if (duplicate.value) error.value = `Ce client a déjà l'article « ${duplicate.value.designation} ».`
	else error.value = null
	if (error.value) return
	if (changeCount.value) store.enqueue('article_update', { ...refTo('article', article.value.name), ...changes.value }, article.value.name)
	router.replace({ name: 'Article', params: { id: article.value.name } })
}
</script>

<template>
	<div v-if="!article" class="py-10 text-center text-ink-gray-6">
		<PageHeader title="Article introuvable" :back="{ name: 'Clients' }" />
		Cet article n'est pas sur cet appareil.
	</div>
	<div v-else class="pb-32">
		<PageHeader title="Modifier l'article" :subtitle="client?.customer_name" :back="{ name: 'Article', params: { id: article.name } }" />
		<div class="space-y-6">
			<section>
				<h2 class="mb-2 text-[15px] font-semibold">Identité</h2>
				<div class="card divide-y divide-outline-gray-1">
					<label class="block px-4 py-3">
						<span class="block text-xs font-medium text-ink-gray-6">Désignation *</span>
						<input v-model="form.designation" type="text" class="block w-full border-0 bg-transparent p-0 text-base font-semibold uppercase focus:ring-0" autocapitalize="characters" />
						<span v-if="duplicate" class="mt-1 block text-xs text-ink-amber-3">Déjà utilisée par un autre article de ce client.</span>
					</label>
					<label class="list-row">
						<span class="font-medium">Réf. article client</span>
						<input v-model="form.code_client" type="text" class="min-w-0 flex-1 border-0 bg-transparent p-0 text-right text-base text-ink-gray-7 focus:ring-0" placeholder="—" />
					</label>
					<label class="list-row">
						<span class="font-medium">Consommation annuelle</span>
						<input v-model.number="form.consommation_annuelle" type="number" inputmode="numeric" min="0" class="w-32 border-0 bg-transparent p-0 text-right text-base text-ink-gray-7 focus:ring-0" placeholder="—" />
					</label>
				</div>
			</section>

			<section>
				<h2 class="mb-2 text-[15px] font-semibold">Procédé *</h2>
				<div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Procédé">
					<button v-for="p in procedes" :key="p" type="button" role="radio" :aria-checked="form.procede === p" :class="form.procede === p ? 'chip-on' : 'chip-off'" @click="form.procede = p">{{ p }}</button>
				</div>
				<p v-if="initial && form.procede !== initial.form.procede" class="mt-2 text-xs text-ink-gray-6">
					La fiche technique {{ form.procede }} s'affiche ; les valeurs {{ initial.form.procede || 'précédentes' }} restent dans le Desk.
				</p>
			</section>

			<p v-if="!schema" class="text-sm text-ink-gray-6">Fiche technique indisponible : synchronisez l'appareil pour la charger.</p>

			<section v-for="g in groups" :key="g.label" class="space-y-2.5">
				<h2 class="text-[15px] font-semibold">{{ groupTitle(g.label) }}</h2>
				<div v-if="g.fields.length" class="card divide-y divide-outline-gray-1">
					<template v-for="f in g.fields" :key="f.fieldname">
						<div v-if="segmented(f)" class="space-y-2 px-4 py-3">
							<span :id="`seg-${f.fieldname}`" class="block font-medium">{{ f.label }}</span>
							<div class="segmented" role="radiogroup" :aria-labelledby="`seg-${f.fieldname}`">
								<button v-for="o in f.options" :key="o" type="button" role="radio" :aria-checked="values[f.fieldname] === o" @click="pick(f, o)">{{ o }}</button>
							</div>
						</div>
						<label v-else-if="f.fieldtype === 'Select' || f.fieldtype === 'Link'" class="list-row">
							<span class="font-medium">{{ f.label }}</span>
							<select v-model="values[f.fieldname]" class="min-w-0 max-w-[55%] border-0 bg-transparent py-0 pr-7 text-right text-base text-ink-gray-7 focus:ring-0">
								<option :value="null">—</option>
								<option v-for="o in f.options" :key="o" :value="o">{{ o }}</option>
							</select>
						</label>
						<label v-else class="list-row">
							<span class="font-medium">{{ f.label }}</span>
							<input
								v-if="inputType(f) === 'number'"
								:value="values[f.fieldname] ?? ''"
								type="number"
								inputmode="decimal"
								min="0"
								class="w-28 border-0 bg-transparent p-0 text-right text-base text-ink-gray-7 focus:ring-0"
								placeholder="—"
								@input="onNumber(f, $event)"
							/>
							<input v-else v-model="values[f.fieldname]" type="text" class="min-w-0 max-w-[55%] flex-1 border-0 bg-transparent p-0 text-right text-base text-ink-gray-7 focus:ring-0" placeholder="—" />
						</label>
					</template>
				</div>
				<div v-if="g.checks.length" class="flex flex-wrap gap-2">
					<button v-for="c in g.checks" :key="c.fieldname" type="button" :aria-pressed="Boolean(Number(values[c.fieldname]))" :class="Number(values[c.fieldname]) ? 'chip-on' : 'chip-off'" @click="toggleCheck(c)">{{ c.label }}</button>
				</div>
			</section>
		</div>

		<div class="action-bar flex-col">
			<p v-if="error" class="text-sm text-ink-red-3" role="alert">{{ error }}</p>
			<p v-else class="text-center text-xs text-ink-gray-6">{{ changeCount ? `${changeCount} modification${changeCount > 1 ? 's' : ''} · envoyée${changeCount > 1 ? 's' : ''} à la prochaine synchro` : 'Aucune modification' }}</p>
			<button type="button" class="btn-primary w-full" :disabled="!changeCount" @click="save">Enregistrer</button>
		</div>
	</div>
</template>
