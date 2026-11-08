<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import LucideArrowLeft from '~icons/lucide/arrow-left'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import FormDialog from '@shared/components/FormDialog.vue'
import MoreMenu from '@shared/components/MoreMenu.vue'
import StatusPill from '@shared/components/StatusPill.vue'
import AppToast from './AppToast.vue'
import AtelierCoupes from './AtelierCoupes.vue'
import AtelierDepot from './AtelierDepot.vue'
import AtelierExport from './AtelierExport.vue'
import AtelierFeuille from './AtelierFeuille.vue'
import AtelierPaliers from './AtelierPaliers.vue'
import AtelierReferences from './AtelierReferences.vue'
import AtelierReglages from './AtelierReglages.vue'
import RecordHeader from './RecordHeader.vue'
import { allQuantities, commonCutLabel, isGabarit, costLabel, materialCost, rankForQuantity, fileLabel, formatDay, gridLabel, isPdf, mm, motifLabel, percentLabel, pitchLabel, replacementText, scenarioAlerts, setPendingNotice, sheetLabel, sheetsFor, sheetsLabel, tabLabel, tonnageFor, tonnageLabel, type AtelierReference, type Scenario, type ScenarioSort } from '@/lib/atelier'
import { formatQuantity } from '@/lib/etudes'
import { useAtelier } from '@/lib/useAtelier'

/** L'atelier d'imposition : depuis une étude pour créer son imposition, ou en test rapide, sans étude ni workflow. */
const props = defineProps<{ etude?: string; calcul?: string }>()
const router = useRouter()

const state = useAtelier(() => ({ etude: props.etude, calcul: props.calcul }), (name) => router.replace({ name: 'AtelierTest', params: { calcul: name } }))
const { data, calcul, reglages, formats, support, grammage, fichier, stale, essais, shown, retained, error, loadError, busy, simError, rows, sheets, current, retainedRow, running, failed, canWork, canCreate, canSimulate, readable, roll, sort, direction } = state

const dialog = ref<'depot' | 'export' | 'creer' | null>(null)
const notice = ref('')
const etude = computed(() => data.value?.etude ?? null)
const quantite = computed(() => reglages.value?.quantite ?? 0)
const quantities = computed(() => allQuantities(quantite.value, reglages.value?.paliers ?? []))
const prixTonne = computed(() => reglages.value?.prix_tonne ?? 0)
// La quantité choisie dans la carte des paliers : le tableau se trie et se compte pour elle.
const palier = ref<number | null>(null)
const shownQty = computed(() => (palier.value && quantities.value.includes(palier.value) ? palier.value : quantite.value))
const tableRows = computed(() => (shownQty.value !== quantite.value ? rankForQuantity(rows.value, shownQty.value) : rows.value))
function pickTier(value: number) {
	palier.value = value === quantite.value ? null : value
}
const hasTrace = computed(() => Boolean(fichier.value))
// Un gabarit standard compare des formats ; l'imposition, elle, se crée à partir du vrai tracé.
const gabarit = computed(() => isGabarit(fichier.value))
// Sans tracé lisible ni dépôt, l'écran n'a rien à montrer d'autre que le dépôt.
const blank = computed(() => !etude.value && !calcul.value)
const status = computed(() => {
	if (running.value) return { label: 'En cours', tone: 'orange' as const }
	if (failed.value) return { label: 'Échec', tone: 'red' as const }
	if (hasTrace.value && !readable.value) return { label: 'Tracé illisible', tone: 'orange' as const }
	if (rows.value.length) return { label: 'Terminé', tone: 'green' as const }
	return calcul.value ? { label: 'Tracé lu', tone: 'blue' as const } : null
})
const canRun = computed(() => canWork.value && readable.value && !running.value && !busy.value)
const fresh = computed(() => rows.value.length > 0 && !stale.value)
const readOnlyNote = computed(() => {
	if (!data.value || canWork.value) return ''
	if (!data.value.droits.calculer) return 'Votre rôle lit ce calcul sans pouvoir le relancer ni créer d\'imposition.'
	if (etude.value?.status === 'Nouveau') return "Démarrez l'étude pour calculer et créer son imposition."
	return 'Cette étude est conclue : son atelier se lit seulement.'
})
const maxRate = computed(() => Math.max(1, ...rows.value.map((row) => row.taux_chutes)))
const silhouette = computed(() => calcul.value?.silhouette ?? null)
const lisiere = computed(() => calcul.value?.bornes?.lisiere || reglages.value?.lisiere || 0)
const pince = computed(() => calcul.value?.bornes?.pince || reglages.value?.pince || 0)
const marge = computed(() => calcul.value?.bornes?.marge_arriere || reglages.value?.marge_arriere || 0)
const isEssai = (row: Scenario) => Boolean(row.cle)
const currentEssai = computed(() => (current.value && isEssai(current.value) ? current.value : null))

