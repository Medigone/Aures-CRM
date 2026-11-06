<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import LucideCheck from '~icons/lucide/check'
import LucideClock from '~icons/lucide/clock'
import LucideMinus from '~icons/lucide/minus'
import StatusPill from '@shared/components/StatusPill.vue'
import { setQuantitesImpactees } from '@/lib/api'
import { deskUrl, piecesProgress } from '@/lib/display'
import type { DossierPiece, Perform, TicketDetail } from '@/types'

/** Pièces du dossier : ce qui existe réellement, lu dans les documents liés au ticket. Les actions restent dans l'en-tête. */
const props = defineProps<{ ticket: TicketDetail; busy: boolean; perform: Perform; wide?: boolean }>()

const STATE_LABELS: Record<DossierPiece['state'], string> = { ok: 'Obtenue', wait: 'Existe et avance', missing: 'Manquante', skip: 'Sans objet ou pour information' }
const progress = computed(() => piecesProgress(props.ticket))
const canEdit = computed(() => props.ticket.can_write && !['Terminé', 'Annulé'].includes(props.ticket.status))

// Quantités d'une réclamation : le seul élément qui se saisit, faute de document.
const quantity = ref('')
watch(
	() => props.ticket.pieces.find((piece) => piece.key === 'quantites')?.quantity,
	(value) => {
		quantity.value = value ? String(value) : ''
	},
	{ immediate: true },
)
function saveQuantity() {
	const current = props.ticket.pieces.find((piece) => piece.key === 'quantites')?.quantity ?? 0
	if (Number(quantity.value || 0) === current) return
	props.perform(() => setQuantitesImpactees(props.ticket, String(quantity.value || 0)))
}
</script>

<template>
	<section v-if="ticket.pieces.length" class="card flex flex-col gap-1 p-3.5" aria-label="Pièces du dossier">
		<div class="flex items-baseline justify-between gap-2">
			<h3 class="text-base font-semibold">Pièces du dossier</h3>
			<span v-if="progress.total" class="text-sm tabular-nums text-ink-gray-6">{{ progress.done === progress.total ? 'Complet' : `${progress.done} sur ${progress.total} pour terminer` }}</span>
		</div>
		<div v-for="piece in ticket.pieces" :key="piece.key" class="piece" :class="wide && 'piece-wide'">
			<span class="piece-mark" :class="`piece-mark-${piece.state}`" role="img" :aria-label="STATE_LABELS[piece.state]" :title="STATE_LABELS[piece.state]">
				<LucideCheck v-if="piece.state === 'ok'" class="h-3 w-3" aria-hidden="true" />
				<LucideClock v-else-if="piece.state === 'wait'" class="h-3 w-3" aria-hidden="true" />
				<LucideMinus v-else-if="piece.state === 'skip'" class="h-3 w-3" aria-hidden="true" />
			</span>
			<span class="piece-name">{{ piece.label }}</span>
			<div class="piece-body">
				<div v-for="document in piece.documents" :key="document.name" class="piece-line">
					<RouterLink v-if="document.doctype === 'Demande Faisabilite'" class="ref-link tabular-nums" :to="{ name: 'Demande', params: { id: document.name } }">{{ document.name }}</RouterLink>
					<a v-else class="ref-link tabular-nums" :href="deskUrl(document.doctype, document.name)" target="_blank" rel="noopener noreferrer">{{ document.name }}</a>
					<StatusPill v-if="document.status" :status="document.status" />
				</div>
				<div v-if="piece.key === 'quantites'" class="piece-line">
					<input v-model="quantity" class="field-input piece-quantity" type="number" min="0" step="any" aria-label="Quantités impactées" placeholder="0" :disabled="busy || !canEdit" @change="saveQuantity" />
				</div>
				<span v-if="piece.summary" class="piece-line">{{ piece.summary }}</span>
				<span v-if="piece.empty" class="piece-empty">{{ piece.empty }}</span>
				<span v-if="piece.detail" class="piece-detail">{{ piece.detail }}</span>
			</div>
		</div>
	</section>
</template>
