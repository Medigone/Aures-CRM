<script setup lang="ts">
/** En-tête commun des fiches : titre et état à gauche, actions à droite, sur toute la largeur. */
</script>

<template>
	<header class="card record-head">
		<div class="min-w-0">
			<div class="record-head-title">
				<h2 class="page-title"><slot name="title" /></h2>
				<slot name="flags" />
			</div>
			<div class="record-head-sub"><slot name="sub" /></div>
		</div>
		<div class="record-actions"><slot name="actions" /></div>
	</header>
</template>
