import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveVisualTheme, visualThemes } from '../../src/app/theme/theme.js';

const themeCss = readFileSync(new URL('../../src/app/theme/theme.css', import.meta.url), 'utf8');

const colorRoles = [
  'surface',
  'surface-subtle',
  'text',
  'muted',
  'border',
  'accent',
  'on-accent',
  'danger',
  'danger-surface',
  'focus',
] as const;

type ColorRole = (typeof colorRoles)[number];
type Palette = Record<ColorRole, string>;

function selectorBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = themeCss.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
  if (!match?.[1]) throw new Error(`Missing theme selector: ${selector}`);
  return match[1];
}

function declarations(block: string): Map<string, string> {
  return new Map(
    [...block.matchAll(/--(grant-[a-z-]+):\s*([^;]+);/g)].map((match) => [
      match[1]!,
      match[2]!.trim(),
    ]),
  );
}

function fallbackColor(value: string): string {
  const fallback = value.match(/,\s*(#[0-9a-f]{6})\)$/i)?.[1];
  return fallback ?? value;
}

function palette(theme: 'common-grants' | 'host-neutral', scheme: 'light' | 'dark'): Palette {
  const base = declarations(selectorBlock(`.grant-app[data-visual-theme='${theme}']`));
  const overrides =
    scheme === 'dark'
      ? declarations(selectorBlock(`.grant-app[data-visual-theme='${theme}'].dark`))
      : new Map<string, string>();
  return Object.fromEntries(
    colorRoles.map((role) => {
      const value = overrides.get(`grant-color-${role}`) ?? base.get(`grant-color-${role}`);
      if (!value) throw new Error(`Missing ${theme}/${scheme} color role: ${role}`);
      return [role, fallbackColor(value)];
    }),
  ) as Palette;
}

function luminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

function expectContrast(palette: Palette) {
  for (const [foreground, background] of [
    ['text', 'surface'],
    ['muted', 'surface'],
    ['muted', 'surface-subtle'],
    ['accent', 'surface'],
    ['on-accent', 'accent'],
    ['danger', 'danger-surface'],
  ] as const) {
    expect(contrast(palette[foreground], palette[background])).toBeGreaterThanOrEqual(4.5);
  }
  for (const [foreground, background] of [
    ['border', 'surface'],
    ['focus', 'surface'],
    ['focus', 'surface-subtle'],
  ] as const) {
    expect(contrast(palette[foreground], palette[background])).toBeGreaterThanOrEqual(3);
  }
}

describe('visual theme contract', () => {
  it('defaults unknown values to CommonGrants and accepts only explicit presets', () => {
    expect(visualThemes).toEqual(['common-grants', 'host-neutral']);
    expect(resolveVisualTheme(undefined)).toBe('common-grants');
    expect(resolveVisualTheme('unknown')).toBe('common-grants');
    expect(resolveVisualTheme({ color: 'red' })).toBe('common-grants');
    expect(resolveVisualTheme('host-neutral')).toBe('host-neutral');
  });

  it('keeps theme CSS token-only and host variables allowlisted', () => {
    const withoutComments = themeCss.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const block of withoutComments.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
      expect(block[1]!.trim()).toMatch(
        /^\.grant-app\[data-visual-theme='(?:common-grants|host-neutral)'\](?:\.dark)?$/,
      );
      expect(block[2]!.replace(/--grant-[a-z-]+:\s*[^;]+;/g, '').trim()).toBe('');
    }
    expect(withoutComments).not.toMatch(/(?:^|[;{]\s*)content\s*:/m);

    const hostVariables = [...themeCss.matchAll(/var\((--color-[a-z-]+)/g)].map(
      (match) => match[1],
    );
    expect([...new Set(hostVariables)].sort()).toEqual(
      [
        '--color-background-primary',
        '--color-background-secondary',
        '--color-border-primary',
        '--color-text-link',
        '--color-text-primary',
        '--color-text-secondary',
      ].sort(),
    );
  });

  it('meets WCAG AA contrast for every app-owned fallback palette', () => {
    for (const theme of visualThemes) {
      for (const scheme of ['light', 'dark'] as const) {
        expectContrast(palette(theme, scheme));
      }
    }
  });

  it('meets the contrast contract for representative host-variable fixtures', () => {
    const fixtures: Palette[] = [
      {
        ...palette('host-neutral', 'light'),
        surface: '#ffffff',
        'surface-subtle': '#f5f5f5',
        text: '#1f1f1f',
        muted: '#5d5d5d',
        border: '#767676',
        accent: '#0b57d0',
      },
      {
        ...palette('host-neutral', 'dark'),
        surface: '#181818',
        'surface-subtle': '#242424',
        text: '#f2f2f2',
        muted: '#b3b3b3',
        border: '#777777',
        accent: '#9cc2ff',
      },
    ];
    fixtures.forEach(expectContrast);
  });
});
