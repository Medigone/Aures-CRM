<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import LucideArrowRightLeft from '~icons/lucide/arrow-right-left'
import LucideCircleDot from '~icons/lucide/circle-dot'
import LucideMail from '~icons/lucide/mail'
import LucidePaperclip from '~icons/lucide/paperclip'
import LucidePencil from '~icons/lucide/pencil'
import LucidePlus from '~icons/lucide/plus'
import LucideTrash2 from '~icons/lucide/trash-2'
import LucideUserPlus from '~icons/lucide/user-plus'
import CommentText from './CommentText.vue'
import { exactTime, initialsOf, insertMention, mentionQuery, relativeTime, type ActivityApi, type ActivityItem, type Mention } from '../activity'

/** Commentaires et activité d'un document, comme la timeline du Desk. */
const props = defineProps<{
	api: ActivityApi
	/** Change quand le document change : le fil se recharge. */
	version?: string
	userName: string
}>()
const emit = defineEmits<{ changed: [] }>()

const VISIBLE = 8
const FILTERS = [
	{ key: 'all', label: 'Tout' },
	{ key: 'comments', label: 'Commentaires' },
	{ key: 'history', label: 'Historique' },
] as const
type Filter = (typeof FILTERS)[number]['key']

const items = ref<ActivityItem[]>([])
const commentCount = ref(0)
const loading = ref(true)
const error = ref('')
const writeError = ref('')
const busy = ref(false)
const filter = ref<Filter>('all')
const expanded = ref(false)
const draft = ref('')
const editing = ref<string | null>(null)
const editDraft = ref('')
const deleting = ref<string | null>(null)
const input = ref<HTMLTextAreaElement | null>(null)
const root = ref<HTMLElement | null>(null)

const filtered = computed(() => items.value.filter((item) => filter.value === 'all' || (filter.value === 'comments') === (item.kind === 'comment')))
const shown = computed(() => (expanded.value ? filtered.value : filtered.value.slice(0, VISIBLE)))
const hiddenCount = computed(() => filtered.value.length - shown.value.length)

let lastRequest = 0
async function load() {
	const request = ++lastRequest
	error.value = ''
	try {
		const response = await props.api.load()
		if (request !== lastRequest) return
		items.value = response.items
		commentCount.value = response.comment_count
	} catch (e) {
		if (request === lastRequest) error.value = (e as Error).message
	} finally {
		if (request === lastRequest) loading.value = false
	}
}
onMounted(load)
watch(() => props.version, load)
watch(
	() => props.api,
	() => {
		items.value = []
		loading.value = true
		draft.value = ''
		editing.value = null
		deleting.value = null
		writeError.value = ''
		filter.value = 'all'
		expanded.value = false
		mentions = []
		load()
	},
)

// Mentions : la liste est chargée une fois, au premier `@`.
let mentions: Mention[] = []
const candidates = ref<Mention[]>([])
let candidatesLoaded = false
const query = ref<string | null>(null)
const cursor = ref(0)
const matches = computed(() => {
	if (query.value === null) return []
	const search = query.value.toLowerCase()
	return candidates.value.filter((person) => person.label.toLowerCase().includes(search) && person.label !== props.userName).slice(0, 6)
})
async function onDraftInput() {
	const field = input.value
	query.value = field ? mentionQuery(draft.value.slice(0, field.selectionStart)) : null
	cursor.value = 0
	if (query.value !== null && !candidatesLoaded) {
		candidatesLoaded = true
		try {
			candidates.value = await props.api.mentionCandidates()
		} catch {
			candidatesLoaded = false
		}
	}
}
async function choose(person: Mention) {
	const field = input.value
	const result = insertMention(draft.value, field?.selectionStart ?? draft.value.length, person.label)
	draft.value = result.text
	if (!mentions.some((item) => item.id === person.id)) mentions.push(person)
	query.value = null
	await nextTick()
	field?.focus()
	field?.setSelectionRange(result.caret, result.caret)
}
function onDraftKey(event: KeyboardEvent) {
	if (matches.value.length) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault()
			const size = matches.value.length
			cursor.value = (cursor.value + (event.key === 'ArrowDown' ? 1 : size - 1)) % size
			return
		}
		if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
			event.preventDefault()
			choose(matches.value[cursor.value])
			return
		}
		if (event.key === 'Escape') {
			query.value = null
			return
		}
	}
	if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) send()
}

