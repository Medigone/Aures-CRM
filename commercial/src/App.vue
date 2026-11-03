<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import LucideCalendarDays from '~icons/lucide/calendar-days'
import LucideBuilding2 from '~icons/lucide/building-2'
import LucideSettings from '~icons/lucide/settings'
import { useCommercialStore } from '@/stores/commercial'
import { useAppTheme } from '@/lib/theme'
import { applyUpdate, updateReady } from '@/lib/sw'

const store = useCommercialStore()
useAppTheme()
onMounted(() => store.init())

const tabs = [
	{ to: { name: 'Today' }, label: "Aujourd'hui", icon: LucideCalendarDays, match: ['Today'] },
	{ to: { name: 'Clients' }, label: 'Clients', icon: LucideBuilding2, match: ['Clients', 'Client', 'Article'] },
	{ to: { name: 'Settings' }, label: 'Réglages', icon: LucideSettings, match: ['Settings'] },
]
</script>

<template>
	<div class="min-h-screen md:pl-20">
		<div v-if="updateReady" class="sticky top-0 z-30 flex items-center justify-between gap-3 bg-accent px-4 py-2 text-sm text-white">
			<span>Une nouvelle version est disponible.</span>
			<button type="button" class="rounded-lg bg-white/20 px-3 py-1.5 font-medium" @click="applyUpdate">Mettre à jour</button>
		</div>
		<div v-if="store.storageError" class="bg-amber-50 px-4 py-2 text-sm text-amber-800">
			Stockage local indisponible : les données ne seront pas consultables hors connexion.
		</div>

		<main class="mx-auto w-full max-w-3xl px-4 pb-[calc(var(--bottom-chrome)+env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)]">
			<div v-if="!store.loaded" class="py-20 text-center text-ink-gray-6">Chargement…</div>
			<RouterView v-else />
		</main>

		<!-- Navigation : barre du bas sur téléphone, rail à gauche sur tablette. -->
		<nav
			class="fixed inset-x-0 bottom-0 z-20 grid h-[calc(var(--bottom-chrome)+env(safe-area-inset-bottom))] grid-cols-3 border-t border-outline-gray-2 bg-surface-white pb-[env(safe-area-inset-bottom)] md:inset-y-0 md:left-0 md:right-auto md:flex md:h-auto md:w-20 md:flex-col md:gap-2 md:border-r md:border-t-0 md:pt-6"
			aria-label="Navigation principale"
		>
			<RouterLink
				v-for="tab in tabs"
				:key="tab.label"
				:to="tab.to"
				class="flex flex-col items-center justify-center gap-1 text-xs md:py-3"
				:class="tab.match.includes(String($route.name)) ? 'font-medium text-accent' : 'text-ink-gray-6'"
			>
				<component :is="tab.icon" class="h-6 w-6" aria-hidden="true" />
				{{ tab.label }}
			</RouterLink>
		</nav>
	</div>
</template>
