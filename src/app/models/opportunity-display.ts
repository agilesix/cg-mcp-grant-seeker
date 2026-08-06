import type { WireOpportunity } from '../../core/wire.js';

export interface DetailRow {
  label: string;
  value: string;
}

export interface OpportunityDetailModel {
  agency: string;
  applicantTypes: string[];
  contact: DetailRow[];
  dates: DetailRow[];
  description: string | null;
  eligibilityNotes: string | null;
  facts: DetailRow[];
  funding: DetailRow[];
  hasDecisionDetails: boolean;
  showDeadlineNote: boolean;
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function humanize(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function money(
  value: { amount: string; currency: string } | null | undefined,
): string | null {
  if (!value) return null;
  const amount = Number(value.amount);
  const currency = value.currency ?? 'USD';
  if (Number.isFinite(amount)) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `${value.amount} ${currency}`;
    }
  }
  return `${value.amount} ${currency}`;
}

function dateText(value: unknown): string | null {
  const text = optionalText(value);
  if (!text) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return text;
  const [, year, month, day] = match;
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
      year: 'numeric',
    }).format(new Date(`${year}-${month}-${day}T00:00:00Z`));
  } catch {
    return text;
  }
}

function timeText(value: unknown): string | null {
  const text = optionalText(value);
  if (!text) return null;
  const match = /^(\d{2}):(\d{2}):(\d{2})(\.\d+)?$/.exec(text);
  if (!match) return text;
  const [, hourText, minute, second, fraction] = match;
  const hour = Number(hourText);
  const displayHour = hour % 12 || 12;
  const seconds = second === '00' && !fraction ? '' : `:${second}${fraction ?? ''}`;
  return `${displayHour}:${minute}${seconds} ${hour < 12 ? 'AM' : 'PM'}`;
}

function dateAndTime(date: unknown, time: unknown): string | null {
  const formattedDate = dateText(date);
  const formattedTime = timeText(time);
  if (!formattedDate) return formattedTime;
  return formattedTime ? `${formattedDate} at ${formattedTime}` : formattedDate;
}

type OpportunityEvent = NonNullable<NonNullable<WireOpportunity['keyDates']>['closeDate']>;

export function eventName(event: OpportunityEvent | null | undefined, fallback: string): string {
  return optionalText(event?.name) ?? fallback;
}

export function eventLabel(
  event: NonNullable<WireOpportunity['keyDates']>['closeDate'],
): string | null {
  if (!event) return null;
  if (event.eventType === 'singleDate') return dateAndTime(event.date, event.time);
  if (event.eventType === 'dateRange') {
    const startDate = dateAndTime(event.startDate, event.startTime);
    const endDate = dateAndTime(event.endDate, event.endTime);
    return startDate && endDate ? `${startDate} to ${endDate}` : (startDate ?? endDate);
  }
  return optionalText(event.details) ?? optionalText(event.description) ?? optionalText(event.name);
}

function eventDetailValue(event: OpportunityEvent): string | null {
  const value = eventLabel(event);
  const description = optionalText(event.description);
  if (!value) return description;
  return description && description !== value ? `${value} · ${description}` : value;
}

export function statusLabel(status: WireOpportunity['status']): string {
  switch (status.value) {
    case 'open':
      return 'Open for applications';
    case 'forecasted':
      return 'Forecasted: not yet open';
    case 'closed':
      return 'Closed to applications';
    case 'custom':
      return optionalText(status.customValue) ?? 'Status provided by source';
  }
}

function customObject(opportunity: WireOpportunity, name: string): Record<string, unknown> | null {
  const value = opportunity.customFields?.[name]?.value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function customText(opportunity: WireOpportunity, name: string): string | null {
  return optionalText(opportunity.customFields?.[name]?.value);
}

function compactRows(rows: Array<DetailRow | null>): DetailRow[] {
  return rows.filter((row): row is DetailRow => Boolean(row?.value));
}

export function safeDescriptionText(value: unknown): string | null {
  const text = optionalText(value);
  if (!text) return null;

  if (typeof DOMParser !== 'undefined') {
    const separated = text.replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, ' ');
    const parsed = new DOMParser().parseFromString(separated, 'text/html');
    parsed.querySelectorAll('script, style, noscript, template').forEach((element) => {
      element.remove();
    });
    return (
      parsed.body.textContent
        ?.replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || null
    );
  }

  return (
    text
      .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim() || null
  );
}

