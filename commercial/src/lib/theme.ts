/** Thème de la PWA commerciale, sous sa propre clé. */
import { createAppTheme, type ThemePreference } from '@shared/theme'

export type { ThemePreference }

export const THEME_KEY = 'commercial-theme'
export const useAppTheme = createAppTheme(THEME_KEY)
