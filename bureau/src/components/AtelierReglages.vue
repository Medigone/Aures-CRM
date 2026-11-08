<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatQuantity } from '@/lib/etudes'
import { allQuantities, dimensionsLabel, recoupeSummary, refenteSummary, FIBRE_TRACE_OPTIONS, fibreRotation, fileLabel, formatFibre, mm, MOTIF_OPTIONS, motifsSummary, parseQuantities, type AtelierCalcul, type AtelierData, type AtelierFormat, type AtelierReglages } from '@/lib/atelier'

/** La barre des réglages : un bouton par étape, qui ouvre son tiroir. Le tracé, les quantités, la matière, les formats, puis les réglages du moteur. */
const props = defineProps<{ data: AtelierData; calcul: AtelierCalcul | null; reglages: AtelierReglages; formats: AtelierFormat[]; support: string | null; fichier: string | null; readable: boolean; canWork: boolean; grammage: number }>()
const emit = defineEmits<{ changed: []; depot: []; grammage: [value: number]; support: [name: string]; 'add-format': [laize: string, depl: string, bobine: boolean, done: (error: string) => void] }>()

const laize = ref('')
const depl = ref('')
const bobine = ref(false)
const formatError = ref('')
function add() {
	emit('add-format', laize.value, depl.value, bobine.value, (error) => {
		formatError.value = error
		if (!error) {
			laize.value = ''
			depl.value = ''
		}
	})
}
// Paliers et prix ne touchent pas au moteur : la carte des paliers se recalcule aussitôt, sans relancer le calcul.
// Une quantité à la fois, ajoutée par Entrée ou « Ajouter » ; une liste collée passe aussi.
const palier = ref('')
const paliersError = ref('')
watch(() => props.reglages, () => {
	palier.value = ''
	paliersError.value = ''
})
function addPalier() {
	const parsed = parseQuantities(palier.value)
	if (typeof parsed === 'string') {
		paliersError.value = parsed
		return
	}
	if (!parsed.length) {
		paliersError.value = 'Indiquez une quantité.'
		return
	}
	const next = [...new Set([...(props.reglages.paliers ?? []), ...parsed])].filter((value) => value !== props.reglages.quantite).sort((a, b) => a - b)
	if (next.length > 8) {
		paliersError.value = 'Huit quantités au plus.'
		return
	}
	paliersError.value = ''
	props.reglages.paliers = next
	palier.value = ''
}
function removePalier(value: number) {
	props.reglages.paliers = (props.reglages.paliers ?? []).filter((other) => other !== value)
}
function setGrammage(event: Event) {
	const value = Number((event.target as HTMLInputElement).value)
	emit('grammage', Number.isFinite(value) && value > 0 ? value : 0)
}
function setPrix(event: Event) {
	const value = Number((event.target as HTMLInputElement).value)
	props.reglages.prix_tonne = Number.isFinite(value) && value > 0 ? value : 0
}
// La refente ne sert qu'à proposer un format : la changer ne demande pas de relancer le calcul.
const refente = (key: 'refente_rive' | 'refente_bandes_max' | 'refente_laize_min' | 'recoupe_morceaux_max' | 'recoupe_rognage', event: Event) => {
	const value = Number((event.target as HTMLInputElement).value)
	props.reglages[key] = Number.isFinite(value) && value > 0 ? (key === 'refente_bandes_max' || key === 'recoupe_morceaux_max' ? Math.floor(value) : value) : 0
}
const number = (key: 'pont' | 'lisiere' | 'pince' | 'marge_arriere', event: Event) => {
	const value = Number((event.target as HTMLInputElement).value)
	if (Number.isFinite(value) && value >= 0) {
		props.reglages[key] = value
		emit('changed')
	}
}
// Un tiroir à la fois. Sans tracé lisible, celui du tracé ; sans résultat, celui des formats.
type Drawer = 'trace' | 'quantites' | 'matiere' | 'formats' | 'reglages'
const open = ref<Drawer | null>(!props.readable ? 'trace' : !props.calcul?.scenarios?.length ? 'formats' : null)
function toggle(key: Drawer) {
	open.value = open.value === key ? null : key
}
const checked = computed(() => props.formats.filter((row) => row.coche).length)
const buttons = computed<{ key: Drawer; label: string; value: string; alert?: boolean }[]>(() => [
	{
		key: 'trace',
		label: props.data.etude?.trace ? `Tracé ${props.data.etude.trace}` : 'Tracé',
		value: props.calcul?.developpe_l ? `${dimensionsLabel(`${props.calcul.developpe_l}x${props.calcul.developpe_d}`)} mm` : props.fichier ? fileLabel(props.fichier) : 'Aucun fichier',
		alert: Boolean(props.fichier && !props.readable) || !props.fichier,
	},
	{ key: 'quantites', label: 'Quantités', value: allQuantities(props.reglages.quantite, props.reglages.paliers ?? []).map(formatQuantity).join(' · ') || 'À saisir', alert: !props.reglages.quantite },
	{
		key: 'matiere',
		label: 'Matière',
		value: [props.support ?? (props.grammage ? '' : props.data.etude ? 'Sans support' : 'Grammage à saisir'), props.grammage ? `${mm(props.grammage)} g/m²` : '', props.data.droits.couts && props.reglages.prix_tonne ? `${formatQuantity(props.reglages.prix_tonne)} DA/t` : ''].filter(Boolean).join(' · '),
	},
	{ key: 'formats', label: props.support ? `Formats du support` : 'Formats', value: checked.value ? `${checked.value} coché${checked.value > 1 ? 's' : ''} sur ${props.formats.length}` : 'Aucun coché', alert: !checked.value },
	{ key: 'reglages', label: 'Réglages', value: `Pont ${mm(props.reglages.pont)} mm · ${motifsSummary(props.reglages.motifs)}` },
])
/** La fibre en trois lettres sur la ligne du format ; une bobine l'a en déplacement sauf mention contraire. */
const FIBRES = [
	{ value: 'En laize', short: 'L', label: 'Fibre en laize' },
	{ value: 'En déplacement', short: 'D', label: 'Fibre en déplacement' },
	{ value: '', short: '?', label: 'Fibre inconnue' },
]
function setFibre(row: AtelierFormat, value: string) {
	if (formatFibre(row) === value) return
	row.fibre = value
	emit('changed')
}
</script>

