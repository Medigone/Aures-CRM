<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import LucideChevronLeft from '~icons/lucide/chevron-left'
import LucideChevronRight from '~icons/lucide/chevron-right'
import LucideFileText from '~icons/lucide/file-text'
import LucideX from '~icons/lucide/x'
import StatusPill from '@shared/components/StatusPill.vue'
import { fileName, fileUrl } from '@shared/text'
import { activateMaquette, referenceMaquette } from '@/lib/api'
import { activationConsequence, isImageFile, isPdfFile, type ArticleDetail } from '@/lib/articles'
import { deskUrl, formatDay } from '@/lib/display'

/** Une version de maquette : son aperçu sans quitter la fiche, et ce qu'on peut en faire, avec les conséquences annoncées. */
const props = defineProps<{ article: ArticleDetail; start: string; busy: boolean; perform: (action: () => Promise<ArticleDetail>) => Promise<boolean> }>()
const emit = defineEmits<{ close: [] }>()

const current = ref(props.start)
// De la plus ancienne à la plus récente, comme on lit un historique.
const versions = computed(() => [...props.article.prepresse.maquettes].reverse())
const index = computed(() => versions.value.findIndex((row) => row.name === current.value))
const maquette = computed(() => versions.value[index.value] ?? versions.value[versions.value.length - 1])
const linkedBats = computed(() => props.article.prepresse.bats.filter((row) => row.maquette === maquette.value?.name))
const consequence = computed(() => (maquette.value ? activationConsequence(props.article, maquette.value.name) : ''))
const canWrite = computed(() => props.article.droits_prepresse.maquette)
const canActivate = computed(() => canWrite.value && ['Référencée', 'Obsolète'].includes(maquette.value?.status ?? ''))
const canReference = computed(() => canWrite.value && maquette.value?.status === 'A référencer')

function go(step: number) {
	const next = versions.value[index.value + step]
	if (next) current.value = next.name
}
function activate() {
	const name = maquette.value.name
	props.perform(() => activateMaquette(props.article, name))
}
function reference() {
	const name = maquette.value.name
	if (window.confirm('Confirmez-vous que le fichier source de la maquette a été renommé avec cet ID dans le serveur des maquettes ?')) props.perform(() => referenceMaquette(props.article, name))
}

const root = ref<HTMLElement | null>(null)
function onKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape') {
		event.stopPropagation()
		emit('close')
	} else if (event.key === 'ArrowLeft') go(-1)
	else if (event.key === 'ArrowRight') go(1)
}
onMounted(async () => {
	await nextTick()
	root.value?.focus()
})
</script>

<template>
	<div class="dialog-scrim" @keydown="onKeydown">
		<div ref="root" class="dialog pp-dialog" role="dialog" aria-modal="true" :aria-label="`Version de maquette ${maquette?.name}`" tabindex="-1">
			<div class="dialog-head">
				<div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
					<h2 class="page-title">Version {{ maquette?.ver ?? '?' }}</h2>
					<StatusPill v-if="maquette" :status="maquette.status" />
					<span class="text-sm tabular-nums text-ink-gray-6">{{ maquette?.name }}</span>
				</div>
				<button type="button" class="app-icon-bare" aria-label="Fermer" @click="emit('close')"><LucideX class="h-4 w-4" aria-hidden="true" /></button>
			</div>
			<div v-if="maquette" class="pp-viewer">
				<div class="pp-stage">
					<template v-if="maquette.fichier_maquette">
						<img v-if="isImageFile(maquette.fichier_maquette)" class="pp-preview" :src="fileUrl(maquette.fichier_maquette) || undefined" :alt="`Maquette ${maquette.name}`" />
						<object v-else-if="isPdfFile(maquette.fichier_maquette)" class="pp-preview pp-preview-pdf" :data="fileUrl(maquette.fichier_maquette) || undefined" type="application/pdf" :aria-label="`Maquette ${maquette.name}`"><LucideFileText class="h-12 w-12" aria-hidden="true" /></object>
						<LucideFileText v-else class="h-12 w-12" aria-hidden="true" />
						<p class="text-sm text-ink-gray-7">{{ fileName(maquette.fichier_maquette) }}</p>
					</template>
					<p v-else class="text-ink-gray-6">Aucun fichier pour cette version.</p>
				</div>
				<div class="pp-panel">
					<dl class="side-kv">
						<div><dt>Créée le</dt><dd class="tabular-nums">{{ formatDay(maquette.date_creation) || '—' }}</dd></div>
						<div><dt>Changements</dt><dd :class="!maquette.desc_changements && 'font-normal text-ink-gray-6'">{{ maquette.desc_changements || '—' }}</dd></div>
						<div><dt>Couleurs</dt><dd :class="!maquette.resume_couleurs && 'font-normal text-ink-gray-6'">{{ maquette.resume_couleurs || 'Non renseignées' }}</dd></div>
						<div><dt>BAT lié</dt><dd :class="!linkedBats.length && 'font-normal text-ink-gray-6'">{{ linkedBats.length ? linkedBats.map((row) => `${row.name} (${row.status})`).join(', ') : 'Aucun' }}</dd></div>
					</dl>
					<div class="flex flex-wrap items-center gap-1.5">
						<a v-if="maquette.fichier_maquette" class="btn-secondary" :href="fileUrl(maquette.fichier_maquette) || undefined" target="_blank" rel="noopener noreferrer">Ouvrir le fichier<LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" /></a>
						<a class="ref-link ml-1" :href="deskUrl('Maquette', maquette.name)" target="_blank" rel="noopener noreferrer">Sur le Desk</a>
					</div>
					<span class="flex-auto"></span>
					<template v-if="canActivate">
						<p class="rounded-control tone-amber px-3 py-2 text-sm"><strong class="font-semibold">Si vous activez cette version :</strong> {{ consequence }}</p>
						<button type="button" class="btn-primary" :disabled="busy" @click="activate">{{ busy ? 'Activation…' : `Activer la version ${maquette.ver ?? ''}` }}</button>
					</template>
					<template v-else-if="canReference">
						<p class="rounded-control tone-blue px-3 py-2 text-sm">Cette version doit être référencée avant de pouvoir être activée.</p>
						<button type="button" class="btn-primary" :disabled="busy" @click="reference">Marquer comme référencée</button>
					</template>
				</div>
			</div>
			<div class="dialog-foot justify-between">
				<div class="pp-strip" role="group" aria-label="Changer de version">
					<button v-for="row in versions" :key="row.name" type="button" :aria-current="row.name === current" :title="row.name" @click="current = row.name">V{{ row.ver ?? '?' }}<template v-if="row.status === 'Version Activée'"> activée</template></button>
				</div>
				<div class="flex flex-none items-center gap-1.5">
					<button type="button" class="icon-btn" aria-label="Version précédente" :disabled="index <= 0" @click="go(-1)"><LucideChevronLeft class="h-4 w-4" aria-hidden="true" /></button>
					<button type="button" class="icon-btn" aria-label="Version suivante" :disabled="index >= versions.length - 1" @click="go(1)"><LucideChevronRight class="h-4 w-4" aria-hidden="true" /></button>
				</div>
			</div>
		</div>
	</div>
</template>
