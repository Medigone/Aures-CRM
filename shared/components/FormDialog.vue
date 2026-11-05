<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import LucideX from '~icons/lucide/x'

/**
 * Fenêtre de création, par-dessus la page qui reste en place.
 * Un clic à côté ne ferme pas. Si la saisie n'est pas vide (`dirty`), la fermeture demande confirmation dans le pied.
 * Avec `draft`, la saisie est gardée en brouillon par l'appelant : fermer ne perd rien, et `discard` l'efface.
 */
const props = withDefaults(defineProps<{ title: string; dirty: boolean; busy?: boolean; hint?: string; draft?: boolean }>(), { hint: 'Ctrl + Entrée pour créer' })
const emit = defineEmits<{ close: []; submit: []; discard: [] }>()

const root = ref<HTMLElement | null>(null)
const body = ref<HTMLElement | null>(null)
const confirming = ref(false)

function requestClose() {
	if (props.busy) return
	if (props.dirty) confirming.value = true
	else emit('close')
}
function onKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape') {
		event.stopPropagation()
		if (confirming.value) confirming.value = false
		else requestClose()
	} else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
		event.preventDefault()
		if (!confirming.value) emit('submit')
	} else if (event.key === 'Tab') {
		// La tabulation reste dans la fenêtre.
		const focusable = root.value?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')
		if (!focusable?.length) return
		const first = focusable[0]
		const last = focusable[focusable.length - 1]
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault()
			last.focus()
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault()
			first.focus()
		}
	}
}
onMounted(async () => {
	await nextTick()
	body.value?.querySelector<HTMLElement>('input,select,textarea')?.focus()
})
</script>

<template>
	<div class="dialog-scrim" @keydown="onKeydown">
		<div ref="root" class="dialog" role="dialog" aria-modal="true" :aria-label="title">
			<div class="dialog-head">
				<h2 class="page-title">{{ title }}</h2>
				<button type="button" class="app-icon-bare" aria-label="Fermer" :disabled="busy" @click="requestClose"><LucideX class="h-4 w-4" aria-hidden="true" /></button>
			</div>
			<slot name="top" />
			<div ref="body" class="dialog-body">
				<slot />
			</div>
			<div class="dialog-foot">
				<template v-if="confirming && draft">
					<span class="flex-auto font-semibold text-ink-gray-9">Votre saisie reste en brouillon.</span>
					<button type="button" class="btn-ghost" @click="confirming = false">Continuer la saisie</button>
					<button type="button" class="btn-danger" @click="emit('discard')">Effacer la saisie</button>
					<button type="button" class="btn-primary" @click="emit('close')">Fermer</button>
				</template>
				<template v-else-if="confirming">
					<span class="flex-auto font-semibold text-ink-gray-9">Abandonner cette saisie ?</span>
					<button type="button" class="btn-secondary" @click="confirming = false">Continuer la saisie</button>
					<button type="button" class="btn-danger" @click="emit('close')">Abandonner</button>
				</template>
				<template v-else>
					<span class="flex-auto text-sm text-ink-gray-6">{{ hint }}</span>
					<button type="button" class="btn-ghost" :disabled="busy" @click="requestClose">Annuler</button>
					<slot name="actions" />
				</template>
			</div>
		</div>
	</div>
</template>
