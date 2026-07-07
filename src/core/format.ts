import type { Opportunity } from './types.js';

type KeyDates = NonNullable<Opportunity['keyDates']>;
type CgEvent = NonNullable<KeyDates['closeDate']>;

/**
 * CommonGrants money amounts are objects ({ amount, currency }), not numbers.
 * Renders a human-friendly string, or undefined when there's nothing to show.
 */
export function formatMoney(
  money: { amount?: string | number | null; currency?: string | null } | null | undefined,
): string | undefined {
  if (money?.amount == null || money.amount === '') return undefined;
  const n = Number(money.amount);
  return Number.isFinite(n)
    ? `$${n.toLocaleString()}`
    : `${money.amount} ${money.currency ?? ''}`.trim();
}

/** Renders a Date (or ISO-ish string) as YYYY-MM-DD, tolerating bad input. */
function formatDate(value: Date | string | null | undefined): string | undefined {
  if (value == null || value === '') return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
}

/**
 * A CommonGrants key date is an Event: a discriminated union of a single date
 * or a date range. Renders either shape, or undefined when there's nothing.
 */
function formatEventDate(event: CgEvent | null | undefined): string | undefined {
  if (!event) return undefined;
  if (event.eventType === 'singleDate') return formatDate(event.date);
  if (event.eventType === 'dateRange') {
    const start = formatDate(event.startDate);
    const end = formatDate(event.endDate);
    return start && end ? `${start} – ${end}` : (start ?? end);
  }
  return undefined;
}

/**
 * A compact one-entry summary for search result lists.
 *
 * Note the real @common-grants/sdk@0.5 opportunity shape: `status` is an
 * object ({ value }), money fields are Money objects, `keyDates.*` are Event
 * unions holding Date values, and there is no top-level `agency` field (agency
 * is only ever a plugin custom field).
 */
export function formatOpportunitySummary(opp: Opportunity, index: number): string {
  const maxAward = formatMoney(opp.funding?.maxAwardAmount);
  const closes = formatEventDate(opp.keyDates?.closeDate);
  return [
    `${index + 1}. ${opp.title ?? '(no title)'}`,
    `   ID: ${opp.id}`,
    opp.status?.value && `   Status: ${opp.status.value}`,
    maxAward && `   Max award: ${maxAward}`,
    closes && `   Closes: ${closes}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** A full detail view for a single opportunity. */
export function formatOpportunityDetail(opp: Opportunity, sourceLabel: string): string {
  const maxAward = formatMoney(opp.funding?.maxAwardAmount);
  const minAward = formatMoney(opp.funding?.minAwardAmount);
  const closes = formatEventDate(opp.keyDates?.closeDate);
  const posted = formatEventDate(opp.keyDates?.postDate);
  return [
    `**${opp.title ?? opp.id}**`,
    `Source: ${sourceLabel}`,
    `ID: ${opp.id}`,
    opp.status?.value && `Status: ${opp.status.value}`,
    opp.description && `\n${opp.description}`,
    maxAward && `\nMax award: ${maxAward}`,
    minAward && `Min award: ${minAward}`,
    closes && `Close date: ${closes}`,
    posted && `Posted: ${posted}`,
  ]
    .filter(Boolean)
    .join('\n');
}
