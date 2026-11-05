<script setup lang="ts">
import LucideTrash from '~icons/lucide/trash-2'
import PantoneInput from './PantoneInput.vue'
import { CMJN_CHANNELS, newTeinte, teinteHex, type ArticleTeinte } from '@/lib/articles'

/** Saisie des couleurs d'un article. Dès qu'une ligne existe, le serveur en déduit l'impression et le nombre de couleurs. */
const lines = defineModel<ArticleTeinte[]>({ required: true })
const emit = defineEmits<{ error: [message: string] }>()

function update(index: number, patch: Partial<ArticleTeinte>) {
	lines.value = lines.value.map((line, at) => (at === index ? { ...line, ...patch } : line))
}
function percent(event: Event) {
	return Math.min(100, Math.max(0, Math.round(Number((event.target as HTMLInputElement).value) || 0)))
}
</script>

<template>
	<div class="color-inputs">
		<div v-for="(line, index) in lines" :key="line.key" class="color-input" :class="line.type_couleur === 'CMJN' && 'color-input-cmjn'">
			<span class="color-swatch color-swatch-lg" :class="!teinteHex(line) && 'color-swatch-none'" :style="teinteHex(line) ? { background: teinteHex(line)! } : undefined" aria-hidden="true"></span>
			<PantoneInput v-if="line.type_couleur === 'Pantone'" :model-value="line" :input-id="`pantone-${line.key}`" @update:model-value="lines = lines.map((item, at) => (at === index ? $event : item))" @error="emit('error', $event)" />
			<div v-else class="color-channels">
				<label v-for="channel in CMJN_CHANNELS" :key="channel" class="color-channel">
					<span>{{ channel.toUpperCase() }}</span>
					<input :value="line[channel]" class="field-input tabular-nums" type="number" min="0" max="100" step="1" :aria-label="`${channel.toUpperCase()} en pourcentage`" @input="update(index, { [channel]: percent($event) })" />
				</label>
			</div>
			<input :value="line.nom" class="field-input color-input-name" placeholder="Nom (facultatif)" autocomplete="off" aria-label="Nom de la couleur" @input="update(index, { nom: ($event.target as HTMLInputElement).value })" />
			<button type="button" class="comment-tool flex-none" aria-label="Retirer cette couleur" title="Retirer cette couleur" @click="lines = lines.filter((_, at) => at !== index)"><LucideTrash class="h-3.5 w-3.5" aria-hidden="true" /></button>
		</div>
		<div class="flex flex-wrap gap-2">
			<button type="button" class="btn-secondary" @click="lines = [...lines, newTeinte('Pantone')]">Ajouter un Pantone</button>
			<button type="button" class="btn-secondary" @click="lines = [...lines, newTeinte('CMJN')]">Ajouter une teinte CMJN</button>
		</div>
		<p v-if="lines.length" class="color-note">Aperçu indicatif, le nuancier fait foi. L'impression et le nombre de couleurs se déduisent de ces lignes.</p>
	</div>
</template>
