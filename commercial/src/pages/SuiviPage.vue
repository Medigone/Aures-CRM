<script setup lang="ts">
import { RouterLink } from 'vue-router'
import LucidePlus from '~icons/lucide/plus'
import PageHeader from '@/components/PageHeader.vue'
import AffairesTabs from '@/components/AffairesTabs.vue'
</script>

<template>
	<div>
		<PageHeader title="Suivi" subtitle="Tickets, devis, commandes et réclamations">
			<template #actions>
				<RouterLink :to="{ name: 'NewTicket' }" class="icon-btn" aria-label="Nouveau ticket"><LucidePlus class="h-5 w-5" /></RouterLink>
			</template>
		</PageHeader>
		<AffairesTabs />
	</div>
</template>
