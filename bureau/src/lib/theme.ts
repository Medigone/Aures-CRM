/** Thème du poste de bureau, sous sa propre clé (même règle que l'avant-chargement de index.html). */
import { createAppTheme } from '@shared/theme'

export const THEME_KEY = 'bureau-theme'
export const useAppTheme = createAppTheme(THEME_KEY)
