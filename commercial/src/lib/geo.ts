export type GpsPoint = { latitude: number; longitude: number; precision: number | null }
type LatLng = { latitude: number; longitude: number }

/** Distance à vol d'oiseau en mètres (haversine). */
export function distanceM(a: LatLng, b: LatLng): number {
	const rad = Math.PI / 180
	const dLat = (b.latitude - a.latitude) * rad
	const dLng = (b.longitude - a.longitude) * rad
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2
	return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** « 300 m », « 2,4 km », « 12 km ». */
export function formatDistance(meters: number): string {
	const rounded = Math.max(50, Math.round(meters / 50) * 50)
	if (rounded < 1000) return `${rounded} m`
	const km = meters / 1000
	return km < 10 ? `${km.toFixed(1).replace('.', ',')} km` : `${Math.round(km)} km`
}

/** Point exploitable : deux coordonnées présentes (0 compris), sinon null. */
export function pointOf(latitude?: number | null, longitude?: number | null): LatLng | null {
	return latitude == null || longitude == null ? null : { latitude, longitude }
}

/**
 * Lignes à moins de `radiusM` de `from`, pas vues depuis `staleDays` jours (ou jamais), de la plus proche à la plus loin.
 * `place` et `lastSeen` lisent la position et la dernière visite de chaque ligne.
 */
export function pickNearby<T>(
	rows: T[],
	from: LatLng,
	place: (row: T) => LatLng | null,
	lastSeen: (row: T) => Date | null,
	{ radiusM = 1000, staleDays = 60, now = Date.now() } = {},
): { row: T; meters: number }[] {
	const limit = now - staleDays * 86400000
	const found: { row: T; meters: number }[] = []
	for (const row of rows) {
		const at = place(row)
		if (!at) continue
		const seen = lastSeen(row)
		if (seen && seen.getTime() > limit) continue
		const meters = distanceM(from, at)
		if (meters <= radiusM) found.push({ row, meters })
	}
	return found.sort((a, b) => a.meters - b.meters)
}

/** Lignes de la plus proche à la plus loin ; celles sans position gardent leur ordre, en fin de liste. */
export function sortByDistance<T>(rows: T[], from: LatLng | null, place: (row: T) => LatLng | null): T[] {
	if (!from) return rows
	const located: { row: T; meters: number }[] = []
	const unknown: T[] = []
	for (const row of rows) {
		const at = place(row)
		if (at) located.push({ row, meters: distanceM(from, at) })
		else unknown.push(row)
	}
	return [...located.sort((a, b) => a.meters - b.meters).map((entry) => entry.row), ...unknown]
}

/** Position déjà accordée : relue sans afficher de demande d'autorisation (null sinon). */
export async function quietPosition(): Promise<GpsPoint | null> {
	try {
		const status = await navigator.permissions?.query({ name: 'geolocation' as PermissionName })
		if (status?.state !== 'granted') return null
	} catch {
		return null
	}
	return currentPosition(10000)
}

/** Position de l'appareil, ou null (refus, délai dépassé, indisponible). */
export function currentPosition(timeoutMs = 15000): Promise<GpsPoint | null> {
	if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null)
	return new Promise((resolve) => {
		navigator.geolocation.getCurrentPosition(
			(position) =>
				resolve({
					latitude: position.coords.latitude,
					longitude: position.coords.longitude,
					precision: Math.round(position.coords.accuracy),
				}),
			() => resolve(null),
			{ enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 },
		)
	})
}

/** Coordonnées saisies dans le Desk (« 36.75, 3.05 »), ou null si illisibles. */
export function parseGps(value?: string | null): { latitude: number; longitude: number } | null {
	const numbers = (value || '').match(/-?\d+(?:\.\d+)?/g)
	if (!numbers || numbers.length < 2) return null
	const latitude = Number(numbers[0])
	const longitude = Number(numbers[1])
	if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
	return { latitude, longitude }
}
