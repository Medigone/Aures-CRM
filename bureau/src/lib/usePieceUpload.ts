/** Fichier d'une pièce : il part une fois la pièce créée, puis se range dessus. Sans fichier choisi, la pièce se suffit. */
import { ref, type Ref } from 'vue'
import type FileUploader from '@shared/components/FileUploader.vue'
import type { UploadedFile } from '@shared/api'
import { setPieceFile } from './api'
import type { PiecesResult } from './etudePieces'

type Uploader = InstanceType<typeof FileUploader>

export function usePieceUpload(uploader: Ref<Uploader | null>, piece: string, doctype: string) {
	const uploading = ref(false)
	let result: PiecesResult | null = null
	let url = ''
	let settle: ((value: PiecesResult) => void) | null = null
	let fail: ((error: Error) => void) | null = null

	const hasFile = () => Boolean(uploader.value?.items.length)
	function onUploaded(file: UploadedFile) {
		url = file.file_url
	}
	async function onSettled(_sent: number, failed: number) {
		uploading.value = false
		try {
			if (failed || !url || !result) throw new Error("Le fichier n'est pas joint. Réessayez l'envoi.")
			settle?.(await setPieceFile(result.etude, piece, url))
		} catch (e) {
			fail?.(e as Error)
		}
	}
	/** Après l'enregistrement de la pièce. Renvoie l'état à jour, fichier rangé. */
	function send(saved: PiecesResult) {
		if (!hasFile() || !saved.piece) return Promise.resolve(saved)
		result = saved
		url = ''
		uploading.value = true
		return new Promise<PiecesResult>((resolve, reject) => {
			settle = resolve
			fail = reject
			// Après un envoi raté, le fichier reste en erreur : il repart sans passer par la file.
			if (uploader.value?.items.some((item) => item.status === 'error')) uploader.value.retryAll()
			else uploader.value?.start({ doctype, docname: saved.piece! })
		})
	}
	return { uploading, hasFile, onUploaded, onSettled, send }
}
