<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import LucideAtSign from '~icons/lucide/at-sign'
import LucideMessageCircle from '~icons/lucide/message-circle'
import LucideShare2 from '~icons/lucide/share-2'
import { canShareFile, devisPdfUrl, fetchDevisPdf, getEnvoi, isShareAbort, markDevisSent, sendDevisEmail, whatsappUrl, type EnvoiInfo } from '@/lib/devisEnvoi'

/**
 * Envoi du devis au client, en panneau bas. WhatsApp et « Autre application » passent par le partage du téléphone,
 * avec le PDF joint ; l'envoi est noté quand le partage se termine. L'email part du serveur, PDF joint.
 */
const props = defineProps<{ name: string; client: string }>()
const emit = defineEmits<{ close: []; sent: [envoi: NonNullable<EnvoiInfo['envoi']>] }>()

type Step = 'choix' | 'email' | 'manuel'
const step = ref<Step>('choix')
const info = ref<EnvoiInfo | null>(null)
const loadError = ref('')
const error = ref('')
const busy = ref(false)
const email = ref('')
const message = ref('')
// Partage impossible sur cet appareil : le PDF s'ouvre, l'envoi se confirme à la main.
const manualCanal = ref('')

onMounted(async () => {
	window.addEventListener('keydown', onKey)
	try {
		info.value = await getEnvoi(props.name)
		email.value = info.value.email ?? ''
		message.value = info.value.message
	} catch (e) {
		loadError.value = (e as Error).message
	}
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !busy.value && emit('close')

const shareText = computed(() => `Devis ${props.name} · Aures Emballages`)

function done(envoi: EnvoiInfo['envoi']) {
	if (envoi) emit('sent', envoi)
	emit('close')
}

async function share(canal: 'WhatsApp' | 'Autre application') {
	if (busy.value) return
	busy.value = true
	error.value = ''
	try {
		const file = await fetchDevisPdf(props.name)
		if (!canShareFile(file)) {
			manualCanal.value = canal
			step.value = 'manuel'
			return
		}
		await navigator.share({ files: [file], title: shareText.value, text: shareText.value })
		done((await markDevisSent(props.name, canal)).envoi)
	} catch (e) {
		if (!isShareAbort(e)) error.value = (e as Error).message
	} finally {
		busy.value = false
	}
}

async function confirmManual() {
	if (busy.value) return
	busy.value = true
	error.value = ''
	try {
		done((await markDevisSent(props.name, manualCanal.value)).envoi)
	} catch (e) {
		error.value = (e as Error).message
	} finally {
		busy.value = false
	}
}

async function sendEmail() {
	if (busy.value || !email.value.trim()) return
	busy.value = true
	error.value = ''
	try {
		done((await sendDevisEmail(props.name, email.value.trim(), message.value)).envoi)
	} catch (e) {
		error.value = (e as Error).message
	} finally {
		busy.value = false
	}
}
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-50 bg-black/50" @click="!busy && emit('close')" />
		<section
			role="dialog"
			aria-modal="true"
			aria-labelledby="envoi-title"
			class="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85vh] max-w-3xl flex-col gap-3 overflow-y-auto rounded-t-[28px] bg-surface-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2.5 dark:bg-surface-cards"
		>
			<span class="mx-auto h-1.5 w-10 rounded-full bg-outline-gray-3" aria-hidden="true" />
			<div class="min-w-0">
				<h2 id="envoi-title" class="text-lg font-semibold">{{ step === 'email' ? 'Envoyer par email' : 'Envoyer le devis' }}</h2>
				<p class="truncate text-sm text-ink-gray-6">{{ name }} · {{ client }}</p>
			</div>

			<p v-if="loadError" class="text-sm text-ink-red-3" role="alert">{{ loadError }}</p>
			<p v-else-if="!info" class="py-6 text-center text-ink-gray-6">Préparation de l'envoi…</p>
			<p v-else-if="!info.peut_envoyer" class="py-4 text-ink-gray-7">Ce devis ne peut pas être envoyé : il doit être validé et encore ouvert.</p>

			<template v-else-if="step === 'choix'">
				<button type="button" class="envoi-option" :disabled="busy" @click="share('WhatsApp')">
					<span class="envoi-icon tone-green"><LucideMessageCircle class="h-5 w-5" aria-hidden="true" /></span>
					<span class="min-w-0"><span class="block font-semibold">WhatsApp</span><span class="block text-sm text-ink-gray-6">Le PDF part dans la conversation du client</span></span>
				</button>
				<button type="button" class="envoi-option" :disabled="busy" @click="step = 'email'">
					<span class="envoi-icon tone-blue"><LucideAtSign class="h-5 w-5" aria-hidden="true" /></span>
					<span class="min-w-0"><span class="block font-semibold">Email</span><span class="block truncate text-sm text-ink-gray-6">{{ info.email || 'Adresse à saisir' }} · PDF joint, envoyé par Aures</span></span>
				</button>
				<button type="button" class="envoi-option" :disabled="busy" @click="share('Autre application')">
					<span class="envoi-icon bg-surface-gray-3 text-ink-gray-7"><LucideShare2 class="h-5 w-5" aria-hidden="true" /></span>
					<span class="min-w-0"><span class="block font-semibold">Autre application</span><span class="block text-sm text-ink-gray-6">Menu de partage du téléphone</span></span>
				</button>
				<p v-if="busy" class="text-center text-sm text-ink-gray-6">Préparation du PDF…</p>
			</template>

			<template v-else-if="step === 'email'">
				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium">Adresse du client</span>
					<input v-model="email" type="email" inputmode="email" autocomplete="email" class="field-input text-[16px]" placeholder="contact@client.dz" />
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium">Message</span>
					<textarea v-model="message" rows="7" class="field-input text-[16px]"></textarea>
				</label>
				<p class="text-xs text-ink-gray-6">Le PDF du devis est joint. Les réponses du client vous reviennent.</p>
				<div class="flex gap-2">
					<button type="button" class="btn-secondary flex-1" :disabled="busy" @click="step = 'choix'">Retour</button>
					<button type="button" class="btn-primary flex-1" :disabled="busy || !email.trim()" @click="sendEmail">{{ busy ? 'Envoi…' : 'Envoyer' }}</button>
				</div>
			</template>

			<template v-else>
				<p class="text-ink-gray-7">Ce navigateur ne sait pas joindre un fichier à une autre application. Ouvrez le PDF, envoyez-le au client{{ manualCanal === 'WhatsApp' ? ' sur WhatsApp' : '' }}, puis confirmez.</p>
				<a class="btn-secondary" :href="devisPdfUrl(name)" target="_blank" rel="noopener noreferrer">Ouvrir le PDF</a>
				<a v-if="manualCanal === 'WhatsApp'" class="btn-secondary" :href="whatsappUrl(info.telephone, shareText)" target="_blank" rel="noopener noreferrer">Ouvrir WhatsApp</a>
				<button type="button" class="btn-primary" :disabled="busy" @click="confirmManual">C'est envoyé</button>
			</template>

			<p v-if="error" class="text-sm text-ink-red-3" role="alert">{{ error }}</p>
		</section>
	</Teleport>
</template>

<style scoped>
.envoi-option {
	@apply flex min-h-16 items-center gap-3 rounded-2xl border border-outline-gray-2 bg-surface-white p-3 text-left disabled:opacity-60 dark:bg-surface-cards;
}
.envoi-icon {
	@apply inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl;
}
</style>
