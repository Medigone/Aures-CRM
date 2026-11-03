<script setup lang="ts">
/** Paramètres › Notifications : activation sur ce téléphone, test et catégories. */
import { computed, onMounted, ref } from 'vue'
import { disablePush, enablePush, pushState, refreshPush, savePushPreferences, sendTestPush } from '@/lib/push'

const test = ref(false)
const message = ref<{ text: string; error: boolean } | null>(null)
function toast(text: string, kind?: 'error') {
	message.value = { text, error: kind === 'error' }
}
const saving = ref(new Set<string>())

const hint = computed(() => {
	switch (pushState.support) {
		case 'ios-install':
			return "Sur iPhone, ajoutez d'abord l'app à l'écran d'accueil (Partager › Sur l'écran d'accueil), puis ouvrez-la depuis son icône."
		case 'denied':
			return 'Les notifications sont bloquées pour Aures Commercial. Autorisez-les dans les réglages du téléphone.'
		case 'unsupported':
			return 'Ce navigateur ne reçoit pas les notifications.'
	}
	return pushState.subscribed
		? 'Une alerte arrive même app fermée.'
		: 'Recevez une alerte (devis validé, BAT, urgence…), même app fermée.'
})

async function toggle() {
	const next = !pushState.subscribed
	try {
		if (next) await enablePush()
		else await disablePush()
		toast(next ? 'Notifications activées' : 'Notifications désactivées')
	} catch (error) {
		toast((error as Error).message || "Le réglage n'a pas pu être enregistré.", 'error')
	}
}

async function sendTest() {
	test.value = true
	try {
		const { delivered } = await sendTestPush()
		if (delivered) toast('Notification envoyée : elle arrive dans quelques secondes.')
		else toast("La notification n'a pas pu être envoyée.", 'error')
	} catch (error) {
		toast((error as Error).message, 'error')
	} finally {
		test.value = false
	}
}

async function toggleCategory(id: string, actif: boolean) {
	if (saving.value.has(id)) return
	saving.value.add(id)
	const actives = pushState.preferences.filter((c) => (c.id === id ? actif : c.actif)).map((c) => c.id)
	try {
		await savePushPreferences(actives)
	} catch (error) {
		toast((error as Error).message || "La préférence n'a pas pu être enregistrée.", 'error')
	} finally {
		saving.value.delete(id)
	}
}

onMounted(() => refreshPush().catch(() => {}))
</script>

<template>
	<section v-if="pushState.loaded && pushState.enabled" aria-labelledby="push-title">
		<h2 id="push-title" class="section-title mb-2">Notifications</h2>
		<div class="card divide-y divide-outline-gray-1">
			<div class="flex items-center gap-3 p-4">
				<div class="min-w-0 flex-1">
					<p id="push-device" class="font-medium text-ink-gray-9">Sur ce téléphone</p>
					<p class="text-sm text-ink-gray-6">{{ hint }}</p>
				</div>
				<button
					v-if="pushState.support === 'ok'"
					type="button"
					role="switch"
					class="push-switch"
					:class="{ 'push-switch--on': pushState.subscribed }"
					:aria-checked="pushState.subscribed"
					aria-labelledby="push-device"
					:disabled="pushState.busy"
					@click="toggle"
				>
					<span class="push-switch__thumb" aria-hidden="true" />
				</button>
			</div>
			<div v-if="pushState.subscribed" class="flex items-center gap-3 p-4">
				<p class="min-w-0 flex-1 text-sm text-ink-gray-6">Vérifiez qu'une notification arrive sur ce téléphone.</p>
				<button type="button" class="btn-secondary" :disabled="test" @click="sendTest">
					{{ test ? 'Envoi…' : 'Envoyer un test' }}
				</button>
			</div>
			<template v-if="pushState.devices > 0">
				<div v-for="categorie in pushState.preferences" :key="categorie.id" class="flex items-center gap-3 p-4">
					<p :id="`push-cat-${categorie.id}`" class="min-w-0 flex-1 text-sm text-ink-gray-9">{{ categorie.label }}</p>
					<button
						type="button"
						role="switch"
						class="push-switch"
						:class="{ 'push-switch--on': categorie.actif }"
						:aria-checked="categorie.actif"
						:aria-labelledby="`push-cat-${categorie.id}`"
						:disabled="saving.has(categorie.id)"
						@click="toggleCategory(categorie.id, !categorie.actif)"
					>
						<span class="push-switch__thumb" aria-hidden="true" />
					</button>
				</div>
			</template>
		</div>
		<p v-if="message" class="mt-2 text-sm" :class="message.error ? 'text-ink-red-3' : 'text-ink-gray-6'" role="status">{{ message.text }}</p>
	</section>
</template>

<style scoped>
.push-switch {
	position: relative;
	flex-shrink: 0;
	width: 44px;
	height: 26px;
	border-radius: 999px;
	background: var(--surface-gray-4, #d4d4d8);
	transition: background-color 0.15s;
}

.push-switch--on {
	background: rgb(var(--accent-rgb));
}

.push-switch:disabled {
	opacity: 0.6;
}

.push-switch__thumb {
	position: absolute;
	top: 3px;
	left: 3px;
	width: 20px;
	height: 20px;
	border-radius: 999px;
	background: #fff;
	box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
	transition: transform 0.15s;
}

.push-switch--on .push-switch__thumb {
	transform: translateX(18px);
}
</style>
