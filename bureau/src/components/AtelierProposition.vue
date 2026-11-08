<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { proposeFormats } from '@/lib/api'
import { byCritere, costLabel, CRITERES_FORMAT, defaultMaxFormat, fibreFeuilleLabel, gridLabel, PAS_FOURNISSEUR, percentLabel, presseAlert, sameSheet, sheetLabel, sheetsFor, sheetsLabel, stockComparison, tonnageFor, tonnageLabel, type AtelierFormat, type AtelierPresse, type AtelierReglages, type CritereFormat, type Proposition, type Scenario } from '@/lib/atelier'

/**
 * Le sens inverse des formats cochés : à partir du tracé, la feuille idéale. C'est l'utilisateur qui choisit le
 * critère ; on montre le gagnant de chacun pour comparer, rien n'est enregistré tant qu'il ne garde pas la feuille.
 */
const props = defineProps<{ calcul: string; formats: AtelierFormat[]; reglages: AtelierReglages; grammage: number; presse?: AtelierPresse | null; current: Scenario | null; enabled: boolean; canSeeCosts: boolean }>()
const emit = defineEmits<{ pick: [row: Scenario] }>()

const start = defaultMaxFormat(props.presse, props.formats)
const laizeMax = ref(String(start.laize))
const deplMax = ref(String(start.depl))
const pas = ref<number>(10)
const critere = ref<CritereFormat>('matiere')
const lignes = ref<Proposition[] | null>(null)
const coutPresse = ref<string | null>(null)
const error = ref('')
const loading = ref(false)
let lastRequest = 0

// Un autre calcul, ou d'autres réglages : l'ancienne proposition ne vaut plus.
watch(() => [props.calcul, props.enabled], () => {
	lignes.value = null
	error.value = ''
})

async function propose() {
	const request = ++lastRequest
	error.value = ''
	loading.value = true
	try {
		const { quantite, lisiere, pince, marge_arriere } = props.reglages
		const formats = props.formats.map(({ coche: _coche, ...row }) => row)
		const response = await proposeFormats(props.calcul, { laize_max: laizeMax.value, depl_max: deplMax.value, pas: pas.value, formats: JSON.stringify(formats), quantite, lisiere, pince, marge_arriere })
		if (request !== lastRequest) return
		lignes.value = response.lignes
		coutPresse.value = response.cout?.presse ?? null
		if (!response.lignes.some((row) => row.criteres.includes(critere.value))) critere.value = 'matiere'
		const winner = rows.value[0]?.row
		if (winner) emit('pick', winner)
		else error.value = 'Aucune feuille sous ce format maxi ne reçoit une pose.'
	} catch (e) {
		if (request === lastRequest) error.value = (e as Error).message
	} finally {
		if (request === lastRequest) loading.value = false
	}
}

// Un critère qu'aucune feuille ne gagne ne se propose pas : pas de coût de passage, ou aucun format en stock.
const options = computed(() => CRITERES_FORMAT.filter((option) => lignes.value?.some((row) => row.criteres.includes(option.value))))
const rows = computed(() => (lignes.value ? byCritere(lignes.value, critere.value) : []))
const chosen = computed(() => rows.value[0] ?? null)
const stock = computed(() => lignes.value?.find((row) => row.criteres.includes('stock')))
const comparison = computed(() => (chosen.value && critere.value !== 'stock' ? stockComparison(chosen.value.row, stock.value, props.reglages.quantite, props.grammage) : ''))
const noStock = computed(() => Boolean(lignes.value?.length && !stock.value))
const showCost = computed(() => props.canSeeCosts && Boolean(coutPresse.value))
const costNote = computed(() => {
	if (!props.canSeeCosts) return ''
	if (coutPresse.value) return `Coût complet : matière et passages sur ${coutPresse.value}, sans gâche ni découpe.`
	return lignes.value ? 'Coût complet indisponible : il faut une étude dont la presse prévue a son coût par 1 000 feuilles, et un prix matière.' : ''
})
function choose(value: CritereFormat) {
	critere.value = value
	const winner = rows.value[0]?.row
	if (winner) emit('pick', winner)
}
const shownHere = (row: Proposition) => Boolean(props.current && sameSheet(props.current, row))
</script>

