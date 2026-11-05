<script setup lang="ts">
import { computed, ref } from 'vue'
import FileUploader from '@shared/components/FileUploader.vue'
import FormDialog from '@shared/components/FormDialog.vue'
import type { UploadedFile } from '@shared/api'
import { newMaquetteVersion, setMaquetteFile } from '@/lib/api'
import type { ArticleDetail, ArticlePrepresse } from '@/lib/articles'

/** Même règle que sur le Desk : la version en service le reste jusqu'à l'activation de la nouvelle. */
const props = defineProps<{ article: ArticleDetail; maquette: ArticlePrepresse['maquettes'][number]; perform: (action: () => Promise<ArticleDetail>) => Promise<boolean> }>()
const emit = defineEmits<{ close: []; created: [article: ArticleDetail, name: string, failed: boolean] }>()

const changes = ref('')
const error = ref('')
const busy = ref(false)
const uploader = ref<InstanceType<typeof FileUploader> | null>(null)
const nextVersion = computed(() => Math.max(0, ...props.article.prepresse.maquettes.map((row) => row.ver ?? 0)) + 1)
const dirty = computed(() => Boolean(changes.value.trim() || uploader.value?.items.length))

let uploaded: UploadedFile | null = null
function onUploaded(file: UploadedFile) {
	uploaded = file
}

async function submit() {
	if (busy.value) return
	if (!changes.value.trim()) {
		error.value = 'Décrivez ce qui change.'
		return
	}
	busy.value = true
	error.value = ''
	let created = ''
	let article = props.article
	const ok = await props.perform(async () => {
		const result = await newMaquetteVersion(props.article, props.maquette.name, changes.value)
		created = result.name
		article = result.article
		return result.article
	})
	if (!ok) {
		error.value = "La version n'a pas été créée."
		busy.value = false
		return
	}
	// La version existe : un fichier refusé ne doit pas la faire oublier.
	let failed = false
	if (uploader.value?.items.length) {
		failed = (await uploader.value.start({ doctype: 'Maquette', docname: created })) > 0
		const file = uploaded as UploadedFile | null
		if (file) {
			await props.perform(async () => {
				article = await setMaquetteFile(article, created, file.file_url)
				return article
			})
		}
	}
	busy.value = false
	emit('created', article, created, failed)
	emit('close')
}
</script>

<template>
	<FormDialog title="Nouvelle version" :dirty="dirty" :busy="busy" @close="emit('close')" @submit="submit">
		<p class="text-sm text-ink-gray-7">Elle part de {{ maquette.name }} et devient la version {{ nextVersion }} de {{ article.designation }}.</p>
		<div class="form-field">
			<label class="field-label" for="version-changes">Ce qui change <span class="req">obligatoire</span></label>
			<textarea id="version-changes" v-model="changes" class="field-input comment-input" rows="3" placeholder="Par exemple : nouveau poids net, Pantone du logo" :aria-invalid="Boolean(error)" @input="error = ''"></textarea>
			<p v-if="error" class="field-error" role="alert">{{ error }}</p>
		</div>
		<div class="form-field">
			<span class="field-label">Fichier de la maquette</span>
			<FileUploader ref="uploader" deferred :multiple="false" @uploaded="onUploaded" />
		</div>
		<p class="rounded-control tone-amber px-3 py-2 text-sm"><strong class="font-semibold">À savoir :</strong> {{ maquette.name }} reste en service jusqu'à l'activation de la nouvelle version. Un PV de destruction est créé en brouillon pour elle dès maintenant.</p>
		<template #actions>
			<button type="button" class="btn-primary" :disabled="busy" @click="submit">{{ busy ? 'Création…' : 'Créer la version' }}</button>
		</template>
	</FormDialog>
</template>
