/** Petit magasin clé-valeur IndexedDB : l'instantané commercial et la file d'envoi. */

const DB_NAME = 'aures-commercial'
const DB_VERSION = 1
const STORE = 'kv'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
	if (!dbPromise) {
		dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION)
			request.onupgradeneeded = () => {
				if (!request.result.objectStoreNames.contains(STORE)) {
					request.result.createObjectStore(STORE)
				}
			}
			request.onsuccess = () => {
				const db = request.result
				// Une autre version de l'application demande la base : on la libère, la prochaine écriture la rouvre.
				db.onversionchange = () => {
					db.close()
					dbPromise = null
				}
				db.onclose = () => {
					dbPromise = null
				}
				resolve(db)
			}
			request.onerror = () => reject(request.error)
			request.onblocked = () => reject(new Error('Base locale bloquée par un autre onglet.'))
		}).catch((error) => {
			// Un échec d'ouverture n'est pas mémorisé : l'essai suivant retente.
			dbPromise = null
			throw error
		})
	}
	return dbPromise
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
	return openDb().then(
		(db) =>
			new Promise<T>((resolve, reject) => {
				const tx = db.transaction(STORE, mode)
				const request = action(tx.objectStore(STORE))
				tx.oncomplete = () => resolve(request.result as T)
				tx.onerror = () => reject(tx.error)
				tx.onabort = () => reject(tx.error)
			}),
	)
}

export function idbGet<T>(key: string): Promise<T | undefined> {
	return run<T | undefined>('readonly', (store) => store.get(key))
}

export function idbSet<T>(key: string, value: T): Promise<void> {
	// Les proxys réactifs Vue ne se clonent pas : on stocke une copie JSON.
	const plain = JSON.parse(JSON.stringify(value))
	return run<void>('readwrite', (store) => store.put(plain, key))
}

export function idbClear(): Promise<void> {
	return run<void>('readwrite', (store) => store.clear())
}

export function idbDelete(key: string): Promise<void> {
	return run<void>('readwrite', (store) => store.delete(key))
}
