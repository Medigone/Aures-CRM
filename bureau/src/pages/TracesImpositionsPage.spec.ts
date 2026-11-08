import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '@/App.vue'
import { setPoste } from '@/lib/postes'
import { routes } from '@/router'

vi.mock('@shared/realtime', async (original) => ({
	...(await original<typeof import('@shared/realtime')>()),
	connectRealtime: vi.fn(),
	closeRealtime: vi.fn(),
}))

const traceRow = { name: 'TRA-1', modified: '2026-11-04 10:00:00', creation: '2026-01-01 10:00:00', tags: [], cloche: false, statut: 'En service', ver: 2, client: 'CLI-1', client_label: 'BISCUITERIE SAI', article: 'CLI-1-001', designation: 'QAADA BOÎTE', procede: 'Offset', dimensions: '72x46.5x107', points_colle: 3, fichier: 'image', impositions: 2 }
const traces = { traces: [traceRow], counts: { service: 1, sans_imposition: 0, image: 1, obsoletes: 1, all: 2 }, total: 1, start: 0, page_length: 20, names: ['TRA-1'] }
const imposition = { name: 'IMP-1', poses: 12, format: '1020 × 700', chutes: 33.8, machine: 'KOMORI 40', ideale: true, obsolete: false, groupage: null, origine: 'Moteur v1', creation: '2026-01-02 10:00:00' }
const traceDetail = {
	...traceRow,
	can_write: true,
	can_version: true,
	can_replace_file: false,
	date_activation: '2026-11-04',
	version_origine: 'TRA-0',
	remplacee_par: null,
	desc_changements: 'Patte de collage élargie',
	cotations: '72x46.5x107',
	fichier: { url: '/files/trace.png', name: 'trace.png', kind: 'image' },
	versions: [
		{ name: 'TRA-1', ver: 2, statut: 'En service', date_activation: '2026-11-04', desc_changements: 'Patte de collage élargie', fichier: null, dimensions: '72x46.5x107', par: 'Lina' },
		{ name: 'TRA-0', ver: 1, statut: 'Obsolète', date_activation: '2026-01-01', desc_changements: null, fichier: null, dimensions: '70x46x107', par: 'Lina' },
	],
	impositions: [imposition, { ...imposition, name: 'IMP-2', ideale: false }],
	etudes: [{ name: 'ETF-1', status: 'En étude', demande: 'DF-1', assigne: null, creation: '2026-01-01 10:00:00' }],
	formes: [],
	comments: { count: 0, last: null },
}
const impositionRow = { name: 'IMP-1', modified: '2026-11-04 10:00:00', creation: '2026-01-02 10:00:00', tags: [], cloche: false, client: 'CLI-1', client_label: 'BISCUITERIE SAI', article: 'CLI-1-001', designation: 'QAADA BOÎTE', trace: 'TRA-1', procede: 'Offset', poses: 12, grille: '4 × 3', format: '1020 × 700', support: 'Palette', chutes: 33.8, machine: 'KOMORI 40', origine: 'Moteur v1', ideale: true, ideale_manuelle: false, obsolete: false, groupage: null }
const impositions = { impositions: [impositionRow, { ...impositionRow, name: 'IMP-9', ideale: false, obsolete: true }], counts: { valables: 1, ideales: 1, atelier: 1, main: 0, groupees: 0, obsoletes: 1, all: 2 }, total: 2, start: 0, page_length: 20, names: ['IMP-1', 'IMP-9'] }
const impositionDetail = {
	...impositionRow,
	can_write: true,
	can_choose: false,
	can_auto: false,
	trace: { name: 'TRA-1', dimensions: '72x46.5x107', ver: 2, statut: 'En service' },
	n_col: 4,
	n_rang: 3,
	rotation: 0,
	motif: 'Grille droite',
	format_support: null,
	pas_laize: 247.2,
	pas_depl: 171.55,
	pont: 2.5,
	trait_commun: ['en laize'],
	machine_decoupe: null,
	forme: null,
	calcul: null,
	articles_groupes: [],
	fichier: null,
	dessin: null,
	atelier: { etude: 'ETF-1', status: 'En étude' },
	autres: [],
	etudes: [],
	comments: { count: 0, last: null },
}

