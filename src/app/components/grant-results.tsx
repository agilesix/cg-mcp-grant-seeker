import './grant-results.css';

import { useEffect, useMemo, useRef } from 'react';
import {
  buildOpportunityDetailModel,
  eventLabel,
  money,
  type DetailRow,
} from '../models/opportunity-display.js';
import type { PresentShortlistOutput, ShortlistItem } from '../tools/present-shortlist.js';

export interface HostInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface GrantResultsProps {
  output: PresentShortlistOutput;
  selectedKey: string | null;
  visibleCount: number;
  expandedDescriptionKey: string | null;
  colorScheme: 'light' | 'dark';
  insets: HostInsets;
  onSelect: (key: string) => void;
  onBack: () => void;
  onShowMore: () => void;
  onToggleDescription: (key: string) => void;
  onOpenExternal: (url: string) => void;
}

export function itemKey(item: Pick<ShortlistItem, 'source' | 'id'>): string {
  return `${item.source.name}:${item.id}`;
}

function DetailRows({ rows }: { rows: DetailRow[] }) {
  return (
    <dl className="detail-rows">
      {rows.map((row) => (
        <div key={`${row.label}:${row.value}`}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DetailView({
  item,
  headingRef,
  descriptionExpanded,
  onBack,
  onToggleDescription,
  onOpenExternal,
}: {
  item: ShortlistItem & { opportunity: NonNullable<ShortlistItem['opportunity']> };
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  descriptionExpanded: boolean;
  onBack: () => void;
  onToggleDescription: () => void;
  onOpenExternal: (url: string) => void;
}) {
  const detail = useMemo(
    () => buildOpportunityDetailModel(item.opportunity, item.source.label),
    [item.opportunity, item.source.label],
  );
  const hasMoreDetails =
    Boolean(detail.eligibilityNotes) ||
    detail.dates.length > 0 ||
    detail.contact.length > 0 ||
    detail.showDeadlineNote;

  return (
    <section className="detail-view" aria-label="Grant opportunity details">
      <header className="detail-header">
        <div>
          <p className="eyebrow">{detail.agency}</p>
          <h1 ref={headingRef} tabIndex={-1}>
            {item.opportunity.title}
          </h1>
        </div>
        <span className="status-badge">{item.opportunity.status.value}</span>
      </header>

      <dl className="detail-facts">
        {detail.facts.map((fact) => (
          <div key={`${fact.label}:${fact.value}`}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>

      {detail.description && (
        <section className="detail-section">
          <h2>About this opportunity</h2>
          <p className={`description ${descriptionExpanded ? 'expanded' : ''}`}>
            {detail.description}
          </p>
          <button
            className="text-button"
            type="button"
            aria-expanded={descriptionExpanded}
            onClick={onToggleDescription}
          >
            {descriptionExpanded ? 'Show less' : 'Show full description'}
          </button>
        </section>
      )}

      {(detail.applicantTypes.length > 0 || detail.funding.length > 0) && (
        <div className="detail-grid detail-section">
          {detail.applicantTypes.length > 0 && (
            <section>
              <h2>Who can apply</h2>
              <div className="chips">
                {detail.applicantTypes.map((applicantType) => (
                  <span className="chip" key={applicantType}>
                    {applicantType}
                  </span>
                ))}
              </div>
            </section>
          )}
          {detail.funding.length > 0 && (
            <section>
              <h2>Funding</h2>
              <DetailRows rows={detail.funding} />
            </section>
          )}
        </div>
      )}

      {!detail.hasDecisionDetails && (
        <p className="notice">
          The source did not provide additional funding, deadline, eligibility, or contact details.
          The complete information currently available is shown above.
        </p>
      )}

      {hasMoreDetails && (
        <details className="detail-disclosure">
          <summary>More opportunity details</summary>
          <div className="detail-disclosure-content">
            {detail.eligibilityNotes && (
              <section>
                <h2>Eligibility notes</h2>
                <p>{detail.eligibilityNotes}</p>
              </section>
            )}
            {(detail.dates.length > 0 || detail.contact.length > 0) && (
              <div className="detail-grid">
                {detail.dates.length > 0 && (
                  <section>
                    <h2>Key dates</h2>
                    <DetailRows rows={detail.dates} />
                  </section>
                )}
                {detail.contact.length > 0 && (
                  <section>
                    <h2>Contact</h2>
                    <DetailRows rows={detail.contact} />
                  </section>
                )}
              </div>
            )}
            {detail.showDeadlineNote && (
              <p className="notice">
                Dates and requirements are provided by the grant source and may change. A displayed
                close date may be an administrative horizon for a rolling or continuous program.
              </p>
            )}
          </div>
        </details>
      )}

      <div className="detail-actions">
        <button className="secondary-button" type="button" onClick={onBack}>
          Back to shortlist
        </button>
        {item.providerPageUrl && (
          <button
            className="primary-button"
            type="button"
            onClick={() => onOpenExternal(item.providerPageUrl!)}
          >
            View provider page
          </button>
        )}
      </div>
    </section>
  );
}

export function GrantResultsLoading({
  colorScheme,
  insets,
}: Pick<GrantResultsProps, 'colorScheme' | 'insets'>) {
  return (
    <main
      className={`grant-app ${colorScheme}`}
      style={{
        paddingTop: insets.top,
        paddingRight: insets.right,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
      }}
    >
      <p className="notice" role="status">
        Loading grant information…
      </p>
    </main>
  );
}

export function GrantResultsMessage({
  colorScheme,
  insets,
  message,
}: Pick<GrantResultsProps, 'colorScheme' | 'insets'> & { message: string }) {
  return (
    <main
      className={`grant-app ${colorScheme}`}
      style={{
        paddingTop: insets.top,
        paddingRight: insets.right,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
      }}
    >
      <p className="notice" role="alert">
        {message}
      </p>
    </main>
  );
}

export default function GrantResults({
  output,
  selectedKey,
  visibleCount,
  expandedDescriptionKey,
  colorScheme,
  insets,
  onSelect,
  onBack,
  onShowMore,
  onToggleDescription,
  onOpenExternal,
}: GrantResultsProps) {
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const restoreFocusKey = useRef<string | null>(null);
  const successful = output.items.filter(
    (item): item is ShortlistItem & { opportunity: NonNullable<ShortlistItem['opportunity']> } =>
      item.status === 'success' && Boolean(item.opportunity),
  );
  const selected = successful.find((item) => itemKey(item) === selectedKey);
  const visible = output.items.slice(0, visibleCount);
  const hiddenCount = Math.max(0, output.items.length - visible.length);
  const rootStyle = {
    paddingTop: insets.top,
    paddingRight: insets.right,
    paddingBottom: insets.bottom,
    paddingLeft: insets.left,
  };

  useEffect(() => {
    if (selected) {
      detailHeadingRef.current?.focus();
      return;
    }
    if (!restoreFocusKey.current) return;
    rowRefs.current.get(restoreFocusKey.current)?.focus();
    restoreFocusKey.current = null;
  }, [selected]);

  if (selected) {
    const key = itemKey(selected);
    return (
      <main className={`grant-app ${colorScheme}`} style={rootStyle}>
        <DetailView
          item={selected}
          headingRef={detailHeadingRef}
          descriptionExpanded={expandedDescriptionKey === key}
          onBack={() => {
            restoreFocusKey.current = key;
            onBack();
          }}
          onToggleDescription={() => onToggleDescription(key)}
          onOpenExternal={onOpenExternal}
        />
      </main>
    );
  }

  return (
    <main className={`grant-app ${colorScheme}`} style={rootStyle}>
      <header className="app-header">
        <p className="eyebrow">Grant opportunities</p>
        <h1>Opportunity shortlist</h1>
        <p>
          {successful.length} {successful.length === 1 ? 'opportunity' : 'opportunities'} ready for
          review
        </p>
        {output.researchContext.queries.length > 0 && (
          <details className="research-context">
            <summary>Research context</summary>
            <p>Search terms reported by the assistant:</p>
            <ul>
              {output.researchContext.queries.map((query) => (
                <li key={query}>{query}</li>
              ))}
            </ul>
          </details>
        )}
      </header>

      <ol className="result-list">
        {visible.map((item) => {
          if (item.status === 'error' || !item.opportunity) {
            return (
              <li className="result-error" key={itemKey(item)}>
                <span className="rank">{item.rank}</span>
                <div>
                  <strong>{item.source.label}</strong>
                  <p>{item.error?.message ?? 'This opportunity could not be loaded.'}</p>
                </div>
              </li>
            );
          }

          return (
            <li key={itemKey(item)}>
              <button
                ref={(node) => {
                  const key = itemKey(item);
                  if (node) rowRefs.current.set(key, node);
                  else rowRefs.current.delete(key);
                }}
                className="result-row"
                type="button"
                onClick={() => onSelect(itemKey(item))}
              >
                <span className="rank">{item.rank}</span>
                <span className="result-main">
                  <span className="result-source">{item.source.label}</span>
                  <strong>{item.opportunity.title}</strong>
                  <span className="result-meta">
                    <span>
                      {money(item.opportunity.funding?.maxAwardAmount) ?? 'Award not provided'}
                    </span>
                    <span>
                      {eventLabel(item.opportunity.keyDates?.closeDate ?? null) ??
                        'Close date not provided'}
                    </span>
                  </span>
                </span>
                <span className="review-label">Review</span>
              </button>
            </li>
          );
        })}
      </ol>

      {hiddenCount > 0 && (
        <div className="collection-action">
          <button className="secondary-button" type="button" onClick={onShowMore}>
            Show more results ({hiddenCount})
          </button>
        </div>
      )}
    </main>
  );
}
