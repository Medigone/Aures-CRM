<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import LucideArrowRight from '~icons/lucide/arrow-right'
import LucideCheck from '~icons/lucide/check'
import LucideChevronDown from '~icons/lucide/chevron-down'
import LucideInfo from '~icons/lucide/info'
import FormDialog from '@shared/components/FormDialog.vue'
import ClientPicker from './ClientPicker.vue'
import { checkArticleDesignation, duplicateArticle } from '@/lib/api'
import { allKeys, buildDuplicateModel, currentPreset, DUPLICATE_PRESETS, duplicateSummary, duplicateWarnings, keepPayload, neverText, nextSteps, presetKeys, sousDesignation, toggleKey, toggleRubrique, withoutClientItems, type DuplicatePreset } from '@/lib/articleDuplicate'
import { procedeLabel, TYPE_GENERAL, type ArticleDetail, type ArticleOptions } from '@/lib/articles'
import type { ClientChoice } from '@/types'

/**
 * Dupliquer un article en trois étapes : destination, ce qu'on garde, vérification.
 * Un article général n'a que la première : il n'a ni fiche technique ni prépresse.
 */
const props = defineProps<{ article: ArticleDetail; options: ArticleOptions }>()
const emit = defineEmits<{ close: []; created: [name: string] }>()

const general = computed(() => props.article.type === TYPE_GENERAL)
const sousArticle = computed(() => Boolean(props.article.sous_article))
const compose = computed(() => Boolean(props.article.compose))
const originClient: ClientChoice | null = props.article.client
	? { name: props.article.client, label: props.article.client_label || props.article.client, wilaya: props.article.wilaya, commercial: props.article.commercial_user, commercial_name: props.article.commercial, open_tickets: 0 }
	: null

const model = computed(() => buildDuplicateModel(props.article, props.options.schema))
const step = ref<1 | 2 | 3>(1)
const designation = ref(props.article.designation)
const client = ref<ClientChoice | null>(originClient)
const reference = ref('')
const groupe = ref(props.article.groupe ?? '')
const conflict = ref('')
const designationError = ref('')
const clientError = ref('')
const serverError = ref('')
const busy = ref(false)
const picked = ref(presetKeys(model.value, 'tout'))
const initialPicked = new Set(picked.value)
const opened = ref(new Set<string>())

const upper = computed(() => designation.value.trim().toUpperCase())
const otherClient = computed(() => Boolean(client.value && client.value.name !== props.article.client))
const clientLabel = computed(() => client.value?.label ?? '')
const groupes = computed(() => (groupe.value && !props.options.groupes.includes(groupe.value) ? [groupe.value, ...props.options.groupes] : props.options.groupes))
const stepLabels = computed(() => (general.value ? [] : ['Destination', compose.value ? 'Sous-articles' : 'À garder', 'Vérifier']))
const lastStep = computed(() => (general.value ? 1 : 3))
const preset = computed(() => currentPreset(model.value, picked.value, otherClient.value))
const presetNote = computed(() => DUPLICATE_PRESETS.find((item) => item.key === preset.value)?.note ?? `Sélection sur mesure : ${pickedCount.value} ${pickedCount.value > 1 ? 'éléments repris' : 'élément repris'} sur ${totalCount.value}.`)
const totalCount = computed(() => allKeys(model.value).length)
const pickedCount = computed(() => allKeys(model.value).filter((key) => picked.value.has(key)).length)
const warnings = computed(() => duplicateWarnings(props.article, model.value, picked.value, clientLabel.value, otherClient.value))
const summary = computed(() => duplicateSummary(model.value, picked.value))
const todo = computed(() => nextSteps(model.value, picked.value, compose.value))
const never = computed(() => neverText(props.article))
const sousRows = computed(() => model.value.sous.map((row) => ({ ...row, title: sousDesignation(props.article.designation, row.title, upper.value) })))

