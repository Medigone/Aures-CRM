<script setup lang="ts">
import { RouterLink } from 'vue-router'
import StatusPill from '@shared/components/StatusPill.vue'
import { formatDraftQuantity, lineStudyStatus, saleTotal, type DemandeDetail, type DemandeSale } from '@/lib/demandes'
import { deskUrl, formatDay } from '@/lib/display'

/** Tableaux de la demande : ses articles, ses études, ou ses devis et commandes. */
const props = defineProps<{ demande: DemandeDetail; kind: 'articles' | 'etudes' | 'devis' | 'commandes'; withStudy?: boolean; resultLabel?: string }>()
const quantity = (value: number) => formatDraftQuantity(String(value))
const sales = (): DemandeSale[] => (props.kind === 'devis' ? props.demande.devis : props.demande.commandes)
</script>

<template>
	<div class="ref-scroll">
		<table v-if="kind === 'articles'" class="ref-table">
			<thead>
				<tr v-if="withStudy"><th>Article</th><th class="end">Quantité</th><th>Étude</th></tr>
				<tr v-else><th>Article</th><th>Procédé</th><th class="end">Quantité</th><th>Livraison</th><th>Création</th><th>Étude</th></tr>
			</thead>
			<tbody>
				<tr v-for="line in demande.lines" :key="line.name">
					<td class="!whitespace-normal"><RouterLink class="ref-link" :to="{ name: 'Article', params: { id: line.article } }">{{ line.designation }}</RouterLink></td>
					<template v-if="!withStudy">
						<td>{{ line.procede || '—' }}</td>
					</template>
					<td class="end tabular-nums">{{ quantity(line.quantite) }}</td>
					<template v-if="!withStudy">
						<td class="tabular-nums">{{ formatDay(line.date_livraison) || '—' }}</td>
						<td>{{ line.est_creation ? 'Oui' : 'Non' }}</td>
					</template>
					<td><StatusPill v-if="lineStudyStatus(demande, line)" :status="lineStudyStatus(demande, line)" /><span v-else class="text-ink-gray-6">Pas lancée</span></td>
				</tr>
			</tbody>
		</table>

		<table v-else-if="kind === 'etudes'" class="ref-table">
			<thead><tr><th>Étude</th><th>Article</th><th class="end">Quantité</th><th>{{ resultLabel || 'Résultat' }}</th></tr></thead>
			<tbody>
				<tr v-for="etude in demande.etudes" :key="etude.name">
					<td><RouterLink class="ref-link tabular-nums" :to="{ name: 'Etude', params: { id: etude.name } }">{{ etude.name }}</RouterLink></td>
					<td class="!whitespace-normal">{{ etude.designation }}</td>
					<td class="end tabular-nums">{{ quantity(etude.quantite) }}</td>
					<td><StatusPill :status="etude.status" /></td>
				</tr>
			</tbody>
		</table>

		<table v-else class="ref-table">
			<thead><tr><th>{{ kind === 'devis' ? 'Devis' : 'Commande' }}</th><th>Date</th><th>Statut</th><th class="end">Total (DA)</th></tr></thead>
			<tbody>
				<tr v-for="sale in sales()" :key="sale.name">
					<td>
						<RouterLink v-if="kind === 'devis'" class="ref-link tabular-nums" :to="{ name: 'DevisFiche', params: { id: sale.name } }">{{ sale.name }}</RouterLink>
						<a v-else class="ref-link tabular-nums" :href="deskUrl('Sales Order', sale.name)" target="_blank" rel="noopener noreferrer">{{ sale.name }}</a>
					</td>
					<td class="tabular-nums">{{ formatDay(sale.date) || '—' }}</td>
					<td><StatusPill :status="sale.status" /></td>
					<td class="end tabular-nums">{{ saleTotal(sale) }}</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>
