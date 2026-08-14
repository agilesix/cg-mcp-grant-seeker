import '../theme/theme.css';
import './grant-results.css';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  buildOpportunityDetailModel,
  eventLabel,
  eventName,
  fundingSummary,
  statusLabel,
  type DetailRow,
} from '../models/opportunity-display.js';
import type { PresentShortlistOutput, ShortlistItem } from '../tools/present-shortlist.js';
import type { VisualTheme } from '../theme/theme.js';

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
  visualTheme: VisualTheme;
  insets: HostInsets;
  displayMode: 'inline' | 'fullscreen' | null;
  displayModePending: boolean;
  displayModeError: string | null;
  onSelect: (key: string) => void;
  onBack: () => void;
  onShowMore: () => void;
  onToggleDescription: (key: string) => void;
  onOpenExternal: (url: string) => void;
  onToggleDisplayMode: () => void;
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

function DisplayModeControl({
  displayMode,
  pending,
  error,
  onToggle,
}: {
  displayMode: GrantResultsProps['displayMode'];
  pending: boolean;
  error: string | null;
  onToggle: () => void;
}) {
  if (displayMode !== 'inline') return null;

  return (
    <div className="display-mode-control">
      <button
        className="secondary-button display-mode-button"
        type="button"
        disabled={pending}
        aria-label="Open full screen"
        onClick={onToggle}
      >
        {pending ? 'Opening…' : 'Full screen'}
      </button>
      {error && (
        <p className="display-mode-error" role="status">
          {error}
        </p>
      )}
    </div>
  );
}

function ExpandableDescription({
  description,
  expanded,
  onToggle,
}: {
  description: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const descriptionId = useId();
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    if (expanded) return;
    const descriptionElement = descriptionRef.current;
    if (!descriptionElement) return;
    const update = () =>
      setIsTruncated(descriptionElement.scrollHeight > descriptionElement.clientHeight + 1);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(descriptionElement);
    return () => observer.disconnect();
  }, [description, expanded]);

  return (
    <>
      <p
        ref={descriptionRef}
        id={descriptionId}
        className={`description ${expanded ? 'expanded' : ''}`}
        data-testid="opportunity-description"
      >
        {description}
      </p>
      {(isTruncated || expanded) && (
        <button
          className="text-button"
          type="button"
          aria-controls={descriptionId}
          aria-expanded={expanded}
          onClick={onToggle}
        >
          {expanded ? 'Show less' : 'Show full description'}
        </button>
      )}
    </>
  );
}

function DetailView({
  item,
  headingRef,
  descriptionExpanded,
  onToggleDescription,
  onOpenExternal,
}: {
  item: ShortlistItem & { opportunity: NonNullable<ShortlistItem['opportunity']> };
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  descriptionExpanded: boolean;
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
          <p className={`status-text status-${item.opportunity.status.value}`}>
            {statusLabel(item.opportunity.status)}
          </p>
        </div>
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
          <ExpandableDescription
            description={detail.description}
            expanded={descriptionExpanded}
            onToggle={onToggleDescription}
          />
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
        {item.providerPageUrl && (
          <div className="source-action">
            <p>Confirm current requirements and application instructions with the source.</p>
            <button
              className="primary-button"
              type="button"
              onClick={() => onOpenExternal(item.providerPageUrl!)}
            >
              View source details
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export function GrantResultsLoading({
  colorScheme,
  visualTheme,
  insets,
}: Pick<GrantResultsProps, 'colorScheme' | 'visualTheme' | 'insets'>) {
  return (
    <main
      className={`grant-app ${colorScheme}`}
      data-visual-theme={visualTheme}
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
  visualTheme,
  insets,
  message,
}: Pick<GrantResultsProps, 'colorScheme' | 'visualTheme' | 'insets'> & { message: string }) {
  return (
    <main
      className={`grant-app ${colorScheme}`}
      data-visual-theme={visualTheme}
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
  visualTheme,
  insets,
  displayMode,
  displayModePending,
  displayModeError,
  onSelect,
  onBack,
  onShowMore,
  onToggleDescription,
  onOpenExternal,
  onToggleDisplayMode,
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
  const reportedFilters = output.researchContext.filters ?? [];
  const reportedSort = output.researchContext.sort ?? null;
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
      <main
        className={`grant-app ${colorScheme}`}
        data-visual-theme={visualTheme}
        style={rootStyle}
      >
        <nav className="detail-toolbar" aria-label="Opportunity navigation">
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              restoreFocusKey.current = key;
              onBack();
            }}
          >
            Back to shortlist
          </button>
          <DisplayModeControl
            displayMode={displayMode}
            pending={displayModePending}
            error={displayModeError}
            onToggle={onToggleDisplayMode}
          />
        </nav>
        <DetailView
          item={selected}
          headingRef={detailHeadingRef}
          descriptionExpanded={expandedDescriptionKey === key}
          onToggleDescription={() => onToggleDescription(key)}
          onOpenExternal={onOpenExternal}
        />
      </main>
    );
  }

  return (
    <main className={`grant-app ${colorScheme}`} data-visual-theme={visualTheme} style={rootStyle}>
      <header className="app-header">
        <p className="eyebrow">Grant opportunities</p>
        <h1>Opportunity shortlist</h1>
        <p>
          {successful.length} {successful.length === 1 ? 'opportunity' : 'opportunities'} ready for
          review
        </p>
        {(reportedFilters.length > 0 || reportedSort) && (
          <div className="selection-context" aria-label="Shortlist selection">
            {reportedFilters.length > 0 && (
              <p>
                <strong>Filtered by</strong>
                <span>{reportedFilters.join(' · ')}</span>
              </p>
            )}
            {reportedSort && (
              <p>
                <strong>Sorted by</strong>
                <span>{reportedSort}</span>
              </p>
            )}
          </div>
        )}
        {output.researchContext.queries.length > 0 && (
          <details className="research-context">
            <summary>How this shortlist was researched</summary>
            <p>Search terms the assistant reported using:</p>
            <ul>
              {output.researchContext.queries.map((query) => (
                <li key={query}>{query}</li>
              ))}
            </ul>
            <p>
              The assistant reported using each item above in a separate search. Different grant
              sources may search different parts of an opportunity, so the same words can produce
              different results.
            </p>
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

          const closeEvent = item.opportunity.keyDates?.closeDate ?? null;
          const closeValue = eventLabel(closeEvent);

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
                    <span>{fundingSummary(item.opportunity)}</span>
                    <span>
                      {closeValue
                        ? `${eventName(closeEvent, 'Close date')}: ${closeValue}`
                        : 'Close date not provided'}
                    </span>
                  </span>
                </span>
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
