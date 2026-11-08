<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { proposeFormats } from '@/lib/api'
import { byCritere, costLabel, CRITERES_FORMAT, defaultMaxFormat, fibreFeuilleLabel, gridLabel, mm, percentLabel, plainComparison, presseAlert, sameSheet, sheetLabel, sheetsFor, sheetsLabel, tonnageFor, tonnageLabel, type AtelierFormat, type AtelierPresse, type AtelierReglages, type CritereFormat, type Proposition, type Scenario } from '@/lib/atelier'

/**
 * Le sens inverse des formats cochés : à partir du tracé, la feuille idéale parmi les formats standards du support,
 * palettes, bobines entières et bobines refendues. C'est l'utilisateur qui choisit le critère ; on montre le gagnant
 * de chacun pour comparer. Rien n'est enregistré tant qu'il ne garde pas la feuille.
 */
const props = defineProps<{ calcul: string; formats: AtelierFormat[]; reglages: AtelierReglages; grammage: number; presse?: AtelierPresse | null; current: Scenario | null; enabled: boolean; canSeeCosts: boolean }>()
const emit = defineEmits<{ pick: [row: Scenario] }>()

// Sans presse, le format maxi se saisit ; on garde le dernier saisi sur ce poste, pour ne pas le retaper.
const MEMO = 'atelier-format-maxi'
function remembered() {
	try {
		const saved = JSON.parse(localStorage.getItem(MEMO) ?? 'null')
		return saved?.laize > 0 && saved?.depl > 0 ? saved : null
	} catch {
		return null
	}
}
const start = defaultMaxFormat(props.presse) ?? remembered()
const laizeMax = ref(start ? String(start.laize) : '')
const deplMax = ref(start ? String(start.depl) : '')
const critere = ref<CritereFormat>('matiere')
const lignes = ref<Proposition[] | null>(null)
const result = ref<{ cout: string | null; refente: boolean; recoupe: boolean; formats: number } | null>(null)
const error = ref('')
const loading = ref(false)
let lastRequest = 0

// Un autre calcul, ou d'autres réglages : l'ancienne proposition ne vaut plus.
watch(() => [props.calcul, props.enabled], () => {
	lignes.value = null
	result.value = null
	error.value = ''
})

async function propose() {
	const request = ++lastRequest
	error.value = ''
	loading.value = true
	if (!props.presse) {
		try {
			localStorage.setItem(MEMO, JSON.stringify({ laize: Number(laizeMax.value), depl: Number(deplMax.value) }))
		} catch {
			// Navigation privée : on le retapera.
		}
	}
	try {
		const { quantite, lisiere, pince, marge_arriere, refente_rive, refente_bandes_max, refente_laize_min, recoupe_morceaux_max, recoupe_rognage } = props.reglages
		const formats = props.formats.map(({ coche: _coche, ...row }) => row)
		const response = await proposeFormats(props.calcul, { laize_max: laizeMax.value, depl_max: deplMax.value, formats: JSON.stringify(formats), quantite, lisiere, pince, marge_arriere, refente_rive, refente_bandes_max, refente_laize_min, recoupe_morceaux_max, recoupe_rognage })
		if (request !== lastRequest) return
		lignes.value = response.lignes
		result.value = { cout: response.cout?.presse ?? null, refente: response.refente, recoupe: response.recoupe, formats: response.formats }
		if (!response.lignes.some((row) => row.criteres.includes(critere.value))) critere.value = 'matiere'
		const winner = rows.value[0]?.row
		if (winner) emit('pick', winner)
		else error.value = response.formats ? 'Aucun format du support ne reçoit une pose sous ce format maxi.' : "Le support n'a aucun format : ajoutez ses palettes et ses bobines."
	} catch (e) {
		if (request === lastRequest) error.value = (e as Error).message
	} finally {
		if (request === lastRequest) loading.value = false
	}
}