<template>
	<details class="atelier-cuts atelier-propose">
		<summary>Proposer un format</summary>
		<p class="m-0 mb-2 text-sm text-ink-gray-6">La feuille idéale pour ce tracé, sous un format maxi, arrondie au pas du fournisseur. Choisissez le critère : rien n'est enregistré.</p>
		<div class="atelier-sim-row">
			<label class="form-field"><span class="field-label">Laize maxi</span><input v-model="laizeMax" class="field-input tabular-nums" type="number" min="0" :disabled="!enabled" /></label>
			<label class="form-field"><span class="field-label">Dépl. maxi</span><input v-model="deplMax" class="field-input tabular-nums" type="number" min="0" :disabled="!enabled" /></label>
			<label class="form-field atelier-propose-pas"><span class="field-label">Arrondi</span><select v-model.number="pas" class="field-input" :disabled="!enabled"><option v-for="value in PAS_FOURNISSEUR" :key="value" :value="value">{{ value }} mm</option></select></label>
			<button type="button" class="btn-secondary" :disabled="!enabled || loading || !laizeMax || !deplMax" @click="propose">{{ loading ? 'Recherche…' : lignes ? 'Proposer à nouveau' : 'Proposer' }}</button>
		</div>
		<p v-if="!enabled" class="m-0 mt-2 text-sm text-ink-gray-6">Les propositions s'ouvrent une fois le tracé lu, et après un nouveau calcul si les réglages ont changé.</p>
		<p v-else-if="error" role="alert" class="field-error m-0 mt-2">{{ error }}</p>

		<template v-if="lignes?.length">
			<div class="atelier-criteres" role="radiogroup" aria-label="Critère du format idéal">
				<button v-for="option in options" :key="option.value" type="button" role="radio" class="atelier-critere" :aria-checked="critere === option.value" :title="option.hint" @click="choose(option.value)">{{ option.label }}</button>
			</div>
			<p v-if="chosen" class="atelier-propose-best">
				<b>{{ chosen.row.libelle }}</b>
				<span class="tabular-nums"> · {{ chosen.row.nb_poses }} poses, {{ percentLabel(chosen.row.taux_chutes) }} de chutes<template v-if="reglages.quantite">, {{ sheetsLabel(sheetsFor(chosen.row, reglages.quantite)) }} feuilles</template></span>
				<span v-if="comparison" class="block text-ink-gray-7">{{ comparison }}</span>
				<span v-else-if="critere !== 'stock' && chosen.row.origine !== 'Sur mesure'" class="block text-ink-gray-7">Le stock suffit : aucune feuille sur mesure ne fait mieux sous ce format maxi.</span>
			</p>
			<div class="atelier-table-wrap">
				<table class="atelier-table">
					<thead>
						<tr>
							<th>Critère</th>
							<th>Feuille</th>
							<th class="end">Grille</th>
							<th class="end">Chutes</th>
							<th class="end">Feuilles</th>
							<th class="end">Tonnage</th>
							<th v-if="showCost" class="end">Coût complet</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="item in rows" :key="item.value" :data-retained="shownHere(item.row)" :aria-label="`Voir la feuille ${sheetLabel(item.row)}`" @click="emit('pick', item.row)">
							<td>
								<div class="font-medium text-ink-gray-9">{{ item.label }}</div>
								<div class="text-sm text-ink-gray-6">{{ item.hint }}</div>
							</td>
							<td>
								<div class="tabular-nums text-ink-gray-9">{{ sheetLabel(item.row) }}</div>
								<div class="text-sm text-ink-gray-6">{{ item.row.origine }}<template v-if="item.row.fibre_feuille">, {{ fibreFeuilleLabel(item.row.fibre_feuille) }}</template></div>
								<div v-if="presseAlert(item.row, presse)" class="atelier-row-alert">Dépasse {{ presse?.nom }}</div>
							</td>
							<td class="end">{{ gridLabel(item.row) }}<template v-if="item.row.rotation"> · {{ item.row.rotation }}°</template></td>
							<td class="end">{{ percentLabel(item.row.taux_chutes) }}</td>
							<td class="end">{{ sheetsLabel(sheetsFor(item.row, reglages.quantite)) }}</td>
							<td class="end">{{ tonnageLabel(tonnageFor(item.row, reglages.quantite, grammage)) }}</td>
							<td v-if="showCost" class="end">{{ costLabel(item.row.cout_complet ?? null) }}</td>
						</tr>
					</tbody>
				</table>
			</div>
			<p class="m-0 mt-1 text-sm text-ink-gray-6">Cliquez sur une ligne pour voir sa feuille, puis gardez-la pour pouvoir la retenir.</p>
			<p v-if="noStock" class="m-0 text-sm text-ink-gray-6">Aucun format du support ne reçoit une pose : pas de comparaison avec le stock.</p>
			<p v-if="costNote" class="m-0 text-sm text-ink-gray-6">{{ costNote }}</p>
		</template>
	</details>
</template>
