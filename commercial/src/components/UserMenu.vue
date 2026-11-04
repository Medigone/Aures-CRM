<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import LucideTarget from '~icons/lucide/target'
import LucideRefreshCw from '~icons/lucide/refresh-cw'
import LucideSettings from '~icons/lucide/settings'
import LucideLogOut from '~icons/lucide/log-out'
import { useCommercialStore } from '@/stores/commercial'
import { fileUrl, initiales } from '@/lib/text'

/** Avatar de l'utilisateur, présent sur toutes les pages : objectifs, saisies, paramètres, déconnexion. */
const store = useCommercialStore()
const route = useRoute()

const open = ref(false)
watch(() => route.fullPath, () => (open.value = false))

const user = computed(() => store.user)
const imageError = ref(false)
const image = computed(() => (imageError.value ? null : fileUrl(user.value?.image)))

const enAttente = computed(() => store.pendingCount)
const aCorriger = computed(() => store.failed.length)
const badge = computed(() => aCorriger.value || enAttente.value)
const badgeLabel = computed(() => {
	if (aCorriger.value) return `, ${aCorriger.value} saisie(s) à corriger`
	return enAttente.value ? `, ${enAttente.value} saisie(s) en attente` : ''
})
const objectif = computed(() => {
	const value = store.bundle?.objectifs?.target_achievement_pct
	return value == null ? null : Math.round(value)
})

function onKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape') open.value = false
}
watch(open, (isOpen) => {
	if (isOpen) window.addEventListener('keydown', onKeydown)
	else window.removeEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

function logout() {
	const pending = store.pendingCount + store.failed.length
	const message = pending
		? `${pending} saisie(s) ne sont pas encore envoyées et seront perdues. Se déconnecter quand même ?`
		: 'Se déconnecter ? Les données de cet appareil seront effacées.'
	if (window.confirm(message)) store.logout()
}
</script>

<template>
	<button
		type="button"
		class="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-fonce text-[15px] font-semibold text-white transition active:scale-95"
		:aria-label="`Mon compte${badgeLabel}`"
		aria-haspopup="menu"
		:aria-expanded="open"
		@click="open = !open"
	>
		<img v-if="image" :src="image" alt="" class="h-full w-full rounded-full object-cover" @error="imageError = true" />
		<template v-else>{{ initiales(user?.full_name) }}</template>
		<span
			v-if="badge"
			class="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-surface-gray-1 px-1 text-[10px] font-bold text-white dark:border-surface-white"
			:class="aCorriger ? 'bg-red-600' : 'bg-amber-700'"
			aria-hidden="true"
		>{{ badge }}</span>
	</button>

	<Teleport to="body">
		<template v-if="open">
			<button type="button" class="fixed inset-0 z-50 bg-black/30" aria-label="Fermer le menu" @click="open = false" />
			<div role="menu" aria-label="Mon compte" class="card fixed right-4 top-[calc(env(safe-area-inset-top)+4.25rem)] z-50 w-[296px] max-w-[calc(100vw-2rem)] overflow-hidden shadow-xl">
				<div class="flex items-center gap-3 border-b border-outline-gray-1 p-4">
					<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-fonce text-[15px] font-semibold text-white" aria-hidden="true">
						<img v-if="image" :src="image" alt="" class="h-full w-full rounded-full object-cover" />
						<template v-else>{{ initiales(user?.full_name) }}</template>
					</span>
					<span class="min-w-0">
						<span class="block truncate text-base font-semibold">{{ user?.full_name }}</span>
						<span class="block truncate text-[13px] text-ink-gray-6">{{ user?.name }}</span>
					</span>
				</div>
				<RouterLink :to="{ name: 'Objectifs' }" role="menuitem" class="flex min-h-14 items-center gap-3 px-4 active:bg-surface-gray-2">
					<LucideTarget class="h-5 w-5 shrink-0 text-ink-gray-6" aria-hidden="true" />
					<span class="flex-1 text-base font-medium">Mes objectifs</span>
					<span v-if="objectif != null" class="text-sm font-semibold tabular-nums text-ink-gray-6">{{ objectif }} %</span>
				</RouterLink>
				<RouterLink :to="{ name: 'Sync' }" role="menuitem" class="flex min-h-14 items-center gap-3 px-4 active:bg-surface-gray-2">
					<LucideRefreshCw class="h-5 w-5 shrink-0 text-ink-gray-6" aria-hidden="true" />
					<span class="flex-1 text-base font-medium">{{ aCorriger ? 'Saisies à corriger' : 'Saisies à envoyer' }}</span>
					<span v-if="badge" class="flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-xs font-bold text-white" :class="aCorriger ? 'bg-red-600' : 'bg-amber-700'">{{ badge }}</span>
				</RouterLink>
				<RouterLink :to="{ name: 'Settings' }" role="menuitem" class="flex min-h-14 items-center gap-3 px-4 active:bg-surface-gray-2">
					<LucideSettings class="h-5 w-5 shrink-0 text-ink-gray-6" aria-hidden="true" />
					<span class="flex-1 text-base font-medium">Paramètres</span>
				</RouterLink>
				<button type="button" role="menuitem" class="status-ink flex min-h-14 w-full items-center gap-3 border-t border-outline-gray-1 px-4 text-left text-base font-medium text-ink-red-3 active:bg-surface-gray-2" @click="logout">
					<LucideLogOut class="h-5 w-5 shrink-0" aria-hidden="true" />Se déconnecter
				</button>
			</div>
		</template>
	</Teleport>
</template>
