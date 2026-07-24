import type { WireOpportunity } from '../core/tools.js';

export interface DetailFact {
  label: string;
  value: string;
}

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
  facts: DetailFact[];
  funding: DetailRow[];
  additionalDetails: DetailRow[];
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

function money(value: { amount: string; currency: string } | null | undefined): string | null {
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

function eventLabel(event: NonNullable<WireOpportunity['keyDates']>['closeDate']): string | null {
  if (!event) return null;
  if (event.eventType === 'singleDate') return dateText(event.date);
  if (event.eventType === 'dateRange') {
    const startDate = dateText(event.startDate);
    const endDate = dateText(event.endDate);
    return startDate && endDate ? `${startDate} – ${endDate}` : (startDate ?? endDate);
  }
  return optionalText(event.details) ?? optionalText(event.description) ?? optionalText(event.name);
}

function customValue(opportunity: WireOpportunity, name: string): unknown {
  return opportunity.customFields?.[name]?.value;
}

function customObject(opportunity: WireOpportunity, name: string): Record<string, unknown> | null {
  const value = customValue(opportunity, name);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function customText(opportunity: WireOpportunity, name: string): string | null {
  return optionalText(customValue(opportunity, name));
}

function customList(opportunity: WireOpportunity, name: string): string | null {
  const value = customValue(opportunity, name);
  if (!Array.isArray(value)) return null;
  const items = value.map(optionalText).filter((item): item is string => Boolean(item));
  return items.length > 0 ? items.join(', ') : null;
}

function customBoolean(opportunity: WireOpportunity, name: string): boolean | null {
  const value = customValue(opportunity, name);
  return typeof value === 'boolean' ? value : null;
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
    const readable = parsed.body.textContent
      ?.replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return readable || null;
  }

  const readable = text
    .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return readable || null;
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
  const posted = eventLabel(opportunity.keyDates?.postDate ?? null);
  const close = eventLabel(opportunity.keyDates?.closeDate ?? null);
  const fundingInstrument =
    customText(opportunity, 'fundingInstrument') ??
    customText(opportunity, 'assistanceListingType');

  const facts = compactRows([
    awardRange
      ? { label: 'Award range', value: awardRange }
      : totalFunding
        ? { label: 'Total funding', value: totalFunding }
        : null,
    posted ? { label: 'Posted', value: posted } : null,
    close ? { label: 'Close date', value: close } : null,
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
    posted ? { label: 'Posted', value: posted } : null,
    close ? { label: 'Close date', value: close } : null,
    ...Object.entries(opportunity.keyDates?.otherDates ?? {}).map(([key, event]) => {
      const value = eventLabel(event);
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

  const eligibilityNotes =
    optionalText(eligibilityCriteria?.details) ??
    customText(opportunity, 'caApplicantTypeNotes') ??
    customText(opportunity, 'applicantTypeNotes');

  const letterOfIntent =
    customBoolean(opportunity, 'caLoi') ?? customBoolean(opportunity, 'letterOfIntentRequired');
  const additionalDetails = compactRows([
    customText(opportunity, 'caGeography')
      ? { label: 'Geography', value: customText(opportunity, 'caGeography')! }
      : null,
    customText(opportunity, 'caFundingMethod')
      ? { label: 'Funding method', value: customText(opportunity, 'caFundingMethod')! }
      : null,
    customList(opportunity, 'caCategories')
      ? { label: 'Program categories', value: customList(opportunity, 'caCategories')! }
      : null,
    letterOfIntent === null
      ? null
      : { label: 'Letter of intent', value: letterOfIntent ? 'Required' : 'Not required' },
  ]);

  const description = safeDescriptionText(opportunity.description);
  const hasDecisionDetails =
    facts.length > 1 ||
    Boolean(description) ||
    applicantTypes.length > 0 ||
    funding.length > 0 ||
    dates.length > 0 ||
    contact.length > 0 ||
    Boolean(eligibilityNotes) ||
    additionalDetails.length > 0;

  return {
    agency,
    applicantTypes,
    contact,
    dates,
    description,
    eligibilityNotes,
    facts,
    funding,
    additionalDetails,
    hasDecisionDetails,
    showDeadlineNote: Boolean(close),
  };
}
