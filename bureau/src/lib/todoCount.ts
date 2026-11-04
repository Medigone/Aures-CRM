/** Compteur « À traiter » du menu : il reste affiché quand on quitte la liste des tickets. */
import { ref } from 'vue'
import { getQueue } from './api'

export const todoCount = ref<number | undefined>()

export async function loadTodoCount() {
	try {
		todoCount.value = (await getQueue('todo', [], '', { pageLength: 1 })).counts.todo
	} catch {
		// Le compteur est un confort : le menu reste utilisable sans lui.
	}
}
