/** État de l'atelier : chargement, calcul qui tourne, réglages et résultats tenus à jour. */
import { closeRealtime, connectRealtime, type RealtimeEvent } from '@shared/realtime'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createAtelierImposition, getAtelier, getAtelierCalcul, getSupportFormats, keepAtelierScenario, prepareAtelier, runAtelier, saveAtelierTiers, simulateFormat } from './api'
import { isPdf, isRunning, manualFormat, referenceFormat, rollOf, sameSheet, sortScenarios, type AtelierCalcul, type AtelierData, type AtelierFormat, type AtelierReference, type AtelierReglages, type Scenario, type ScenarioSort } from './atelier'

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
	const roll = computed(() => rollOf(current.value, formats.value))

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
			motifs: settings.motifs,
			fibre_trace: settings.fibre_trace,
			trait_commun: settings.trait_commun,
			quantite: settings.quantite,
			paliers: settings.paliers,
			prix_tonne: settings.prix_tonne,
			grammage: grammage.value,
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
	// Paliers, prix et grammage se gardent sur le calcul dès qu'ils changent, sans relancer le moteur.
	let tiersTimer: ReturnType<typeof setTimeout> | null = null
	watch(
		() => (reglages.value ? JSON.stringify([reglages.value.paliers, reglages.value.prix_tonne, grammage.value]) : ''),
		(now, before) => {
			if (!now || !before || !calcul.value || !canWork.value) return
			if (tiersTimer) clearTimeout(tiersTimer)
			const name = calcul.value.name
			tiersTimer = setTimeout(() => {
				const settings = reglages.value
				if (!settings || calcul.value?.name !== name || isRunning(calcul.value)) return
				saveAtelierTiers(name, { paliers: settings.paliers ?? [], prix_tonne: settings.prix_tonne ?? 0, grammage: grammage.value }).catch(() => {
					// Gardés au prochain calcul de toute façon.
				})
			}, 600)
		},
	)
	function changed() {
		if (calcul.value?.scenarios.length) stale.value = true
	}
	function addFormat(laize: string, depl: string, bobine = false) {
		const row = manualFormat(laize, depl, formats.value, bobine)
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
			if (response.prix_tonne && reglages.value) reglages.value.prix_tonne = response.prix_tonne
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
	/** Un essai donne la grille droite, puis le motif quand il fait plus de poses : on montre le dernier, le meilleur. */
	async function simulate(call: () => Promise<{ scenario: Scenario | null; scenarios?: Scenario[]; message?: string }>) {
		simError.value = ''
		try {
			const response = await call()
			const found = response.scenarios?.length ? response.scenarios : response.scenario ? [response.scenario] : []
			if (!found.length) {
				simError.value = response.message || 'Aucune pose ne tient sur ce format.'
				return
			}
			const added = found.map((row) => ({ ...row, origine: row.origine || 'Simulation', cle: `essai-${++essaiId}` }))
			essais.value = [...essais.value, ...added]
			shown.value = added[added.length - 1].cle
		} catch (e) {
			simError.value = (e as Error).message
		}
	}
	const tryFormat = (laize: string, depl: string, fibre = '') => simulate(() => simulateFormat(calcul.value!.name, { laize, depl, fibre, ...marges() }))
	/** Une coupe de la bobine : déjà calculée, on la montre ; sinon elle s'ajoute comme un essai, qu'on peut garder. */
	function showCut(row: Scenario) {
		simError.value = ''
		const known = sheets.value.find((other) => sameSheet(other, row))
		if (known) {
			shown.value = keyOf(known)
			return
		}
		const cle = `essai-${++essaiId}`
		essais.value = [...essais.value, { ...row, cle }]
		shown.value = cle
	}
	/**
	 * Partir d'une imposition déjà faite : son format s'essaie aussitôt quand le tracé est lu, sans rien enregistrer ;
	 * sinon il rejoint les formats à comparer, coché, pour le prochain calcul.
	 */
	async function startFrom(row: AtelierReference): Promise<'essai' | 'format' | ''> {
		const format = referenceFormat(row)
		if (!format) return ''
		// Feuille déjà dans le tableau : on la montre plutôt que d'en faire un essai en double.
		const sheet = sheets.value.find((other) => Math.abs(other.laize - format.laize) < 2 && Math.abs(other.depl - format.depl) < 2)
		if (sheet && !stale.value) {
			shown.value = keyOf(sheet)
			return 'essai'
		}
		if (canSimulate.value) {
			// La fibre de la même feuille au catalogue, si on la connaît.
			const catalogue = formats.value.find((other) => !other.bobine && Math.abs(other.laize - format.laize) < 2 && Math.abs(other.depl - format.depl) < 2)
			await tryFormat(String(format.laize), String(format.depl), catalogue?.fibre ?? '')
			return simError.value ? '' : 'essai'
		}
		const known = formats.value.find((other) => !other.bobine && Math.abs(other.laize - format.laize) < 2 && Math.abs(other.depl - format.depl) < 2)
		if (known) {
			if (!known.coche) {
				known.coche = true
				changed()
			}
			return 'format'
		}
		const error = addFormat(String(format.laize), String(format.depl))
		if (error) simError.value = error
		return error ? '' : 'format'
	}
	function keep(row: Scenario) {
		return guarded(async () => {
			const { cle: _cle, poses: _poses, criteres: _criteres, fibre_feuille: _fibre, cout_complet: _cout, ...scenario } = row as Scenario & { criteres?: unknown; fibre_feuille?: unknown; cout_complet?: unknown }
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
	return { data, calcul, reglages, formats, support, grammage, fichier, stale, essais, shown, retained, sort, direction, error, loadError, busy, simError, rows, sheets, current, retainedRow, running, failed, canWork, canCreate, canSimulate, readable, roll, keyOf, load, run, useFile, changed, addFormat, chooseSupport, setSort, retain, tryFormat, startFrom, showCut, keep, createImposition }
}
