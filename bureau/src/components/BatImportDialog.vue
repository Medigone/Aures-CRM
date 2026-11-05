<script setup lang="ts">
import { computed, ref } from 'vue'
import type { UploadedFile } from '@shared/api'
import FileUploader from '@shared/components/FileUploader.vue'
import FormDialog from '@shared/components/FormDialog.vue'
import { fieldVisible, type FicheField } from '@shared/fiche'
import ArticleColorsInput from './ArticleColorsInput.vue'
import FicheInput from './FicheInput.vue'
import { analyzeBat, setArticleFile, updateArticle } from '@/lib/api'
import { articleDoc, teintesForEdit, type ArticleDetail, type ArticleOptions, type ArticleTeinte } from '@/lib/articles'
import { batFileCheck, batRows, batUpdate, sameColors, type BatAnalysis, type BatGap, type BatRow } from '@/lib/batImport'

/** Joindre un BAT : l'analyse propose des valeurs, l'utilisateur les ajuste, et seule sa vérification écrit sur l'article. */
const props = defineProps<{ article: ArticleDetail; options: ArticleOptions | null }>()
const emit = defineEmits<{ close: []; saved: [article: ArticleDetail, message: string] }>()

const uploader = ref<InstanceType<typeof FileUploader> | null>(null)
const step = ref<1 | 2>(1)
const analysis = ref<BatAnalysis | null>(null)
const rows = ref<BatRow[]>([])
const same = ref<string[]>([])
const hiddenInformations = ref<{ label: string; value: string }[]>([])
const teintes = ref<ArticleTeinte[]>([])
const replaceColors = ref(false)
const gapIgnored = ref(false)
const busy = ref(false)
const error = ref('')
// Ce qui a déjà réussi n'est pas refait si l'envoi du fichier est à reprendre.
let updated: ArticleDetail | null = null
let fieldsUpdated = false
let attaching: Promise<void> | null = null
// Envoyé mais pas encore rangé : une reprise ne renvoie pas le fichier.
const uploadedUrl = ref('')

const file = computed(() => uploader.value?.items.find((item) => item.status !== 'refused')?.file ?? null)
const existing = computed(() => props.article.teintes ?? [])
const colorsToDecide = computed(() => Boolean(analysis.value && (analysis.value.teintes.length || analysis.value.ecarts.length)))
const colorsIdentical = computed(() => colorsToDecide.value && existing.value.length > 0 && !analysis.value?.ecarts.length && sameColors(existing.value, teintes.value))
const readable = computed(() => Boolean(rows.value.length || same.value.length || colorsToDecide.value))
const informations = computed(() => [...hiddenInformations.value, ...(analysis.value?.informations ?? [])])
const gapText = computed(() => {
	const codes = (source: BatGap['source']) => analysis.value?.ecarts.filter((gap) => gap.source === source).map((gap) => gap.label).join(', ')
	const legend = codes('legende')
	const inks = codes('fichier')
	return [legend && `la légende annonce ${legend}`, inks && `le fichier utilise ${inks}`].filter(Boolean).join(', ')
})
// Une encre perdue fausserait le nombre de couleurs : un écart se tranche avant d'écrire les couleurs.
const gapOpen = computed(() => Boolean(replaceColors.value && analysis.value?.ecarts.length && !gapIgnored.value && !analysis.value.ecarts.some(gapKept)))
const hint = computed(() => (step.value === 1 ? "Le fichier n'est joint qu'à la fin." : 'Rien ne change avant la mise à jour.'))
const sendingAll = ref(false)
const primaryLabel = computed(() => {
	if (uploadedUrl.value && !busy.value) return "Réessayer l'envoi"
	if (busy.value) return step.value === 1 && !sendingAll.value ? 'Analyse…' : 'Mise à jour…'
	if (step.value === 1) return 'Analyser'
	return readable.value ? 'Mettre à jour la fiche' : 'Joindre le fichier'
})

