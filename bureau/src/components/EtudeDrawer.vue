<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import LucideChevronDown from '~icons/lucide/chevron-down'
import LucideChevronUp from '~icons/lucide/chevron-up'
import LucideX from '~icons/lucide/x'
import StatusPill from '@shared/components/StatusPill.vue'
import TagEditor from './TagEditor.vue'
import { getEtude } from '@/lib/api'
import { deskUrl, formatDay } from '@/lib/display'
import { formatQuantity, missingPieces, type EtudeDetail } from '@/lib/etudes'
import { useDrawerControls } from '@/lib/useDrawerControls'

/** Aperçu d'une étude : la fiche et ses actions arrivent ensuite, le traitement reste sur le Desk. */
const props = defineProps<{ id: string; position: string; noPrev: boolean; noNext: boolean }>()
const emit = defineEmits<{ prev: []; next: []; close: []; changed: [] }>()

const etude = ref<EtudeDetail | null>(null)
const error = ref('')
let lastRequest = 0
async function load() {
	const request = ++lastRequest
	error.value = ''
	try {
		const result = await getEtude(props.id)
		if (request === lastRequest) etude.value = result
	} catch (e) {
		if (request === lastRequest) error.value = (e as Error).message
	}
}
onMounted(load)
watch(
	() => props.id,
	() => {
		etude.value = null
		load()
	},
)
defineExpose({ refresh: load })

const root = ref<HTMLElement | null>(null)
useDrawerControls(root, { close: () => emit('close'), prev: () => emit('prev'), next: () => emit('next') })

function onTags(tags: string[]) {
	if (etude.value) etude.value.tags = tags
	emit('changed')
}
</script>

<template>
	<aside ref="root" class="bureau-drawer" aria-label="Aperçu de l'étude">
		<div class="bureau-drawer-head">
			<button type="button" class="icon-btn" aria-label="Étude précédente" :disabled="noPrev" @click="emit('prev')"><LucideChevronUp class="h-4 w-4" aria-hidden="true" /></button>
			<button type="button" class="icon-btn" aria-label="Étude suivante" :disabled="noNext" @click="emit('next')"><LucideChevronDown class="h-4 w-4" aria-hidden="true" /></button>
			<span class="text-xs text-ink-gray-6">{{ position }}</span>
			<span class="flex-auto"></span>
			<a v-if="etude" class="btn-primary" :href="deskUrl(etude.doctype, etude.name)" target="_blank" rel="noopener noreferrer">
				Ouvrir sur le Desk
				<LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />
			</a>
			<button type="button" class="icon-btn" aria-label="Fermer l'aperçu" @click="emit('close')"><LucideX class="h-4 w-4" aria-hidden="true" /></button>
		</div>

		<div class="bureau-drawer-body">
			<p v-if="error" role="alert" class="text-tone-red">
				{{ error }}
				<button type="button" class="ml-1 font-semibold underline" @click="load">Réessayer</button>
			</p>
			<p v-else-if="!etude" class="py-8 text-center text-ink-gray-6">Chargement de l'étude…</p>

			<template v-else>
				<div>
					<div class="flex flex-wrap items-center gap-1.5">
						<h2 class="text-xl font-semibold tabular-nums">{{ etude.name }}</h2>
						<StatusPill :status="etude.status" />
						<span class="urgence" :class="`urgence-${etude.urgence}`">{{ etude.urgence }}</span>
					</div>
					<p class="mt-0.5 text-sm text-ink-gray-7">{{ [etude.procede, `${formatQuantity(etude.quantite)} ex.`, etude.retirage && 'Retirage'].filter(Boolean).join(' · ') }}</p>
					<TagEditor class="mt-1.5" :doctype="etude.doctype" :name="etude.name" :modified="etude.modified" :tags="etude.tags" :can-edit="etude.can_write" @changed="onTags" />
				</div>

				<dl class="bureau-drawer-facts">
					<div><dt>Article</dt><dd class="truncate" :title="etude.designation"><RouterLink class="ref-link" :to="{ name: 'Article', params: { id: etude.article } }">{{ etude.designation }}</RouterLink></dd></div>
					<div><dt>Client</dt><dd class="truncate" :title="etude.client_label"><RouterLink class="ref-link" :to="{ name: 'Client', params: { id: etude.client } }">{{ etude.client_label }}</RouterLink></dd></div>
					<div><dt>Échéance</dt><dd class="tabular-nums" :class="etude.retard && 'etude-late'">{{ formatDay(etude.echeance) || '—' }}</dd></div>
					<div><dt>Livraison souhaitée</dt><dd class="tabular-nums">{{ formatDay(etude.livraison) || '—' }}</dd></div>
					<div v-if="etude.demande"><dt>Demande</dt><dd class="truncate tabular-nums"><RouterLink class="ref-link" :to="{ name: 'Demande', params: { id: etude.demande } }">{{ etude.demande }}</RouterLink></dd></div>
					<div><dt>Commercial</dt><dd class="truncate" :title="etude.commercial || undefined">{{ etude.commercial || 'Non attribué' }}</dd></div>
				</dl>

				<section class="card flex flex-col gap-1">
					<h3 class="text-base font-semibold">Pièces de l'étude</h3>
					<p v-if="missingPieces(etude).length" class="text-sm text-ink-gray-6">Manque : {{ missingPieces(etude).join(', ').toLowerCase() }}.</p>
					<dl class="kv">
						<div v-for="piece in etude.pieces" :key="piece.key">
							<dt>{{ piece.label }}</dt>
							<dd>
								<a v-if="piece.value" class="ref-link tabular-nums" :href="deskUrl(piece.doctype, piece.value)" target="_blank" rel="noopener noreferrer">{{ piece.value }}</a>
								<span v-else class="text-ink-gray-6">{{ piece.key === 'machine_prevue' ? 'Non choisie' : 'Aucun document' }}</span>
								<StatusPill v-if="piece.status" class="ml-1.5" :status="piece.status" />
							</dd>
						</div>
					</dl>
				</section>

				<section v-if="etude.observations" class="card flex flex-col gap-1">
					<h3 class="text-base font-semibold">Observations</h3>
					<p class="whitespace-pre-line text-sm">{{ etude.observations }}</p>
				</section>
			</template>
		</div>
	</aside>
</template>
