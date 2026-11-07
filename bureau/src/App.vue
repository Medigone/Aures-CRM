<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { onSessionExpired } from '@shared/api'
import BrandMark from '@shared/components/BrandMark.vue'
import LoginLayout from '@/components/LoginLayout.vue'
import { logout, redirectToLogin } from '@/lib/api'
import { canRead } from '@/lib/droits'
import NoAccessPage from '@/pages/NoAccessPage.vue'

// Un visiteur sans session ne reçoit du serveur que la page de connexion.
const account = window.user
const showApp = !account || Boolean(window.can_access)
if (account) onSessionExpired(redirectToLogin)

// Une page dont le rôle ne lit pas le document le dit, sans redirection : l'adresse reste celle du lien reçu.
const route = useRoute()
const refused = computed(() => Boolean(account) && !canRead(route.meta.doctype as string | string[] | undefined))
</script>

<template>
	<NoAccessPage v-if="showApp && refused" />
	<RouterView v-else-if="showApp" />
	<LoginLayout v-else>
		<header class="flex flex-col items-start gap-5 px-1">
			<BrandMark size="lg" />
			<div class="flex flex-col gap-1.5">
				<h1 class="text-[24px] font-bold leading-tight tracking-tight text-ink-gray-9">Accès non autorisé</h1>
				<p class="text-ink-gray-7">Le compte {{ account }} n'a pas accès au poste de bureau. Contactez votre administrateur si vous pensez que c'est une erreur.</p>
			</div>
		</header>
		<div class="card flex flex-col gap-2 p-5">
			<button type="button" class="btn-primary" @click="logout">Changer de compte</button>
			<a class="btn-secondary" href="/app">Retour au Desk</a>
		</div>
	</LoginLayout>
</template>
