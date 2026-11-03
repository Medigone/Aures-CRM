/// <reference types="vite/client" />

declare module '*.vue' {
	import type { DefineComponent } from 'vue'
	const component: DefineComponent<object, object, unknown>
	export default component
}

declare module '~icons/*' {
	import type { FunctionalComponent, SVGAttributes } from 'vue'
	const component: FunctionalComponent<SVGAttributes>
	export default component
}
