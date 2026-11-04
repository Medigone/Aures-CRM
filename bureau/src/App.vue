<script setup lang="ts">
import { RouterView } from 'vue-router'
import BrandMark from '@shared/components/BrandMark.vue'

const allowed = Boolean(window.can_access)
</script>

<template>
	<RouterView v-if="allowed" />
	<main v-else class="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
		<BrandMark size="lg" />
		<h1 class="text-xl font-semibold">Accès réservé au back office</h1>
		<p class="max-w-md text-ink-gray-7">Votre compte n'a pas accès au poste de bureau. Contactez votre administrateur si vous pensez que c'est une erreur.</p>
		<a class="btn-secondary" href="/app">Retour au Desk</a>
	</main>
</template>
