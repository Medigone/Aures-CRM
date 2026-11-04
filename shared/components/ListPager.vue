<script setup lang="ts">
import { computed } from 'vue'
import LucideChevronLeft from '~icons/lucide/chevron-left'
import LucideChevronRight from '~icons/lucide/chevron-right'

/** Pied de toutes les listes : taille de page, tri en cours, position, précédent et suivant. */
const props = defineProps<{ total: number; page: number; pageSize: number; sizes: readonly number[]; sortLabel: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:page': [page: number]; 'update:pageSize': [size: number] }>()

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const from = computed(() => (props.total ? props.page * props.pageSize + 1 : 0))
const to = computed(() => Math.min(props.total, (props.page + 1) * props.pageSize))
</script>

<template>
	<div class="pager">
		<div class="pager-sizes" role="group" aria-label="Lignes par page">
			<span>Par page</span>
			<div class="seg">
				<button v-for="size in sizes" :key="size" type="button" :aria-pressed="size === pageSize" :disabled="disabled" @click="emit('update:pageSize', size)">{{ size }}</button>
			</div>
		</div>
		<span class="flex-auto"></span>
		<span>{{ sortLabel }}</span>
		<template v-if="total">
			<span>{{ from }}–{{ to }} sur {{ total }}</span>
			<div class="pager-nav">
				<button type="button" class="pager-btn" aria-label="Page précédente" :disabled="disabled || page <= 0" @click="emit('update:page', page - 1)"><LucideChevronLeft class="h-3.5 w-3.5" aria-hidden="true" /></button>
				<span>Page {{ page + 1 }} sur {{ pageCount }}</span>
				<button type="button" class="pager-btn" aria-label="Page suivante" :disabled="disabled || page >= pageCount - 1" @click="emit('update:page', page + 1)"><LucideChevronRight class="h-3.5 w-3.5" aria-hidden="true" /></button>
			</div>
		</template>
		<span v-else>Aucune ligne</span>
	</div>
</template>
