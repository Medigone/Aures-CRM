<script setup lang="ts">
import { RouterLink } from 'vue-router'
import LucidePaperclip from '~icons/lucide/paperclip'
import LucideTriangleAlert from '~icons/lucide/triangle-alert'
import StatusPill from './StatusPill.vue'
import type { SuiviRow } from '@/lib/suivi'

/** Carte d'une affaire ou d'une visite : titre et statut, détail, note, avancement. */
defineProps<{ row: SuiviRow }>()

const NOTE_TONES: Record<NonNullable<SuiviRow['note']>['tone'], string> = {
	red: 'text-ink-red-3',
	amber: 'text-ink-amber-3',
	green: 'text-ink-green-3',
	blue: 'text-ink-blue-3',
	gray: 'text-ink-gray-7',
	muted: 'text-ink-gray-6',
}
</script>

<template>
	<RouterLink :to="row.to" class="card-link px-4 py-3.5">
		<div class="flex items-center gap-2.5">
			<p class="min-w-0 flex-1 truncate text-base font-semibold">{{ row.title }}</p>
			<StatusPill :status="row.status" :tone="row.tone" class="shrink-0" />
		</div>
		<div v-if="row.sub || row.urgence || row.pending || row.files" class="mt-0.5 flex items-center gap-1.5 text-sm text-ink-gray-6">
			<span class="min-w-0 truncate">{{ row.sub }}</span>
			<span v-if="row.urgence" class="status-ink shrink-0 rounded-md bg-surface-amber-2 px-1.5 text-xs font-semibold leading-[18px] text-ink-amber-3">{{ row.urgence }}</span>
			<span v-if="row.pending" class="ml-auto inline-flex shrink-0 items-center gap-1 text-xs"><span class="pending-dot" />À envoyer</span>
			<span v-if="row.files" class="inline-flex shrink-0 items-center gap-0.5 text-xs" :class="!row.pending && 'ml-auto'">
				<LucidePaperclip class="h-3.5 w-3.5" aria-hidden="true" />{{ row.files }}
				<span class="sr-only">pièce(s) jointe(s)</span>
			</span>
		</div>
		<div v-if="row.note || row.amount" class="mt-1.5 flex items-center justify-between gap-2.5 text-[13px] leading-snug">
			<span v-if="row.note" class="status-ink inline-flex min-w-0 items-center gap-1.5" :class="[NOTE_TONES[row.note.tone], row.note.tone !== 'muted' && 'font-medium']">
				<LucideTriangleAlert v-if="row.note.alert" class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
				<span class="truncate">{{ row.note.text }}</span>
			</span>
			<span v-if="row.amount" class="ml-auto shrink-0 text-sm font-semibold tabular-nums text-ink-gray-9">{{ row.amount }}</span>
		</div>
		<div v-if="row.progress" class="mt-2">
			<div class="h-1.5 overflow-hidden rounded-full bg-surface-gray-3" role="progressbar" :aria-valuenow="row.progress.percent" aria-valuemin="0" aria-valuemax="100">
				<div class="h-full rounded-full bg-accent" :style="{ width: `${row.progress.percent}%` }" />
			</div>
			<div class="mt-1 flex justify-between gap-2 text-xs text-ink-gray-6">
				<span class="shrink-0 font-semibold tabular-nums text-ink-gray-9">{{ row.progress.percent }} %</span>
				<span class="truncate">{{ row.progress.label }}</span>
			</div>
		</div>
	</RouterLink>
</template>