function fieldOf(fieldname: string): FicheField | undefined {
	const doc = articleDoc(props.article)
	return props.options?.schema.groups.flatMap((group) => group.fields).find((field) => field.fieldname === fieldname && fieldVisible(field, doc))
}
async function analyze() {
	if (!file.value || busy.value) return
	busy.value = true
	error.value = ''
	try {
		const result = await analyzeBat(props.article.name, file.value)
		const read = batRows(result.propositions, props.article, fieldOf)
		analysis.value = result
		rows.value = read.rows
		same.value = read.same
		hiddenInformations.value = read.hidden
		teintes.value = teintesForEdit(result.teintes)
		// Une couleur déjà en place n'est jamais remplacée sans le demander.
		replaceColors.value = !existing.value.length
		step.value = 2
	} catch (e) {
		error.value = (e as Error).message
	} finally {
		busy.value = false
	}
}
function ignoreGap() {
	gapIgnored.value = !gapIgnored.value
	if (gapIgnored.value) teintes.value = teintes.value.filter((line) => !analysis.value?.ecarts.some((gap) => gap.code === line.code))
}
function gapKept(gap: BatGap) {
	return teintes.value.some((line) => line.code === gap.code)
}
function toggleGap(gap: BatGap) {
	gapIgnored.value = false
	if (gapKept(gap)) teintes.value = teintes.value.filter((line) => line.code !== gap.code)
	else teintes.value = [...teintesForEdit([{ ...gap }]), ...teintes.value]
}
// La file d'envoi n'attend pas ce rangement : la fin de l'envoi l'attend ici, pour ne fermer qu'une fois le BAT en place.
async function attach() {
	updated = await setArticleFile(updated ?? props.article, 'fiche_technique', uploadedUrl.value)
	uploadedUrl.value = ''
}
function onUploaded(uploaded: UploadedFile) {
	uploadedUrl.value = uploaded.file_url
	attaching = attach()
}
function finish() {
	emit('saved', updated ?? props.article, fieldsUpdated ? 'Fiche technique mise à jour et BAT joint.' : 'BAT joint.')
	emit('close')
}
function attachFailed() {
	error.value = fieldsUpdated ? "La fiche est à jour, mais le BAT n'est pas joint. Réessayez l'envoi." : "Le BAT n'est pas joint. Réessayez l'envoi."
}
async function onSettled(sent: number, failed: number) {
	try {
		await attaching
		if (failed || !sent) attachFailed()
		else finish()
	} catch {
		attachFailed()
	} finally {
		busy.value = false
	}
}
async function save() {
	if (busy.value || (!file.value && !uploadedUrl.value)) return
	if (gapOpen.value) {
		error.value = "Choisissez d'abord la couleur à garder dans l'écart signalé."
		return
	}
	busy.value = true
	sendingAll.value = true
	error.value = ''
	try {
		if (uploadedUrl.value) {
			await attach()
			finish()
			return
		}
		if (!updated) {
			const values = batUpdate(rows.value, replaceColors.value && !colorsIdentical.value && colorsToDecide.value ? teintes.value : null)
			updated = values ? await updateArticle(props.article, values) : props.article
			fieldsUpdated = Boolean(values)
		}
		if (uploader.value?.items.some((item) => item.status === 'error')) uploader.value.retryAll()
		else uploader.value?.start({ doctype: 'Item', docname: props.article.name })
	} catch (e) {
		if (uploadedUrl.value) attachFailed()
		else error.value = (e as Error).message
	} finally {
		// Pendant l'envoi, c'est sa fin qui rend la main.
		if (!uploader.value?.sending) busy.value = false
	}
}
function submit() {
	return step.value === 1 && !uploadedUrl.value ? analyze() : save()
}
</script>

<template>
	<FormDialog title="Importer un BAT" :dirty="Boolean(file)" :busy="busy" :hint="hint" @close="emit('close')" @submit="submit">
		<FileUploader ref="uploader" deferred :zone="step === 1" :multiple="false" accept=".pdf,application/pdf" doctype="Item" :docname="article.name" :check="batFileCheck" @change="error = ''" @uploaded="onUploaded" @settled="onSettled" />

		<template v-if="step === 2">
			<p v-if="!readable" role="status" class="rounded-control tone-amber px-3 py-2 text-sm">Aucune information lisible dans ce PDF : son texte est peut-être vectorisé. Vous pouvez joindre le fichier, et remplir la fiche avec Modifier.</p>

			<template v-if="rows.length || same.length">
				<h3 class="form-section mt-0 border-t-0 pt-0">Fiche technique</h3>
				<ul class="bat-rows">
					<li v-for="row in rows" :key="row.key" class="bat-row">
						<input v-model="row.checked" class="mt-1 h-4 w-4" type="checkbox" :aria-label="`Reprendre : ${row.field.label}`" />
						<div class="min-w-0">
							<p v-if="row.field.fieldtype === 'Check'" class="font-medium text-ink-gray-9">{{ row.field.label }} : oui</p>
							<FicheInput v-else v-model="row.value" :field="row.field" />
							<p v-if="row.current" class="bat-current">Valeur actuelle : {{ row.field.fieldtype === 'Check' ? 'non' : row.current }}. Elle reste si vous ne cochez pas.</p>
						</div>
					</li>
				</ul>
				<p v-if="same.length" class="color-note">Déjà à jour : {{ same.join(', ') }}.</p>
			</template>

			<template v-if="colorsToDecide">
				<h3 class="form-section">Couleurs</h3>
				<div v-if="analysis?.ecarts.length" role="alert" class="bat-gap rounded-control tone-amber px-3 py-2 text-sm">
					<p><strong class="font-semibold">Écart dans ce BAT :</strong> {{ gapText }}.<template v-if="replaceColors"> Choisissez ce qu'il faut garder.</template></p>
					<div v-if="replaceColors" class="flex flex-wrap gap-2">
						<button v-for="gap in analysis.ecarts" :key="gap.code" type="button" class="btn-secondary" :aria-pressed="gapKept(gap)" @click="toggleGap(gap)">{{ gapKept(gap) ? `${gap.code} gardé` : `Garder ${gap.code}` }}</button>
						<button type="button" class="btn-ghost" :aria-pressed="gapIgnored" @click="ignoreGap">{{ gapIgnored ? 'Aucune gardée' : 'Ne garder aucune' }}</button>
					</div>
				</div>
				<label v-if="existing.length && !colorsIdentical" class="flex cursor-pointer items-center gap-2">
					<input v-model="replaceColors" class="h-4 w-4" type="checkbox" />
					{{ existing.length > 1 ? `Remplacer les ${existing.length} couleurs de l'article` : "Remplacer la couleur de l'article" }}
				</label>
				<p v-if="colorsIdentical" class="color-note">Couleurs déjà à jour.</p>
				<ArticleColorsInput v-else-if="replaceColors" v-model="teintes" @error="error = $event" />
			</template>

			<template v-if="informations.length">
				<h3 class="form-section">Non repris</h3>
				<dl class="bat-info">
					<div v-for="item in informations" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
				</dl>
			</template>
		</template>

		<p v-if="error" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ error }}</p>

		<template #actions>
			<button v-if="step === 1 && !uploadedUrl" type="button" class="btn-secondary" :disabled="busy || !file" @click="save">Joindre sans analyser</button>
			<button type="button" class="btn-primary" :disabled="busy || (!file && !uploadedUrl)" @click="submit">{{ primaryLabel }}</button>
		</template>
	</FormDialog>
</template>
