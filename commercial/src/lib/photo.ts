/** Photo prise sur l'appareil, réduite (1600 px, JPEG) pour partir dans la file d'envoi. */
const MAX_SIDE = 1600
const QUALITY = 0.75

export async function compressPhoto(file: File): Promise<{ filename: string; data: string }> {
	const url = URL.createObjectURL(file)
	try {
		const image = await new Promise<HTMLImageElement>((resolve, reject) => {
			const img = new Image()
			img.onload = () => resolve(img)
			img.onerror = () => reject(new Error('Photo illisible.'))
			img.src = url
		})
		const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height))
		const canvas = document.createElement('canvas')
		canvas.width = Math.round(image.width * scale)
		canvas.height = Math.round(image.height * scale)
		canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
		const base = file.name.replace(/\.[^.]+$/, '') || 'photo'
		return { filename: `${base}.jpg`, data: canvas.toDataURL('image/jpeg', QUALITY) }
	} finally {
		URL.revokeObjectURL(url)
	}
}
