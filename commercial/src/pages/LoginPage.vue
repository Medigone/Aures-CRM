<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import LucideEye from '~icons/lucide/eye'
import LucideEyeOff from '~icons/lucide/eye-off'
import LucideCircleAlert from '~icons/lucide/circle-alert'
import LucideCloudOff from '~icons/lucide/cloud-off'
import LucideCloud from '~icons/lucide/cloud'
import LucideChevronLeft from '~icons/lucide/chevron-left'
import LucideMail from '~icons/lucide/mail'
import { ApiError, login, resetPassword, safeRedirect } from '@/lib/api'
import BrandMark from '@/components/BrandMark.vue'

const route = useRoute()
const screen = ref<'login' | 'forgot'>('login')
const usr = ref('')
const pwd = ref('')
const showPwd = ref(false)
const loading = ref(false)
const error = ref('')
const sent = ref(false)
const online = ref(navigator.onLine)
const updateOnline = () => (online.value = navigator.onLine)
onMounted(() => {
	window.addEventListener('online', updateOnline)
	window.addEventListener('offline', updateOnline)
})
onUnmounted(() => {
	window.removeEventListener('online', updateOnline)
	window.removeEventListener('offline', updateOnline)
})

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
		error.value = messageOf(e, "Envoi impossible pour le moment.")
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
	<div class="flex min-h-[100dvh] flex-col bg-surface-gray-1 px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+4.5rem)]">
		<div class="mx-auto flex w-full max-w-sm flex-1 flex-col">
			<template v-if="screen === 'login'">
				<header class="flex flex-col items-start gap-5 px-1">
					<BrandMark size="lg" />
					<div class="flex flex-col gap-1.5">
						<h1 class="text-[28px] font-bold leading-tight tracking-tight">Bonjour,</h1>
						<p class="text-ink-gray-7">Connectez-vous pour retrouver votre journée, vos clients et vos affaires.</p>
					</div>
				</header>

				<form class="card mt-8 flex flex-col gap-4 p-5" novalidate @submit.prevent="submit">
					<div v-if="error" role="alert" class="flex items-start gap-2.5 rounded-2xl bg-surface-red-1 px-3.5 py-3 text-sm text-ink-red-4">
						<LucideCircleAlert class="mt-px h-[18px] w-[18px] shrink-0" aria-hidden="true" />
						<span>{{ error }}</span>
					</div>
					<div>
						<label for="login-usr" class="field-label">Email ou identifiant</label>
						<input
							id="login-usr"
							v-model="usr"
							type="email"
							autocomplete="username"
							inputmode="email"
							autocapitalize="off"
							spellcheck="false"
							placeholder="prenom.nom@aures.dz"
							class="field-input text-[16px]"
							@input="error = ''"
						/>
					</div>
					<div>
						<div class="flex items-baseline justify-between">
							<label for="login-pwd" class="field-label">Mot de passe</label>
							<button type="button" class="mb-1 text-xs font-medium text-accent" @click="goTo('forgot')">Oublié ?</button>
						</div>
						<div class="relative">
							<input
								id="login-pwd"
								v-model="pwd"
								:type="showPwd ? 'text' : 'password'"
								autocomplete="current-password"
								placeholder="••••••••"
								class="field-input pr-12 text-[16px]"
								:aria-invalid="Boolean(error) || undefined"
								@input="error = ''"
							/>
							<button
								type="button"
								class="absolute right-0.5 top-0.5 flex h-11 w-11 items-center justify-center rounded-2xl text-ink-gray-7"
								:aria-label="showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
								:aria-pressed="showPwd"
								@click="showPwd = !showPwd"
							>
								<component :is="showPwd ? LucideEyeOff : LucideEye" class="h-5 w-5" aria-hidden="true" />
							</button>
						</div>
					</div>
					<button type="submit" class="btn-primary mt-1 min-h-[52px] text-base" :disabled="loading">
						<span v-if="loading" class="h-[18px] w-[18px] animate-spin rounded-full border-2 border-on-primary/35 border-t-on-primary" aria-hidden="true" />
						{{ loading ? 'Connexion…' : 'Se connecter' }}
					</button>
				</form>

				<div v-if="!online" class="card mt-4 flex items-center gap-3 px-4 py-3.5">
					<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
						<LucideCloudOff class="h-[18px] w-[18px]" aria-hidden="true" />
					</span>
					<span class="text-sm text-ink-gray-7">Hors ligne : la connexion reprendra dès le retour du réseau. Vos saisies non envoyées sont conservées.</span>
				</div>

				<footer class="mt-auto flex flex-col items-center gap-2.5 pt-8 text-center">
					<p class="inline-flex items-center gap-2 text-sm text-ink-gray-7">
						<LucideCloud class="h-4 w-4" aria-hidden="true" />
						Une fois connecté, l'application fonctionne hors ligne.
					</p>
					<p class="text-xs text-ink-gray-6">Aures Commercial · accès réservé aux équipes Aures</p>
				</footer>
			</template>

			<template v-else>
				<button type="button" class="icon-btn -mt-10" aria-label="Retour à la connexion" @click="goTo('login')">
					<LucideChevronLeft class="h-5 w-5" aria-hidden="true" />
				</button>
				<header class="mt-6 flex flex-col gap-1.5 px-1">
					<h1 class="text-[26px] font-bold leading-tight tracking-tight">Mot de passe oublié</h1>
					<p class="text-ink-gray-7">Saisissez votre email : vous recevrez un lien pour en choisir un nouveau.</p>
				</header>

				<div v-if="sent" role="status" class="card mt-6 flex items-start gap-3 p-5">
					<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-fond text-accent">
						<LucideMail class="h-[18px] w-[18px]" aria-hidden="true" />
					</span>
					<div class="flex flex-col gap-1">
						<strong class="font-semibold">Email envoyé</strong>
						<span class="text-sm text-ink-gray-7">
							Si un compte existe pour {{ usr.trim() }}, le lien arrive dans quelques minutes. Pensez à vérifier les indésirables.
						</span>
					</div>
				</div>

				<form v-else class="card mt-6 flex flex-col gap-4 p-5" novalidate @submit.prevent="sendReset">
					<div v-if="error" role="alert" class="flex items-start gap-2.5 rounded-2xl bg-surface-red-1 px-3.5 py-3 text-sm text-ink-red-4">
						<LucideCircleAlert class="mt-px h-[18px] w-[18px] shrink-0" aria-hidden="true" />
						<span>{{ error }}</span>
					</div>
					<div>
						<label for="reset-usr" class="field-label">Email</label>
						<input
							id="reset-usr"
							v-model="usr"
							type="email"
							autocomplete="username"
							inputmode="email"
							autocapitalize="off"
							spellcheck="false"
							placeholder="prenom.nom@aures.dz"
							class="field-input text-[16px]"
						/>
					</div>
					<button type="submit" class="btn-primary min-h-[52px] text-base" :disabled="loading">
						<span v-if="loading" class="h-[18px] w-[18px] animate-spin rounded-full border-2 border-on-primary/35 border-t-on-primary" aria-hidden="true" />
						Envoyer le lien
					</button>
				</form>
			</template>
		</div>
	</div>
</template>
