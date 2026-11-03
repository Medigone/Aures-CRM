<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import LucideCalendarDays from '~icons/lucide/calendar-days'
import LucideBuilding2 from '~icons/lucide/building-2'
import LucideCalendarRange from '~icons/lucide/calendar-range'
import LucideBriefcase from '~icons/lucide/briefcase'
import LucideSettings from '~icons/lucide/settings'
import { useCommercialStore } from '@/stores/commercial'
import { useAppTheme } from '@/lib/theme'
import { applyUpdate, updateReady } from '@/lib/sw'
import { dismissPushInvite, enablePush, pushState, shouldInvitePush } from '@/lib/push'

const store = useCommercialStore()
// Invitation aux notifications : une fois, dans l'app installée, tant que l'appareil n'est pas abonné.
const inviteClosed = ref(false)
const showInvite = computed(() => !inviteClosed.value && pushState.loaded && shouldInvitePush())
function closeInvite() {
	dismissPushInvite()
	inviteClosed.value = true
}
async function acceptInvite() {
	try {
		await enablePush()
	} catch {
		/* refus : le réglage reste disponible dans Réglages */
	}
	closeInvite()
}
useAppTheme()
onMounted(() => store.init())

const tabs = [
	{ to: { name: 'Today' }, label: "Aujourd'hui", icon: LucideCalendarDays, match: ['Today', 'Visit', 'NewVisit', 'Appel', 'NewAppel'] },
	{ to: { name: 'Week' }, label: 'Semaine', icon: LucideCalendarRange, match: ['Week', 'Rdv', 'NewRdv'] },
	{ to: { name: 'Clients' }, label: 'Clients', icon: LucideBuilding2, match: ['Clients', 'Client', 'Article', 'NewProspect'] },
	{ to: { name: 'Suivi' }, label: 'Suivi', icon: LucideBriefcase, match: ['Suivi', 'Ticket', 'NewTicket', 'Devis', 'Commande', 'Reclamation'] },
	{ to: { name: 'Settings' }, label: 'Réglages', icon: LucideSettings, match: ['Settings', 'Sync', 'Objectifs'], badge: true },
]
</script>

<template>
	<div class="min-h-screen md:pl-20">
		<div v-if="updateReady" class="sticky top-0 z-30 flex items-center justify-between gap-3 bg-accent px-4 py-2 text-sm text-white">
			<span>Une nouvelle version est disponible.</span>
			<button type="button" class="rounded-lg bg-white/20 px-3 py-1.5 font-medium" @click="applyUpdate">Mettre à jour</button>
		</div>
		<div v-if="showInvite" class="flex items-center gap-3 bg-surface-blue-2 px-4 py-2 text-sm text-ink-blue-3">
			<span class="flex-1">Être prévenu quand un devis est validé, un BAT prêt ou une urgence décidée ?</span>
			<button type="button" class="font-medium" @click="acceptInvite">Activer</button>
			<button type="button" class="text-ink-gray-6" @click="closeInvite">Plus tard</button>
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
			class="fixed inset-x-0 bottom-0 z-20 grid h-[calc(var(--bottom-chrome)+env(safe-area-inset-bottom))] grid-cols-5 border-t border-outline-gray-2 bg-surface-white pb-[env(safe-area-inset-bottom)] md:inset-y-0 md:left-0 md:right-auto md:flex md:h-auto md:w-20 md:flex-col md:gap-2 md:border-r md:border-t-0 md:pt-6"
			aria-label="Navigation principale"
		>
			<RouterLink
				v-for="tab in tabs"
				:key="tab.label"
				:to="tab.to"
				class="flex flex-col items-center justify-center gap-1 text-xs md:py-3"
				:class="tab.match.includes(String($route.name)) ? 'font-medium text-accent' : 'text-ink-gray-6'"
			>
				<span class="relative">
					<component :is="tab.icon" class="h-6 w-6" aria-hidden="true" />
					<span
						v-if="tab.badge && (store.pendingCount || store.failed.length)"
						class="absolute -right-2 -top-1 min-w-[1.1rem] rounded-full px-1 text-center text-[10px] font-semibold leading-[1.1rem] text-white"
						:class="store.failed.length ? 'bg-red-500' : 'bg-amber-500'"
						:aria-label="`${store.pendingCount} saisie(s) en attente, ${store.failed.length} à corriger`"
					>{{ store.failed.length || store.pendingCount }}</span>
				</span>
				{{ tab.label }}
			</RouterLink>
		</nav>
	</div>
</template>
