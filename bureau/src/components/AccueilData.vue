<script setup lang="ts">
import LucideBuilding2 from '~icons/lucide/building-2'
import LucideFileText from '~icons/lucide/file-text'
import LucidePackage from '~icons/lucide/package'
import LucideRefreshCw from '~icons/lucide/refresh-cw'
import TicketStatus from './TicketStatus.vue'
import { gapRoute, type AccueilData, type DocumentGap } from '@/lib/accueil'
import { conditionsQuery } from '@/lib/filters'

/** Les données à mettre à jour : chaque ligne ouvre la liste déjà filtrée, là où le travail se fait. */
defineProps<{ data: Pick<AccueilData, 'updates' | 'clients' | 'articles' | 'documents'> }>()

const percent = (count: number, total: number) => `${total ? Math.round((count * 100) / total) : 0}%`
const documentRoute = (row: DocumentGap) => ({ ...row.to!, query: row.conditions?.length ? { filtres: conditionsQuery(row.conditions) } : {} })
</script>

<template>
	<section class="card accueil-data">
		<div class="accueil-card-head">
			<h2 class="accueil-title">Données à mettre à jour</h2>
		</div>

		<template v-if="data.updates.total">
			<div class="accueil-group">
				<LucideRefreshCw class="accueil-group-icon" aria-hidden="true" />
				<h3>Demandes de mise à jour</h3>
				<span>{{ data.updates.total }} {{ data.updates.total > 1 ? 'tickets' : 'ticket' }}</span>
			</div>
			<RouterLink v-for="row in data.updates.rows" :key="row.name" class="accueil-gap accueil-gap-ticket" :to="{ name: 'Ticket', params: { id: row.name } }">
				<span class="accueil-gap-text">
					<b class="tabular-nums">{{ row.name }}</b>
					<small>Mise à jour données · {{ row.client }}</small>
				</span>
				<TicketStatus :status="row.status" />
			</RouterLink>
		</template>

		<template v-if="data.clients">
			<div class="accueil-group">
				<LucideBuilding2 class="accueil-group-icon" aria-hidden="true" />
				<h3>Clients</h3>
				<span>{{ data.clients.total }} fiches</span>
			</div>
			<RouterLink v-for="row in data.clients.rows" :key="row.key" class="accueil-gap" :to="gapRoute('Clients', row)">
				<span class="accueil-gap-label">{{ row.label }}</span>
				<span class="accueil-track accueil-track-thin" aria-hidden="true"><i :style="{ width: percent(row.count, row.total) }"></i></span>
				<b class="accueil-gap-count tabular-nums">{{ row.count }} / {{ row.total }}</b>
			</RouterLink>
		</template>

		<template v-if="data.articles">
			<div class="accueil-group">
				<LucidePackage class="accueil-group-icon" aria-hidden="true" />
				<h3>Articles</h3>
				<span>{{ data.articles.total }} fiches</span>
			</div>
			<RouterLink v-for="row in data.articles.rows" :key="row.key" class="accueil-gap" :to="gapRoute('Articles', row)">
				<span class="accueil-gap-label">{{ row.label }}</span>
				<span class="accueil-track accueil-track-thin" aria-hidden="true"><i :style="{ width: percent(row.count, row.total) }"></i></span>
				<b class="accueil-gap-count tabular-nums">{{ row.count }} / {{ row.total }}</b>
			</RouterLink>
		</template>

		<template v-if="data.documents.length">
			<div class="accueil-group">
				<LucideFileText class="accueil-group-icon" aria-hidden="true" />
				<h3>Documents à remettre à jour</h3>
			</div>
			<template v-for="row in data.documents" :key="row.key">
				<RouterLink v-if="row.to" class="accueil-gap" :to="documentRoute(row)">
					<span class="accueil-gap-label">{{ row.label }}</span>
					<b class="accueil-gap-count tabular-nums">{{ row.count }}</b>
				</RouterLink>
				<a v-else class="accueil-gap" :href="row.href" target="_blank" rel="noopener noreferrer">
					<span class="accueil-gap-label">{{ row.label }} ↗</span>
					<b class="accueil-gap-count tabular-nums">{{ row.count }}</b>
				</a>
			</template>
		</template>
	</section>
</template>
