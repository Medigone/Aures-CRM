<script setup lang="ts">
import { ref, watch } from 'vue'
import { formatQuantity } from '@/lib/etudes'
import { dimensionsLabel, FIBRE_FEUILLE_OPTIONS, recoupeSummary, refenteSummary, FIBRE_TRACE_OPTIONS, fibreRotation, fibreSummary, fileLabel, formatFibre, mm, MOTIF_OPTIONS, motifsSummary, parseQuantities, type AtelierCalcul, type AtelierData, type AtelierFormat, type AtelierReglages } from '@/lib/atelier'

/** Colonne de gauche : le tracé, la quantité, les formats à comparer et les réglages du moteur. */
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
</script>

<template>
	<aside class="card atelier-rail" aria-label="Réglages de l'atelier">
		<div class="atelier-rail-section">
			<h4>{{ data.etude?.trace ? `Tracé ${data.etude.trace}` : 'Tracé' }}</h4>
			<a v-if="fichier" class="atelier-file" :href="fichier" target="_blank" rel="noopener noreferrer">{{ fileLabel(fichier) }}</a>
			<p v-else class="m-0 text-ink-gray-6">Aucun fichier.</p>
			<p v-if="fichier && !readable" class="atelier-alert" data-tone="red">Ce fichier n'est pas un PDF : le moteur ne peut pas le lire.</p>
			<dl v-if="calcul?.developpe_l" class="atelier-facts">
				<div><dt>Développé</dt><dd>{{ dimensionsLabel(`${calcul.developpe_l}x${calcul.developpe_d}`) }} mm</dd></div>
				<div><dt>Surface utile</dt><dd>{{ mm(calcul.surface_utile) }} cm²</dd></div>
				<div><dt>Remplissage</dt><dd>{{ mm(calcul.remplissage_bbox) }} %</dd></div>
			</dl>
			<button v-if="canWork" type="button" :class="readable ? 'btn-secondary' : 'btn-primary'" @click="emit('depot')">Déposer un autre PDF</button>
		</div>
		<div class="atelier-rail-section atelier-rail-grid">
			<label class="form-field">
				<span class="field-label">Quantité</span>
				<input v-model.number="reglages.quantite" class="field-input tabular-nums" type="number" min="0" step="1" :disabled="Boolean(data.etude) || !canWork" />
			</label>
			<div v-if="data.etude" class="form-field">
				<span class="field-label">Presse de l'étude</span>
				<span class="atelier-value">{{ data.etude.presse?.nom ?? 'Aucune' }}</span>
			</div>
			<div class="form-field atelier-rail-wide">
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
				<small v-else>Le gagnant de chaque quantité, sans relancer le calcul.</small>
			</div>
			<label v-if="!data.etude && !support" class="form-field atelier-rail-wide">
				<span class="field-label">Grammage (g/m²)</span>
				<input class="field-input tabular-nums" type="number" min="0" step="1" :value="grammage || ''" placeholder="Sans support, à saisir" :disabled="!canWork" @change="setGrammage" />
				<small>{{ data.droits.couts ? 'Il donne le tonnage et le coût matière.' : 'Il donne le tonnage.' }}</small>
			</label>
			<label v-if="data.droits.couts" class="form-field atelier-rail-wide">
				<span class="field-label">Prix matière (DA la tonne)</span>
				<input class="field-input tabular-nums" type="number" min="0" step="1000" :value="reglages.prix_tonne || ''" placeholder="Non renseigné" :disabled="!canWork" @change="setPrix" />
				<small>{{ !grammage ? 'Indiquez un support ou un grammage : sans lui, ni tonnage ni coût.' : reglages.prix_tonne ? 'Départage les quantités au coût matière.' : 'Sans prix, les quantités se départagent au tonnage.' }}</small>
			</label>
		</div>
		<div class="atelier-rail-section">
			<label v-if="!data.etude" class="form-field">
				<span class="field-label">Support</span>
				<select class="field-input" :value="support ?? ''" :disabled="!canWork" @change="emit('support', ($event.target as HTMLSelectElement).value)">
					<option value="">Aucun, formats à la main</option>
					<option v-for="row in data.supports" :key="row.value" :value="row.value">{{ row.label }}</option>
				</select>
			</label>
			<h4>{{ support ? `Formats du support ${support}` : 'Formats à comparer' }}</h4>
			<p v-if="!formats.length" class="m-0 text-sm text-ink-gray-6">Aucun format pour l'instant. Ajoutez-en un.</p>
			<div v-for="row in formats" :key="`${row.laize}-${row.depl}-${row.bobine}`" class="atelier-format-row">
				<label class="atelier-check">
					<input v-model="row.coche" type="checkbox" :disabled="!canWork" @change="emit('changed')" />
					<span>{{ row.libelle }}<small v-if="row.coche && fibreRotation(reglages.fibre_trace, formatFibre(row))">{{ fibreRotation(reglages.fibre_trace, formatFibre(row)) }}</small></span>
				</label>
				<select v-model="row.fibre" class="field-input atelier-fibre" :aria-label="`Fibre de la feuille ${row.libelle}`" :disabled="!canWork" @change="emit('changed')">
					<option v-for="option in FIBRE_FEUILLE_OPTIONS" :key="option.value" :value="option.value">{{ option.value === '' && row.bobine ? 'Fibre en déplacement' : option.label }}</option>
				</select>
			</div>
			<div v-if="canWork" class="atelier-add-format">
				<input v-model="laize" class="field-input tabular-nums" type="text" inputmode="decimal" placeholder="Laize" aria-label="Laize du format à ajouter" />
				<input v-model="depl" class="field-input tabular-nums" type="text" inputmode="decimal" :placeholder="bobine ? 'Max' : 'Dépl.'" :aria-label="bobine ? 'Longueur maximale de coupe' : 'Déplacement du format à ajouter'" />
				<button type="button" class="btn-secondary" @click="add">Ajouter</button>
			</div>
			<label v-if="canWork" class="atelier-check"><input v-model="bobine" type="checkbox" /><span>Bobine<small v-if="bobine">Laize fixe. Indiquez le maximum de coupe que la presse accepte.</small></span></label>
			<p v-if="formatError" role="alert" class="field-error">{{ formatError }}</p>
		</div>
		<details class="atelier-rail-section">
			<summary>Réglages : pont {{ mm(reglages.pont) }} mm, {{ fibreSummary(reglages.fibre_trace) }}, {{ motifsSummary(reglages.motifs) }}</summary>
			<div class="atelier-rail-grid">
				<label class="form-field"><span class="field-label">Pont mini (mm)</span><input class="field-input tabular-nums" type="number" min="0" step="0.1" :value="reglages.pont" :disabled="!canWork" @change="number('pont', $event)" /></label>
				<label class="form-field"><span class="field-label">Fibre sur le tracé</span><select v-model="reglages.fibre_trace" class="field-input" :disabled="!canWork" @change="emit('changed')"><option v-for="option in FIBRE_TRACE_OPTIONS" :key="option">{{ option }}</option></select></label>
				<p class="atelier-rail-wide m-0 text-sm text-ink-gray-6">Le sens que la boîte exige, sur le tracé tel qu'il est dessiné. Avec la fibre de chaque format, il donne la rotation de pose format par format.</p>
				<label v-if="reglages.sens_fibre && reglages.sens_fibre !== 'Libre'" class="form-field atelier-rail-wide"><span class="field-label">Rotation imposée partout (ancien réglage)</span><select v-model="reglages.sens_fibre" class="field-input" :disabled="!canWork" @change="emit('changed')"><option>Libre</option><option>0°</option><option>90°</option></select><small>Mettez-la sur Libre pour que la fibre de chaque format décide.</small></label>
				<label class="form-field atelier-rail-wide">
					<span class="field-label">Tête-bêche et quinconce</span>
					<select v-model="reglages.motifs" class="field-input" :disabled="!canWork" @change="emit('changed')"><option v-for="option in MOTIF_OPTIONS" :key="option">{{ option }}</option></select>
					<small>Une pose sur deux retournée ou décalée pour emboîter les rabats. « Aligné seulement » garde des filets continus d'un bord à l'autre.</small>
				</label>
				<label class="form-field"><span class="field-label">Lisière (mm)</span><input class="field-input tabular-nums" type="number" min="0" step="0.1" :value="reglages.lisiere" :disabled="!canWork" @change="number('lisiere', $event)" /></label>
				<label class="form-field"><span class="field-label">Pince (mm)</span><input class="field-input tabular-nums" type="number" min="0" step="0.1" :value="reglages.pince" :disabled="!canWork" @change="number('pince', $event)" /></label>
				<label class="form-field"><span class="field-label">Marge arrière (mm)</span><input class="field-input tabular-nums" type="number" min="0" step="0.1" :value="reglages.marge_arriere" :disabled="!canWork" @change="number('marge_arriere', $event)" /></label>
				<label class="atelier-check atelier-check-inline"><input type="checkbox" :checked="Boolean(reglages.trait_commun)" :disabled="!canWork" @change="reglages.trait_commun = Number(($event.target as HTMLInputElement).checked); emit('changed')" />Trait commun</label>
			</div>
		</details>
		<details class="atelier-rail-section">
			<summary>Refente : {{ refenteSummary(reglages) }}</summary>
			<div class="atelier-rail-grid">
				<p class="atelier-rail-wide m-0 text-sm text-ink-gray-6">Le débobinage coupe une bobine en bandes égales. Ces réglages servent à proposer un format ; sans eux, la refente n'est pas proposée.</p>
				<label class="form-field"><span class="field-label">Bandes au plus</span><input class="field-input tabular-nums" type="number" min="0" step="1" :value="reglages.refente_bandes_max || ''" placeholder="Aucune" :disabled="!canWork" @change="refente('refente_bandes_max', $event)" /></label>
				<label class="form-field"><span class="field-label">Rive (mm)</span><input class="field-input tabular-nums" type="number" min="0" step="0.5" :value="reglages.refente_rive || ''" placeholder="0" :disabled="!canWork" @change="refente('refente_rive', $event)" /></label>
				<label class="form-field atelier-rail-wide"><span class="field-label">Laize de bande mini (mm)</span><input class="field-input tabular-nums" type="number" min="0" step="1" :value="reglages.refente_laize_min || ''" placeholder="Sans minimum" :disabled="!canWork" @change="refente('refente_laize_min', $event)" /><small>La rive est rognée de chaque côté de la bobine, et comptée en chute.</small></label>
			</div>
		</details>
		<details class="atelier-rail-section">
			<summary>Massicot : {{ recoupeSummary(reglages) }}</summary>
			<div class="atelier-rail-grid">
				<p class="atelier-rail-wide m-0 text-sm text-ink-gray-6">Le massicot recoupe une feuille de palette en morceaux égaux, en laize, en déplacement ou les deux. Sans ces réglages, la recoupe n'est pas proposée.</p>
				<label class="form-field"><span class="field-label">Morceaux au plus</span><input class="field-input tabular-nums" type="number" min="0" step="1" :value="reglages.recoupe_morceaux_max || ''" placeholder="Aucun" :disabled="!canWork" @change="refente('recoupe_morceaux_max', $event)" /></label>
				<label class="form-field"><span class="field-label">Rognage (mm)</span><input class="field-input tabular-nums" type="number" min="0" step="0.5" :value="reglages.recoupe_rognage || ''" placeholder="0" :disabled="!canWork" @change="refente('recoupe_rognage', $event)" /></label>
				<small class="atelier-rail-wide">Le rognage est pris sur chaque bord de la feuille, et compté en chute.</small>
			</div>
		</details>
	</aside>
</template>
