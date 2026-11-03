<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import LucideFileText from '~icons/lucide/file-text'
import LucideDownload from '~icons/lucide/download'
import LucideCheck from '~icons/lucide/check'
import LucideX from '~icons/lucide/x'
import { cacheFile, cachedObjectUrl, cachedUrls } from '@/lib/contentCache'
import { fileUrl } from '@/lib/text'
import { useCommercialStore } from '@/stores/commercial'

/**
 * Fichier du CRM (BAT, fiche technique, tracé…) : image affichée (plein écran au toucher) ou document
 * à ouvrir ; lu depuis le cache de l'appareil s'il y est gardé, sinon depuis le serveur (en ligne).
 */
const props = defineProps<{ path: string | null | undefined; label: string; image?: boolean }>()
const store = useCommercialStore()
const url = computed(() => fileUrl(props.path))
const isImage = computed(() => props.image ?? /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url.value || ''))
const kept = computed(() => Boolean(url.value && cachedUrls.value.has(url.value)))
const localUrl = ref<string | null>(null)
const saving = ref(false)
const failed = ref(false)
const fullscreen = ref(false)

async function loadLocal() {
	if (localUrl.value) URL.revokeObjectURL(localUrl.value)
	localUrl.value = url.value && kept.value ? await cachedObjectUrl(url.value) : null
}
watch([url, kept], loadLocal, { immediate: true })
onBeforeUnmount(() => {
	if (localUrl.value) URL.revokeObjectURL(localUrl.value)
})

const src = computed(() => localUrl.value || (store.online ? url.value : null))

async function keep() {
	if (!url.value) return
	saving.value = true
	failed.value = !(await cacheFile(url.value))
	saving.value = false
}

function open() {
	if (isImage.value) fullscreen.value = true
	else if (src.value) window.open(src.value, '_blank', 'noopener')
}
</script>

<template>
	<div v-if="url" class="card p-3">
		<div class="flex items-center justify-between gap-2">
			<button type="button" class="flex min-w-0 items-center gap-2 text-left" :disabled="!src" @click="open">
				<LucideFileText v-if="!isImage" class="h-5 w-5 shrink-0 text-ink-gray-6" aria-hidden="true" />
				<span class="truncate text-sm font-medium" :class="src ? 'text-accent' : 'text-ink-gray-5'">{{ label }}</span>
			</button>
			<span v-if="kept" class="inline-flex items-center gap-1 text-xs text-ink-green-3"><LucideCheck class="h-4 w-4" aria-hidden="true" />Hors-ligne</span>
			<button v-else-if="store.online" type="button" class="inline-flex min-h-9 items-center gap-1 text-xs text-accent" :disabled="saving" @click="keep">
				<LucideDownload class="h-4 w-4" aria-hidden="true" />{{ saving ? 'Téléchargement…' : 'Garder hors-ligne' }}
			</button>
			<span v-else class="text-xs text-ink-gray-5">Pas sur l'appareil</span>
		</div>
		<p v-if="failed" class="mt-1 text-xs text-ink-red-3">Fichier non gardé (trop lourd ou indisponible).</p>
		<img v-if="isImage && src" :src="src" :alt="label" class="mt-2 max-h-64 w-full cursor-zoom-in rounded-lg object-contain" loading="lazy" @click="fullscreen = true" />

		<div v-if="fullscreen && src" class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2" role="dialog" :aria-label="label" @click="fullscreen = false">
			<button type="button" class="absolute right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] rounded-full bg-white/20 p-2 text-white" aria-label="Fermer">
				<LucideX class="h-6 w-6" />
			</button>
			<img :src="src" :alt="label" class="max-h-full max-w-full object-contain" />
		</div>
	</div>
</template>
