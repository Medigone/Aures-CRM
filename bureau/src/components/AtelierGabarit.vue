<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { createGabarit, previewGabarit } from '@/lib/api'
import { cotesOf, GABARITS, gabaritPaths, mm, type GabaritApercu, type GabaritModele } from '@/lib/atelier'

/** Un gabarit standard à partir des cotes : on le voit avant de le calculer, puis l'atelier le lit comme un tracé. */
const props = defineProps<{ cotations?: string | null; support?: string | null }>()
const emit = defineEmits<{ uploaded: [url: string] }>()

const modele = ref<GabaritModele>('A20')
const [l0, w0, h0] = cotesOf(props.cotations)
const longueur = ref(l0)
const largeur = ref(w0)
const hauteur = ref(h0)
const apercu = ref<GabaritApercu | null>(null)
const error = ref('')
const busy = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

const values = computed(() => ({ modele: modele.value, longueur: Number(longueur.value), largeur: Number(largeur.value), hauteur: Number(hauteur.value), support: props.support ?? null }))
const complete = computed(() => values.value.longueur > 0 && values.value.largeur > 0 && values.value.hauteur > 0)
const paths = computed(() => (apercu.value ? gabaritPaths(apercu.value) : null))

function refresh() {
	if (timer) clearTimeout(timer)
	if (!complete.value) {
		apercu.value = null
		return
	}
	const asked = JSON.stringify(values.value)
	timer = setTimeout(async () => {
		try {
			const response = await previewGabarit(values.value)
			if (JSON.stringify(values.value) !== asked) return
			apercu.value = response
			error.value = ''
		} catch (e) {
			apercu.value = null
			error.value = (e as Error).message
		}
	}, 250)
}
watch(values, refresh, { immediate: true })
onBeforeUnmount(() => timer && clearTimeout(timer))

async function use() {
	if (!complete.value || busy.value) return
	busy.value = true
	error.value = ''
	try {
		emit('uploaded', (await createGabarit(values.value)).file_url)
	} catch (e) {
		error.value = (e as Error).message
	} finally {
		busy.value = false
	}
}
</script>

<template>
	<div class="atelier-gabarit">
		<div class="atelier-gabarit-models" role="radiogroup" aria-label="Modèle d'étui">
			<label v-for="option in GABARITS" :key="option.value" class="atelier-gabarit-model" :data-on="modele === option.value">
				<input v-model="modele" type="radio" name="gabarit-modele" :value="option.value" class="sr-only" />
				<b>{{ option.label }}</b><small>{{ option.hint }}</small>
			</label>
		</div>
		<div class="atelier-gabarit-cotes">
			<label class="form-field"><span class="field-label">Longueur L (mm)</span><input v-model="longueur" class="field-input tabular-nums" type="number" min="10" step="0.5" /></label>
			<label class="form-field"><span class="field-label">Largeur l (mm)</span><input v-model="largeur" class="field-input tabular-nums" type="number" min="10" step="0.5" /></label>
			<label class="form-field"><span class="field-label">Hauteur H (mm)</span><input v-model="hauteur" class="field-input tabular-nums" type="number" min="10" step="0.5" /></label>
		</div>
		<p v-if="cotations" class="m-0 text-sm text-ink-gray-6">Prérempli avec les cotes de l'article : {{ cotations.replace(/x/g, ' × ') }} mm.</p>
		<figure v-if="paths && apercu" class="atelier-gabarit-preview">
			<svg :viewBox="`0 0 ${paths.width} ${paths.height}`" role="img" :aria-label="`Gabarit ${modele}, développé ${mm(apercu.developpe_l)} par ${mm(apercu.developpe_d)} millimètres`">
				<path class="etude-sheet-cut-line" :d="paths.coupe" />
				<path class="etude-sheet-crease" :d="paths.rainage" />
			</svg>
			<figcaption class="tabular-nums">Développé {{ mm(apercu.developpe_l) }} × {{ mm(apercu.developpe_d) }} mm · carton {{ mm(apercu.epaisseur) }} mm</figcaption>
		</figure>
		<p v-else-if="!complete" class="m-0 text-sm text-ink-gray-6">Indiquez les trois cotes pour voir le gabarit.</p>
		<p class="m-0 rounded-control tone-amber px-3 py-2 text-sm">Gabarit standard, sans les encoches ni les arrondis du vrai tracé : il sert à comparer des formats et à chiffrer, pas à fabriquer. L'imposition se crée à partir du vrai tracé.</p>
		<p v-if="error" role="alert" class="field-error m-0">{{ error }}</p>
		<div class="flex justify-end"><button type="button" class="btn-primary" :disabled="!complete || !apercu || busy" @click="use">Utiliser ce gabarit</button></div>
	</div>
</template>
