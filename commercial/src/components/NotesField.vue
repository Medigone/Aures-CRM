<script setup lang="ts">
import { onMounted, ref } from 'vue'
import LucideMic from '~icons/lucide/mic'
import LucideKeyboard from '~icons/lucide/keyboard'
import DictationSheet from './DictationSheet.vue'
import { dictationSupported } from '@/lib/dictation'

/**
 * Zone de texte dictée d'abord (Chrome Android, en ligne) : la dictée s'ouvre en panneau et s'ajoute à la suite ;
 * le clavier reste possible. Sans prise en charge de la dictée, c'est une zone de texte simple.
 */
const model = defineModel<string>({ required: true })
const props = defineProps<{ label?: string; placeholder?: string; hint?: string | null; subtitle?: string | null; autoDictate?: boolean }>()
const emit = defineEmits<{ dictated: [] }>()
const supported = dictationSupported()
const open = ref(false)
const textarea = ref<HTMLTextAreaElement | null>(null)

function append(text: string) {
	if (!text) return
	const current = model.value.trimEnd()
	model.value = current ? `${current}${/[.!?:;,]$/.test(current) ? ' ' : '. '}${text}` : text
	emit('dictated')
}

function focusKeyboard() {
	textarea.value?.focus()
}

onMounted(() => {
	if (props.autoDictate && supported) open.value = true
})
defineExpose({ dictate: () => (open.value = true) })
</script>

<template>
	<section class="card space-y-3 p-4">
		<div class="flex items-center justify-between gap-2">
			<h2 class="text-[15px] font-semibold">{{ label || 'Notes' }}</h2>
			<span v-if="hint" class="text-xs text-ink-gray-6">{{ hint }}</span>
		</div>
		<textarea
			ref="textarea"
			v-model="model"
			:rows="model ? 5 : 3"
			class="block w-full resize-none border-0 bg-transparent p-0 text-base leading-relaxed text-ink-gray-9 placeholder:text-ink-gray-5 focus:ring-0"
			:placeholder="placeholder"
			:aria-label="label || 'Notes'"
		/>
		<div v-if="supported" class="flex gap-2">
			<button type="button" class="flex min-h-[52px] flex-1 items-center justify-center gap-2.5 rounded-full bg-accent text-[15px] font-semibold text-white transition active:scale-[0.98]" @click="open = true">
				<LucideMic class="h-[22px] w-[22px]" aria-hidden="true" />
				{{ model ? 'Continuer la dictée' : 'Dicter' }}
			</button>
			<button type="button" class="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-outline-gray-2 text-ink-gray-7" aria-label="Taper au clavier" @click="focusKeyboard">
				<LucideKeyboard class="h-5 w-5" aria-hidden="true" />
			</button>
		</div>
		<DictationSheet v-if="open" :title="label || 'Notes'" :subtitle="subtitle" @done="append" @close="open = false" />
	</section>
</template>
