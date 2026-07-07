import { describe, expect, it } from 'vitest';
import {
  formatMoney,
  formatOpportunityDetail,
  formatOpportunitySummary,
} from '../../src/core/format.js';
import type { Opportunity } from '../../src/core/index.js';

const opp = {
  id: 'abc-123',
  title: 'Workforce Development Grant',
  status: { value: 'open' },
  description: 'Funds job training programs.',
  funding: {
    maxAwardAmount: { amount: '500000', currency: 'USD' },
    minAwardAmount: { amount: 10000, currency: 'USD' },
  },
  keyDates: {
    closeDate: { eventType: 'singleDate', name: 'Close date', date: '2026-09-01' },
    postDate: { eventType: 'singleDate', name: 'Post date', date: '2026-06-01' },
  },
} as unknown as Opportunity;

describe('formatMoney', () => {
  it('formats a Money object with a numeric string amount', () => {
    expect(formatMoney({ amount: '500000', currency: 'USD' })).toBe('$500,000');
  });

  it('formats a numeric amount', () => {
    expect(formatMoney({ amount: 10000 })).toBe('$10,000');
  });

  it('returns undefined for missing or empty amounts', () => {
    expect(formatMoney(undefined)).toBeUndefined();
    expect(formatMoney(null)).toBeUndefined();
    expect(formatMoney({ amount: null })).toBeUndefined();
    expect(formatMoney({ amount: '' })).toBeUndefined();
  });

  it('falls back to raw amount + currency for non-numeric input', () => {
    expect(formatMoney({ amount: 'TBD', currency: 'USD' })).toBe('TBD USD');
  });
});

describe('formatOpportunitySummary', () => {
  const text = formatOpportunitySummary(opp, 0);

  it('numbers the entry and shows title, id, status, award, and close date', () => {
    expect(text).toContain('1. Workforce Development Grant');
    expect(text).toContain('ID: abc-123');
    expect(text).toContain('Status: open');
    expect(text).toContain('Max award: $500,000');
    expect(text).toContain('Closes: 2026-09-01');
  });

  it('reads the nested status object, not a bare string', () => {
    expect(text).not.toContain('Status: [object Object]');
  });
});

describe('formatOpportunityDetail', () => {
  const text = formatOpportunityDetail(opp, 'Federal (Simpler.Grants.gov)');

  it('includes the source label, description, both award bounds, and dates', () => {
    expect(text).toContain('Source: Federal (Simpler.Grants.gov)');
    expect(text).toContain('Funds job training programs.');
    expect(text).toContain('Max award: $500,000');
    expect(text).toContain('Min award: $10,000');
    expect(text).toContain('Close date: 2026-09-01');
    expect(text).toContain('Posted: 2026-06-01');
  });
});
