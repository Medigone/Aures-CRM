<script setup lang="ts">
import { computed } from 'vue'
import LucideArrowRight from '~icons/lucide/arrow-right'
import LucideLoader from '~icons/lucide/loader'
import LucidePlay from '~icons/lucide/play'
import StatusPill from '@shared/components/StatusPill.vue'
import { waitLabel, type AccueilScope } from '@/lib/accueil'
import { etudeGroupTitle, etudeRowDetail, type EtudeAccueilData, type EtudeAccueilRow } from '@/lib/accueilEtude'
import { initials } from '@/lib/display'

/** La file de l'équipe : chaque étude ouverte avec ce qui la fait avancer. Le serveur dit quelle action est permise. */
const props = defineProps<{ data: EtudeAccueilData; busy: string; scope: AccueilScope }>()
const emit = defineEmits<{ run: [row: EtudeAccueilRow]; 'update:scope': [scope: AccueilScope] }>()

const shown = computed(() => props.data.queue.filter((group) => group.total))
const wait = (row: EtudeAccueilRow) => waitLabel({ status: row.status, echeance: row.echeance, is_late: row.retard, idle_days: row.idle_days })
const fiche = (row: EtudeAccueilRow) => ({ name: 'Etude', params: { id: row.name } })
</script>

<template>
	<section class="card accueil-queue">
		<div class="accueil-card-head">
			<h2 class="accueil-title">{{ scope === 'mine' ? 'Mes études' : "File de l'équipe" }}</h2>
			<span class="accueil-count tabular-nums">{{ data.counts[scope] }}</span>
			<div class="accueil-scope" role="group" aria-label="Périmètre de la file">
				<button type="button" :class="scope === 'team' && 'is-on'" :aria-pressed="scope === 'team'" @click="emit('update:scope', 'team')">Toute l'équipe</button>
				<button type="button" :class="scope === 'mine' && 'is-on'" :aria-pressed="scope === 'mine'" @click="emit('update:scope', 'mine')">À moi <span class="tabular-nums">{{ data.counts.mine }}</span></button>
			</div>
			<RouterLink class="accueil-pill" :to="{ name: 'Etudes' }">Tout voir</RouterLink>
		</div>
		<p v-if="!shown.length" class="accueil-empty">{{ scope === 'mine' ? "Aucune étude ouverte ne vous est attribuée." : "Aucune étude n'attend ici." }}</p>
		<div v-for="group in shown" :key="group.key">
			<div class="accueil-group">
				<h3>{{ etudeGroupTitle(group.key, data.can_conclude).title }}</h3>
				<b class="accueil-group-count tabular-nums">{{ group.total }}</b>
				<span>{{ etudeGroupTitle(group.key, data.can_conclude).hint }}</span>
			</div>
			<div v-for="row in group.rows" :key="row.name" class="accueil-row">
				<span v-if="row.urgence && row.urgence !== 'U0'" class="urgence accueil-urgence" :class="`urgence-${row.urgence}`">{{ row.urgence }}</span>
				<span v-else class="accueil-urgence-quiet">U0</span>
				<div class="accueil-row-main">
					<div class="accueil-row-line">
						<RouterLink class="ref-link font-semibold tabular-nums" :to="fiche(row)">{{ row.name }}</RouterLink>
						<span :title="row.client_label">{{ row.client_label }}</span>
					</div>
					<p class="accueil-row-sub" :title="etudeRowDetail(row, data.both)">
						{{ etudeRowDetail(row, data.both) }}<span class="accueil-row-who-inline">, {{ row.assigne ? `attribuée à ${row.assigne}` : 'non attribuée' }}</span>
					</p>
				</div>
				<div class="accueil-row-who" :class="!row.assigne && 'is-none'" :title="row.assigne ?? 'Non attribuée'">
					<span class="accueil-initials" aria-hidden="true">{{ row.assigne ? initials(row.assigne) : '' }}</span>
					<span class="truncate">{{ row.assigne ?? 'Non attribuée' }}</span>
				</div>
				<div class="accueil-row-state">
					<StatusPill :status="row.status" />
					<span class="accueil-row-sub" :class="row.retard && 'is-late'">{{ wait(row) }}</span>
				</div>
				<div class="accueil-row-action">
					<button v-if="row.action.kind === 'run'" type="button" class="btn-secondary accueil-action" :disabled="busy === row.name" @click="emit('run', row)">
						<LucideLoader v-if="busy === row.name" class="h-3.5 w-3.5 flex-none" aria-hidden="true" />
						<LucidePlay v-else class="h-3.5 w-3.5 flex-none" aria-hidden="true" />
						{{ row.action.label }}
					</button>
					<RouterLink v-else class="accueil-action" :class="row.action.kind === 'link' ? 'btn-secondary' : 'btn accueil-action-quiet'" :to="fiche(row)">
						<LucideArrowRight class="h-3.5 w-3.5 flex-none" aria-hidden="true" />
						{{ row.action.label }}
					</RouterLink>
				</div>
			</div>
			<RouterLink v-if="group.total > group.rows.length" class="accueil-more" :to="{ name: 'Etudes' }">{{ group.total - group.rows.length }} autres dans la liste des études</RouterLink>
		</div>
	</section>
</template>
