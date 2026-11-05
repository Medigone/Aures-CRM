<script setup lang="ts">
import { computed } from 'vue'
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
import GlobalSearch from './GlobalSearch.vue'
import { logout } from '@/lib/api'
import { initials } from '@/lib/display'
import { useAppTheme } from '@/lib/theme'
import { todoCount } from '@/lib/todoCount'

/** Coquille du poste de bureau : la même barre et le même menu sur toutes ses pages. */
const props = defineProps<{ crumbs: Crumb[]; active: 'tickets' | 'clients' | 'articles' }>()

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
</script>

<template>
	<AppShell poste="Back office" :groups="navGroups" :crumbs="crumbs" :user-name="userName" :initials="initials(userName)" storage-key="bureau-menu">
		<template #search>
			<GlobalSearch @open="(name) => router.push({ name: 'Ticket', params: { id: name } })" />
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
	</AppShell>
</template>
