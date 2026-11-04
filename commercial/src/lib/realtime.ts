/**
 * Temps réel : ce que le Desk modifie (ticket pris en charge, devis validé, BAT, production…) arrive sur
 * l'appareil sans attendre la synchro. Le serveur (aurescrm/commercial_events.py) n'envoie que des
 * identifiants aux commerciaux concernés ; l'appareil recharge alors son instantané.
 */
import { connectRealtime as connect, type RealtimeEvent } from '@shared/realtime'

export { closeRealtime, isForeignChange, throttledReload } from '@shared/realtime'

export const COMMERCIAL_EVENT = 'aures_commercial_update'

export type CommercialEvent = RealtimeEvent

export const connectRealtime = (onEvent: (event: CommercialEvent) => void, onReconnect: () => void) =>
	connect<CommercialEvent>(COMMERCIAL_EVENT, onEvent, onReconnect)
