<script setup lang="ts">
import { ref } from 'vue'
import LucideChevronDown from '~icons/lucide/chevron-down'
import LucideColumns3 from '~icons/lucide/columns-3'
import LucidePencil from '~icons/lucide/pencil'
import LucideStar from '~icons/lucide/star'
import LucideX from '~icons/lucide/x'
import type { SavedListView } from '@/lib/api'
import type { ListViewsSession } from '@/lib/useListViews'

/** Sélecteur de vue, à côté du titre de la liste, et ce qu'on peut faire d'une vue modifiée. */
const props = defineProps<{ session: ListViewsSession; open: boolean }>()
const emit = defineEmits<{ toggle: []; close: []; saveAs: []; saved: [message: string] }>()

const renaming = ref<string | null>(null)
const newName = ref('')
const removing = ref<string | null>(null)

function pick(view: SavedListView | null) {
	props.session.apply(view)
	emit('close')
}
function startRename(view: SavedListView) {
	removing.value = null
	renaming.value = view.name
	newName.value = view.label
}
async function confirmRename(view: SavedListView) {
	const name = newName.value.trim()
	if (name && name !== view.label && !(await props.session.rename(view, name))) return
	renaming.value = null
}
async function confirmRemove(view: SavedListView) {
	removing.value = null
	if (await props.session.remove(view)) emit('saved', 'Vue supprimée.')
}
async function overwrite() {
	if (await props.session.overwrite()) emit('saved', 'Vue enregistrée.')
}
const starLabel = (view: SavedListView) => (props.session.defaultName.value === view.name ? `${view.label} est votre vue par défaut` : `Faire de ${view.label} ma vue par défaut`)
</script>

<template>
	<div class="list-menu relative flex-none">
		<button type="button" class="btn-secondary view-selector" aria-haspopup="menu" :aria-expanded="open" aria-label="Changer de vue" @click="emit('toggle')">
			<LucideColumns3 class="h-3.5 w-3.5" aria-hidden="true" />
			<span class="view-selector-label">{{ session.label.value }}</span>
			<LucideChevronDown class="h-3.5 w-3.5" aria-hidden="true" />
		</button>
		<div v-if="open" class="app-menu view-menu" role="menu">
			<div class="view-row" :aria-current="!session.activeName.value ? 'true' : undefined">
				<button type="button" class="view-row-apply" role="menuitem" @click="pick(null)">Vue standard</button>
			</div>
			<template v-for="group in [{ title: 'Mes vues', views: session.mine.value }, { title: 'Vues partagées', views: session.shared.value }]" :key="group.title">
				<template v-if="group.views.length">
					<p class="app-menu-title">{{ group.title }}</p>
					<div v-for="view in group.views" :key="view.name" class="view-row" :aria-current="view.name === session.activeName.value ? 'true' : undefined">
						<form v-if="renaming === view.name" class="flex min-w-0 flex-1 items-center gap-1" @submit.prevent="confirmRename(view)">
							<input v-model="newName" class="field-input min-w-0 flex-1" type="text" :aria-label="`Nouveau nom de ${view.label}`" />
							<button type="submit" class="text-sm font-medium" :disabled="session.busy.value">Renommer</button>
							<button type="button" class="text-sm font-medium" @click="renaming = null">Annuler</button>
						</form>
						<template v-else-if="removing === view.name">
							<span class="min-w-0 flex-1 truncate px-2">Supprimer « {{ view.label }} » ?</span>
							<button type="button" class="text-sm font-medium text-tone-red" :disabled="session.busy.value" @click="confirmRemove(view)">Supprimer</button>
							<button type="button" class="px-1 text-sm font-medium" @click="removing = null">Annuler</button>
						</template>
						<template v-else>
							<button type="button" class="view-row-apply" role="menuitem" :title="view.label" @click="pick(view)">{{ view.label }}</button>
							<span v-if="view.is_global" class="saved-filter-scope">Tout le monde</span>
							<button type="button" class="view-row-icon" :class="session.defaultName.value === view.name && 'view-row-star'" :aria-pressed="session.defaultName.value === view.name" :aria-label="starLabel(view)" :title="session.defaultName.value === view.name ? 'Vue par défaut' : 'En faire ma vue par défaut'" :disabled="session.busy.value" @click="session.toggleDefault(view)"><LucideStar class="h-3.5 w-3.5" aria-hidden="true" /></button>
							<template v-if="view.can_edit">
								<button type="button" class="view-row-icon" :aria-label="`Renommer ${view.label}`" title="Renommer" @click="startRename(view)"><LucidePencil class="h-3.5 w-3.5" aria-hidden="true" /></button>
								<button type="button" class="view-row-icon" :aria-label="`Supprimer ${view.label}`" title="Supprimer" @click="renaming = null; removing = view.name"><LucideX class="h-3.5 w-3.5" aria-hidden="true" /></button>
							</template>
						</template>
					</div>
				</template>
			</template>
			<p v-if="session.loadError.value" role="alert" class="rounded-control tone-red mx-1 my-1 px-2.5 py-1.5 text-sm">{{ session.loadError.value }}</p>
			<div class="app-menu-sep"></div>
			<button type="button" class="app-menu-item" role="menuitem" @click="emit('close'); emit('saveAs')">Enregistrer sous une nouvelle vue</button>
		</div>
	</div>
	<template v-if="session.modified.value">
		<span class="view-modified">Modifiée</span>
		<button v-if="session.canOverwrite.value" type="button" class="btn-secondary" :disabled="session.busy.value" @click="overwrite">Enregistrer</button>
		<button type="button" class="btn-secondary" @click="emit('saveAs')">Enregistrer sous</button>
		<button type="button" class="px-1 text-sm text-link" @click="session.reset()">Annuler les changements</button>
	</template>
</template>
