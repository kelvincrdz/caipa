export const VISUAL_THEMES = ['boteco', 'bossa-nova', 'amber', 'litoral'] as const;
export type VisualTheme = typeof VISUAL_THEMES[number];

export interface ThemeMeta {
  id: VisualTheme;
  name: string;
  description: string;
  /** Page background hex (for preview) */
  bgPage: string;
  /** Card background hex (for preview) */
  bgCard: string;
  /** Primary / heading color hex */
  colorPrimary: string;
  /** Action / button color hex */
  colorAction: string;
  /** Display font name */
  fontDisplay: string;
  /** Optional font-style for display font preview */
  previewFontStyle?: string;
}

export const THEME_META: Record<VisualTheme, ThemeMeta> = {
  boteco: {
    id: 'boteco',
    name: 'Boteco Nostálgico',
    description: 'Alegria, giz e azulejo',
    bgPage: '#FCF8F2',
    bgCard: '#FFFFFF',
    colorPrimary: '#00509D',
    colorAction: '#E6AA22',
    fontDisplay: '"Zilla Slab", serif',
  },
  'bossa-nova': {
    id: 'bossa-nova',
    name: 'Bossa Nova',
    description: 'Elegância tropical',
    bgPage: '#F4F1EA',
    bgCard: '#FFFFFF',
    colorPrimary: '#2A4B3C',
    colorAction: '#D97746',
    fontDisplay: '"Fraunces", serif',
  },
  amber: {
    id: 'amber',
    name: 'Luz de Âmbar',
    description: 'O barzinho íntimo e calmo',
    bgPage: '#1C1816',
    bgCard: '#2A2421',
    colorPrimary: '#D4AF37',
    colorAction: '#D4AF37',
    fontDisplay: '"Cormorant Garamond", serif',
    previewFontStyle: 'italic',
  },
  litoral: {
    id: 'litoral',
    name: 'Litoral Artesanal',
    description: 'Barro, areia e renda',
    bgPage: '#EADDD7',
    bgCard: '#F5F0EC',
    colorPrimary: '#B65C3A',
    colorAction: '#B65C3A',
    fontDisplay: '"Alice", serif',
  },
};

/**
 * Applies a visual theme by setting data-theme on <html>.
 * Falls back to 'boteco' for unknown values.
 */
export function applyTheme(theme: string | null | undefined): void {
  const valid = (VISUAL_THEMES as readonly string[]).includes(theme ?? '') ? theme! : 'boteco';
  document.documentElement.dataset.theme = valid;
}

/** Returns the ThemeMeta for a theme id, defaulting to boteco. */
export function getThemeMeta(theme: string | null | undefined): ThemeMeta {
  const valid = (VISUAL_THEMES as readonly string[]).includes(theme ?? '')
    ? (theme as VisualTheme)
    : 'boteco';
  return THEME_META[valid];
}
