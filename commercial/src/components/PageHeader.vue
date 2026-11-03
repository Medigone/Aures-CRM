<script setup lang="ts">
import { useRouter, type RouteLocationRaw } from 'vue-router'
import LucideChevronLeft from '~icons/lucide/chevron-left'

/** Titre de page avec retour : l'historique s'il existe, sinon `back`. */
const props = defineProps<{ title: string; subtitle?: string | null; back?: RouteLocationRaw }>()
const router = useRouter()

function goBack() {
	if (window.history.state?.back) router.back()
	else if (props.back) router.replace(props.back)
	else router.replace({ name: 'Today' })
}
</script>

<template>
	<div class="mb-4 flex items-start gap-1">
		<button v-if="back" type="button" class="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-gray-7 active:bg-surface-gray-2" aria-label="Retour" @click="goBack">
			<LucideChevronLeft class="h-6 w-6" aria-hidden="true" />
		</button>
		<div class="min-w-0 flex-1 py-1.5">
			<h1 class="text-[24px] font-bold leading-tight tracking-tight">{{ title }}</h1>
			<p v-if="subtitle" class="truncate text-sm text-ink-gray-6">{{ subtitle }}</p>
		</div>
		<div v-if="$slots.actions" class="flex shrink-0 items-center gap-2 pt-0.5">
			<slot name="actions" />
		</div>
	</div>
</template>
