<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import LucideMapPin from '~icons/lucide/map-pin'
import LucideMic from '~icons/lucide/mic'
import LucideCamera from '~icons/lucide/camera'
import LucideUserPlus from '~icons/lucide/user-plus'
import LucidePackagePlus from '~icons/lucide/package-plus'
import LucidePhone from '~icons/lucide/phone'
import LucideCalendarPlus from '~icons/lucide/calendar-plus'

/** Menu du bouton central : saisies terrain d'abord (visite, ticket dicté, photo), puis les fiches. */
const emit = defineEmits<{ close: [] }>()

const terrain = [
	{ to: { name: 'NewVisit' }, label: 'Démarrer une visite', icon: LucideMapPin },
	{ to: { name: 'NewTicket', query: { dictee: '1' } }, label: 'Dicter un ticket', icon: LucideMic },
	{ to: { name: 'NewTicket', query: { photo: '1' } }, label: 'Photographier un document', icon: LucideCamera },
]
const fiches = [
	{ to: { name: 'NewProspect' }, label: 'Nouveau client / prospect', icon: LucideUserPlus },
	{ to: { name: 'NewArticle' }, label: 'Nouvel article', icon: LucidePackagePlus },
	{ to: { name: 'NewAppel' }, label: 'Noter un appel', icon: LucidePhone },
	{ to: { name: 'NewRdv' }, label: 'Planifier un rendez-vous', icon: LucideCalendarPlus },
]

const onKey = (event: KeyboardEvent) => event.key === 'Escape' && emit('close')
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
	<div class="fixed inset-0 z-30 bg-surface-gray-1/80 backdrop-blur-[2px]" @click="emit('close')" />
	<div
		role="menu"
		aria-label="Créer"
		class="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] left-1/2 z-30 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 rounded-[22px] bg-surface-white p-2 shadow-[0_16px_40px_rgba(24,24,27,0.14)] dark:bg-surface-cards md:bottom-auto md:left-24 md:top-6 md:translate-x-0"
	>
		<p class="px-3 pb-1.5 pt-2.5 text-xs font-semibold uppercase tracking-wide text-ink-gray-6">Sur le terrain</p>
		<RouterLink v-for="item in terrain" :key="item.label" :to="item.to" role="menuitem" class="flex min-h-[52px] items-center gap-3.5 rounded-2xl px-3 text-base font-medium active:bg-surface-gray-2">
			<component :is="item.icon" class="h-[22px] w-[22px]" aria-hidden="true" />{{ item.label }}
		</RouterLink>
		<div class="mx-3 my-1.5 h-px bg-outline-gray-1" />
		<p class="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-gray-6">Fiches</p>
		<RouterLink v-for="item in fiches" :key="item.label" :to="item.to" role="menuitem" class="flex min-h-[52px] items-center gap-3.5 rounded-2xl px-3 text-base font-medium active:bg-surface-gray-2">
			<component :is="item.icon" class="h-[22px] w-[22px]" aria-hidden="true" />{{ item.label }}
		</RouterLink>
	</div>
</template>
