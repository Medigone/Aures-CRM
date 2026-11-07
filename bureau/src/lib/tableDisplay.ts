/**
 * Tableau personnalisable de DataList : épinglage, densité et réglages d'affichage par liste et par utilisateur.
 * Rien ici n'écrit le contenu des lignes : seulement des clés de colonnes, des largeurs et une densité.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties, type Ref } from 'vue'
import type { Column } from './list'

export type Density = 'compact' | 'normal' | 'comfortable'
export const DENSITIES: { key: Density; label: string }[] = [
	{ key: 'compact', label: 'Condensée' },
	{ key: 'normal', label: 'Normale' },
	{ key: 'comfortable', label: 'Aérée' },
]
const DEFAULT_DENSITY: Density = 'normal'

export interface TablePrefs {
	/** Colonnes épinglées par l'utilisateur, sans la colonne verrouillée qui l'est toujours. */
	pinned: string[]
	density: Density
}

/** Colonne verrouillée comprise. Limite aussi les règles CSS de `tableDisplay.css`. */
export const MAX_PINNED = 5
/** Au-delà de cette part de la largeur visible, il ne resterait plus de place pour faire défiler le reste. */
const MAX_PINNED_SHARE = 0.6
const NARROW_QUERY = '(max-width: 720px)'
const COARSE_QUERY = '(pointer: coarse)'
const DEFAULT_MIN_WIDTH = 56
const NARROW_MAIN_WIDTH = 140
export const WIDTH_STEP = 16
export const WIDTH_STEP_LARGE = 48
/** Case à cocher et contour du plateau, avant la première colonne. */
const CHECK_START = 33
const NO_CHECK_START = 15
const COLUMN_GAP = 8
/** Le fond fixe déborde un peu : le texte qui défile ne colle pas à la colonne épinglée. */
const PLATE_MARGIN = 4

/** Identifiant opaque du compte, pour ne pas écrire l'e-mail en clair. Une empreinte de séparation, pas une protection. */
export function opaqueId(value: string) {
	let first = 0xdeadbeef
	let second = 0x41c6ce57
	for (let index = 0; index < value.length; index++) {
		const code = value.charCodeAt(index)
		first = Math.imul(first ^ code, 2654435761)
		second = Math.imul(second ^ code, 1597334677)
	}
	first = Math.imul(first ^ (first >>> 16), 2246822507) ^ Math.imul(second ^ (second >>> 13), 3266489909)
	second = Math.imul(second ^ (second >>> 16), 2246822507) ^ Math.imul(first ^ (first >>> 13), 3266489909)
	return (first >>> 0).toString(36) + (second >>> 0).toString(36)
}

/** Une clé par liste, par version, par site et par utilisateur. Le préfixe sert aussi aux colonnes, largeurs et vue active de la liste. */
export function tableStorageKey(list: string, site: string, user: string | null | undefined) {
	return `aures:bureau:${list}:v1:${site}:${opaqueId(user || 'anonyme')}`
}

const prefsKey = (key: string) => `${key}:affichage`

export function readTablePrefs(key: string): TablePrefs {
	const fallback: TablePrefs = { pinned: [], density: DEFAULT_DENSITY }
	try {
		const saved = JSON.parse(localStorage.getItem(prefsKey(key)) || 'null')
		if (!saved || typeof saved !== 'object' || saved.v !== 1) return fallback
		const pinned = Array.isArray(saved.pinned) ? [...new Set<string>(saved.pinned.filter((item: unknown) => typeof item === 'string' && item))] : []
		return { pinned, density: DENSITIES.some(({ key: item }) => item === saved.density) ? saved.density : DEFAULT_DENSITY }
	} catch {
		return fallback
	}
}

export function writeTablePrefs(key: string, prefs: TablePrefs) {
	try {
		localStorage.setItem(prefsKey(key), JSON.stringify({ v: 1, pinned: prefs.pinned, density: prefs.density }))
	} catch {
		// Stockage indisponible : le choix vaut pour cette session.
	}
}

/** Efface l'affichage de cette liste : colonnes, largeurs, épinglage et densité. La vue active et les autres listes ne bougent pas. */
export function clearTablePrefs(key: string) {
	try {
		for (const item of [key, `${key}:largeurs`, prefsKey(key)]) localStorage.removeItem(item)
	} catch {
		// Stockage indisponible : rien à effacer.
	}
}

export function minColumnWidth(column: { minWidth?: number }) {
	return column.minWidth ?? DEFAULT_MIN_WIDTH
}

/** Les colonnes épinglées passent devant, dans leur ordre, derrière la colonne verrouillée. Le reste garde le sien. */
export function pinnedFirst<Row>(columns: Column<Row>[], pinned: string[], locked: string) {
	const isPinned = (key: string) => key === locked || pinned.includes(key)
	return [...columns.filter(({ key }) => key === locked), ...columns.filter(({ key }) => key !== locked && isPinned(key)), ...columns.filter(({ key }) => !isPinned(key))]
}

/** Sur petit écran, la colonne principale reste fixe sans prendre toute la largeur. Les réglages enregistrés ne changent pas. */
export function capMainColumn<Row>(columns: Column<Row>[], locked: string) {
	return columns.map((column) => (column.key === locked && column.width > NARROW_MAIN_WIDTH ? { ...column, width: NARROW_MAIN_WIDTH, grow: undefined } : column))
}

/** Décalage de chaque colonne fixe depuis le bord gauche de la zone de défilement. */
export function pinOffsets(widths: number[], start: number, gap = COLUMN_GAP) {
	let left = start
	return widths.map((width) => {
		const offset = left
		left += width + gap
		return offset
	})
}

