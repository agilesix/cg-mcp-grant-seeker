import { describe, expect, it } from 'vitest';
import { resolveVisualTheme, visualThemes } from '../../src/views/theme-config.js';

describe('visual theme configuration', () => {
  it('uses CommonGrants styling by default', () => {
    expect(resolveVisualTheme(undefined)).toBe('common-grants');
    expect(resolveVisualTheme('unknown')).toBe('common-grants');
  });

  it('allows self-hosters to select the host-neutral preset', () => {
    expect(resolveVisualTheme('host-neutral')).toBe('host-neutral');
  });

  it('keeps the supported preset list explicit', () => {
    expect(visualThemes).toEqual(['common-grants', 'host-neutral']);
  });
});
