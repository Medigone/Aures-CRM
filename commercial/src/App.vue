<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import LucideHouse from '~icons/lucide/house'
import LucideBuilding2 from '~icons/lucide/building-2'
import LucideTicket from '~icons/lucide/ticket'
import LucideLayoutGrid from '~icons/lucide/layout-grid'
import LucidePlus from '~icons/lucide/plus'
import CreateMenu from '@/components/CreateMenu.vue'
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

// Navigation : le terrain d'abord (journée, tickets), la création au centre, le reste dans « Plus ».
const tabs = [
	{ to: { name: 'Today' }, label: "Aujourd'hui", icon: LucideHouse, match: ['Today', 'ATraiter', 'Visit', 'NewVisit', 'Appel', 'NewAppel', 'Week', 'Rdv', 'NewRdv'] },
	{ to: { name: 'Suivi' }, label: 'Tickets', icon: LucideTicket, match: ['Suivi', 'Ticket', 'NewTicket', 'Devis', 'Commande', 'Reclamation'] },
	{ to: { name: 'Clients' }, label: 'Clients', icon: LucideBuilding2, match: ['Clients', 'Client', 'Article', 'NewArticle', 'EditArticle', 'NewProspect'] },
	{ to: { name: 'Settings' }, label: 'Plus', icon: LucideLayoutGrid, match: ['Settings', 'Sync', 'Objectifs'], badge: true },
]
const route = useRoute()
const menuOpen = ref(false)
watch(() => route.fullPath, () => (menuOpen.value = false))
// Saisie terrain (visite, nouveau ticket) : plein écran sur téléphone, la barre d'action prend la place de la navigation.
const focusMode = computed(() => ['Visit', 'NewVisit', 'NewTicket', 'NewArticle', 'EditArticle'].includes(String(route.name)))
</script>

<template>
	<div class="min-h-screen md:pl-20" :class="focusMode && 'focus-mode'">
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

		<CreateMenu v-if="menuOpen" @close="menuOpen = false" />

		<!-- Navigation : barre basse avec bouton de création central sur téléphone, rail à gauche sur tablette. -->
		<nav
			class="fixed inset-x-0 bottom-0 z-40 grid h-[calc(4.75rem+env(safe-area-inset-bottom))] grid-cols-5 items-start border-t border-outline-gray-1 bg-surface-white px-2 pb-[env(safe-area-inset-bottom)] pt-2 md:inset-y-0 md:right-auto md:flex md:h-auto md:w-20 md:flex-col md:items-center md:gap-2 md:border-r md:border-t-0 md:pt-6"
			:class="focusMode && 'max-md:hidden'"
			aria-label="Navigation principale"
		>
			<template v-for="(tab, i) in tabs" :key="tab.label">
				<button
					v-if="i === 2"
					type="button"
					class="mx-auto -mt-7 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-on-primary shadow-[0_8px_20px_rgba(24,24,27,0.25)] transition active:scale-95 md:order-first md:mb-4 md:mt-0 md:h-14 md:w-14 md:shadow-none"
					:aria-label="menuOpen ? 'Fermer le menu de création' : 'Créer'"
					:aria-expanded="menuOpen"
					@click="menuOpen = !menuOpen"
				>
					<LucidePlus class="h-7 w-7 transition-transform" :class="menuOpen && 'rotate-45'" aria-hidden="true" />
				</button>
				<RouterLink
					:to="tab.to"
					class="flex flex-col items-center gap-1 pt-1 text-[11px] md:w-full md:py-3"
					:class="tab.match.includes(String($route.name)) ? 'font-semibold text-ink-gray-9' : 'font-medium text-ink-gray-6'"
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
					<span class="h-0.5 w-4 rounded-full" :class="tab.match.includes(String($route.name)) ? 'bg-ink-gray-9' : 'bg-transparent'" aria-hidden="true" />
				</RouterLink>
			</template>
		</nav>
	</div>
</template>