/** Nombre de colonnes qui restent fixes : celles qui tiennent sans occuper presque toute la largeur visible. */
export function stickyCount(widths: number[], start: number, available: number, narrow: boolean, gap = COLUMN_GAP) {
	const allowed = narrow ? Math.min(widths.length, 1) : widths.length
	if (!available) return allowed
	let used = start
	let count = 0
	for (const width of widths.slice(0, allowed)) {
		used += width + (count ? gap : 0)
		if (used > available * MAX_PINNED_SHARE) break
		count++
	}
	return count
}

function useMediaQuery(query: string) {
	const media = typeof window.matchMedia === 'function' ? window.matchMedia(query) : null
	const matches = ref(Boolean(media?.matches))
	const update = () => (matches.value = Boolean(media?.matches))
	onMounted(() => media?.addEventListener?.('change', update))
	onBeforeUnmount(() => media?.removeEventListener?.('change', update))
	return matches
}

export interface TableDisplayOptions<Row> {
	storageKey: string
	locked: string
	columns: Ref<Column<Row>[]>
	selectable: Ref<boolean>
	scroller: Ref<HTMLElement | null>
}

export function useTableDisplay<Row>({ storageKey, locked, columns, selectable, scroller }: TableDisplayOptions<Row>) {
	const initial = readTablePrefs(storageKey)
	const pinned = ref<string[]>(initial.pinned)
	const density = ref<Density>(initial.density)
	const narrow = useMediaQuery(NARROW_QUERY)
	const coarse = useMediaQuery(COARSE_QUERY)
	const measured = ref<Record<string, number>>({})
	const available = ref(0)
	const scrolled = ref(false)
	const moreRight = ref(false)

	function save() {
		writeTablePrefs(storageKey, { pinned: pinned.value, density: density.value })
	}
	const setDensity = (next: Density) => {
		density.value = next
		save()
	}
	const isPinned = (key: string) => key === locked || pinned.value.includes(key)
	// Un réglage ancien peut dépasser la limite ou citer une colonne disparue : seules comptent les colonnes affichées.
	const ordered = computed(() => {
		const arranged = pinnedFirst(columns.value, pinned.value, locked)
		return narrow.value ? capMainColumn(arranged, locked) : arranged
	})
	const pinnedColumns = computed(() => ordered.value.filter(({ key }) => isPinned(key)).slice(0, MAX_PINNED))
	const canPinMore = computed(() => pinnedColumns.value.length < MAX_PINNED)
	function togglePin(key: string) {
		if (key === locked) return
		if (pinned.value.includes(key)) pinned.value = pinned.value.filter((item) => item !== key)
		else if (canPinMore.value) pinned.value = [...pinned.value, key]
		save()
	}
	const unpin = (key: string) => {
		if (!pinned.value.includes(key)) return
		pinned.value = pinned.value.filter((item) => item !== key)
		save()
	}
	function resetPrefs() {
		pinned.value = []
		density.value = DEFAULT_DENSITY
		clearTablePrefs(storageKey)
	}

	const start = computed(() => (selectable.value ? CHECK_START : NO_CHECK_START))
	const pinnedWidths = computed(() => pinnedColumns.value.map(({ key, width }) => measured.value[key] ?? width))
	const sticky = computed(() => stickyCount(pinnedWidths.value, start.value, available.value, narrow.value))
	const suspended = computed(() => !narrow.value && sticky.value < pinnedColumns.value.length)
	const rootStyle = computed<CSSProperties>(() => {
		const widths = pinnedWidths.value.slice(0, sticky.value)
		const offsets = pinOffsets(widths, start.value)
		const vars: Record<string, string> = {}
		offsets.forEach((offset, index) => (vars[`--pin-left-${index + 1}`] = `${offset}px`))
		const end = offsets.length ? offsets[offsets.length - 1] + widths[widths.length - 1] + PLATE_MARGIN : 0
		vars['--pin-end'] = `${end}px`
		return vars as CSSProperties
	})
	const rootAttrs = computed(() => ({
		'data-density': density.value,
		'data-sticky': String(sticky.value),
		'data-scrolled': scrolled.value ? 'true' : undefined,
		'data-more-right': moreRight.value ? 'true' : undefined,
	}))

	function measure() {
		const box = scroller.value
		if (!box) return
		available.value = box.clientWidth
		scrolled.value = box.scrollLeft > 0
		moreRight.value = box.scrollLeft + box.clientWidth < box.scrollWidth - 1
		const heads = box.querySelectorAll<HTMLElement>('.list-head .list-th')
		const next: Record<string, number> = {}
		ordered.value.forEach(({ key }, index) => {
			const width = heads[index]?.getBoundingClientRect().width
			if (width) next[key] = width
		})
		measured.value = next
	}
	let observer: ResizeObserver | null = null
	function observe() {
		if (!observer || !scroller.value) return
		observer.disconnect()
		observer.observe(scroller.value)
		scroller.value.querySelectorAll('.list-head .list-th').forEach((head) => observer!.observe(head))
	}
	onMounted(() => {
		if (typeof ResizeObserver !== 'undefined') observer = new ResizeObserver(measure)
		observe()
		measure()
		scroller.value?.addEventListener('scroll', measure, { passive: true })
	})
	onBeforeUnmount(() => {
		observer?.disconnect()
		scroller.value?.removeEventListener('scroll', measure)
	})
	watch(
		() => ordered.value.map(({ key }) => key).join(),
		async () => {
			await nextTick()
			observe()
			measure()
		},
	)

	return { pinned, density, narrow, coarse, ordered, canPinMore, sticky, suspended, rootStyle, rootAttrs, isPinned, setDensity, togglePin, unpin, resetPrefs }
}

/** Ce dont a besoin le panneau : sans les colonnes, dont le type dépend de la liste. */
export type TableDisplay = Omit<ReturnType<typeof useTableDisplay>, 'ordered'>
