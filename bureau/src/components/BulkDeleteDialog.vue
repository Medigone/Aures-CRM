<script setup lang="ts">
import FormDialog from '@shared/components/FormDialog.vue'

/** Pas de raccourci clavier ici : supprimer demande un clic délibéré sur le bouton. */
defineProps<{ countLabel: string; names: string[] }>()
const emit = defineEmits<{ close: []; confirm: [] }>()
const SHOWN = 5
</script>

<template>
	<FormDialog :title="`Supprimer ${countLabel} ?`" :dirty="false" hint="" @close="emit('close')">
		<p class="m-0 text-ink-gray-7">
			{{ names.slice(0, SHOWN).join(', ') }}<template v-if="names.length > SHOWN"> et {{ names.length - SHOWN }} autre{{ names.length - SHOWN > 1 ? 's' : '' }}</template>.
		</p>
		<p class="m-0 mt-2 text-sm text-ink-gray-6">Une ligne soumise ou liée à d'autres documents n'est pas supprimée : la raison s'affiche ensuite. Un administrateur peut restaurer une suppression depuis le Desk (Deleted Document).</p>
		<template #actions>
			<button type="button" class="btn-danger" @click="emit('confirm')">Supprimer {{ countLabel }}</button>
		</template>
	</FormDialog>
</template>
