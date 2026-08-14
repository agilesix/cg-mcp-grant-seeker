// @vitest-environment jsdom

import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShortlistViewState } from '../../src/app/models/view-state.js';
import type { PresentShortlistOutput } from '../../src/app/tools/present-shortlist.js';
import type { WireOpportunity } from '../../src/core/wire.js';

const host = vi.hoisted(() => ({
  output: null as PresentShortlistOutput | null,
  persisted: null as ShortlistViewState | null,
  openExternal: vi.fn(),
  displayMode: 'inline' as 'inline' | 'fullscreen',
  setDisplayMode: vi.fn(),
  visualTheme: 'common-grants' as 'common-grants' | 'host-neutral',
}));

vi.mock('skybridge/web', async () => {
  const React = await import('react');
  return {
    useLayout: () => ({
      theme: 'light',
      maxHeight: 800,
      safeArea: { insets: { top: 0, right: 0, bottom: 0, left: 0 } },
    }),
    useDisplayMode: () => [host.displayMode, host.setDisplayMode] as const,
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

vi.mock('../../src/app/hosts/skybridge/theme-config.js', () => ({
  get visualTheme() {
    return host.visualTheme;
  },
}));

import GrantResultsContainer from '../../src/app/hosts/skybridge/views/grant-results.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

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
      filters: [],
      sort: null,
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
    host.displayMode = 'inline';
    host.setDisplayMode.mockReset();
    host.setDisplayMode.mockResolvedValue({ mode: 'fullscreen' });
    container = document.createElement('div');
    document.documentElement.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it.each(['common-grants', 'host-neutral'] as const)(
    'persists navigation and focus under the %s preset',
    async (visualTheme) => {
      host.visualTheme = visualTheme;
      await act(async () => root.render(<GrantResultsContainer />));
      expect(container.querySelector('.grant-app')?.getAttribute('data-visual-theme')).toBe(
        visualTheme,
      );

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
    },
  );

  it('requests fullscreen from detail view when the user chooses Full screen', async () => {
    await act(async () => root.render(<GrantResultsContainer />));
    expect(container.querySelector('.display-mode-control')).toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('.result-row')?.click());

    const expand = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Full screen',
    );
    expect(expand).toBeTruthy();

    await act(async () => expand?.click());

    expect(host.setDisplayMode).toHaveBeenCalledWith('fullscreen');
  });

  it('opens the exact source details URL from an opportunity', async () => {
    await act(async () => root.render(<GrantResultsContainer />));

    const firstRow = container.querySelector<HTMLButtonElement>('.result-row');
    await act(async () => firstRow?.click());
    const sourceDetails = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'View source details',
    );
    await act(async () => sourceDetails?.click());

    expect(host.openExternal).toHaveBeenCalledWith('https://example.gov/item-1');
  });

  it('offers description expansion only when the rendered text is truncated', async () => {
    const scrollHeight = vi
      .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockReturnValue(160);
    const clientHeight = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(80);

    await act(async () => root.render(<GrantResultsContainer />));
    const firstRow = container.querySelector<HTMLButtonElement>('.result-row');
    await act(async () => firstRow?.click());

    expect(
      Array.from(container.querySelectorAll('button')).some(
        (button) => button.textContent === 'Show full description',
      ),
    ).toBe(true);
    const expandDescription = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Show full description',
    );
    expect(expandDescription?.getAttribute('aria-controls')).toBe(
      container.querySelector('[data-testid="opportunity-description"]')?.id,
    );
    await act(async () => expandDescription?.click());
    expect(container.querySelector('.description.expanded')).toBeTruthy();
    expect(container.textContent).toContain('Show less');

    scrollHeight.mockRestore();
    clientHeight.mockRestore();
  });

  it('does not offer description expansion when the rendered text fits', async () => {
    const scrollHeight = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(80);
    const clientHeight = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(80);

    await act(async () => root.render(<GrantResultsContainer />));
    const firstRow = container.querySelector<HTMLButtonElement>('.result-row');
    await act(async () => firstRow?.click());

    expect(container.textContent).not.toContain('Show full description');

    scrollHeight.mockRestore();
    clientHeight.mockRestore();
  });

  it('disables Full screen while the host request is pending', async () => {
    const request = deferred<{ mode: 'fullscreen' }>();
    host.setDisplayMode.mockReturnValue(request.promise);
    await act(async () => root.render(<GrantResultsContainer />));
    await act(async () => container.querySelector<HTMLButtonElement>('.result-row')?.click());

    const expand = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Full screen',
    ) as HTMLButtonElement;
    act(() => expand.click());

    expect(expand.disabled).toBe(true);
    expect(expand.textContent).toBe('Opening…');

    await act(async () => request.resolve({ mode: 'fullscreen' }));
    expect(expand.disabled).toBe(false);
  });

  it('announces when the host declines fullscreen without rejecting', async () => {
    host.setDisplayMode.mockResolvedValue({ mode: 'inline' });
    await act(async () => root.render(<GrantResultsContainer />));
    await act(async () => container.querySelector<HTMLButtonElement>('.result-row')?.click());

    const expand = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Full screen',
    );
    await act(async () => expand?.click());

    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      'Full screen is not available in this host.',
    );
  });

  it('announces a rejected fullscreen request', async () => {
    host.setDisplayMode.mockRejectedValue(new Error('unsupported'));
    await act(async () => root.render(<GrantResultsContainer />));
    await act(async () => container.querySelector<HTMLButtonElement>('.result-row')?.click());

    const expand = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Full screen',
    );
    await act(async () => expand?.click());

    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      'Full screen is not available in this host.',
    );
  });

  it('leaves fullscreen exit controls to the host', async () => {
    host.displayMode = 'fullscreen';
    await act(async () => root.render(<GrantResultsContainer />));
    await act(async () => container.querySelector<HTMLButtonElement>('.result-row')?.click());

    expect(container.querySelector('.display-mode-control')).toBeNull();
  });

  it('does not update local state when a display-mode request settles after unmount', async () => {
    const request = deferred<{ mode: 'inline' }>();
    host.setDisplayMode.mockReturnValue(request.promise);
    await act(async () => root.render(<GrantResultsContainer />));
    await act(async () => container.querySelector<HTMLButtonElement>('.result-row')?.click());

    const expand = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Full screen',
    );
    act(() => expand?.click());
    await act(async () => root.unmount());
    root = createRoot(container);

    await act(async () => request.resolve({ mode: 'inline' }));
    expect(container.textContent).toBe('');
  });

  it('settles display-mode state under React Strict Mode', async () => {
    host.setDisplayMode.mockResolvedValue({ mode: 'inline' });
    await act(async () =>
      root.render(
        <StrictMode>
          <GrantResultsContainer />
        </StrictMode>,
      ),
    );
    await act(async () => container.querySelector<HTMLButtonElement>('.result-row')?.click());

    const expand = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Full screen',
    ) as HTMLButtonElement;
    await act(async () => expand.click());

    expect(expand.disabled).toBe(false);
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      'Full screen is not available in this host.',
    );
  });

  it('ignores a stale request result after the host changes display mode', async () => {
    const request = deferred<{ mode: 'inline' }>();
    host.setDisplayMode.mockReturnValue(request.promise);
    await act(async () => root.render(<GrantResultsContainer />));
    await act(async () => container.querySelector<HTMLButtonElement>('.result-row')?.click());

    const expand = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Full screen',
    );
    act(() => expand?.click());

    host.displayMode = 'fullscreen';
    await act(async () => root.render(<GrantResultsContainer />));
    await act(async () => request.resolve({ mode: 'inline' }));
    host.displayMode = 'inline';
    await act(async () => root.render(<GrantResultsContainer />));

    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector<HTMLButtonElement>('.display-mode-button')?.disabled).toBe(
      false,
    );
  });
});