export function buildOpportunityDetailModel(
  opportunity: WireOpportunity,
  sourceLabel: string,
): OpportunityDetailModel {
  const agencyField = customObject(opportunity, 'agency');
  const contactInfo = customObject(opportunity, 'contactInfo');
  const eligibilityCriteria = customObject(opportunity, 'eligibilityCriteria');
  const costSharing = customObject(opportunity, 'costSharing');
  const agency = optionalText(agencyField?.name) ?? optionalText(agencyField?.code) ?? sourceLabel;
  const awardRange = [
    money(opportunity.funding?.minAwardAmount),
    money(opportunity.funding?.maxAwardAmount),
  ]
    .filter(Boolean)
    .join(' – ');
  const totalFunding = money(opportunity.funding?.totalAmountAvailable);
  const postEvent = opportunity.keyDates?.postDate ?? null;
  const closeEvent = opportunity.keyDates?.closeDate ?? null;
  const posted = eventLabel(postEvent);
  const close = eventLabel(closeEvent);
  const fundingInstrument =
    customText(opportunity, 'fundingInstrument') ??
    customText(opportunity, 'assistanceListingType');

  const facts = compactRows([
    awardRange
      ? { label: 'Award range', value: awardRange }
      : totalFunding
        ? { label: 'Total funding', value: totalFunding }
        : null,
    posted ? { label: eventName(postEvent, 'Posted date'), value: posted } : null,
    close ? { label: eventName(closeEvent, 'Closing date'), value: close } : null,
    fundingInstrument ? { label: 'Funding type', value: fundingInstrument } : null,
    { label: 'Source', value: sourceLabel },
  ]);

  const applicantTypes = [
    ...new Set(
      (opportunity.acceptedApplicantTypes ?? [])
        .map(
          (type) =>
            optionalText(type.customValue) ??
            optionalText(type.description) ??
            optionalText(type.value),
        )
        .filter((value): value is string => Boolean(value))
        .map(humanize),
    ),
  ];

  const costSharingRequired =
    typeof costSharing?.isRequired === 'boolean' ? costSharing.isRequired : null;
  const costSharingPercentage =
    typeof costSharing?.percentage === 'number' ? costSharing.percentage : null;
  const costSharingLabel =
    costSharingRequired === null
      ? null
      : costSharingRequired
        ? `Required${costSharingPercentage === null ? '' : ` · ${costSharingPercentage}%`}`
        : 'Not required';

  const funding = compactRows([
    totalFunding ? { label: 'Total available', value: totalFunding } : null,
    awardRange ? { label: 'Award range', value: awardRange } : null,
    fundingInstrument ? { label: 'Funding type', value: fundingInstrument } : null,
    costSharingLabel ? { label: 'Cost sharing', value: costSharingLabel } : null,
    optionalText(opportunity.funding?.details)
      ? { label: 'Funding details', value: optionalText(opportunity.funding?.details)! }
      : null,
  ]);

  const dates = compactRows([
    postEvent
      ? {
          label: eventName(postEvent, 'Posted date'),
          value: eventDetailValue(postEvent) ?? posted ?? '',
        }
      : null,
    closeEvent
      ? {
          label: eventName(closeEvent, 'Closing date'),
          value: eventDetailValue(closeEvent) ?? close ?? '',
        }
      : null,
    ...Object.entries(opportunity.keyDates?.otherDates ?? {}).map(([key, event]) => {
      const value = eventDetailValue(event);
      return value ? { label: optionalText(event.name) ?? humanize(key), value } : null;
    }),
  ]);

  const contact = compactRows([
    optionalText(contactInfo?.name)
      ? { label: 'Name', value: optionalText(contactInfo?.name)! }
      : null,
    optionalText(contactInfo?.email)
      ? { label: 'Email', value: optionalText(contactInfo?.email)! }
      : null,
    optionalText(contactInfo?.phone)
      ? { label: 'Phone', value: optionalText(contactInfo?.phone)! }
      : null,
    optionalText(contactInfo?.description)
      ? { label: 'Notes', value: optionalText(contactInfo?.description)! }
      : null,
  ]);

  const description = safeDescriptionText(opportunity.description);
  const eligibilityNotes = optionalText(eligibilityCriteria?.details);
  const hasDecisionDetails =
    facts.length > 1 ||
    Boolean(description) ||
    applicantTypes.length > 0 ||
    funding.length > 0 ||
    dates.length > 0 ||
    contact.length > 0 ||
    Boolean(eligibilityNotes);

  return {
    agency,
    applicantTypes,
    contact,
    dates,
    description,
    eligibilityNotes,
    facts,
    funding,
    hasDecisionDetails,
    showDeadlineNote: Boolean(close),
  };
}