let currentTrace: typeof traceDetail = traceDetail
let currentImposition: typeof impositionDetail = impositionDetail
const versionResult = () => ({ name: 'TRA-2', ver: 3, impositions: 2, formes: [], etudes: ['ETF-1'], trace: { ...traceDetail, name: 'TRA-2', ver: 3 } })
const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
	const url = String(input)
	const body = url.includes('get_traces')
		? traces
		: url.includes('get_trace_options') || url.includes('get_imposition_options')
			? { doctype: 'Trace', filter_fields: [] }
			: url.includes('get_trace_preview')
				? { image: 'data:image/png;base64,AAAA', pages: 2, width: 1400, height: 900 }
				: url.includes('create_trace_version')
				? versionResult()
				: url.includes('get_trace_activity') || url.includes('get_imposition_activity')
					? { items: [], comment_count: 0 }
					: url.includes('get_trace')
						? currentTrace
						: url.includes('get_impositions')
							? impositions
							: url.includes('set_imposition_ideale')
								? { ...currentImposition, ideale_manuelle: true, can_choose: false, can_auto: true }
								: url.includes('get_imposition')
									? currentImposition
									: null
	return Promise.resolve(new Response(JSON.stringify({ message: body }), { status: 200 }))
})
const sent = (method: string) => {
	const call = fetchMock.mock.calls.find((item) => String(item[0]).includes(method))
	if (!call) return undefined
	const body = (call[1] as RequestInit | undefined)?.body
	return body ? JSON.parse(String(body)) : Object.fromEntries(new URL(String(call[0]), 'https://x.test').searchParams)
}

async function open(path: string) {
	const router = createRouter({ history: createMemoryHistory('/bureau'), routes })
	await router.push(path)
	await router.isReady()
	const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body })
	await flushPromises()
	return { wrapper, router }
}

