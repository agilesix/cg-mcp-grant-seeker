export const visualThemes = ['common-grants', 'host-neutral'] as const;

export type VisualTheme = (typeof visualThemes)[number];

export function resolveVisualTheme(value: string | undefined): VisualTheme {
  return value === 'host-neutral' ? value : 'common-grants';
}

/**
 * Product styling and host color scheme are separate concerns. Self-hosters
 * can select the alternate preset at build time without changing the view or
 * its tool contract.
 */
export const visualTheme = resolveVisualTheme(import.meta.env.VITE_GRANT_VISUAL_THEME);
