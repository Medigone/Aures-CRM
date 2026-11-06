<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import StatusPill from '@shared/components/StatusPill.vue'
import { deskUrl } from '@/lib/display'
import type { TicketDetail } from '@/types'

const props = defineProps<{ ticket: TicketDetail }>()

const LABELS: Record<string, string> = {
	Quotation: 'Devis',
	'Sales Order': 'Commande',
	'Etude Faisabilite': 'Étude faisabilité',
	'Etude Faisabilite Flexo': 'Étude faisabilité Flexo',
}

const groups = computed(() => {
	const cycle = props.ticket.cycle
	const output = [
		...(cycle.demandes || []).map((group) => ({ group, label: 'Demande de faisabilité', doctype: 'Demande Faisabilite' })),
		...(cycle.dossiers || []).map((group) => ({ group, label: 'Dossier essai à blanc', doctype: 'Dossier Essai Blanc' })),
	].map(({ group, label, doctype }) => ({
		key: group.name,
		label,
		name: group.name,
		status: group.status,
		url: deskUrl(doctype, group.name),
		// Les demandes ont leur page ; le reste s'ouvre encore sur le Desk.
		to: doctype === 'Demande Faisabilite' ? { name: 'Demande', params: { id: group.name } } : undefined,
		children: [
			...(group.etudes || []).map((etude) => ({
				key: etude.name,
				label: LABELS[etude.doctype || ''] || 'Étude',
				sub: etude.item_name || etude.article || etude.name,
				status: etude.status,
				url: deskUrl(etude.doctype || 'Etude Faisabilite', etude.name),
			})),
			...(group.sales_documents || []).map((document) => ({
				key: document.name,
				label: LABELS[document.doctype] || document.doctype,
				sub: document.name,
				status: document.status,
				url: deskUrl(document.doctype, document.name),
			})),
		],
	}))
	// Commande du devis retenu quand ce devis vient d'une demande non liée à ce ticket.
	const commande = props.ticket.commande
	const known = output.some((group) => group.children.some((child) => child.key === commande?.name))
	if (commande && !known) {
		output.push({ key: commande.name, label: 'Commande', name: commande.name, status: commande.status, url: deskUrl('Sales Order', commande.name), to: undefined, children: [] })
	}
	return output
})
</script>

<template>
	<section aria-label="Cycle du dossier" class="card flex flex-col gap-1.5 p-3.5">
		<h3 class="text-base font-semibold">Cycle du dossier</h3>
		<p v-if="!groups.length" class="text-ink-gray-6">Aucune demande de faisabilité ni devis pour l'instant.</p>
		<div v-for="group in groups" :key="group.key" class="flex flex-col gap-0.5 border-t border-outline-gray-1 pt-1.5">
			<component :is="group.to ? RouterLink : 'a'" v-bind="group.to ? { to: group.to } : { href: group.url, target: '_blank', rel: 'noopener noreferrer' }" class="flex min-h-[var(--ctl)] items-center justify-between gap-2 rounded-control hover:bg-surface-gray-2">
				<span class="min-w-0">
					<span class="block font-semibold text-link">{{ group.label }}</span>
					<span class="block text-xs text-ink-gray-6">{{ group.name }}</span>
				</span>
				<StatusPill :status="group.status" />
			</component>
			<a v-for="child in group.children" :key="child.key" :href="child.url" target="_blank" rel="noopener noreferrer" class="flex min-h-[var(--ctl)] items-center justify-between gap-2 rounded-control pl-2.5 text-sm text-ink-gray-7 hover:bg-surface-gray-2">
				<span class="min-w-0">
					<span class="block">{{ child.label }}</span>
					<span class="block break-words text-xs text-ink-gray-6">{{ child.sub }}</span>
				</span>
				<StatusPill :status="child.status" />
			</a>
		</div>
	</section>
</template>
