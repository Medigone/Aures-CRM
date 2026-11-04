<script setup lang="ts">
import { computed } from 'vue'
import StatusPill from '@shared/components/StatusPill.vue'
import { statusLabel } from '@/lib/display'

const props = defineProps<{ status?: string | null }>()
const tone = computed(() => (props.status === 'Pending' ? 'violet' : undefined))
</script>

<template>
	<StatusPill :status="statusLabel(status)" :tone="tone" />
</template>
