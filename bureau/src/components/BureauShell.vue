<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import LucideBuilding2 from '~icons/lucide/building-2'
import LucideFileText from '~icons/lucide/file-text'
import LucideLogOut from '~icons/lucide/log-out'
import LucideMoon from '~icons/lucide/moon'
import LucidePackage from '~icons/lucide/package'
import LucideShoppingCart from '~icons/lucide/shopping-cart'
import LucideSun from '~icons/lucide/sun'
import LucideTicket from '~icons/lucide/ticket'
import LucideWallet from '~icons/lucide/wallet'
import AppShell from '@shared/components/AppShell.vue'
import { realtimeConnected } from '@shared/realtime'
import type { Crumb, NavGroup } from '@shared/shell'
import AppToast from './AppToast.vue'
import ArticleDialog from './ArticleDialog.vue'
import ClientDialog from './ClientDialog.vue'
import CommandPalette from './CommandPalette.vue'
import GlobalSearch from './GlobalSearch.vue'
import NewTicketDialog from './NewTicketDialog.vue'
import { logout } from '@/lib/api'
import { initials } from '@/lib/display'
import type { CreateKind } from '@/lib/palette'
import { useAppTheme } from '@/lib/theme'
import { loadTodoCount, todoCount } from '@/lib/todoCount'

/** Coquille du poste de bureau : la même barre et le même menu sur toutes ses pages. */
const props = defineProps<{ crumbs: Crumb[]; active: 'tickets' | 'clients' | 'articles' }>()
const emit = defineEmits<{ created: [kind: CreateKind] }>()

const router = useRouter()
const userName = window.user_fullname || window.user || ''
const theme = useAppTheme()
const nextThemeLabel = computed(() => (theme.resolved.value === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'))
function toggleTheme() {
	theme.setPreference(theme.resolved.value === 'dark' ? 'light' : 'dark')
}

// Menu : les écrans pas encore repris dans le poste de bureau s'ouvrent sur le Desk.
const navGroups = computed<NavGroup[]>(() => [
	{
		title: 'Mon travail',
		items: [
			{ id: 'tickets', label: 'Tickets', icon: LucideTicket, to: { name: 'Home' }, count: todoCount.value, active: props.active === 'tickets' },
			{ id: 'commandes', label: 'Commandes', icon: LucideShoppingCart, href: '/app/sales-order' },
			{ id: 'devis', label: 'Devis', icon: LucideFileText, href: '/app/quotation' },
			{ id: 'creances', label: 'Créances', icon: LucideWallet, href: '/app/suivi-creance' },
		],
	},
	{
		title: 'Référentiel',
		items: [
			{ id: 'clients', label: 'Clients', icon: LucideBuilding2, to: { name: 'Clients' }, active: props.active === 'clients' },
			{ id: 'articles', label: 'Articles', icon: LucidePackage, to: { name: 'Articles' }, active: props.active === 'articles' },
		],
	},
])

// Palette de commandes : elle crée depuis n'importe quelle page, sans quitter celle-ci.
const searchBar = ref<InstanceType<typeof GlobalSearch> | null>(null)
const paletteOpen = ref(false)
const creating = ref<CreateKind | null>(null)
const created = ref<{ kind: CreateKind; name: string; failedFiles: number } | null>(null)

function dismissPalette() {
	paletteOpen.value = false
	nextTick(() => searchBar.value?.focus())
}
function togglePalette() {
	if (paletteOpen.value) dismissPalette()
	else paletteOpen.value = true
}
function startCreating(kind: CreateKind) {
	paletteOpen.value = false
	creating.value = kind
}
function onCreated(kind: CreateKind, name: string, failedFiles = 0) {
	creating.value = null
	created.value = { kind, name, failedFiles }
	if (kind === 'ticket') loadTodoCount()
	emit('created', kind)
}
const createdMessage = computed(() => {
	if (!created.value) return ''
	const { kind, name, failedFiles } = created.value
	if (kind === 'article') return 'Article créé.'
	if (kind === 'client') return 'Prospect créé.'
	const files = !failedFiles ? '' : failedFiles > 1 ? ` ${failedFiles} fichiers n'ont pas été envoyés : joignez-les depuis la fiche.` : " Un fichier n'a pas été envoyé : joignez-le depuis la fiche."
	return `Ticket ${name} créé.${files}`
})
function openCreated() {
	const record = created.value
	created.value = null
	if (!record) return
	const route = { ticket: 'Ticket', article: 'Article', client: 'Client' }[record.kind]
	router.push({ name: route, params: { id: record.name } })
}
</script>

<template>
	<AppShell poste="Back office" :groups="navGroups" :crumbs="crumbs" :user-name="userName" :initials="initials(userName)" storage-key="bureau-menu">
		<template #search>
			<GlobalSearch ref="searchBar" @toggle="togglePalette" />
		</template>
		<template #status>
			<span class="live-status" :data-live="realtimeConnected" :title="realtimeConnected ? 'Les changements faits ailleurs arrivent seuls' : 'Les changements faits ailleurs n\'arrivent plus seuls : actualisez la liste'">
				<i aria-hidden="true"></i>
				<span>{{ realtimeConnected ? 'À jour' : 'Temps réel coupé' }}</span>
			</span>
		</template>
		<template #account="{ close }">
			<button type="button" class="app-menu-item" role="menuitem" @click="toggleTheme(); close()">
				<LucideSun v-if="theme.resolved.value === 'dark'" class="h-3.5 w-3.5" aria-hidden="true" />
				<LucideMoon v-else class="h-3.5 w-3.5" aria-hidden="true" />
				{{ nextThemeLabel }}
			</button>
			<a href="/app" class="app-menu-item" role="menuitem" target="_blank" rel="noopener noreferrer" @click="close()">
				<LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />
				Ouvrir le Desk
			</a>
			<div class="app-menu-sep"></div>
			<button type="button" class="app-menu-item" role="menuitem" @click="logout">
				<LucideLogOut class="h-3.5 w-3.5" aria-hidden="true" />
				Se déconnecter
			</button>
		</template>
		<slot />
		<CommandPalette v-if="paletteOpen" @close="dismissPalette" @done="paletteOpen = false" @create="startCreating" />
		<NewTicketDialog v-if="creating === 'ticket'" @close="creating = null" @created="(result) => onCreated('ticket', result.name, result.failedFiles)" />
		<ArticleDialog v-else-if="creating === 'article'" @close="creating = null" @created="(name) => onCreated('article', name)" />
		<ClientDialog v-else-if="creating === 'client'" @close="creating = null" @created="(name) => onCreated('client', name)" />
		<AppToast :message="createdMessage" :tone="created?.failedFiles ? 'warning' : 'success'" :duration="created?.failedFiles ? 0 : 8000" @close="created = null">
			<button type="button" class="app-toast-action" @click="openCreated">Ouvrir la fiche</button>
		</AppToast>
	</AppShell>
</template>