const sim = ref({ laize: '', depl: '' })
function sortMark(key: ScenarioSort) {
	return sort.value === key ? (direction.value === 1 ? ' ↑' : ' ↓') : ''
}
async function onUploaded(url: string) {
	dialog.value = null
	if (await state.useFile(url)) notice.value = isGabarit(url) ? 'Gabarit lu. Cochez des formats et calculez.' : isPdf(url) ? `Tracé lu : ${fileLabel(url)}.` : ''
}
function onAddFormat(laize: string, depl: string, bobine: boolean, done: (error: string) => void) {
	done(state.addFormat(laize, depl, bobine))
}
async function create() {
	const row = retainedRow.value
	const created = await state.createImposition()
	dialog.value = null
	if (!created || !etude.value || !row) return
	setPendingNotice(`Imposition ${created.imposition} créée et liée. Taux de chutes : ${percentLabel(created.taux_chutes)}.`)
	router.push({ name: 'Etude', params: { id: etude.value.name } })
}
function openHistorique(name: string) {
	if (etude.value) state.load(name)
	else router.push({ name: 'AtelierTest', params: { calcul: name } })
}
async function startFrom(row: AtelierReference) {
	const done = await state.startFrom(row)
	if (done === 'format') notice.value = `Format ${row.format} ajouté aux formats à comparer. Lancez le calcul.`
}
async function copyLink() {
	await navigator.clipboard?.writeText(window.location.href)
	notice.value = 'Lien copié.'
}
</script>

