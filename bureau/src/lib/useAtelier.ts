/** État de l'atelier : chargement, calcul qui tourne, réglages et résultats tenus à jour. */
import { closeRealtime, connectRealtime, type RealtimeEvent } from '@shared/realtime'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createAtelierImposition, getAtelier, getAtelierCalcul, getSupportFormats, keepAtelierScenario, prepareAtelier, runAtelier, simulateFormat, simulateGrid } from './api'
import { isPdf, isRunning, manualFormat, sortScenarios, type AtelierCalcul, type AtelierData, type AtelierFormat, type AtelierReglages, type Scenario, type ScenarioSort } from './atelier'

// Le temps réel prévient de la fin ; la relecture reste pour une coupure.
const POLL_MS = 5000

export function useAtelier(source: () => { etude?: string; calcul?: string }, onTestCreated: (calcul: string) => void) {
	const data = ref<AtelierData | null>(null)
	const calcul = ref<AtelierCalcul | null>(null)
	const reglages = ref<AtelierReglages | null>(null)
	const formats = ref<AtelierFormat[]>([])
	const support = ref<string | null>(null)
	const grammage = ref(0)
	const fichier = ref<string | null>(null)
	const stale = ref(false)
	const essais = ref<Scenario[]>([])
	const shown = ref<string | null>(null)
	const retained = ref<number | null>(null)
	const sort = ref<ScenarioSort>('taux_chutes')
	const direction = ref<1 | -1>(1)
	const error = ref('')
	const loadError = ref('')
	const busy = ref(false)
	const simError = ref('')
	let timer: ReturnType<typeof setTimeout> | null = null
	let essaiId = 0

	const keyOf = (row: Scenario) => row.cle ?? `idx-${row.idx}`
	const rows = computed(() => (calcul.value ? sortScenarios(calcul.value.scenarios.filter((row) => row.nb_poses), sort.value, direction.value) : []))
	const sheets = computed(() => [...rows.value, ...essais.value])
	const current = computed(() => sheets.value.find((row) => keyOf(row) === shown.value) ?? sheets.value[0] ?? null)
	const retainedRow = computed(() => rows.value.find((row) => row.idx === retained.value) ?? null)
	const running = computed(() => isRunning(calcul.value))
	const canWork = computed(() => Boolean(data.value?.droits.calculer && (!data.value.etude || data.value.etude.ecriture)))
	const canCreate = computed(() => Boolean(canWork.value && data.value?.etude && data.value.droits.creer_imposition))
	const readable = computed(() => isPdf(fichier.value))
	const canSimulate = computed(() => Boolean(calcul.value?.cache_disponible && !running.value && !stale.value))
	const failed = computed(() => calcul.value?.statut_calcul === 'Échec')

	function stopPolling() {
		if (timer) clearTimeout(timer)
		timer = null
	}
	function poll() {
		stopPolling()
		if (!isRunning(calcul.value) || !calcul.value) return
		const name = calcul.value.name
		timer = setTimeout(async () => {
			try {
				const fresh = await getAtelierCalcul(name)
				if (calcul.value?.name !== name) return
				applyCalcul(fresh)
			} catch {
				// Coupure passagère : on retente au prochain tour.
			}
			poll()
		}, POLL_MS)
	}
	async function refreshRunning(name?: string) {
		if (!calcul.value || (name && calcul.value.name !== name) || !isRunning(calcul.value)) return
		try {
			applyCalcul(await getAtelierCalcul(calcul.value.name))
			poll()
		} catch {
			// La relecture prendra le relais.
		}
	}
	onMounted(() => {
		connectRealtime<RealtimeEvent & { calcul?: string }>('imposition_calcul_termine', (event) => refreshRunning(event.calcul), () => refreshRunning())
	})
	onBeforeUnmount(() => {
		stopPolling()
		closeRealtime()
	})

	function applyCalcul(fresh: AtelierCalcul) {
		calcul.value = fresh
		fichier.value = fresh.fichier_trace ?? fichier.value
		if (isRunning(fresh)) return
		const kept = fresh.scenarios.find((row) => row.retenu)
		if (kept) retained.value = kept.idx ?? null
		else if (!fresh.scenarios.some((row) => row.idx === retained.value)) retained.value = null
		const first = sortScenarios(fresh.scenarios.filter((row) => row.nb_poses), sort.value, direction.value)[0]
		if (!shown.value || !sheets.value.some((row) => keyOf(row) === shown.value)) shown.value = kept ? `idx-${kept.idx}` : first ? keyOf(first) : null
	}
	function apply(response: AtelierData) {
		data.value = response
		reglages.value = { ...response.reglages }
		formats.value = response.formats
		support.value = response.support
		grammage.value = response.grammage
		fichier.value = response.fichier_trace ?? response.etude?.trace_fichier ?? null
		stale.value = false
		essais.value = []
		shown.value = null
		retained.value = null
		calcul.value = null
		if (response.calcul) applyCalcul(response.calcul)
		poll()
	}
	async function load(calculName?: string) {
		loadError.value = ''
		stopPolling()
		const { etude, calcul: name } = source()
		try {
			apply(await getAtelier(etude, calculName ?? name))
		} catch (e) {
			loadError.value = (e as Error).message
		}
	}
	watch(() => [source().etude, source().calcul], ([etude, name], before) => {
		// Le test vient de recevoir son adresse : il est déjà à l'écran.
		if (before && !etude && name && calcul.value?.name === name) return
		load()
	}, { immediate: true })

	function values() {
		const settings = reglages.value!
		return {
			etude: data.value?.etude?.name,
			calcul: calcul.value?.name,
			fichier_trace: fichier.value,
			support_technique: support.value,
			pont: settings.pont,
			sens_fibre: settings.sens_fibre,
			trait_commun: settings.trait_commun,
			quantite: settings.quantite,
			lisiere: settings.lisiere,
			pince: settings.pince,
			marge_arriere: settings.marge_arriere,
			formats: formats.value.filter((row) => row.coche),
		}
	}
	/** Un test tout juste créé prend son adresse : un rechargement le retrouve. */
	function adopt(fresh: AtelierCalcul) {
		const isNew = calcul.value?.name !== fresh.name
		applyCalcul(fresh)
		if (isNew && !data.value?.etude) onTestCreated(fresh.name)
	}
	async function guarded(action: () => Promise<void>) {
		if (busy.value) return false
		busy.value = true
		error.value = ''
		try {
			await action()
			return true
		} catch (e) {
			error.value = (e as Error).message
			return false
		} finally {
			busy.value = false
		}
	}
	function run() {
		return guarded(async () => {
			const fresh = await runAtelier(values())
			stale.value = false
			essais.value = []
			shown.value = null
			retained.value = null
			adopt(fresh)
			poll()
		})
	}
	/** Le PDF déposé sert à ce calcul : le moteur le lit aussitôt, le fichier du tracé ne change pas. */
	function useFile(url: string) {
		fichier.value = url
		return guarded(async () => {
			const fresh = await prepareAtelier(values())
			stale.value = false
			essais.value = []
			shown.value = null
			adopt(fresh)
		})
	}
	function changed() {
		if (calcul.value?.scenarios.length) stale.value = true
	}
	function addFormat(laize: string, depl: string) {
		const row = manualFormat(laize, depl, formats.value)
		if (typeof row === 'string') return row
		formats.value = [...formats.value, row]
		changed()
		return ''
	}
	async function chooseSupport(name: string) {
		support.value = name || null
		try {
			const response = name ? await getSupportFormats(name) : { grammage: 0, pont_mini: 0, formats: [] }
			if ((support.value ?? '') !== name) return
			grammage.value = response.grammage
			if (response.pont_mini && reglages.value) reglages.value.pont = response.pont_mini
			// Lus après la réponse : un format ajouté pendant l'attente reste.
			formats.value = [...response.formats, ...formats.value.filter((row) => row.origine === 'Manuel')]
			changed()
		} catch (e) {
			error.value = (e as Error).message
		}
	}
	function setSort(key: ScenarioSort) {
		if (sort.value === key) direction.value = direction.value === 1 ? -1 : 1
		else {
			sort.value = key
			direction.value = 1
		}
	}
	function retain(row: Scenario) {
		shown.value = keyOf(row)
		if (canWork.value) retained.value = row.idx ?? null
	}
	function marges() {
		const settings = reglages.value!
		return { quantite: settings.quantite, lisiere: settings.lisiere, pince: settings.pince, marge_arriere: settings.marge_arriere, ignorer_contraintes_machine: 1 }
	}
	async function simulate(call: () => Promise<{ scenario: Scenario | null; message?: string }>) {
		simError.value = ''
		try {
			const response = await call()
			if (!response.scenario) {
				simError.value = response.message || 'Aucune pose ne tient sur ce format.'
				return
			}
			const cle = `essai-${++essaiId}`
			essais.value = [...essais.value, { ...response.scenario, origine: response.scenario.origine || 'Simulation', cle }]
			shown.value = cle
		} catch (e) {
			simError.value = (e as Error).message
		}
	}
	const tryFormat = (laize: string, depl: string) => simulate(() => simulateFormat(calcul.value!.name, { laize, depl, ...marges() }))
	const tryGrid = (rotation: string, nCol: string, nRang: string) => simulate(() => simulateGrid(calcul.value!.name, { rotation, n_col: nCol, n_rang: nRang, ...marges() }))
	function keep(row: Scenario) {
		return guarded(async () => {
			const { cle: _cle, ...scenario } = row
			await keepAtelierScenario(calcul.value!.name, scenario)
			const name = calcul.value!.name
			essais.value = essais.value.filter((other) => other !== row)
			const fresh = await getAtelierCalcul(name)
			applyCalcul(fresh)
			const added = fresh.scenarios[fresh.scenarios.length - 1]
			if (added) shown.value = `idx-${added.idx}`
		})
	}
	async function createImposition() {
		const etude = data.value?.etude
		if (!etude || !calcul.value || retained.value == null) return null
		let created = null
		await guarded(async () => {
			created = await createAtelierImposition(etude.name, calcul.value!.name, retained.value!)
		})
		return created as Awaited<ReturnType<typeof createAtelierImposition>> | null
	}
	return { data, calcul, reglages, formats, support, grammage, fichier, stale, essais, shown, retained, sort, direction, error, loadError, busy, simError, rows, sheets, current, retainedRow, running, failed, canWork, canCreate, canSimulate, readable, keyOf, load, run, useFile, changed, addFormat, chooseSupport, setSort, retain, tryFormat, tryGrid, keep, createImposition }
}
