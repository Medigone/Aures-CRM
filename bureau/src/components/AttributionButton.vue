<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import LucideCheck from '~icons/lucide/check'
import LucideChevronDown from '~icons/lucide/chevron-down'
import LucideUserRound from '~icons/lucide/user-round'
import type { Option, TicketDetail } from '@/types'

/** Bouton Attribution, toujours premier dans les actions d'un ticket : se l'attribuer, ou choisir qui le prend en charge. */
const props = defineProps<{ ticket: TicketDetail; options: Option[]; canAssign: boolean; busy: boolean }>()
const emit = defineEmits<{ assign: [user: string] }>()

const MENU_WIDTH = 288
const open = ref(false)
const alignRight = ref(false)
const query = ref('')
const root = ref<HTMLElement | null>(null)
const search = ref<HTMLInputElement | null>(null)
const me = computed(() => String(window.user ?? ''))
const assignee = computed(() => props.ticket.assigne_a_nom || '')

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const shown = computed(() => {
	const wanted = fold(query.value.trim())
	return props.options.filter((option) => fold(option.label).includes(wanted))
})

async function toggle() {
	open.value = !open.value
	if (!open.value) return
	query.value = ''
	// Le menu reste dans l'écran, quelle que soit la place du bouton dans la barre.
	alignRight.value = (root.value?.getBoundingClientRect().left ?? 0) + MENU_WIDTH > window.innerWidth - 8
	await nextTick()
	search.value?.focus()
}
function pick(user: string) {
	open.value = false
	emit('assign', user)
}
function onPointerDown(event: PointerEvent) {
	if (open.value && !root.value?.contains(event.target as Node)) open.value = false
}
function onKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape') open.value = false
}
onMounted(() => {
	document.addEventListener('pointerdown', onPointerDown)
	document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
	document.removeEventListener('pointerdown', onPointerDown)
	document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
	<div ref="root" class="relative min-w-0 flex-none">
		<button v-if="canAssign" type="button" class="btn-secondary attribution-btn" :disabled="busy" aria-haspopup="menu" :aria-expanded="open" :aria-label="`Attribution : ${assignee || 'non attribué'}`" @click="toggle">
			<LucideUserRound class="h-3.5 w-3.5 flex-none" aria-hidden="true" />
			Attribution
			<span class="attribution-name" :title="assignee || undefined">{{ assignee || 'Non attribué' }}</span>
			<LucideChevronDown class="h-3.5 w-3.5 flex-none" aria-hidden="true" />
		</button>
		<span v-else class="attribution-read">
			<LucideUserRound class="h-3.5 w-3.5 flex-none" aria-hidden="true" />
			Attribution
			<span class="attribution-name" :title="assignee || undefined">{{ assignee || 'Non attribué' }}</span>
		</span>
		<div v-if="open" class="app-menu attribution-menu" :class="alignRight && 'app-menu-right'" role="menu">
			<button v-if="!ticket.mine" type="button" class="app-menu-item font-medium" role="menuitem" @click="pick(me)">Me l'attribuer</button>
			<div v-if="!ticket.mine" class="app-menu-sep"></div>
			<p class="app-menu-title">Prise en charge par</p>
			<input ref="search" v-model="query" class="field-input attribution-search" type="search" aria-label="Chercher une personne" placeholder="Chercher une personne" />
			<div class="attribution-list">
				<p v-if="!shown.length" class="px-2 py-1.5 text-sm text-ink-gray-6">Aucune personne ne porte ce nom.</p>
				<button v-for="option in shown" :key="option.value" type="button" class="app-menu-item" role="menuitemradio" :aria-checked="option.value === ticket.assigne_a" @click="pick(option.value)">
					<LucideCheck class="h-3.5 w-3.5 flex-none" :class="option.value !== ticket.assigne_a && 'invisible'" aria-hidden="true" />
					<span class="truncate" :title="option.label">{{ option.label }}</span>
				</button>
			</div>
		</div>
	</div>
</template>