<template>
	<main class="bureau-main">
		<div v-if="loadError" role="alert" class="card p-3.5 text-tone-red">
			{{ loadError }}
			<button type="button" class="ml-1 font-semibold underline" @click="state.load()">Réessayer</button>
		</div>
		<div v-else-if="!data || !reglages" class="card p-8 text-center text-ink-gray-6">Chargement de l'atelier…</div>

		<template v-else>
			<RouterLink v-if="etude" class="atelier-back" :to="{ name: 'Etude', params: { id: etude.name } }"><LucideArrowLeft aria-hidden="true" />Étude {{ etude.name }}</RouterLink>
			<RecordHeader>
				<template #title>{{ etude ? "Atelier d'imposition" : 'Test rapide' }}</template>
				<template #flags>
					<StatusPill v-if="status" :status="status.label" :tone="status.tone" />
					<StatusPill v-if="stale" status="Recalcul requis" tone="amber" />
				</template>
				<template #sub>
					<template v-if="etude"><span>{{ etude.designation }}</span><span>{{ etude.client_label }}</span><span class="tabular-nums">{{ formatQuantity(etude.quantite) }} ex.</span></template>
					<span v-else>Atelier d'imposition, sans étude ni workflow. Un test ne crée pas d'imposition.</span>
				</template>
				<template #actions>
					<button v-if="canWork && !blank" type="button" :class="fresh ? 'btn-secondary' : 'btn-primary'" :disabled="!canRun" @click="state.run()">Calculer</button>
					<button v-if="canCreate" type="button" :class="fresh ? 'btn-primary' : 'btn-secondary'" :disabled="!retainedRow || stale || busy || gabarit" :title="gabarit ? 'Déposez le vrai tracé : un gabarit standard ne crée pas d\'imposition' : retainedRow ? undefined : 'Retenez une ligne du tableau'" @click="dialog = 'creer'">Créer l'imposition</button>
					<MoreMenu>
						<button type="button" class="app-menu-item" role="menuitem" @click="copyLink">Copier le lien</button>
						<a class="app-menu-item" role="menuitem" href="/app/atelier-imposition" target="_blank" rel="noopener noreferrer"><LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />Ouvrir sur le Desk</a>
					</MoreMenu>
				</template>
			</RecordHeader>

			<p v-if="error" role="alert" class="flex-none rounded-control tone-red px-3.5 py-2.5">{{ error }}</p>
			<p v-if="gabarit" class="flex-none rounded-control tone-amber px-3.5 py-2.5">Gabarit standard tiré des cotes : bon pour comparer des formats et chiffrer. Déposez le vrai tracé avant de créer l'imposition.</p>
			<p v-if="readOnlyNote" class="flex-none rounded-control tone-blue px-3.5 py-2.5">{{ readOnlyNote }}</p>

			<!-- Test rapide : on commence par un tracé. -->
			<div v-if="blank" class="atelier-blank">
				<section class="card ref-card">
					<div class="ref-card-head"><h3>Tester un produit</h3></div>
					<template v-if="canWork">
						<p class="m-0">Déposez son tracé, indiquez une quantité et des formats : l'atelier donne les poses, les chutes et les feuilles, sans passer par une demande ni une étude.</p>
						<AtelierDepot note="Le test reste dans vos derniers tests. Il ne touche à aucun article ni aucune étude." :support="support" @uploaded="onUploaded" />
					</template>
					<p v-else class="m-0 text-ink-gray-6">Votre rôle lit les calculs sans pouvoir en lancer.</p>
				</section>
				<section class="card ref-card">
					<div class="ref-card-head"><h3>Vos derniers tests</h3></div>
					<p v-if="!data.historique.length" class="m-0 text-ink-gray-6">Aucun test pour l'instant.</p>
					<ul v-else class="atelier-tests">
						<li v-for="row in data.historique" :key="row.name">
							<button type="button" @click="openHistorique(row.name)">
								<span class="min-w-0"><b>{{ fileLabel(row.fichier_trace) || row.name }}</b><small class="tabular-nums">{{ row.name }} · {{ formatDay(row.creation) }}{{ row.quantite ? ` · ${formatQuantity(row.quantite)} ex.` : '' }}</small></span>
								<StatusPill :status="row.statut_calcul || 'Non lancé'" />
							</button>
						</li>
					</ul>
				</section>
			</div>

			<div v-else class="atelier-grid">
				<AtelierReglages :data="data" :calcul="calcul" :reglages="reglages" :formats="formats" :support="support" :fichier="fichier" :readable="readable" :can-work="canWork" @changed="state.changed()" @depot="dialog = 'depot'" @support="state.chooseSupport" @add-format="onAddFormat" />

				<div class="atelier-center">
					<AtelierReferences v-if="data.references" :references="data.references" :can-start="canWork" :can-simulate="canSimulate" @start="startFrom" />
					<AtelierPaliers v-if="!running && !stale && rows.length && quantities.length > 1" :rows="sheets" :quantities="quantities" :principale="quantite" :tier-tag="etude ? 'étude' : 'test'" :grammage="grammage" :prix-tonne="prixTonne" :selected="palier" @pick="pickTier" @show="(row) => (shown = state.keyOf(row))" />
					<section class="card atelier-results" aria-label="Résultats du calcul">
						<div v-if="running" class="atelier-state" role="status">
							<span class="atelier-spin" aria-hidden="true"></span>
							<b>Calcul en cours</b>
							<p>Il tourne en arrière-plan, quelques secondes en général. Vous pouvez quitter cette page : le résultat vous attendra ici.</p>
						</div>
						<div v-else-if="failed" class="atelier-state" role="alert">
							<b>Le calcul a échoué</b>
							<p class="whitespace-pre-line">{{ (calcul?.log_calcul ?? '').split('\n').filter((line) => line.startsWith('ÉCHEC')).join('\n').replace(/^ÉCHEC : /, '') || 'Le journal en dit plus.' }}</p>
							<button v-if="canRun" type="button" class="btn-secondary" @click="state.run()">Relancer le calcul</button>
						</div>
						<div v-else-if="!readable" class="atelier-state">
							<b>{{ hasTrace ? 'Ce tracé ne peut pas être calculé' : 'Aucun fichier de tracé' }}</b>
							<p>L'atelier lit un PDF de tracé Esko : noir pour la coupe, rouge pour le rainage. Déposez-le ici pour ce calcul, ou joignez-le au tracé depuis la fiche de l'étude.</p>
							<button v-if="canWork" type="button" class="btn-primary" @click="dialog = 'depot'">Déposer un PDF</button>
						</div>
						<div v-else-if="!sheets.length" class="atelier-state">
							<b>{{ calcul ? 'Tracé lu, rien de calculé' : 'Rien de calculé pour cette étude' }}</b>
							<p>{{ formats.filter((row) => row.coche).length }} format{{ formats.filter((row) => row.coche).length > 1 ? 's' : '' }} à comparer. Le calcul donne pour chacun les poses, les chutes, les feuilles et le tonnage.</p>
							<button v-if="canRun" type="button" class="btn-primary" @click="state.run()">Calculer</button>
						</div>

						<template v-if="!running && !failed && sheets.length">
							<p v-if="stale" class="atelier-alert atelier-alert-top" data-tone="amber">Réglages modifiés : ces résultats ne les prennent pas en compte. Relancez le calcul.</p>
							<div class="atelier-tabs">
								<div class="atelier-tabs-list" role="group" aria-label="Feuilles à comparer">
									<button v-for="row in sheets" :key="state.keyOf(row)" type="button" class="atelier-tab tabular-nums" :data-essai="isEssai(row)" :aria-pressed="current === row" @click="shown = state.keyOf(row)">{{ tabLabel(row) }}<template v-if="isEssai(row)"> · essai</template></button>
								</div>
								<button type="button" class="btn-secondary" @click="dialog = 'export'">Télécharger</button>
							</div>
							<div v-if="current" class="atelier-view">
								<AtelierFeuille v-if="silhouette" :scenario="current" :silhouette="silhouette" :lisiere="lisiere" :pince="pince" :marge="marge" />
								<div class="atelier-stats">
									<h4>{{ current.libelle }}</h4>
									<div class="atelier-rate tabular-nums">{{ percentLabel(current.taux_chutes) }}<small>de chutes</small></div>
									<dl class="atelier-facts">
										<div><dt>Feuille</dt><dd>{{ sheetLabel(current) }}</dd></div>
										<div><dt>Poses</dt><dd>{{ current.nb_poses }} ({{ current.n_col }} × {{ current.n_rang }})</dd></div>
										<div><dt>Disposition</dt><dd>{{ motifLabel(current) }}</dd></div>
										<div><dt>Pas</dt><dd>{{ pitchLabel(current) }}</dd></div>
										<div><dt>Trait commun</dt><dd>{{ commonCutLabel(current) }}</dd></div>
										<div><dt>Reste</dt><dd>{{ mm(current.reste_laize) }} × {{ mm(current.reste_depl) }}</dd></div>
										<div><dt>Surface / pose</dt><dd>{{ mm(current.surface_par_pose) }} cm²</dd></div>
										<div><dt>Feuilles<template v-if="shownQty !== quantite"> ({{ formatQuantity(shownQty) }} ex.)</template></dt><dd>{{ sheetsLabel(sheetsFor(current, shownQty)) }}</dd></div>
										<div><dt>Tonnage</dt><dd>{{ tonnageLabel(tonnageFor(current, shownQty, grammage)) }}</dd></div>
										<div v-if="prixTonne"><dt>Coût matière</dt><dd>{{ costLabel(materialCost(current, shownQty, grammage, prixTonne)) }}</dd></div>
									</dl>
									<p v-for="alert in scenarioAlerts(current, etude?.presse)" :key="alert.text" class="atelier-alert" :data-tone="alert.tone">{{ alert.text }}</p>
								</div>
							</div>
							<AtelierCoupes v-if="roll && canSimulate && calcul && reglages" :calcul="calcul.name" :roll="roll" :current="current" :reglages="reglages" :grammage="grammage" :presse="etude?.presse" @pick="state.showCut" />
							<div v-if="rows.length" class="atelier-table-wrap" :data-stale="stale">
								<table class="atelier-table">
									<thead>
										<tr>
											<th v-if="canCreate"><span class="sr-only">Retenue</span></th>
											<th>Format ou scénario</th>
											<th>Origine</th>
											<th class="end"><button type="button" @click="state.setSort('nb_poses')">Poses{{ sortMark('nb_poses') }}</button></th>
											<th class="end">Grille</th>
											<th class="end"><button type="button" @click="state.setSort('taux_chutes')">Chutes{{ sortMark('taux_chutes') }}</button></th>
											<th class="end">Feuilles<template v-if="shownQty !== quantite"> · {{ formatQuantity(shownQty) }} ex.</template></th>
											<th class="end">Tonnage</th>
											<th v-if="prixTonne" class="end">Coût matière</th>
										</tr>
									</thead>
									<tbody>
										<tr v-for="row in tableRows" :key="state.keyOf(row)" :data-retained="row.idx === retained" @click="state.retain(row)">
											<td v-if="canCreate"><input type="radio" name="atelier-retenu" :aria-label="`Retenir ${row.libelle}`" :checked="row.idx === retained" /></td>
											<td>
												<div class="font-medium text-ink-gray-9">{{ row.libelle }}</div>
												<div class="text-sm tabular-nums text-ink-gray-6">{{ sheetLabel(row) }}</div>
												<div v-if="scenarioAlerts(row, etude?.presse).some((alert) => alert.tone === 'red')" class="atelier-row-alert">{{ scenarioAlerts(row, etude?.presse).find((alert) => alert.tone === 'red')?.text }}</div>
											</td>
											<td>{{ row.origine }}</td>
											<td class="end">{{ row.nb_poses }}</td>
											<td class="end">{{ gridLabel(row) }}</td>
											<td class="end"><span class="atelier-rate-bar"><i><b :style="{ width: `${(row.taux_chutes / maxRate) * 100}%` }"></b></i>{{ percentLabel(row.taux_chutes) }}</span></td>
											<td class="end">{{ sheetsLabel(sheetsFor(row, shownQty)) }}</td>
											<td class="end">{{ tonnageLabel(tonnageFor(row, shownQty, grammage)) }}</td>
											<td v-if="prixTonne" class="end">{{ costLabel(materialCost(row, shownQty, grammage, prixTonne)) }}</td>
										</tr>
									</tbody>
								</table>
							</div>
							<p v-if="shownQty !== quantite" class="atelier-hint">Trié du moins cher au plus cher en matière pour {{ formatQuantity(shownQty) }} ex. <button type="button" class="underline" @click="palier = null">Revenir à {{ formatQuantity(quantite) }} ex.</button></p>
							<p v-if="rows.length" class="atelier-hint">{{ canCreate ? "Cliquez sur une ligne pour la retenir. Aucune n'est recommandée : c'est vous qui retenez." : "Cliquez sur une ligne pour voir sa feuille. Aucune n'est recommandée." }}</p>
						</template>

						<div class="atelier-sim">
							<div class="atelier-sim-row">
								<label class="form-field"><span class="field-label">Laize</span><input v-model="sim.laize" class="field-input tabular-nums" type="number" min="0" :disabled="!canSimulate" /></label>
								<label class="form-field"><span class="field-label">Déplacement</span><input v-model="sim.depl" class="field-input tabular-nums" type="number" min="0" :disabled="!canSimulate" /></label>
								<button type="button" class="btn-secondary" :disabled="!canSimulate || !sim.laize || !sim.depl" @click="state.tryFormat(sim.laize, sim.depl)">Essayer ce format</button>
							</div>
							<p v-if="simError" role="alert" class="field-error m-0">{{ simError }}</p>
							<p v-else-if="currentEssai" class="m-0 text-sm text-ink-gray-7">
								{{ currentEssai.libelle }} : {{ currentEssai.nb_poses }} poses, {{ percentLabel(currentEssai.taux_chutes) }} de chutes. Rien n'est enregistré.
								<button v-if="canWork" type="button" class="btn-secondary ml-1" :disabled="busy" @click="state.keep(currentEssai)">Garder ce scénario</button>
							</p>
							<p v-else class="m-0 text-sm text-ink-gray-6">{{ canSimulate ? 'Essayez un format sans rien enregistrer.' : stale ? 'Relancez le calcul pour essayer un format.' : 'Les essais s\'ouvrent une fois le tracé lu.' }}</p>
						</div>
					</section>

					<section class="card atelier-foot">
						<details>
							<summary>{{ etude ? 'Historique de cette étude' : 'Vos derniers tests' }}</summary>
							<div class="atelier-table-wrap">
								<table class="atelier-table atelier-history">
									<thead><tr><th>Calcul</th><th>Date</th><th>Statut</th><th>Développé</th><th>Imposition créée</th></tr></thead>
									<tbody>
										<tr v-for="row in data.historique" :key="row.name" :data-retained="row.name === calcul?.name" @click="openHistorique(row.name)">
											<td class="tabular-nums">{{ row.name }}</td>
											<td class="tabular-nums">{{ formatDay(row.creation) }}</td>
											<td>{{ row.statut_calcul || 'Non lancé' }}</td>
											<td class="tabular-nums">{{ row.developpe_l ? `${mm(row.developpe_l)} × ${mm(row.developpe_d)}` : '—' }}</td>
											<td class="tabular-nums">{{ row.imposition_creee || 'Aucune' }}</td>
										</tr>
									</tbody>
								</table>
							</div>
						</details>
						<details :open="failed">
							<summary>Journal du calcul</summary>
							<pre class="atelier-journal">{{ calcul?.log_calcul || 'Aucun calcul pour l\'instant.' }}</pre>
						</details>
					</section>
				</div>
			</div>

			<FormDialog v-if="dialog === 'depot'" title="Tracé de ce calcul" :dirty="false" hint="" @close="dialog = null">
				<AtelierDepot :cotations="etude?.cotations" :support="support" :note="etude ? `Ce PDF sert à ce calcul seulement. Le fichier du tracé ${etude.trace ?? ''} ne change pas.` : 'Il remplace le PDF de ce test.'" @uploaded="onUploaded" />
			</FormDialog>
			<AtelierExport v-if="dialog === 'export' && calcul" :calcul="calcul.name" :sheets="sheets" :current="current" @close="dialog = null" />
			<FormDialog v-if="dialog === 'creer' && retainedRow && etude" title="Créer cette imposition ?" :dirty="false" hint="" :busy="busy" @close="dialog = null" @submit="create">
				<p class="m-0"><b class="font-semibold text-ink-gray-9">{{ retainedRow.libelle }}</b> : {{ retainedRow.nb_poses }} poses sur {{ sheetLabel(retainedRow) }} mm, {{ percentLabel(retainedRow.taux_chutes) }} de chutes, {{ sheetsLabel(sheetsFor(retainedRow, quantite)) }} feuilles.</p>
				<p class="rounded-control tone-amber px-3 py-2 text-sm">{{ replacementText(etude) }}</p>
				<p class="m-0 text-ink-gray-6">Le PDF d'imposition est généré à la création. Cette imposition pourra devenir l'idéale et être reprise par les prochains calculs de devis.</p>
				<template #actions><button type="button" class="btn-primary" :disabled="busy" @click="create">Créer et lier à l'étude</button></template>
			</FormDialog>
		</template>
		<AppToast :message="notice" tone="success" @close="notice = ''" />
	</main>
</template>
