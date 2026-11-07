<script setup lang="ts">
import BureauShell from '@/components/BureauShell.vue'

/** Page d'un document que ce rôle ne lit pas : le menu reste là pour repartir. */
</script>

<template>
	<BureauShell :crumbs="[{ label: 'Accès refusé' }]">
		<div class="flex flex-col items-start gap-3 p-6">
			<h1 class="text-[18px] font-semibold leading-tight text-ink-gray-9">Cette page n'est pas accessible</h1>
			<p class="text-ink-gray-7">Votre rôle ne permet pas de lire ce document. Si vous en avez besoin, demandez l'accès à votre administrateur.</p>
			<RouterLink class="btn-secondary" :to="{ name: 'Home' }">Retour à l'accueil</RouterLink>
		</div>
	</BureauShell>
</template>