async function write(action: () => ReturnType<ActivityApi['load']>) {
	if (busy.value) return false
	busy.value = true
	writeError.value = ''
	lastRequest++
	try {
		const response = await action()
		items.value = response.items
		commentCount.value = response.comment_count
		emit('changed')
		return true
	} catch (e) {
		// Le texte saisi reste en place : rien n'est perdu si le serveur refuse.
		writeError.value = (e as Error).message
		return false
	} finally {
		busy.value = false
	}
}
async function send() {
	const text = draft.value.trim()
	if (!text) return
	const used = mentions.filter((person) => text.includes(`@${person.label}`))
	if (await write(() => props.api.add(text, used))) {
		draft.value = ''
		mentions = []
		query.value = null
		if (filter.value === 'history') filter.value = 'all'
	}
}
function startEdit(item: ActivityItem) {
	editing.value = item.id
	editDraft.value = item.text ?? ''
	deleting.value = null
}
async function saveEdit(item: ActivityItem) {
	const text = editDraft.value.trim()
	if (!text) return
	const known = (item.mentions ?? []).filter((person) => text.includes(`@${person.label}`))
	if (await write(() => props.api.update(item.id, text, known))) editing.value = null
}
async function confirmDelete(item: ActivityItem) {
	if (await write(() => props.api.remove(item.id))) deleting.value = null
}

const MARKS = { change: LucideArrowRightLeft, assign: LucideUserPlus, file: LucidePaperclip, mail: LucideMail, create: LucidePlus, info: LucideCircleDot }
const markOf = (item: ActivityItem) => MARKS[item.kind as keyof typeof MARKS] ?? LucideCircleDot

function focusInput() {
	input.value?.focus()
}
defineExpose({ refresh: load, root, focusInput })
</script>

