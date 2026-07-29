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
      insets={{ top: 0, right: 0, bottom: 0, left: 0 }}
      onSelect={vi.fn()}
      onBack={vi.fn()}
      onShowMore={vi.fn()}
      onToggleDescription={vi.fn()}
      onOpenExternal={vi.fn()}
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
    expect(html).toContain('Search terms reported by the assistant');
    expect(html).toContain('<button');
  });

  it('renders a responsive sparse detail without empty sections', () => {
    const html = render({ selectedKey: 'wa:11111111-1111-4111-8111-111111111111' });

    expect(html).toContain('Grant opportunity details');
    expect(html).toContain('The source did not provide additional funding');
    expect(html).not.toContain('Who can apply');
    expect(html).toContain('View provider page');
    expect(html).toContain('Back to shortlist');
  });
});
