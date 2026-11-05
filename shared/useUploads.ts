/** File d'envoi de fichiers : plusieurs à la fois, avec progression, annulation et reprise. */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getMaxFileSize, sendFile, type UploadedFile } from './api'
import { formatFileSize } from './text'

export type UploadStatus = 'queued' | 'sending' | 'done' | 'error' | 'refused'
export interface UploadTarget {
	doctype: string
	docname: string
}
export interface UploadItem {
	id: number
	file: File
	name: string
	size: number
	loaded: number
	status: UploadStatus
	error: string
	target: UploadTarget | null
	controller: AbortController | null
}
export interface UploadOptions {
	/** Le document qui reçoit les fichiers. Sans document, ils attendent `start`. */
	target: () => UploadTarget | null
	/** Sans envoi automatique, les fichiers attendent `start` : le document n'existe pas encore. */
	auto?: boolean
	concurrency?: number
	/** Refus propre au champ, comme un fichier qui n'est pas une image. */
	check?: (file: File) => string
	onUploaded?: (uploaded: UploadedFile, item: UploadItem) => unknown
	onSettled?: (sent: number, failed: number) => unknown
}

export function useUploads(options: UploadOptions) {
	const auto = options.auto ?? true
	const concurrency = options.concurrency ?? 3
	const items = ref<UploadItem[]>([])
	const maxSize = ref(0)
	let nextId = 0
	let active = 0
	let waiting: ((failed: number) => void)[] = []

	onMounted(async () => {
		maxSize.value = await getMaxFileSize()
	})

	function refusal(file: File) {
		if (!file.size) return 'Fichier vide : il ne peut pas être envoyé.'
		if (maxSize.value && file.size > maxSize.value) return `${formatFileSize(file.size)} : trop lourd, ${formatFileSize(maxSize.value)} maximum par fichier`
		return options.check?.(file) ?? ''
	}

	function add(files: Iterable<File> | ArrayLike<File>) {
		for (const file of Array.from(files)) {
			const error = refusal(file)
			items.value.push({ id: ++nextId, file, name: file.name, size: file.size, loaded: 0, status: error ? 'refused' : 'queued', error, target: auto ? options.target() : null, controller: null })
		}
		if (auto) pump()
		else settle()
	}

	async function run(item: UploadItem, target: UploadTarget) {
		active += 1
		item.status = 'sending'
		item.loaded = 0
		item.error = ''
		item.controller = new AbortController()
		try {
			const uploaded = await sendFile(item.file, target.doctype, target.docname, {
				signal: item.controller.signal,
				onProgress: (loaded) => {
					item.loaded = loaded
				},
			})
			item.loaded = item.size
			item.status = 'done'
			await options.onUploaded?.(uploaded, item)
		} catch (e) {
			if (item.controller?.signal.aborted) {
				items.value = items.value.filter((row) => row.id !== item.id)
			} else {
				item.status = 'error'
				item.error = (e as Error).message
			}
		} finally {
			item.controller = null
			active -= 1
			pump()
		}
	}

	function pump() {
		while (active < concurrency) {
			const index = items.value.findIndex((row) => row.status === 'queued' && row.target)
			if (index < 0) break
			// Passer par le tableau réactif : la barre suit l'avancement.
			const item = items.value[index]
			run(item, item.target as UploadTarget)
		}
		settle()
	}

	function settle() {
		if (active || items.value.some((row) => row.status === 'queued' && row.target)) return
		const sent = items.value.filter((row) => row.status === 'done').length
		const failed = items.value.filter((row) => row.status === 'error').length
		const refused = items.value.filter((row) => row.status === 'refused').length
		if (!sent && !failed && !waiting.length) return
		// Ce qui est envoyé apparaît dans la liste du document : seuls les échecs restent ici.
		if (!failed) items.value = items.value.filter((row) => row.status !== 'done')
		const resolvers = waiting
		waiting = []
		resolvers.forEach((resolve) => resolve(failed + refused))
		if (sent || failed) options.onSettled?.(sent, failed)
	}

	/** Lance l'envoi des fichiers en attente et donne le nombre d'échecs. */
	function start(target: UploadTarget) {
		return new Promise<number>((resolve) => {
			waiting.push(resolve)
			for (const item of items.value) if (item.status === 'queued') item.target = target
			pump()
		})
	}

	function cancel(id: number) {
		const item = items.value.find((row) => row.id === id)
		if (item?.controller) item.controller.abort()
		else {
			items.value = items.value.filter((row) => row.id !== id)
			settle()
		}
	}
	function cancelAll() {
		for (const item of [...items.value]) if (item.status === 'queued' || item.status === 'sending') cancel(item.id)
	}
	function retry(id: number) {
		const item = items.value.find((row) => row.id === id)
		if (item?.status !== 'error') return
		item.status = 'queued'
		item.error = ''
		pump()
	}
	function retryAll() {
		for (const item of items.value) {
			if (item.status === 'error') {
				item.status = 'queued'
				item.error = ''
			}
		}
		pump()
	}
	function clear() {
		items.value = []
	}

	const sending = computed(() => items.value.some((row) => row.status === 'sending' || row.status === 'queued'))
	const counted = computed(() => items.value.filter((row) => row.status !== 'refused'))
	const percent = computed(() => {
		const total = counted.value.reduce((sum, row) => sum + row.size, 0)
		const done = counted.value.reduce((sum, row) => sum + row.loaded, 0)
		return total ? Math.min(100, Math.round((done / total) * 100)) : 0
	})

	// Fermer l'onglet coupe l'envoi : le navigateur le demande d'abord.
	function onBeforeUnload(event: BeforeUnloadEvent) {
		if (active) event.preventDefault()
	}
	onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
	onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))

	return { items, maxSize, sending, percent, add, start, cancel, cancelAll, retry, retryAll, clear }
}