<template>
	<section ref="root" class="card activity" aria-label="Commentaires et activité">
		<div class="activity-head">
			<h3 class="activity-title">Commentaires et activité</h3>
			<div class="seg" role="group" aria-label="Filtrer le fil">
				<button v-for="item in FILTERS" :key="item.key" type="button" :aria-pressed="filter === item.key" @click="filter = item.key; expanded = false">
					{{ item.key === 'comments' && commentCount ? `${item.label} ${commentCount}` : item.label }}
				</button>
			</div>
		</div>

		<div class="comment-box">
			<span class="act-avatar act-avatar-me" aria-hidden="true">{{ initialsOf(userName) }}</span>
			<div class="comment-field">
				<textarea
					ref="input"
					v-model="draft"
					class="field-input comment-input"
					rows="2"
					placeholder="Écrire un commentaire. Tapez @ pour mentionner quelqu'un."
					aria-label="Écrire un commentaire"
					:disabled="busy"
					@input="onDraftInput"
					@keydown="onDraftKey"
				></textarea>
				<div v-if="matches.length" class="app-menu mention-menu" role="listbox" aria-label="Personnes à mentionner">
					<button v-for="(person, index) in matches" :key="person.id" type="button" class="app-menu-item" role="option" :aria-selected="index === cursor" @click="choose(person)" @pointerenter="cursor = index">
						<span class="act-avatar" aria-hidden="true">{{ initialsOf(person.label) }}</span>
						{{ person.label }}
					</button>
				</div>
				<div class="comment-foot">
					<span>Ctrl + Entrée pour envoyer</span>
					<button type="button" class="btn-secondary" :disabled="busy || !draft.trim()" @click="send">Commenter</button>
				</div>
				<p v-if="writeError" role="alert" class="text-sm text-tone-red">{{ writeError }}</p>
			</div>
		</div>

		<p v-if="error" role="alert" class="text-sm text-tone-red">
			{{ error }}
			<button type="button" class="ml-1 font-semibold underline" @click="load">Réessayer</button>
		</p>
		<p v-else-if="loading" class="py-3 text-center text-ink-gray-6">Chargement du fil…</p>
		<p v-else-if="!shown.length" class="py-3 text-center text-ink-gray-6">{{ filter === 'comments' ? 'Aucun commentaire pour le moment. Écrivez le premier.' : 'Rien dans cet historique pour le moment.' }}</p>
		<ol v-else class="act-list">
			<template v-for="item in shown" :key="item.id">
				<li v-if="item.kind === 'comment'" class="act-item">
					<span class="act-avatar" aria-hidden="true">{{ initialsOf(item.who) }}</span>
					<div class="comment-bubble">
						<div class="comment-head">
							<strong>{{ item.who }}</strong>
							<time :datetime="item.at" :title="exactTime(item.at)">{{ relativeTime(item.at) }}</time>
							<span v-if="item.mine && editing !== item.id && deleting !== item.id" class="comment-tools">
								<button type="button" class="comment-tool" aria-label="Modifier ce commentaire" title="Modifier" @click="startEdit(item)"><LucidePencil class="h-3.5 w-3.5" aria-hidden="true" /></button>
								<button type="button" class="comment-tool" aria-label="Supprimer ce commentaire" title="Supprimer" @click="deleting = item.id; editing = null"><LucideTrash2 class="h-3.5 w-3.5" aria-hidden="true" /></button>
							</span>
						</div>
						<template v-if="editing === item.id">
							<textarea v-model="editDraft" class="field-input comment-input" rows="2" aria-label="Modifier le commentaire" :disabled="busy"></textarea>
							<div class="flex justify-end gap-1.5">
								<button type="button" class="btn-ghost" :disabled="busy" @click="editing = null">Annuler</button>
								<button type="button" class="btn-secondary" :disabled="busy || !editDraft.trim()" @click="saveEdit(item)">Enregistrer</button>
							</div>
						</template>
						<template v-else>
							<CommentText :parts="item.parts ?? []" />
							<div v-if="deleting === item.id" class="comment-confirm">
								<span class="flex-auto">Supprimer ce commentaire ?</span>
								<button type="button" class="btn-ghost" :disabled="busy" @click="deleting = null">Garder</button>
								<button type="button" class="btn-danger" :disabled="busy" @click="confirmDelete(item)">Supprimer</button>
							</div>
						</template>
					</div>
				</li>
				<li v-else class="act-item">
					<span class="act-mark"><component :is="markOf(item)" class="h-3 w-3" aria-hidden="true" /></span>
					<div class="act-text">
						<template v-if="item.kind === 'change' && item.changes?.length === 1">
							<strong>{{ item.who }}</strong> a changé <b>{{ item.changes[0].label }}</b> de <span class="old">{{ item.changes[0].old }}</span> à <span class="new">{{ item.changes[0].new }}</span>
						</template>
						<template v-else-if="item.kind === 'change'">
							<strong>{{ item.who }}</strong> a changé {{ item.changes?.length }} champs
						</template>
						<template v-else>
							<strong v-if="item.who">{{ item.who }} </strong>{{ item.text }}
							<template v-if="item.link">
								<a v-if="item.link.url" :href="item.link.url" class="text-link" target="_blank" rel="noopener noreferrer">{{ item.link.label }}</a>
								<template v-else>{{ item.link.label }}</template>
							</template>
						</template>
						{{ ' ' }}<time :datetime="item.at" :title="exactTime(item.at)">{{ relativeTime(item.at) }}</time>
						<ul v-if="item.kind === 'change' && (item.changes?.length ?? 0) > 1" class="mt-0.5">
							<li v-for="change in item.changes" :key="change.label"><b>{{ change.label }}</b> : <span class="old">{{ change.old }}</span> → <span class="new">{{ change.new }}</span></li>
						</ul>
					</div>
				</li>
			</template>
		</ol>
		<button v-if="hiddenCount > 0" type="button" class="ml-8 self-start text-sm text-link" @click="expanded = true">Afficher les {{ hiddenCount }} éléments plus anciens</button>
	</section>
</template>
