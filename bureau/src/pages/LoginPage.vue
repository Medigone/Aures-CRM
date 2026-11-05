<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import LucideChevronLeft from '~icons/lucide/chevron-left'
import LucideCircleAlert from '~icons/lucide/circle-alert'
import LucideEye from '~icons/lucide/eye'
import LucideEyeOff from '~icons/lucide/eye-off'
import LucideMail from '~icons/lucide/mail'
import { ApiError } from '@shared/api'
import BrandMark from '@shared/components/BrandMark.vue'
import LoginLayout from '@/components/LoginLayout.vue'
import { login, resetPassword, safeRedirect } from '@/lib/api'

const route = useRoute()
const screen = ref<'login' | 'forgot'>('login')
const usr = ref('')
const pwd = ref('')
const showPwd = ref(false)
const loading = ref(false)
const error = ref('')
const sent = ref(false)

const redirectTo = computed(() => safeRedirect(String(route.query['redirect-to'] || '')))

function messageOf(e: unknown, fallback: string) {
	if (e instanceof ApiError) {
		if (e.offline) return 'Pas de connexion réseau. Réessayez dès le retour du réseau.'
		if (e.status === 401) return 'Email ou mot de passe incorrect.'
		if (e.status === 429) return 'Trop de tentatives. Patientez quelques minutes avant de réessayer.'
		return e.message || fallback
	}
	return fallback
}

async function submit() {
	error.value = ''
	if (!usr.value.trim() || !pwd.value) {
		error.value = 'Saisissez votre email et votre mot de passe.'
		return
	}
	loading.value = true
	try {
		await login(usr.value.trim(), pwd.value)
		// Rechargement complet : la page reçoit la session, le jeton CSRF et l'utilisateur du serveur.
		window.location.replace(redirectTo.value)
	} catch (e) {
		error.value = messageOf(e, 'Connexion impossible pour le moment.')
		loading.value = false
	}
}

async function sendReset() {
	error.value = ''
	if (!usr.value.trim()) {
		error.value = 'Saisissez votre email.'
		return
	}
	loading.value = true
	try {
		await resetPassword(usr.value.trim())
		sent.value = true
	} catch (e) {
		error.value = messageOf(e, 'Envoi impossible pour le moment.')
	} finally {
		loading.value = false
	}
}

function goTo(next: 'login' | 'forgot') {
	screen.value = next
	error.value = ''
	sent.value = false
}
</script>

