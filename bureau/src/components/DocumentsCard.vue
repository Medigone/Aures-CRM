<script setup lang="ts">
import { computed } from 'vue'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import LucidePlus from '~icons/lucide/plus'
import LucideX from '~icons/lucide/x'
import { fileUrl } from '@shared/text'
import { attachFiles, removeDocument } from '@/lib/api'
import { fileExtension, formatDay } from '@/lib/display'
import type { Perform, TicketDetail, TicketDocument } from '@/types'

const props = defineProps<{ ticket: TicketDetail; busy: boolean; perform: Perform }>()

const documents = computed(() => props.ticket.documents)
const canAttach = computed(() => props.ticket.can_write && !['Terminé', 'Annulé'].includes(props.ticket.status))

function attach(event: Event) {
	const input = event.target as HTMLInputElement
	const files = Array.from(input.files || [])
	input.value = ''
	if (files.length) props.perform(() => attachFiles(props.ticket, files))
}

function remove(document: TicketDocument) {
	if (window.confirm(`Retirer le fichier « ${document.file_name} » ?`)) props.perform(() => removeDocument(props.ticket, document.name))
}
</script>

<template>
	<section aria-label="Documents du ticket" class="card flex flex-col gap-1.5 p-3.5">
		<div class="flex items-baseline justify-between gap-2">
			<h3 class="text-base font-semibold">Documents</h3>
			<span class="text-xs text-ink-gray-6">{{ documents.length }} {{ documents.length > 1 ? 'fichiers' : 'fichier' }}</span>
		</div>
		<p v-if="!documents.length" class="text-sm text-ink-gray-6">Aucun document joint.</p>
		<div v-for="document in documents" :key="document.name" class="flex items-center gap-1">
			<a :href="fileUrl(document.file_url) || undefined" target="_blank" rel="noopener noreferrer" class="flex min-h-10 min-w-0 flex-auto items-center gap-2 rounded-control p-1 transition hover:bg-surface-gray-2">
				<span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-gray-3 text-xs font-bold text-ink-gray-8">{{ fileExtension(document.file_name) }}</span>
				<span class="min-w-0 flex-auto">
					<span class="block break-words font-medium">{{ document.file_name }}</span>
					<span class="block text-xs text-ink-gray-6">Joint par {{ document.owner_name }} · {{ formatDay(document.creation) }}</span>
				</span>
				<LucideArrowUpRight class="h-3.5 w-3.5 shrink-0 text-ink-gray-7" aria-hidden="true" />
			</a>
			<button v-if="document.can_remove" type="button" class="icon-btn" :aria-label="`Retirer ${document.file_name}`" :disabled="busy" @click="remove(document)">
				<LucideX class="h-4 w-4" aria-hidden="true" />
			</button>
		</div>
		<div v-if="canAttach" class="relative flex">
			<input id="joindre-fichier" class="absolute h-px w-px opacity-0" type="file" multiple :disabled="busy" @change="attach" />
			<label for="joindre-fichier" class="btn-secondary flex-auto cursor-pointer">
				<LucidePlus class="h-3.5 w-3.5" aria-hidden="true" />
				{{ busy ? 'Enregistrement…' : 'Joindre un fichier' }}
			</label>
		</div>
	</section>
</template>
