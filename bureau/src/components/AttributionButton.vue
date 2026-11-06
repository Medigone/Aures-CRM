<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import LucideCheck from '~icons/lucide/check'
import LucideUserRound from '~icons/lucide/user-round'
import HeaderMenu from './HeaderMenu.vue'
import type { Option, TicketDetail } from '@/types'

/** Bouton Attribution, toujours premier dans les actions d'un ticket : se l'attribuer, ou choisir qui le prend en charge. */
const props = defineProps<{ ticket: Pick<TicketDetail, 'assigne_a' | 'assigne_a_nom' | 'mine'>; options: Option[]; canAssign: boolean; busy: boolean; actionLabel?: string }>()
const emit = defineEmits<{ assign: [user: string] }>()

const query = ref('')
const search = ref<HTMLInputElement | null>(null)
const me = computed(() => String(window.user ?? ''))
const assignee = computed(() => props.ticket.assigne_a_nom || 'Non attribué')

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const shown = computed(() => {
	const wanted = fold(query.value.trim())
	return props.options.filter((option) => fold(option.label).includes(wanted))
})

async function onOpened() {
	query.value = ''
	await nextTick()
	search.value?.focus()
}
</script>

<template>
	<HeaderMenu v-if="canAssign" :label="actionLabel ?? 'Attribution'" :value="actionLabel ? '' : assignee" :aria-label="`Attribution : ${assignee}`" :disabled="busy" menu-class="attribution-menu" @opened="onOpened">
		<template #icon><LucideUserRound class="h-3.5 w-3.5 flex-none" aria-hidden="true" /></template>
		<template #default="{ close }">
			<button v-if="!ticket.mine" type="button" class="app-menu-item font-medium" role="menuitem" @click="close(); emit('assign', me)">Me l'attribuer</button>
			<div v-if="!ticket.mine" class="app-menu-sep"></div>
			<p class="app-menu-title">Prise en charge par</p>
			<input ref="search" v-model="query" class="field-input attribution-search" type="search" aria-label="Chercher une personne" placeholder="Chercher une personne" />
			<div class="attribution-list">
				<p v-if="!shown.length" class="px-2 py-1.5 text-sm text-ink-gray-6">Aucune personne ne porte ce nom.</p>
				<button v-for="option in shown" :key="option.value" type="button" class="app-menu-item" role="menuitemradio" :aria-checked="option.value === ticket.assigne_a" @click="close(); emit('assign', option.value)">
					<LucideCheck class="h-3.5 w-3.5 flex-none" :class="option.value !== ticket.assigne_a && 'invisible'" aria-hidden="true" />
					<span class="truncate" :title="option.label">{{ option.label }}</span>
				</button>
			</div>
		</template>
	</HeaderMenu>
	<span v-else class="attribution-read">
		<LucideUserRound class="h-3.5 w-3.5 flex-none" aria-hidden="true" />
		Attribution
		<span class="header-menu-value" :title="assignee">{{ assignee }}</span>
	</span>
</template>
