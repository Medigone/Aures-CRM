<script setup lang="ts">
import { computed } from 'vue'
import StatusPill from '@shared/components/StatusPill.vue'
import { deskUrl } from '@/lib/display'
import { blockedText, type EtudeDetail } from '@/lib/etudes'

/** L'aperçu de la liste : les pièces réelles et ce qui manque encore pour conclure. Elles se renseignent sur la fiche. */
const props = defineProps<{ etude: EtudeDetail }>()
const blocked = computed(() => blockedText(props.etude))
const empty = (key: string) => (key === 'machine_prevue' ? 'Non choisie' : 'Aucun document')
</script>

<template>
	<section class="card ref-card etude-pieces-card">
		<div class="ref-card-head"><h3>Pièces de l'étude</h3></div>
		<p v-if="blocked" class="etude-blocked">{{ blocked }}</p>
		<dl class="etude-piece-list">
			<div v-for="piece in etude.pieces" :key="piece.key">
				<dt>{{ piece.label }}</dt>
				<dd>
					<a v-if="piece.value" class="ref-link tabular-nums" :href="deskUrl(piece.doctype, piece.value)" target="_blank" rel="noopener noreferrer">{{ piece.value }}</a>
					<span v-else class="text-ink-gray-6">{{ empty(piece.key) }}</span>
					<StatusPill v-if="piece.status" :status="piece.status" />
				</dd>
			</div>
			<div v-if="etude.taux_chutes !== null">
				<dt>Taux de chutes</dt>
				<dd :class="!etude.taux_chutes && 'text-ink-gray-6'" class="tabular-nums">{{ etude.taux_chutes ? `${etude.taux_chutes} %` : 'Non calculé' }}</dd>
			</div>
		</dl>
	</section>
</template>