describe('pages Tracés et Impositions', () => {
	beforeEach(() => {
		window.can_access = true
		window.user = 'etude@example.com'
		currentTrace = traceDetail
		currentImposition = impositionDetail
		fetchMock.mockClear()
		vi.stubGlobal('fetch', fetchMock)
	})
	afterEach(() => {
		delete window.postes
		delete window.droits
		setPoste('')
		localStorage.clear()
		vi.unstubAllGlobals()
		document.body.innerHTML = ''
	})

	it('liste les tracés en service, sans création', async () => {
		const { wrapper } = await open('/traces')
		expect(sent('get_traces').view).toBe('service')
		expect(wrapper.text()).toContain('TRA-1')
		expect(wrapper.text()).toContain('V2')
		expect(wrapper.text()).toContain('72 × 46,5 × 107')
		expect(wrapper.text()).not.toContain('Nouveau tracé')
		wrapper.unmount()
	})

	it("l'adresse garde la vue des tracés", async () => {
		const { wrapper } = await open('/traces?vue=image')
		expect(sent('get_traces').view).toBe('image')
		wrapper.unmount()
	})

	it('la fiche du tracé montre ses versions, ses impositions et ses études', async () => {
		const { wrapper } = await open('/traces/TRA-1')
		expect(wrapper.find('.record-head').text()).toContain('En service')
		const versions = wrapper.find('.trace-versions')
		expect(versions.text()).toContain('V2')
		expect(versions.text()).toContain('Patte de collage élargie')
		expect(versions.text()).toContain('Première version.')
		expect(wrapper.text()).toContain('IMP-2')
		expect(wrapper.text()).toContain('ETF-1')
		expect(wrapper.text()).toContain("l'atelier ne peut pas la lire")
		wrapper.unmount()
	})

	it("une nouvelle version dit ce qu'elle entraîne, exige sa description, puis passe sur la version créée", async () => {
		const { wrapper, router } = await open('/traces/TRA-1')
		const button = wrapper.findAll('.record-actions button').find((item) => item.text() === 'Nouvelle version')!
		await button.trigger('click')
		await flushPromises()
		const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement
		expect(dialog.textContent).toContain('V3')
		expect(dialog.textContent).toContain('2 impositions deviendront obsolètes')
		expect(dialog.textContent).toContain("L'étude en cours passera sur la nouvelle version")
		const submit = [...dialog.querySelectorAll('button')].find((item) => item.textContent?.trim() === 'Mettre en service') as HTMLButtonElement
		submit.click()
		await flushPromises()
		expect(dialog.textContent).toContain('Décrivez ce qui change')
		expect(sent('create_trace_version')).toBeUndefined()
		const textarea = dialog.querySelector('textarea') as HTMLTextAreaElement
		textarea.value = 'Rabat agrandi'
		textarea.dispatchEvent(new Event('input'))
		submit.click()
		await flushPromises()
		expect(sent('create_trace_version').desc_changements).toBe('Rabat agrandi')
		expect(router.currentRoute.value.params.id).toBe('TRA-2')
		wrapper.unmount()
	})

	it("montre l'aperçu d'un tracé en PDF, qui ouvre le PDF complet", async () => {
		currentTrace = { ...traceDetail, fichier: { url: '/files/trace.pdf', name: 'trace.pdf', kind: 'pdf' } }
		const { wrapper } = await open('/traces/TRA-1')
		await flushPromises()
		const image = wrapper.find('.trace-preview-box img')
		expect(image.attributes('src')).toBe('data:image/png;base64,AAAA')
		expect(wrapper.find('.trace-preview-box a').attributes('href')).toBe('/files/trace.pdf')
		expect(wrapper.text()).toContain('Première page sur 2')
		expect(sent('get_trace_preview').name).toBe('TRA-1')
		wrapper.unmount()
	})

	it("une version obsolète ne propose pas de nouvelle version, mais mène à celle en service", async () => {
		currentTrace = { ...traceDetail, statut: 'Obsolète', can_version: false, remplacee_par: 'TRA-2' }
		const { wrapper } = await open('/traces/TRA-1')
		expect(wrapper.find('.record-actions').text()).not.toContain('Nouvelle version')
		expect(wrapper.find('.record-actions').text()).toContain('Voir la version en service')
		expect(wrapper.text()).toContain('Version remplacée')
		wrapper.unmount()
	})

	it('liste les impositions valables, avec leur état', async () => {
		const { wrapper } = await open('/impositions')
		expect(sent('get_impositions').view).toBe('valables')
		expect(wrapper.text()).toContain('IMP-1')
		expect(wrapper.text()).toContain('Idéale')
		expect(wrapper.text()).toContain('33,8 %')
		wrapper.unmount()
	})

	it("la fiche d'une imposition est en lecture et mène à l'étude en cours pour la refaire", async () => {
		const { wrapper } = await open('/impositions/IMP-1')
		const refaire = wrapper.findAll('.record-actions a').find((item) => item.text() === "Refaire à l'atelier")!
		expect(refaire.attributes('href')).toBe('/bureau/etudes/ETF-1/atelier')
		expect(wrapper.find('.fiche-releve').text()).toContain('4 colonnes × 3 rangs')
		expect(wrapper.find('.fiche-releve').text()).toContain('247,2 mm')
		expect(wrapper.find('.record-head [title="Le moins de chutes"]').exists()).toBe(true)
		expect(wrapper.find('.fiche-releve input').exists()).toBe(false)
		wrapper.unmount()
	})

	it("sans étude en cours, l'atelier s'ouvre en test rapide avec le tracé", async () => {
		currentImposition = { ...impositionDetail, atelier: { trace: 'TRA-1' } as unknown as typeof impositionDetail.atelier }
		const { wrapper } = await open('/impositions/IMP-1')
		const refaire = wrapper.findAll('.record-actions a').find((item) => item.text() === "Refaire à l'atelier")!
		expect(refaire.attributes('href')).toBe('/bureau/atelier?trace=TRA-1')
		wrapper.unmount()
	})

	it("rend une imposition idéale à la main, et le dit", async () => {
		currentImposition = { ...impositionDetail, ideale: false, can_choose: true }
		const { wrapper } = await open('/impositions/IMP-1')
		await wrapper.find('.record-actions .more-menu-trigger, .record-actions [aria-haspopup]').trigger('click')
		await flushPromises()
		const item = [...document.body.querySelectorAll('[role="menuitem"]')].find((node) => node.textContent?.trim() === 'Rendre idéale') as HTMLElement
		item.click()
		await flushPromises()
		expect(sent('set_imposition_ideale').name).toBe('IMP-1')
		expect(document.body.textContent).toContain('le calcul automatique ne la remplacera pas')
		wrapper.unmount()
	})

	it("une imposition obsolète le dit en tête de fiche", async () => {
		currentImposition = { ...impositionDetail, ideale: false, obsolete: true }
		const { wrapper } = await open('/impositions/IMP-1')
		expect(wrapper.text()).toContain("n'est plus en service")
		expect(wrapper.find('.record-head').text()).toContain('Obsolète')
		wrapper.unmount()
	})

	it('le menu du poste Étude mène aux deux pages, celui du back office aussi, dans le référentiel', async () => {
		window.postes = [{ key: 'etude', label: 'Étude' }]
		const etude = await open('/traces')
		expect(etude.wrapper.find('a[href="/bureau/traces"]').exists()).toBe(true)
		expect(etude.wrapper.find('a[href="/bureau/impositions"]').exists()).toBe(true)
		expect(etude.wrapper.find('a[href="/app/trace"]').exists()).toBe(false)
		etude.wrapper.unmount()
	})
})