const dirty = computed(() => {
	if (step.value > 1 || designation.value !== props.article.designation || reference.value || groupe.value !== (props.article.groupe ?? '') || client.value?.name !== props.article.client) return true
	return picked.value.size !== initialPicked.size || [...picked.value].some((key) => !initialPicked.has(key))
})
const hint = computed(() => {
	if (step.value === 2) return `${pickedCount.value} ${pickedCount.value > 1 ? 'éléments repris' : 'élément repris'} sur ${totalCount.value}`
	if (step.value === 3 || general.value) return "Rien n'est créé avant de confirmer."
	return 'Ctrl + Entrée pour continuer'
})

function usePreset(key: DuplicatePreset) {
	picked.value = presetKeys(model.value, key, otherClient.value)
}
function toggleOpen(key: string) {
	const next = new Set(opened.value)
	if (next.has(key)) next.delete(key)
	else next.add(key)
	opened.value = next
}
function rubriqueState(fields: { key: string }[]) {
	const on = fields.filter((field) => picked.value.has(field.key)).length
	return { checked: on === fields.length, mixed: on > 0 && on < fields.length }
}
function rubriqueSub(rubrique: { key: string; fields: { key: string; label: string; value: string }[] }) {
	const kept = rubrique.fields.filter((field) => picked.value.has(field.key))
	const total = rubrique.fields.length
	if (!kept.length) return `Non repris : ${total} ${total > 1 ? 'valeurs laissées de côté' : 'valeur laissée de côté'}`
	const partial = kept.length < total ? `${kept.length} sur ${total}` : ''
	if (rubrique.key === 'Couleurs') return partial || `${total} ${total > 1 ? 'couleurs' : 'couleur'}`
	const values = kept.map((field) => (field.value === 'Oui' ? field.label : field.value)).join(' · ')
	return partial ? `${partial} : ${values}` : values
}
function needsMissing(row: { needs?: string }) {
	return Boolean(row.needs && !picked.value.has(row.needs))
}

// Un visuel appartient à son client : changer de client le décoche une fois. Le recocher reste possible, avec un avertissement.
watch(otherClient, (other) => {
	if (other) picked.value = withoutClientItems(picked.value)
})

let lastCheck = 0
async function checkDesignation() {
	const request = ++lastCheck
	const label = designation.value.trim()
	if (!label || (!general.value && !client.value)) {
		conflict.value = ''
		return ''
	}
	try {
		const { message } = await checkArticleDesignation(label, general.value ? undefined : client.value?.name)
		if (request === lastCheck) conflict.value = message ?? ''
		return message ?? ''
	} catch {
		// Le serveur contrôlera de toute façon à la création.
		return ''
	}
}
let timer: ReturnType<typeof setTimeout> | undefined
watch([designation, client], () => {
	designationError.value = ''
	clientError.value = ''
	clearTimeout(timer)
	timer = setTimeout(checkDesignation, 300)
})
onMounted(async () => {
	await nextTick()
	document.querySelector<HTMLInputElement>('#dup-designation')?.select()
	checkDesignation()
})

async function goTo(target: 1 | 2 | 3) {
	if (target > 1 && step.value === 1 && !(await validateDestination())) return
	step.value = target
	await nextTick()
	document.querySelector('.article-duplicate .dialog-body')?.scrollTo(0, 0)
}
async function validateDestination() {
	if (!upper.value) designationError.value = 'Saisissez la désignation.'
	if (!general.value && !sousArticle.value && !client.value) clientError.value = 'Choisissez le client.'
	if (designationError.value || clientError.value) return false
	return !(await checkDesignation())
}
async function create() {
	if (busy.value) return
	serverError.value = ''
	busy.value = true
	try {
		const values = { designation: designation.value.trim(), client: client.value?.name ?? '', reference: reference.value.trim(), groupe: groupe.value }
		const { name } = await duplicateArticle(props.article.name, values, keepPayload(picked.value))
		emit('created', name)
		emit('close')
	} catch (e) {
		serverError.value = (e as Error).message
	} finally {
		busy.value = false
	}
}
async function primary() {
	if (step.value === 1 && !(await validateDestination())) return
	if (step.value === lastStep.value) await create()
	else await goTo((step.value + 1) as 2 | 3)
}
</script>

