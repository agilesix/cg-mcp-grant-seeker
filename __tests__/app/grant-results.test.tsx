import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import GrantResults from '../../src/app/components/grant-results.js';
import type { PresentShortlistOutput } from '../../src/app/tools/present-shortlist.js';
import type { WireOpportunity } from '../../src/core/wire.js';

function opportunity(id: string, title: string): WireOpportunity {
  return {
    id,
    title,
    status: { value: 'open' },
    description: null,
    funding: null,
    keyDates: null,
    acceptedApplicantTypes: [],
    source: null,
    customFields: {},
    createdAt: null,
    lastModifiedAt: null,
  } as unknown as WireOpportunity;
}

const output: PresentShortlistOutput = {
  presentationId: '11111111-1111-4111-8111-111111111111',
  items: [
    {
      rank: 1,
      source: { name: 'wa', label: 'Washington' },
      id: '11111111-1111-4111-8111-111111111111',
      status: 'success',
      opportunity: opportunity('11111111-1111-4111-8111-111111111111', 'Community facilities'),
      providerPageUrl: 'https://example.gov/one',
      error: null,
    },
    {
      rank: 2,
      source: { name: 'federal', label: 'Federal' },
      id: '22222222-2222-4222-8222-222222222222',
      status: 'error',
      opportunity: null,
      providerPageUrl: null,
      error: { code: 'timeout', message: 'This opportunity took too long to load from Federal.' },
    },
  ],
  researchContext: {
    provenance: 'assistant_supplied',
    searchCount: 3,
    queries: ['community development'],
    filters: ['Open opportunities', 'Posted in the last 7 days'],
    sort: 'Nearest close date first',
  },
};

function render(overrides: Partial<Parameters<typeof GrantResults>[0]> = {}) {
  return renderToStaticMarkup(
    <GrantResults
      output={output}
      selectedKey={null}
      visibleCount={5}
      expandedDescriptionKey={null}
      colorScheme="light"
      visualTheme="common-grants"
      insets={{ top: 0, right: 0, bottom: 0, left: 0 }}
      displayMode="inline"
      displayModePending={false}
      displayModeError={null}
      onSelect={vi.fn()}
      onBack={vi.fn()}
      onShowMore={vi.fn()}
      onToggleDescription={vi.fn()}
      onOpenExternal={vi.fn()}
      onToggleDisplayMode={vi.fn()}
      {...overrides}
    />,
  );
}

describe('GrantResults', () => {
  it('renders global rank, provider identity, and safe partial failures', () => {
    const html = render();

    expect(html.indexOf('Community facilities')).toBeLessThan(html.indexOf('Federal'));
    expect(html).toContain('Washington');
    expect(html).toContain('This opportunity took too long to load from Federal.');
    expect(html).toContain('How this shortlist was researched');
    expect(html).toContain('Filtered by');
    expect(html).toContain('Open opportunities · Posted in the last 7 days');
    expect(html).toContain('Sorted by');
    expect(html).toContain('Nearest close date first');
    expect(html).not.toContain('3 searches');
    expect(html).toContain('Search terms the assistant reported using:');
    expect(html).toContain(
      'The assistant reported using each item above in a separate search. Different grant ' +
        'sources may search different parts of an opportunity, so the same words can produce ' +
        'different results.',
    );
    expect(html).toContain('<button');
  });

  it('renders previously generated results without filter or sort fields', () => {
    const legacyOutput = {
      ...output,
      researchContext: {
        provenance: 'assistant_supplied' as const,
        searchCount: 3,
        queries: ['community development'],
      },
    } as PresentShortlistOutput;

    const html = render({ output: legacyOutput });

    expect(html).toContain('Community facilities');
    expect(html).not.toContain('Shortlist selection');
  });

  it('renders a responsive sparse detail without empty sections', () => {
    const html = render({ selectedKey: 'wa:11111111-1111-4111-8111-111111111111' });

    expect(html).toContain('Grant opportunity details');
    expect(html).toContain('The source did not provide additional funding');
    expect(html).not.toContain('Who can apply');
    expect(html).toContain('View source details');
    expect(html).toContain('Confirm current requirements and application instructions');
    expect(html).toContain('Back to shortlist');
    expect(html).toContain('Source reports open');
    expect(html).not.toContain('status-badge');
  });

  it('labels provider dates in the shortlist and explains missing dates', () => {
    const datedOutput: PresentShortlistOutput = {
      ...output,
      items: [
        {
          ...output.items[0]!,
          opportunity: {
            ...opportunity('11111111-1111-4111-8111-111111111111', 'Community facilities'),
            keyDates: {
              postDate: null,
              closeDate: { eventType: 'other', name: 'Application deadline' },
              otherDates: {},
            },
          },
        },
        {
          rank: 2,
          source: { name: 'pa', label: 'Pennsylvania' },
          id: '33333333-3333-4333-8333-333333333333',
          status: 'success',
          opportunity: {
            ...opportunity('33333333-3333-4333-8333-333333333333', 'Neighborhood assistance'),
            funding: {
              minAwardAmount: { amount: '100000', currency: 'USD' },
              maxAwardAmount: { amount: '500000', currency: 'USD' },
            },
            keyDates: {
              postDate: null,
              closeDate: {
                eventType: 'singleDate',
                name: 'Letter of intent due',
                date: '2026-09-15',
                time: '12:00:00',
              },
              otherDates: {},
            },
          },
          providerPageUrl: null,
          error: null,
        },
      ],
    };

    const html = render({ output: datedOutput });

    expect(html).toContain('Closing date not provided');
    expect(html).toContain('Award range: $100,000 to $500,000');
    expect(html).toContain('Letter of intent due: Sep 15, 2026');
    expect(html).not.toContain('12:00 PM');
  });

  it('keeps content and structure identical across visual presets', () => {
    const commonGrants = render({ visualTheme: 'common-grants' });
    const hostNeutral = render({ visualTheme: 'host-neutral' });

    expect(commonGrants.replace('common-grants', 'THEME')).toBe(
      hostNeutral.replace('host-neutral', 'THEME'),
    );
  });

  it('carries visual theme and host color scheme as independent root attributes', () => {
    const html = render({ visualTheme: 'host-neutral', colorScheme: 'dark' });

    expect(html).toContain('class="grant-app dark"');
    expect(html).toContain('data-visual-theme="host-neutral"');
  });

  it('shows Expand inline and leaves fullscreen exit controls to the host', () => {
    expect(render({ displayMode: 'inline' })).toContain('>Expand</button>');
    expect(render({ displayMode: 'fullscreen' })).not.toContain('display-mode-control');
    expect(render({ displayMode: null })).not.toContain('display-mode-control');
  });
});