<template>
	<section class="card atelier-bar" aria-label="Réglages de l'atelier">
		<div class="atelier-bar-buttons">
			<button v-for="item in buttons" :key="item.key" type="button" class="atelier-bar-button" :aria-expanded="open === item.key" aria-controls="atelier-drawer" :data-alert="item.alert || undefined" @click="toggle(item.key)">
				<small>{{ item.label }}</small>
				<span class="tabular-nums">{{ item.value }}</span>
			</button>
		</div>

		<div v-if="open" id="atelier-drawer" class="atelier-drawer">
			<template v-if="open === 'trace'">
				<div class="atelier-drawer-col">
					<a v-if="fichier" class="atelier-file" :href="fichier" target="_blank" rel="noopener noreferrer">{{ fileLabel(fichier) }}</a>
					<p v-else class="m-0 text-ink-gray-6">Aucun fichier.</p>
					<p v-if="fichier && !readable" class="atelier-alert" data-tone="red">Ce fichier n'est pas un PDF : le moteur ne peut pas le lire.</p>
					<button v-if="canWork" type="button" class="self-start" :class="readable ? 'btn-secondary' : 'btn-primary'" @click="emit('depot')">Déposer un autre PDF</button>
				</div>
				<dl v-if="calcul?.developpe_l" class="atelier-facts atelier-drawer-col">
					<div><dt>Développé</dt><dd>{{ dimensionsLabel(`${calcul.developpe_l}x${calcul.developpe_d}`) }} mm</dd></div>
					<div><dt>Surface utile</dt><dd>{{ mm(calcul.surface_utile) }} cm²</dd></div>
					<div><dt>Remplissage</dt><dd>{{ mm(calcul.remplissage_bbox) }} %</dd></div>
				</dl>
			</template>

			<template v-else-if="open === 'quantites'">
				<label class="form-field atelier-drawer-narrow">
					<span class="field-label">Quantité {{ data.etude ? "de l'étude" : 'du test' }}</span>
					<input v-model.number="reglages.quantite" class="field-input tabular-nums" type="number" min="0" step="1" :disabled="Boolean(data.etude) || !canWork" />
				</label>
				<div class="form-field atelier-drawer-col">
					<span class="field-label" id="atelier-paliers">Autres quantités</span>
					<ul v-if="reglages.paliers?.length" class="atelier-chips" aria-labelledby="atelier-paliers">
						<li v-for="value in reglages.paliers" :key="value" class="atelier-chip tabular-nums">
							{{ formatQuantity(value) }}
							<button v-if="canWork" type="button" :aria-label="`Retirer ${formatQuantity(value)}`" @click="removePalier(value)">×</button>
						</li>
					</ul>
					<div v-if="canWork" class="atelier-add-format">
						<input v-model="palier" class="field-input tabular-nums" type="text" inputmode="numeric" placeholder="20 000" aria-label="Quantité à comparer" @keydown.enter.prevent="addPalier" />
						<button type="button" class="btn-secondary" :disabled="!palier.trim()" @click="addPalier">Ajouter</button>
					</div>
					<small v-if="paliersError" role="alert" class="field-error">{{ paliersError }}</small>
					<small v-else class="text-sm text-ink-gray-6">Chaque quantité devient un bouton au-dessus des feuilles, sans relancer le calcul.</small>
				</div>
			</template>

			<template v-else-if="open === 'matiere'">
				<label v-if="!data.etude" class="form-field atelier-drawer-col">
					<span class="field-label">Support</span>
					<select class="field-input" :value="support ?? ''" :disabled="!canWork" @change="emit('support', ($event.target as HTMLSelectElement).value)">
						<option value="">Aucun, formats à la main</option>
						<option v-for="row in data.supports" :key="row.value" :value="row.value">{{ row.label }}</option>
					</select>
				</label>
				<div v-else class="form-field atelier-drawer-col">
					<span class="field-label">Support de l'étude</span>
					<span class="atelier-value">{{ support ?? 'Aucun' }}{{ grammage ? `, ${mm(grammage)} g/m²` : '' }}</span>
				</div>
				<label v-if="!data.etude && !support" class="form-field atelier-drawer-narrow">
					<span class="field-label">Grammage (g/m²)</span>
					<input class="field-input tabular-nums" type="number" min="0" step="1" :value="grammage || ''" placeholder="À saisir" :disabled="!canWork" @change="setGrammage" />
				</label>
				<label v-if="data.droits.couts" class="form-field atelier-drawer-narrow">
					<span class="field-label">Prix matière (DA la tonne)</span>
					<input class="field-input tabular-nums" type="number" min="0" step="1000" :value="reglages.prix_tonne || ''" placeholder="Non renseigné" :disabled="!canWork" @change="setPrix" />
				</label>
				<p class="atelier-drawer-note">{{ !grammage ? 'Sans support ni grammage, ni tonnage ni coût : les feuilles se comparent au carton.' : data.droits.couts && !reglages.prix_tonne ? 'Sans prix, les feuilles se comparent au carton.' : data.droits.couts ? 'Le grammage donne le tonnage, le prix le coût matière.' : 'Le grammage donne le tonnage.' }}</p>
			</template>

			<template v-else-if="open === 'formats'">
				<div class="atelier-drawer-wide">
					<p v-if="data.etude" class="m-0 mb-2 text-sm text-ink-gray-6">Presse de l'étude : {{ data.etude.presse?.nom ?? 'aucune' }}</p>
					<p v-if="!formats.length" class="m-0 text-sm text-ink-gray-6">Aucun format pour l'instant. Ajoutez-en un.</p>
					<ul v-else class="atelier-format-list">
						<li v-for="row in formats" :key="`${row.laize}-${row.depl}-${row.bobine}`" class="atelier-format-row">
							<label class="atelier-check">
								<input v-model="row.coche" type="checkbox" :disabled="!canWork" @change="emit('changed')" />
								<span>{{ row.libelle }}<small v-if="row.coche && fibreRotation(reglages.fibre_trace, formatFibre(row))">{{ fibreRotation(reglages.fibre_trace, formatFibre(row)) }}</small></span>
							</label>
							<span class="atelier-fibre" role="group" :aria-label="`Fibre de la feuille ${row.libelle}`">
								<button v-for="option in FIBRES.filter((option) => !row.bobine || option.value)" :key="option.value" type="button" :title="option.label" :aria-label="option.label" :aria-pressed="formatFibre(row) === option.value" :disabled="!canWork" @click="setFibre(row, option.value)">{{ option.short }}</button>
							</span>
						</li>
					</ul>
				</div>
				<div v-if="canWork" class="atelier-drawer-wide atelier-format-new">
					<div class="atelier-add-format">
						<input v-model="laize" class="field-input tabular-nums" type="text" inputmode="decimal" placeholder="Laize" aria-label="Laize du format à ajouter" />
						<input v-model="depl" class="field-input tabular-nums" type="text" inputmode="decimal" :placeholder="bobine ? 'Max' : 'Dépl.'" :aria-label="bobine ? 'Longueur maximale de coupe' : 'Déplacement du format à ajouter'" />
						<button type="button" class="btn-secondary" @click="add">Ajouter</button>
					</div>
					<label class="atelier-check"><input v-model="bobine" type="checkbox" /><span>Bobine<small v-if="bobine">Laize fixe. Indiquez le maximum de coupe que la presse accepte.</small></span></label>
					<p v-if="formatError" role="alert" class="field-error m-0">{{ formatError }}</p>
				</div>
			</template>

			<template v-else-if="open === 'reglages'">
				<fieldset class="atelier-drawer-group">
					<legend>Pose</legend>
					<div class="atelier-rail-grid">
						<label class="form-field"><span class="field-label">Pont mini (mm)</span><input class="field-input tabular-nums" type="number" min="0" step="0.1" :value="reglages.pont" :disabled="!canWork" @change="number('pont', $event)" /></label>
						<label class="form-field"><span class="field-label">Fibre sur le tracé</span><select v-model="reglages.fibre_trace" class="field-input" title="Le sens que la boîte exige, sur le tracé tel qu'il est dessiné. Avec la fibre de chaque format, il donne la rotation de pose." :disabled="!canWork" @change="emit('changed')"><option v-for="option in FIBRE_TRACE_OPTIONS" :key="option">{{ option }}</option></select></label>
						<label v-if="reglages.sens_fibre && reglages.sens_fibre !== 'Libre'" class="form-field atelier-rail-wide"><span class="field-label">Rotation imposée partout (ancien réglage)</span><select v-model="reglages.sens_fibre" class="field-input" :disabled="!canWork" @change="emit('changed')"><option>Libre</option><option>0°</option><option>90°</option></select><small>Mettez-la sur Libre pour que la fibre de chaque format décide.</small></label>
						<label class="form-field atelier-rail-wide" title="Une pose sur deux retournée ou décalée pour emboîter les rabats. « Aligné seulement » garde des filets continus d'un bord à l'autre.">
							<span class="field-label">Tête-bêche et quinconce</span>
							<select v-model="reglages.motifs" class="field-input" :disabled="!canWork" @change="emit('changed')"><option v-for="option in MOTIF_OPTIONS" :key="option">{{ option }}</option></select>
						</label>
						<label class="form-field"><span class="field-label">Lisière (mm)</span><input class="field-input tabular-nums" type="number" min="0" step="0.1" :value="reglages.lisiere" :disabled="!canWork" @change="number('lisiere', $event)" /></label>
						<label class="form-field"><span class="field-label">Pince (mm)</span><input class="field-input tabular-nums" type="number" min="0" step="0.1" :value="reglages.pince" :disabled="!canWork" @change="number('pince', $event)" /></label>
						<label class="form-field"><span class="field-label">Marge arrière (mm)</span><input class="field-input tabular-nums" type="number" min="0" step="0.1" :value="reglages.marge_arriere" :disabled="!canWork" @change="number('marge_arriere', $event)" /></label>
						<label class="atelier-check atelier-check-inline"><input type="checkbox" :checked="Boolean(reglages.trait_commun)" :disabled="!canWork" @change="reglages.trait_commun = Number(($event.target as HTMLInputElement).checked); emit('changed')" />Trait commun</label>
					</div>
				</fieldset>
				<fieldset class="atelier-drawer-group">
					<legend>Refente <small>{{ refenteSummary(reglages) }}</small></legend>
					<div class="atelier-rail-grid">
						<label class="form-field"><span class="field-label">Bandes au plus</span><input class="field-input tabular-nums" type="number" min="0" step="1" :value="reglages.refente_bandes_max || ''" placeholder="Aucune" :disabled="!canWork" @change="refente('refente_bandes_max', $event)" /></label>
						<label class="form-field"><span class="field-label">Rive (mm)</span><input class="field-input tabular-nums" type="number" min="0" step="0.5" :value="reglages.refente_rive || ''" placeholder="0" :disabled="!canWork" @change="refente('refente_rive', $event)" /></label>
						<label class="form-field atelier-rail-wide"><span class="field-label">Laize de bande mini (mm)</span><input class="field-input tabular-nums" type="number" min="0" step="1" :value="reglages.refente_laize_min || ''" placeholder="Sans minimum" :disabled="!canWork" @change="refente('refente_laize_min', $event)" /></label>
						<small class="atelier-rail-wide">Le débobinage coupe une bobine en bandes égales ; la rive, rognée de chaque côté, compte en chute. Sert au format idéal.</small>
					</div>
				</fieldset>
				<fieldset class="atelier-drawer-group">
					<legend>Massicot <small>{{ recoupeSummary(reglages) }}</small></legend>
					<div class="atelier-rail-grid">
						<label class="form-field"><span class="field-label">Morceaux au plus</span><input class="field-input tabular-nums" type="number" min="0" step="1" :value="reglages.recoupe_morceaux_max || ''" placeholder="Aucun" :disabled="!canWork" @change="refente('recoupe_morceaux_max', $event)" /></label>
						<label class="form-field"><span class="field-label">Rognage (mm)</span><input class="field-input tabular-nums" type="number" min="0" step="0.5" :value="reglages.recoupe_rognage || ''" placeholder="0" :disabled="!canWork" @change="refente('recoupe_rognage', $event)" /></label>
						<small class="atelier-rail-wide">Le massicot recoupe une feuille de palette en morceaux égaux ; le rognage, pris sur chaque bord, compte en chute. Sert au format idéal.</small>
					</div>
				</fieldset>
			</template>
		</div>
	</section>
</template>
