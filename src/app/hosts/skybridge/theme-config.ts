import { resolveVisualTheme } from '../../theme/theme.js';

/**
 * Public build metadata only. Never place credentials in VITE_* variables.
 */
const buildMetadata = (import.meta as ImportMeta & { env?: Record<string, unknown> }).env;

export const visualTheme = resolveVisualTheme(buildMetadata?.VITE_GRANT_VISUAL_THEME);
