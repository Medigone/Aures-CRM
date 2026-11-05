<script setup lang="ts">
import { computed, ref } from 'vue'
import LucideInfo from '~icons/lucide/info'
import FormDialog from '@shared/components/FormDialog.vue'
import { addSousArticle } from '@/lib/api'
import type { ArticleDetail } from '@/lib/articles'

/** Nouveau sous-article : il reprend la fiche de son article parent, comme sur le Desk. */
const props = defineProps<{ article: ArticleDetail }>()
const emit = defineEmits<{ close: []; created: [article: ArticleDetail, name: string] }>()

const designation = ref('')
const quantite = ref('1')
const error = ref('')
const busy = ref(false)
const dirty = computed(() => Boolean(designation.value.trim()) || quantite.value !== '1')

async function submit() {
	if (busy.value) return
	error.value = ''
	const quantity = Number(quantite.value)
	if (!designation.value.trim()) {
		error.value = 'Saisissez la désignation du sous-article.'
		return
	}
	if (!(quantity > 0)) {
		error.value = 'Saisissez une quantité supérieure à zéro.'
		return
	}
	busy.value = true
	try {
		const result = await addSousArticle(props.article, designation.value.trim(), quantity)
		emit('created', result.article, result.name)
		emit('close')
	} catch (e) {
		error.value = (e as Error).message
	} finally {
		busy.value = false
	}
}
</script>

<template>
	<FormDialog title="Nouveau sous-article" :dirty="dirty" :busy="busy" @close="emit('close')" @submit="submit">
		<div class="form-field">
			<label class="field-label" for="sous-designation">Désignation du sous-article <span class="req">obligatoire</span></label>
			<input id="sous-designation" v-model="designation" class="field-input" autocomplete="off" />
			<p class="field-note"><LucideInfo class="mt-px h-3.5 w-3.5 flex-none" aria-hidden="true" /><span>Elle s'ajoute à celle de l'article parent, dont le sous-article reprend la fiche technique.</span></p>
		</div>
		<div class="form-field">
			<label class="field-label" for="sous-quantite">Quantité par article parent <span class="req">obligatoire</span></label>
			<input id="sous-quantite" v-model="quantite" class="field-input tabular-nums" type="number" min="0" step="any" autocomplete="off" />
		</div>
		<p v-if="error" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ error }}</p>
		<template #actions>
			<button type="button" class="btn-primary" :disabled="busy" @click="submit">{{ busy ? 'Création…' : 'Créer le sous-article' }}</button>
		</template>
	</FormDialog>
</template>
