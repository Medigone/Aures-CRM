<script setup lang="ts">
import { ref } from 'vue'
import { dimensionsLabel, fileLabel, mm, type AtelierCalcul, type AtelierData, type AtelierFormat, type AtelierReglages } from '@/lib/atelier'

/** Colonne de gauche : le tracé, la quantité, les formats à comparer et les réglages du moteur. */
const props = defineProps<{ data: AtelierData; calcul: AtelierCalcul | null; reglages: AtelierReglages; formats: AtelierFormat[]; support: string | null; fichier: string | null; readable: boolean; canWork: boolean }>()
const emit = defineEmits<{ changed: []; depot: []; support: [name: string]; 'add-format': [laize: string, depl: string, done: (error: string) => void] }>()

const laize = ref('')
const depl = ref('')
const formatError = ref('')
function add() {
	emit('add-format', laize.value, depl.value, (error) => {
		formatError.value = error
		if (!error) {
			laize.value = ''
			depl.value = ''
		}
	})
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
			<label v-for="row in formats" :key="`${row.laize}-${row.depl}-${row.bobine}`" class="atelier-check">
				<input v-model="row.coche" type="checkbox" :disabled="!canWork" @change="emit('changed')" />
				<span>{{ row.libelle }}</span>
			</label>
			<div v-if="canWork" class="atelier-add-format">
				<input v-model="laize" class="field-input tabular-nums" type="text" inputmode="decimal" placeholder="Laize" aria-label="Laize du format à ajouter" />
				<input v-model="depl" class="field-input tabular-nums" type="text" inputmode="decimal" placeholder="Dépl." aria-label="Déplacement du format à ajouter" />
				<button type="button" class="btn-secondary" @click="add">Ajouter</button>
			</div>
			<p v-if="formatError" role="alert" class="field-error">{{ formatError }}</p>
		</div>
		<details class="atelier-rail-section">
			<summary>Réglages : pont {{ mm(reglages.pont) }} mm, fibre {{ reglages.sens_fibre }}</summary>
			<div class="atelier-rail-grid">
				<label class="form-field"><span class="field-label">Pont mini (mm)</span><input class="field-input tabular-nums" type="number" min="0" step="0.1" :value="reglages.pont" :disabled="!canWork" @change="number('pont', $event)" /></label>
				<label class="form-field"><span class="field-label">Sens de fibre</span><select v-model="reglages.sens_fibre" class="field-input" :disabled="!canWork" @change="emit('changed')"><option>Libre</option><option>0°</option><option>90°</option></select></label>
				<label class="form-field"><span class="field-label">Lisière (mm)</span><input class="field-input tabular-nums" type="number" min="0" step="0.1" :value="reglages.lisiere" :disabled="!canWork" @change="number('lisiere', $event)" /></label>
				<label class="form-field"><span class="field-label">Pince (mm)</span><input class="field-input tabular-nums" type="number" min="0" step="0.1" :value="reglages.pince" :disabled="!canWork" @change="number('pince', $event)" /></label>
				<label class="form-field"><span class="field-label">Marge arrière (mm)</span><input class="field-input tabular-nums" type="number" min="0" step="0.1" :value="reglages.marge_arriere" :disabled="!canWork" @change="number('marge_arriere', $event)" /></label>
				<label class="atelier-check atelier-check-inline"><input type="checkbox" :checked="Boolean(reglages.trait_commun)" :disabled="!canWork" @change="reglages.trait_commun = Number(($event.target as HTMLInputElement).checked); emit('changed')" />Trait commun</label>
			</div>
		</details>
	</aside>
</template>
