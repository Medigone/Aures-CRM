/** Compteur « À traiter » du menu : il reste affiché quand on quitte la liste des tickets. */
import { ref } from 'vue'
import { getQueue } from './api'
import { canRead } from './droits'

export const todoCount = ref<number | undefined>()

export async function loadTodoCount() {
	// Sans droit sur les tickets, l'appel serait refusé à chaque page.
	if (!canRead('Ticket Commercial')) return
	try {
		todoCount.value = (await getQueue('todo', [], '', { pageLength: 1 })).counts.todo
	} catch {
		// Le compteur est un confort : le menu reste utilisable sans lui.
	}
}
