export const visualThemes = ['common-grants', 'host-neutral'] as const;

export type VisualTheme = (typeof visualThemes)[number];

export function resolveVisualTheme(value: unknown): VisualTheme {
  return value === 'host-neutral' ? value : 'common-grants';
}
