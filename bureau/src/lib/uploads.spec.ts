import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FileUploader from '@shared/components/FileUploader.vue'
import { formatFileSize } from '@shared/text'

/** Faux envoi : le test décide quand chaque fichier avance, réussit ou échoue. */
const sent: FakeRequest[] = []
class FakeRequest {
	upload: { onprogress?: (event: { lengthComputable: boolean; loaded: number }) => void } = {}
	status = 200
	responseText = ''
	onload?: () => void
	onerror?: () => void
	onabort?: () => void
	body?: FormData
	open() {}
	setRequestHeader() {}
	send(body: FormData) {
		this.body = body
		sent.push(this)
	}
	abort() {
		this.onabort?.()
	}
	finish(url = '/private/files/x.pdf') {
		this.responseText = JSON.stringify({ message: { name: 'F', file_name: 'x.pdf', file_url: url } })
		this.onload?.()
	}
}
const file = (name: string, size = 1024) => new File(['x'.repeat(size)], name)

function mountUploader(props = {}) {
	return mount(FileUploader, { props: { doctype: 'Item', docname: 'A-1', ...props } })
}

describe("envoi de fichiers", () => {
	beforeEach(() => {
		sent.length = 0
		vi.stubGlobal('XMLHttpRequest', FakeRequest)
		vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 25 * 1024 * 1024 }), { status: 200 })))
	})
	afterEach(() => vi.unstubAllGlobals())

	it('envoie trois fichiers à la fois, et suit chacun', async () => {
		const wrapper = mountUploader()
		await flushPromises()
		;(wrapper.vm as unknown as { add: (files: File[]) => void }).add([file('a.pdf'), file('b.pdf'), file('c.pdf'), file('d.pdf')])
		await flushPromises()
		expect(sent).toHaveLength(3)
		expect(wrapper.text()).toContain('Envoi de 4 fichiers')
		expect(wrapper.text()).toContain('d.pdf')
		expect(wrapper.text()).toContain('en attente')
		sent[0].upload.onprogress?.({ lengthComputable: true, loaded: 512 })
		await flushPromises()
		expect(wrapper.text()).toContain('50 %')
		sent[0].finish()
		await flushPromises()
		expect(sent).toHaveLength(4)
		sent.slice(1).forEach((request) => request.finish())
		await flushPromises()
		expect(wrapper.find('.upload-item').exists()).toBe(false)
		expect(wrapper.emitted('uploaded')).toHaveLength(4)
		expect(wrapper.emitted('settled')?.[0]).toEqual([4, 0])
	})

	it('refuse un fichier trop lourd sans bloquer les autres', async () => {
		const wrapper = mountUploader()
		await flushPromises()
		const heavy = file('lourd.zip')
		Object.defineProperty(heavy, 'size', { value: 62 * 1024 * 1024 })
		;(wrapper.vm as unknown as { add: (files: File[]) => void }).add([heavy, file('ok.pdf')])
		await flushPromises()
		expect(sent).toHaveLength(1)
		expect(wrapper.text()).toContain('62 Mo : trop lourd, 25 Mo maximum par fichier')
	})

	it('garde un échec avec Réessayer, et une annulation retire la ligne', async () => {
		const wrapper = mountUploader()
		await flushPromises()
		;(wrapper.vm as unknown as { add: (files: File[]) => void }).add([file('a.pdf'), file('b.pdf')])
		await flushPromises()
		sent[0].onerror?.()
		await wrapper.find('[aria-label="Annuler b.pdf"]').trigger('click')
		await flushPromises()
		expect(wrapper.text()).not.toContain('b.pdf')
		expect(wrapper.text()).toContain('vérifiez votre connexion')
		await wrapper.findAll('button').find((button) => button.text() === 'Réessayer')!.trigger('click')
		await flushPromises()
		expect(sent).toHaveLength(3)
	})

	it('en attente d’un document, rien ne part avant start', async () => {
		const wrapper = mount(FileUploader, { props: { deferred: true } })
		await flushPromises()
		const vm = wrapper.vm as unknown as { add: (files: File[]) => void; start: (target: { doctype: string; docname: string }) => Promise<number> }
		vm.add([file('a.pdf')])
		await flushPromises()
		expect(sent).toHaveLength(0)
		const started = vm.start({ doctype: 'Ticket Commercial', docname: 'TC-1' })
		await flushPromises()
		expect(sent[0].body?.get('docname')).toBe('TC-1')
		sent[0].finish()
		await expect(started).resolves.toBe(0)
	})

	it('écrit les tailles en français', () => {
		expect(formatFileSize(840 * 1024)).toBe('840 Ko')
		expect(formatFileSize(18.4 * 1024 * 1024)).toBe('18,4 Mo')
	})
})
