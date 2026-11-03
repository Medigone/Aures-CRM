<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import SyncPill from '@/components/SyncPill.vue'
import PushSettingsCard from '@/components/PushSettingsCard.vue'
import { useCommercialStore } from '@/stores/commercial'
import { useAppTheme, type ThemePreference } from '@/lib/theme'
import { formatDay, formatTime } from '@/lib/format'

const store = useCommercialStore()
const { preference, setPreference } = useAppTheme()
const themes: { value: ThemePreference; label: string }[] = [
	{ value: 'system', label: 'Téléphone' },
	{ value: 'light', label: 'Clair' },
	{ value: 'dark', label: 'Sombre' },
]
const counts = computed(() => [
	['Clients', store.clients.length],
	['Contacts', store.bundle?.contacts.length ?? 0],
	['Articles', store.articles.length],
	['Visites (12 mois)', store.visites.length],
	['Rendez-vous', store.rdv.length],
	['Appels (90 jours)', store.appels.length],
])

function logout() {
	const pending = store.pendingCount + store.failed.length
	const message = pending
		? `${pending} saisie(s) ne sont pas encore envoyées et seront perdues. Se déconnecter quand même ?`
		: 'Se déconnecter ? Les données de cet appareil seront effacées.'
	if (window.confirm(message)) store.logout()
}
</script>

<template>
	<div>
		<PageHeader title="Réglages" />

		<section v-if="store.user" class="card mb-4 p-3">
			<p class="font-medium">{{ store.user.full_name }}</p>
			<p class="text-sm text-ink-gray-6">{{ store.user.name }}</p>
			<p v-if="store.user.roles.length" class="mt-1 text-xs text-ink-gray-6">{{ store.user.roles.join(' · ') }}</p>
		</section>

		<section class="mb-4">
			<div class="mb-2 flex items-center justify-between">
				<h2 class="section-title">Données sur cet appareil</h2>
				<SyncPill />
			</div>
			<div class="card divide-y divide-outline-gray-1">
				<div v-for="[label, value] in counts" :key="label" class="flex justify-between px-3 py-2.5 text-sm">
					<span class="text-ink-gray-6">{{ label }}</span><span class="font-medium tabular-nums">{{ value }}</span>
				</div>
				<div v-if="store.bundle" class="flex justify-between px-3 py-2.5 text-sm">
					<span class="text-ink-gray-6">Dernière synchro</span>
					<span class="font-medium">{{ formatDay(store.bundle.synced_at) }} {{ formatTime(store.bundle.synced_at) }}</span>
				</div>
			</div>
			<p v-if="store.syncError" class="mt-2 text-sm text-ink-red-3">{{ store.syncError }}</p>
			<RouterLink :to="{ name: 'Sync' }" class="btn-secondary mt-3 w-full">
				Saisies : {{ store.pendingCount }} en attente<template v-if="store.failed.length">, {{ store.failed.length }} à corriger</template>
			</RouterLink>
		</section>

		<RouterLink :to="{ name: 'Objectifs' }" class="btn-secondary mb-4 w-full">Mes objectifs</RouterLink>

		<PushSettingsCard class="mb-6" />

		<section class="mb-6">
			<h2 class="section-title mb-2">Thème</h2>
			<div class="flex gap-2">
				<button v-for="t in themes" :key="t.value" type="button" :class="preference === t.value ? 'chip-on' : 'chip-off'" @click="setPreference(t.value)">{{ t.label }}</button>
			</div>
		</section>

		<button type="button" class="btn-secondary w-full text-ink-red-3" @click="logout">Se déconnecter</button>
	</div>
</template>
