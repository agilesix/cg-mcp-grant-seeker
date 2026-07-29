// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShortlistViewState } from '../../src/app/models/view-state.js';
import type { PresentShortlistOutput } from '../../src/app/tools/present-shortlist.js';
import type { WireOpportunity } from '../../src/core/wire.js';

const host = vi.hoisted(() => ({
  output: null as PresentShortlistOutput | null,
  persisted: null as ShortlistViewState | null,
  openExternal: vi.fn(),
}));

vi.mock('skybridge/web', async () => {
  const React = await import('react');
  return {
    useLayout: () => ({
      theme: 'light',
      maxHeight: 800,
      safeArea: { insets: { top: 0, right: 0, bottom: 0, left: 0 } },
    }),
    useOpenExternal: () => host.openExternal,
    useToolInfo: () => ({
      isPending: false,
      isSuccess: true,
      output: host.output,
    }),
    useViewState: <T,>(initial: T) => {
      const [state, setState] = React.useState<T>(() => (host.persisted as T | null) ?? initial);
      const persist = React.useCallback(
        (next: T | ((current: T) => T)) =>
          setState((current) => {
            const value = typeof next === 'function' ? (next as (current: T) => T)(current) : next;
            host.persisted = value as ShortlistViewState;
            return value;
          }),
        [],
      );
      return [state, persist] as const;
    },
  };
});

import GrantResultsContainer from '../../src/app/hosts/skybridge/views/grant-results.js';

function opportunity(id: string): WireOpportunity {
  return {
    id,
    title: `Opportunity ${id}`,
    status: { value: 'open' },
    description: `Description for ${id}`,
    funding: null,
    keyDates: null,
    acceptedApplicantTypes: [],
    source: `https://example.gov/${id}`,
    customFields: {},
    createdAt: null,
    lastModifiedAt: null,
  } as unknown as WireOpportunity;
}

function output(presentationId: string): PresentShortlistOutput {
  return {
    presentationId,
    items: Array.from({ length: 6 }, (_, index) => {
      const id = `item-${index + 1}`;
      return {
        rank: index + 1,
        source: { name: 'wa', label: 'Washington' },
        id,
        status: 'success' as const,
        opportunity: opportunity(id),
        providerPageUrl: `https://example.gov/${id}`,
        error: null,
      };
    }),
    researchContext: {
      provenance: 'assistant_supplied',
      searchCount: 2,
      queries: ['housing', 'youth'],
    },
  };
}

describe('GrantResultsContainer', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    host.output = output('11111111-1111-4111-8111-111111111111');
    host.persisted = null;
    host.openExternal.mockReset();
    container = document.createElement('div');
    document.documentElement.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('persists navigation across a remount, restores focus, and resets for a new presentation', async () => {
    await act(async () => root.render(<GrantResultsContainer />));

    const showMore = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Show more results'),
    );
    expect(showMore).toBeTruthy();
    await act(async () => showMore?.click());
    expect(container.querySelectorAll('.result-row')).toHaveLength(6);

    const firstRow = container.querySelector<HTMLButtonElement>('.result-row');
    expect(firstRow).toBeTruthy();
    await act(async () => firstRow?.click());
    expect(container.querySelector('.detail-view')).toBeTruthy();
    expect(document.activeElement).toBe(container.querySelector('.detail-header h1'));

    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<GrantResultsContainer />));
    expect(container.querySelector('.detail-view')).toBeTruthy();

    const back = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Back to shortlist'),
    );
    await act(async () => back?.click());
    expect(container.querySelectorAll('.result-row')).toHaveLength(6);
    expect(document.activeElement).toBe(container.querySelector('.result-row'));

    host.output = output('22222222-2222-4222-8222-222222222222');
    await act(async () => root.render(<GrantResultsContainer />));
    expect(container.querySelector('.detail-view')).toBeFalsy();
    expect(container.querySelectorAll('.result-row')).toHaveLength(5);
  });
});
