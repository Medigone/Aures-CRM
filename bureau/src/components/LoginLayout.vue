<!-- Mise en page des écrans sans coquille : connexion et refus d'accès. -->
<template>
	<div class="flex min-h-[100dvh] flex-col bg-[var(--page)] p-4">
		<main class="flex flex-auto flex-col items-center justify-center py-6">
			<div class="flex w-full max-w-[360px] flex-col gap-6">
				<slot />
			</div>
		</main>
		<footer class="flex-none pt-2 text-center text-xs text-ink-gray-6">Aures Bureau · accès réservé aux équipes Aures</footer>
	</div>
</template>
