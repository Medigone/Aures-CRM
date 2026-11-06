/** Ce que tous les tiroirs de liste font pareil : clic extérieur et Échap ferment, les flèches changent de ligne. */
import { onBeforeUnmount, onMounted, type Ref } from 'vue'

const OVERLAY = '.dialog-scrim, .app-menu'
const TYPING = 'input:not([type="checkbox"]), textarea, select, [contenteditable]'

export function useDrawerControls(root: Ref<HTMLElement | null>, actions: { close: () => void; prev: () => void; next: () => void }) {
	/** Une ligne change d'article au lieu de fermer ; une fenêtre ou un menu ouverts au-dessus gardent le clic pour eux. */
	function onPointerDown(event: PointerEvent) {
		const target = event.target
		if (event.button !== 0 || !(target instanceof Element) || root.value?.contains(target)) return
		if (!target.closest(`.list-row, ${OVERLAY}`)) actions.close()
	}
	/** Le clavier se tait pendant une saisie, et sous une fenêtre ou un menu, qu'Échap ferme en premier. */
	function onKeydown(event: KeyboardEvent) {
		const action = { Escape: actions.close, ArrowUp: actions.prev, ArrowDown: actions.next }[event.key]
		if (!action || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
		if (event.target instanceof Element && event.target.closest(TYPING)) return
		if (document.querySelector(OVERLAY)) return
		event.preventDefault()
		action()
	}
	onMounted(() => {
		document.addEventListener('pointerdown', onPointerDown)
		document.addEventListener('keydown', onKeydown)
	})
	onBeforeUnmount(() => {
		document.removeEventListener('pointerdown', onPointerDown)
		document.removeEventListener('keydown', onKeydown)
	})
}