<template>
	<LoginLayout>
		<div v-if="screen === 'login'" class="contents">
			<header class="flex flex-col items-start gap-5 px-1">
				<BrandMark size="lg" />
				<div class="flex flex-col gap-1.5">
					<h1 class="text-[24px] font-bold leading-tight tracking-tight text-ink-gray-9">Bonjour,</h1>
					<p class="text-ink-gray-7">Connectez-vous pour retrouver votre espace de travail.</p>
				</div>
			</header>

			<form class="card flex flex-col gap-3.5 p-5" novalidate @submit.prevent="submit">
				<div v-if="error" role="alert" class="login-alert">
					<LucideCircleAlert class="mt-px h-4 w-4 flex-none" aria-hidden="true" />
					<span>{{ error }}</span>
				</div>
				<div>
					<label for="login-usr" class="field-label">Email ou identifiant</label>
					<input id="login-usr" v-model="usr" type="email" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="prenom.nom@aures.dz" class="field-input login-input" @input="error = ''" />
				</div>
				<div>
					<div class="flex items-baseline justify-between">
						<label for="login-pwd" class="field-label">Mot de passe</label>
						<button type="button" class="mb-1 text-xs text-link" @click="goTo('forgot')">Oublié ?</button>
					</div>
					<div class="relative">
						<input
							id="login-pwd"
							v-model="pwd"
							:type="showPwd ? 'text' : 'password'"
							autocomplete="current-password"
							placeholder="••••••••"
							class="field-input login-input pr-[var(--ctl-icon)]"
							:aria-invalid="Boolean(error) || undefined"
							@input="error = ''"
						/>
						<button
							type="button"
							class="absolute right-0 top-0 flex h-[var(--ctl-icon)] w-[var(--ctl-icon)] items-center justify-center rounded-control text-ink-gray-7"
							:aria-label="showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
							:aria-pressed="showPwd"
							@click="showPwd = !showPwd"
						>
							<component :is="showPwd ? LucideEyeOff : LucideEye" class="h-4 w-4" aria-hidden="true" />
						</button>
					</div>
				</div>
				<button type="submit" class="btn-primary mt-0.5" :disabled="loading">
					<span v-if="loading" class="login-spinner" aria-hidden="true" />
					{{ loading ? 'Connexion…' : 'Se connecter' }}
				</button>
			</form>
		</div>

		<div v-else class="contents">
			<button type="button" class="icon-btn" aria-label="Retour à la connexion" title="Retour à la connexion" @click="goTo('login')">
				<LucideChevronLeft class="h-4 w-4" aria-hidden="true" />
			</button>
			<header class="flex flex-col gap-1.5 px-1">
				<h1 class="text-[24px] font-bold leading-tight tracking-tight text-ink-gray-9">Mot de passe oublié</h1>
				<p class="text-ink-gray-7">Saisissez votre email : vous recevrez un lien pour en choisir un nouveau.</p>
			</header>

			<div v-if="sent" role="status" class="card flex items-start gap-3 p-5">
				<span class="login-sent-icon">
					<LucideMail class="h-4 w-4" aria-hidden="true" />
				</span>
				<div class="flex flex-col gap-1">
					<strong class="font-semibold text-ink-gray-9">Email envoyé</strong>
					<span class="text-ink-gray-7">Si un compte existe pour {{ usr.trim() }}, le lien arrive dans quelques minutes. Pensez à vérifier les indésirables.</span>
				</div>
			</div>

			<form v-else class="card flex flex-col gap-3.5 p-5" novalidate @submit.prevent="sendReset">
				<div v-if="error" role="alert" class="login-alert">
					<LucideCircleAlert class="mt-px h-4 w-4 flex-none" aria-hidden="true" />
					<span>{{ error }}</span>
				</div>
				<div>
					<label for="reset-usr" class="field-label">Email</label>
					<input id="reset-usr" v-model="usr" type="email" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="prenom.nom@aures.dz" class="field-input login-input" @input="error = ''" />
				</div>
				<button type="submit" class="btn-primary" :disabled="loading">
					<span v-if="loading" class="login-spinner" aria-hidden="true" />
					Envoyer le lien
				</button>
			</form>
		</div>
	</LoginLayout>
</template>

<style scoped>
.login-alert {
	display: flex;
	align-items: flex-start;
	gap: 0.5rem;
	padding: 0.5rem 0.625rem;
	border: 1px solid var(--tone-red-line);
	border-radius: var(--radius-field);
	background-color: var(--tone-red-soft);
	color: var(--tone-red-ink);
}
.login-sent-icon {
	display: flex;
	flex: none;
	align-items: center;
	justify-content: center;
	width: 2rem;
	height: 2rem;
	border: 1px solid var(--tone-blue-line);
	border-radius: var(--radius-pill);
	background-color: var(--tone-blue-soft);
	color: var(--tone-blue-ink);
}
.login-spinner {
	width: 14px;
	height: 14px;
	border: 2px solid rgb(var(--on-primary-rgb) / 0.35);
	border-top-color: var(--on-primary);
	border-radius: var(--radius-pill);
	animation: login-spin 0.8s linear infinite;
}
@keyframes login-spin {
	to {
		transform: rotate(360deg);
	}
}
@media (prefers-reduced-motion: reduce) {
	.login-spinner {
		animation: none;
	}
}
/* Sous 16 px, iOS agrandit la page quand on touche un champ. */
@media (pointer: coarse) {
	.login-input {
		font-size: 16px;
	}
}
</style>
