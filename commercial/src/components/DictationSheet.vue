<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import LucideX from '~icons/lucide/x'
import LucideCheck from '~icons/lucide/check'
import LucidePause from '~icons/lucide/pause'
import LucideMic from '~icons/lucide/mic'
import { useDictation } from '@/lib/dictation'

/**
 * Dictée en panneau bas : le texte s'écrit en direct ; « Valider » le passe à `done`, « Annuler » l'abandonne.
 * Chrome Android coupe la reconnaissance après un silence : tant que l'utilisateur n'a pas mis en pause, elle reprend seule.
 */
defineProps<{ title: string; subtitle?: string | null }>()
const emit = defineEmits<{ done: [text: string]; close: [] }>()

const text = ref('')
const paused = ref(false)
const dictation = useDictation((chunk) => {
	if (chunk) text.value = text.value ? `${text.value} ${chunk}` : chunk
})

// Durée cumulée des passages d'écoute (les reprises automatiques et les pauses ne la remettent pas à zéro).
const now = ref(Date.now())
const doneMs = ref(0)
const tick = setInterval(() => (now.value = Date.now()), 500)
watch(dictation.startedAt, (next, prev) => {
	if (prev && !next) doneMs.value += Date.now() - prev
})
const elapsed = computed(() => {
	const ms = doneMs.value + (dictation.startedAt.value ? now.value - dictation.startedAt.value : 0)
	const s = Math.floor(ms / 1000)
	return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
})

watch(dictation.listening, (on) => {
	if (!on && !paused.value && !dictation.error.value) dictation.start()
})

function togglePause() {
	paused.value = !paused.value
	if (paused.value) dictation.stop()
	else dictation.start()
}

function finish() {
	paused.value = true
	dictation.stop()
	// La phrase en cours, pas encore confirmée par le moteur, est gardée.
	const last = dictation.interim.value
	const all = [text.value, last].filter(Boolean).join(' ').trim()
	emit('done', all)
	emit('close')
}

function cancel() {
	paused.value = true
	dictation.stop()
	emit('close')
}

const onKey = (event: KeyboardEvent) => event.key === 'Escape' && cancel()
onMounted(() => {
	window.addEventListener('keydown', onKey)
	dictation.start()
})
onBeforeUnmount(() => {
	clearInterval(tick)
	window.removeEventListener('keydown', onKey)
})

const BARS = [10, 18, 26, 14, 34, 44, 28, 20, 38, 52, 40, 24, 16, 30, 46, 36, 22, 12, 28, 42, 32, 18, 26, 14, 20, 34, 24, 12]
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-50 bg-black/50" @click="cancel" />
		<section
			role="dialog"
			aria-modal="true"
			aria-labelledby="dictation-title"
			class="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85vh] min-h-[32rem] max-w-3xl flex-col gap-4 rounded-t-[28px] bg-surface-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2.5 dark:bg-surface-cards"
		>
			<span class="mx-auto h-1.5 w-10 rounded-full bg-outline-gray-3" aria-hidden="true" />
			<div class="flex items-center justify-between gap-3">
				<div class="min-w-0">
					<h2 id="dictation-title" class="text-lg font-semibold">{{ title }}</h2>
					<p v-if="subtitle" class="truncate text-sm text-ink-gray-6">{{ subtitle }}</p>
				</div>
				<span class="inline-flex items-center gap-1.5 rounded-full bg-accent-fond px-3 py-1.5 text-sm font-semibold tabular-nums text-accent">
					<span class="h-2 w-2 rounded-full bg-accent" :class="dictation.listening.value && 'animate-pulse'" aria-hidden="true" />
					{{ elapsed }}
				</span>
			</div>

			<div class="min-h-0 flex-1 overflow-y-auto rounded-[20px] bg-surface-gray-1 p-4 dark:bg-surface-gray-2" aria-live="polite">
				<p v-if="!text && !dictation.interim.value" class="text-lg text-ink-gray-5">{{ paused ? 'En pause.' : 'Parlez, le texte apparaît ici…' }}</p>
				<p class="text-[19px] font-medium leading-relaxed">
					{{ text }} <span class="text-ink-gray-5">{{ dictation.interim.value }}</span>
				</p>
			</div>

			<p v-if="dictation.error.value" class="text-sm text-ink-red-3" role="alert">{{ dictation.error.value }}</p>

			<div class="flex h-14 items-center justify-center gap-1" aria-hidden="true">
				<span
					v-for="(h, i) in BARS"
					:key="i"
					class="dictation-bar w-1 rounded-full bg-accent"
					:class="!dictation.listening.value && 'opacity-30'"
					:style="{ height: `${h}px`, animationDelay: `${(i % 7) * 90}ms`, animationPlayState: dictation.listening.value ? 'running' : 'paused' }"
				/>
			</div>

			<div class="grid grid-cols-3 items-center justify-items-center">
				<button type="button" class="flex h-14 w-14 items-center justify-center rounded-full bg-surface-gray-2 text-ink-gray-8" aria-label="Annuler la dictée" @click="cancel">
					<LucideX class="h-6 w-6" aria-hidden="true" />
				</button>
				<button
					type="button"
					class="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-accent text-white ring-[10px] ring-accent/10 transition active:scale-95"
					:aria-label="paused ? 'Reprendre la dictée' : 'Mettre en pause'"
					@click="togglePause"
				>
					<LucideMic v-if="paused" class="h-8 w-8" aria-hidden="true" />
					<LucidePause v-else class="h-8 w-8" aria-hidden="true" />
				</button>
				<button type="button" class="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary" aria-label="Valider le texte dicté" @click="finish">
					<LucideCheck class="h-6 w-6" aria-hidden="true" />
				</button>
			</div>
			<p class="text-center text-xs text-ink-gray-6">Le texte est ajouté quand vous validez · dictée en ligne uniquement</p>
		</section>
	</Teleport>
</template>

<style scoped>
.dictation-bar {
	animation: dictation-wave 1s ease-in-out infinite alternate;
	transform-origin: center;
}
@keyframes dictation-wave {
	from {
		transform: scaleY(0.35);
	}
	to {
		transform: scaleY(1);
	}
}
@media (prefers-reduced-motion: reduce) {
	.dictation-bar {
		animation: none;
	}
}
</style>
