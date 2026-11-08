/** Lecture du PDF choisi pour un tracé : dès qu'il est dans la file d'envoi, ses cotations sont proposées. */
import { ref, type Ref } from 'vue'
import type FileUploader from '@shared/components/FileUploader.vue'
import { analyzeTracePdf } from './api'
import { isPdfFile } from './articles'
import type { TraceAnalysis } from './traces'

type Uploader = InstanceType<typeof FileUploader>

export function useTraceAnalysis(uploader: Ref<Uploader | null>, found: (analysis: TraceAnalysis) => void) {
	const analysis = ref<TraceAnalysis | null>(null)
	const analyzing = ref(false)
	let current: File | null = null
	let request = 0
	async function onFileChange() {
		const file = uploader.value?.items[0]?.file ?? null
		if (file === current) return
		current = file
		analysis.value = null
		const asked = ++request
		if (!file || !isPdfFile(file.name)) {
			analyzing.value = false
			return
		}
		analyzing.value = true
		try {
			const result = await analyzeTracePdf(file)
			if (asked !== request) return
			analysis.value = result
			found(result)
		} catch (e) {
			if (asked === request) analysis.value = { lisible: false, message: `L'analyse du PDF a échoué : ${(e as Error).message}` }
		} finally {
			if (asked === request) analyzing.value = false
		}
	}
	return { analysis, analyzing, onFileChange }
}
