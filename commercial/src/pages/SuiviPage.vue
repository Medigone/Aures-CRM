<script setup lang="ts">
import { RouterLink } from 'vue-router'
import LucidePlus from '~icons/lucide/plus'
import PageHeader from '@/components/PageHeader.vue'
import AffairesTabs from '@/components/AffairesTabs.vue'
</script>

<template>
	<div>
		<PageHeader title="Tickets" subtitle="et devis, commandes, réclamations">
			<template #actions>
				<RouterLink :to="{ name: 'NewTicket' }" class="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-on-primary" aria-label="Nouveau ticket"><LucidePlus class="h-5 w-5" /></RouterLink>
			</template>
		</PageHeader>
		<AffairesTabs />
	</div>
</template>