<template>
	<FormDialog class="article-create article-duplicate" title="Dupliquer l'article" :dirty="dirty" :busy="busy" :hint="hint" @close="emit('close')" @submit="primary">
		<template #top>
			<ol v-if="stepLabels.length" class="phase-bar" aria-label="Étapes de la duplication">
				<template v-for="(label, index) in stepLabels" :key="label">
					<li v-if="index" class="phase-sep" aria-hidden="true"></li>
					<li>
						<button type="button" class="phase-step" :aria-current="step === index + 1 ? 'step' : undefined" :data-done="step > index + 1" @click="goTo((index + 1) as 1 | 2 | 3)">
							<span class="phase-num"><LucideCheck v-if="step > index + 1" class="h-3 w-3" aria-hidden="true" /><template v-else>{{ index + 1 }}</template></span>{{ label }}
						</button>
					</li>
				</template>
			</ol>
			<div class="phase-recap">
				<span>Origine</span><strong>{{ article.name }}</strong><span>{{ article.designation }}</span><span v-if="article.client_label">{{ article.client_label }}</span><span v-if="article.procede && !general">{{ procedeLabel(article.procede) }}</span>
				<template v-if="step > 1">
					<LucideArrowRight class="h-3.5 w-3.5 self-center text-ink-gray-6" aria-hidden="true" /><strong>{{ upper }}</strong><span>{{ clientLabel }}</span>
				</template>
			</div>
		</template>

		<template v-if="step === 1">
			<div class="form-field">
				<label class="field-label" for="dup-designation">Désignation du nouvel article <span class="req">obligatoire</span></label>
				<input id="dup-designation" v-model="designation" class="field-input" autocomplete="off" :aria-invalid="Boolean(designationError || conflict)" />
				<p v-if="designationError || conflict" class="field-error" role="alert">{{ designationError || conflict }}</p>
				<p v-else-if="upper" class="field-note"><LucideInfo class="mt-px h-3.5 w-3.5 flex-none" aria-hidden="true" /><span>Enregistrée ainsi : {{ upper }}</span></p>
			</div>
			<div class="form-grid">
				<div v-if="!general && !sousArticle" class="form-field">
					<label class="field-label" for="dup-client">Client <span class="req">obligatoire</span></label>
					<ClientPicker v-model="client" input-id="dup-client" :invalid="Boolean(clientError)" @error="serverError = $event" />
					<p v-if="clientError" class="field-error" role="alert">{{ clientError }}</p>
					<p v-else class="field-note"><LucideInfo class="mt-px h-3.5 w-3.5 flex-none" aria-hidden="true" /><span>{{ otherClient ? "Autre client que l'origine : la maquette et l'image ne sont plus cochées." : 'Le code est attribué à la création, à la suite de ceux du client.' }}</span></p>
				</div>
				<div v-if="sousArticle" class="form-field">
					<span class="field-label">Article parent</span>
					<p class="dup-fixed">{{ article.parent_label || article.parent }}</p>
					<p class="field-note"><LucideInfo class="mt-px h-3.5 w-3.5 flex-none" aria-hidden="true" /><span>Le nouveau sous-article reste sous ce parent, chez le même client.</span></p>
				</div>
				<div v-if="!general" class="form-field">
					<label class="field-label" for="dup-reference">Réf. article client</label>
					<input id="dup-reference" v-model="reference" class="field-input" autocomplete="off" />
					<p class="field-note"><LucideInfo class="mt-px h-3.5 w-3.5 flex-none" aria-hidden="true" /><span>{{ article.reference ? `Vide par défaut : celle de l'origine est ${article.reference}.` : 'À renseigner si le client en donne une.' }}</span></p>
				</div>
				<div v-if="!general" class="form-field">
					<span class="field-label">Procédé</span>
					<p class="dup-fixed">{{ procedeLabel(article.procede) || 'Non renseigné' }}</p>
					<p class="field-note"><LucideInfo class="mt-px h-3.5 w-3.5 flex-none" aria-hidden="true" /><span>Il reste celui de l'origine : la fiche technique en dépend.</span></p>
				</div>
				<div class="form-field">
					<label class="field-label" for="dup-groupe">Groupe d'article <span class="req">obligatoire</span></label>
					<select id="dup-groupe" v-model="groupe" class="field-input">
						<option v-for="item in groupes" :key="item" :value="item">{{ item }}</option>
					</select>
				</div>
			</div>
			<p v-if="general && article.tags.length" class="dup-note">Les tags suivent : {{ article.tags.join(', ') }}.</p>
			<p v-if="general && serverError" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ serverError }}</p>
		</template>

		<template v-else-if="step === 2">
			<div v-if="!compose" class="dup-block">
				<span class="field-label">Partir de</span>
				<div class="seg self-start" role="group" aria-label="Sélection de départ">
					<button v-for="item in DUPLICATE_PRESETS" :key="item.key" type="button" :aria-pressed="preset === item.key" @click="usePreset(item.key)">{{ item.label }}</button>
				</div>
				<p class="dup-note">{{ presetNote }}</p>
			</div>

			<section v-if="model.rubriques.length" class="dup-block" aria-label="Fiche technique">
				<h3 class="dup-heading">Fiche technique</h3>
				<div class="dup-list">
					<div v-for="rubrique in model.rubriques" :key="rubrique.key" class="dup-item">
						<div class="dup-row">
							<label class="dup-pick">
								<input type="checkbox" class="h-4 w-4 flex-none" :checked="rubriqueState(rubrique.fields).checked" :indeterminate="rubriqueState(rubrique.fields).mixed" @change="picked = toggleRubrique(picked, rubrique)" />
								<span class="dup-text">
									<span class="dup-title">{{ rubrique.title }}</span>
									<span class="dup-sub">{{ rubriqueSub(rubrique) }}</span>
									<span v-if="rubrique.key === 'Couleurs'" class="dup-dots" aria-hidden="true">
										<span v-for="field in rubrique.fields.filter((row) => picked.has(row.key))" :key="field.key" class="dup-dot" :style="{ background: field.hex ?? 'transparent' }"></span>
									</span>
								</span>
							</label>
							<button type="button" class="icon-btn dup-chevron" :aria-expanded="opened.has(rubrique.key)" :aria-label="`${opened.has(rubrique.key) ? 'Replier' : 'Choisir champ par champ'} : ${rubrique.title}`" @click="toggleOpen(rubrique.key)"><LucideChevronDown class="h-4 w-4" aria-hidden="true" /></button>
						</div>
						<div v-if="opened.has(rubrique.key)" class="dup-fields">
							<label v-for="field in rubrique.fields" :key="field.key" class="dup-pick">
								<input type="checkbox" class="h-4 w-4 flex-none" :checked="picked.has(field.key)" @change="picked = toggleKey(model, picked, field.key)" />
								<span v-if="field.hex" class="dup-dot" :style="{ background: field.hex }" aria-hidden="true"></span>
								<span class="dup-text"><span class="dup-sub">{{ field.label }}</span><span class="dup-value">{{ field.value }}</span></span>
							</label>
						</div>
					</div>
				</div>
			</section>

			<section v-if="sousRows.length" class="dup-block" aria-label="Sous-articles">
				<h3 class="dup-heading">Sous-articles</h3>
				<p class="dup-note">Chacun est recréé avec sa propre fiche technique et un nouveau code, à la suite de celui du nouvel article.</p>
				<div class="dup-list">
					<div v-for="row in sousRows" :key="row.key" class="dup-item">
						<div class="dup-row">
							<label class="dup-pick">
								<input type="checkbox" class="h-4 w-4 flex-none" :checked="picked.has(row.key)" @change="picked = toggleKey(model, picked, row.key)" />
								<span class="dup-text"><span class="dup-title">{{ row.title }}</span><span class="dup-sub">{{ row.sub }}</span></span>
							</label>
						</div>
					</div>
				</div>
			</section>

			<section v-if="model.prepresse.length" class="dup-block" aria-label="Prépresse">
				<h3 class="dup-heading">Prépresse</h3>
				<div class="dup-list">
					<div v-for="row in model.prepresse" :key="row.key" class="dup-item">
						<div class="dup-row">
							<label class="dup-pick" :data-off="Boolean(row.refused) || needsMissing(row)">
								<input type="checkbox" class="h-4 w-4 flex-none" :checked="picked.has(row.key)" :disabled="Boolean(row.refused) || needsMissing(row)" @change="picked = toggleKey(model, picked, row.key)" />
								<span class="dup-text"><span class="dup-title">{{ row.title }}</span><span class="dup-sub">{{ row.refused || (needsMissing(row) ? row.needsText : row.sub) }}</span></span>
							</label>
						</div>
					</div>
				</div>
				<p v-for="warning in warnings.prepresse" :key="warning" class="dup-warning tone-amber" role="status">{{ warning }}</p>
			</section>

			<section v-if="model.fichiers.length" class="dup-block" aria-label="Fichiers et tags">
				<h3 class="dup-heading">Fichiers et tags</h3>
				<p class="dup-note">Les fichiers ne sont pas recopiés : le nouvel article pointe vers les mêmes.</p>
				<div class="dup-list">
					<div v-for="row in model.fichiers" :key="row.key" class="dup-item">
						<div class="dup-row">
							<label class="dup-pick">
								<input type="checkbox" class="h-4 w-4 flex-none" :checked="picked.has(row.key)" @change="picked = toggleKey(model, picked, row.key)" />
								<span class="dup-text"><span class="dup-title">{{ row.title }}</span><span class="dup-sub">{{ row.sub }}</span></span>
							</label>
						</div>
					</div>
				</div>
				<p v-for="warning in warnings.fichiers" :key="warning" class="dup-warning tone-amber" role="status">{{ warning }}</p>
			</section>

			<div class="dup-never"><strong>Ne suivent jamais</strong><span>{{ never }}.</span></div>
		</template>

		<template v-else>
			<div class="dup-summary">
				<section class="dup-block">
					<h3 class="dup-heading">Le nouvel article reçoit</h3>
					<dl class="dup-kv">
						<div v-for="line in summary.kept" :key="line.title"><dt>{{ line.title }}</dt><dd>{{ line.text }}</dd></div>
					</dl>
				</section>
				<section class="dup-block">
					<h3 class="dup-heading">Laissé de côté</h3>
					<dl class="dup-kv">
						<div v-for="line in summary.left" :key="line.title"><dt>{{ line.title }}</dt><dd>{{ line.text }}</dd></div>
					</dl>
				</section>
			</div>
			<section class="dup-block dup-next">
				<h3 class="dup-heading">À faire ensuite sur le nouvel article</h3>
				<ol>
					<li v-for="item in todo" :key="item">{{ item }}</li>
				</ol>
			</section>
			<p v-for="warning in [...warnings.prepresse, ...warnings.fichiers]" :key="warning" class="dup-warning tone-amber" role="status">{{ warning }}</p>
			<p class="dup-note">Le code est attribué à la création. La fiche du nouvel article s'ouvre ensuite, et son activité garde la mention « Dupliqué depuis {{ article.name }} ».</p>
			<p v-if="serverError" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ serverError }}</p>
		</template>

		<template #actions>
			<button v-if="step > 1" type="button" class="btn-secondary" :disabled="busy" @click="goTo((step - 1) as 1 | 2)">Précédent</button>
			<button type="button" class="btn-primary" :disabled="busy || Boolean(step === 1 && conflict)" @click="primary">{{ busy ? 'Duplication…' : step === lastStep ? "Dupliquer l'article" : 'Continuer' }}</button>
		</template>
	</FormDialog>
</template>
