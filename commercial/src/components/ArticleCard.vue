<script setup lang="ts">
import { RouterLink } from 'vue-router'
import StatusPill from '@shared/components/StatusPill.vue'
import { isLocal } from '@/lib/mutations'
import type { Article } from '@/types'

defineProps<{ article: Article }>()
</script>

<template>
	<RouterLink :to="{ name: 'Article', params: { id: article.name } }" class="card-link p-3">
		<div class="flex items-start justify-between gap-2">
			<div class="min-w-0">
				<p class="line-clamp-2 font-medium">{{ article.designation }}</p>
				<p class="truncate text-sm text-ink-gray-6">
					<template v-if="isLocal(article.name)"><span class="pending-dot mr-1" />À envoyer</template><template v-else>{{ article.name }}</template><template v-if="article.code_client"> · réf. client {{ article.code_client }}</template>
				</p>
			</div>
			<StatusPill v-if="article.bat" :status="article.bat.status === 'Nouveau' ? 'BAT en cours' : article.bat.status" />
		</div>
		<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-gray-6">
			<span v-if="article.procede">{{ article.procede }}</span>
			<span v-if="article.dimensions">{{ article.dimensions }}</span>
			<span v-if="article.support">{{ article.support }}</span>
			<span v-if="article.sous_article">Sous-article</span>
			<span v-if="article.compose">Article composé</span>
		</div>
	</RouterLink>
</template>