// Un critère qu'aucune feuille ne gagne ne se propose pas : pas de coût de passage, ou rien sans transformation.
const options = computed(() => CRITERES_FORMAT.filter((option) => lignes.value?.some((row) => row.criteres.includes(option.value))))
const rows = computed(() => (lignes.value ? byCritere(lignes.value, critere.value) : []))
const chosen = computed(() => rows.value[0] ?? null)
const plain = computed(() => lignes.value?.find((row) => row.criteres.includes('sans_transformation')))
const comparison = computed(() => (chosen.value && critere.value !== 'sans_transformation' ? plainComparison(chosen.value.row, plain.value, props.reglages.quantite, props.grammage) : ''))
const showCost = computed(() => props.canSeeCosts && Boolean(result.value?.cout))
const notes = computed(() => {
	if (!result.value) return []
	const list: string[] = []
	if (!result.value.refente) list.push('Refente non proposée : indiquez ses réglages dans la colonne de gauche, sous « Refente ».')
	if (!result.value.recoupe) list.push('Recoupe au massicot non proposée : indiquez ses réglages dans la colonne de gauche, sous « Massicot ».')
	if (props.canSeeCosts && !result.value.cout) list.push('Coût complet indisponible : il faut une étude dont la presse prévue a son coût par 1 000 feuilles, et un prix matière.')
	if (props.canSeeCosts && result.value.cout) list.push(`Coût complet : matière et passages sur ${result.value.cout}, sans gâche, découpe, débobinage ni massicot.`)
	return list
})
function choose(value: CritereFormat) {
	critere.value = value
	const winner = rows.value[0]?.row
	if (winner) emit('pick', winner)
}
/** Ce qu'une feuille transformée consomme : de la bobine en laize, ou un morceau de palette. */
const boughtLabel = (row: Proposition) => (row.origine === 'Bobine refendue' ? `${mm(row.laize_achat)} mm de bobine par feuille` : `${mm(row.laize_achat)} × ${mm(row.depl_achat)} de palette par feuille`)
const shownHere = (row: Proposition) => Boolean(props.current && sameSheet(props.current, row))
</script>

<template>
	<details class="atelier-cuts atelier-propose">
		<summary>Proposer un format</summary>
		<p class="m-0 mb-2 text-sm text-ink-gray-6">La meilleure feuille pour ce tracé parmi les formats du support : palettes entières ou recoupées, bobines entières ou refendues. Les chutes comptent tout ce qui est acheté. Rien n'est enregistré.</p>
		<div class="atelier-sim-row">
			<label class="form-field"><span class="field-label">Laize maxi</span><input v-model="laizeMax" class="field-input tabular-nums" type="number" min="0" placeholder="mm" :disabled="!enabled" /></label>
			<label class="form-field"><span class="field-label">Dépl. maxi</span><input v-model="deplMax" class="field-input tabular-nums" type="number" min="0" placeholder="mm" :disabled="!enabled" /></label>
			<button type="button" class="btn-secondary" :disabled="!enabled || loading || !laizeMax || !deplMax" @click="propose">{{ loading ? 'Recherche…' : lignes ? 'Proposer à nouveau' : 'Proposer' }}</button>
		</div>
		<p v-if="!enabled" class="m-0 mt-2 text-sm text-ink-gray-6">Les propositions s'ouvrent une fois le tracé lu, et après un nouveau calcul si les réglages ont changé.</p>
		<p v-else-if="!presse && !lignes" class="m-0 mt-2 text-sm text-ink-gray-6">Le format maxi est celui de la presse{{ laizeMax ? '' : ' : indiquez-le' }}.</p>
		<p v-if="enabled && error" role="alert" class="field-error m-0 mt-2">{{ error }}</p>

		<template v-if="lignes?.length">
			<div class="atelier-criteres" role="radiogroup" aria-label="Critère du format idéal">
				<button v-for="option in options" :key="option.value" type="button" role="radio" class="atelier-critere" :aria-checked="critere === option.value" :title="option.hint" @click="choose(option.value)">{{ option.label }}</button>
			</div>
			<p v-if="chosen" class="atelier-propose-best">
				<b>{{ chosen.row.libelle }}</b>
				<span class="tabular-nums"> · {{ chosen.row.nb_poses }} poses, {{ percentLabel(chosen.row.taux_chutes) }} de chutes<template v-if="reglages.quantite">, {{ sheetsLabel(sheetsFor(chosen.row, reglages.quantite)) }} feuilles</template></span>
				<span v-if="comparison" class="block text-ink-gray-7">{{ comparison }}</span>
				<span v-else-if="critere !== 'sans_transformation' && !chosen.row.laize_achat && (result?.refente || result?.recoupe)" class="block text-ink-gray-7">Ni refente ni recoupe ne font mieux sous ce format maxi.</span>
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
								<div class="text-sm text-ink-gray-6">{{ item.row.origine }}<template v-if="item.row.laize_achat">, {{ boughtLabel(item.row) }}</template><template v-if="item.row.fibre_feuille">, {{ fibreFeuilleLabel(item.row.fibre_feuille) }}</template></div>
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
		</template>
		<p v-for="note in notes" :key="note" class="m-0 text-sm text-ink-gray-6">{{ note }}</p>
	</details>
</template>
