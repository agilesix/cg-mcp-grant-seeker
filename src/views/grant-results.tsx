import './grant-results.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLayout, useOpenExternal, useToolInfo } from 'skybridge/web';
import type {
  PresentOpportunityShortlistToolInput,
  PresentOpportunityShortlistToolOutput,
  Source,
  WireOpportunity,
} from '../core/tools.js';
import { buildOpportunityDetailModel, type DetailRow } from './opportunity-display.js';

type JsonObject<T> = T & Record<string, unknown>;

interface PresentedOpportunity {
  source: Source;
  opportunity: WireOpportunity;
  providerPageUrl: string | null;
}

interface ShortlistSource {
  source: Source;
  opportunities: PresentedOpportunity[];
  errors: string[];
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

function eventLabel(event: NonNullable<WireOpportunity['keyDates']>['closeDate']): string | null {
  if (!event) return null;
  if (event.eventType === 'singleDate') return optionalText(event.date);
  if (event.eventType === 'dateRange') {
    const startDate = optionalText(event.startDate);
    const endDate = optionalText(event.endDate);
    return startDate && endDate ? `${startDate} – ${endDate}` : (startDate ?? endDate);
  }
  return event.details ?? event.description ?? event.name;
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function DetailRows({ rows }: { rows: DetailRow[] }) {
  return (
    <dl className="detail-rows">
      {rows.map((row, index) => (
        <div key={`${row.label}:${row.value}:${index}`}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DetailView({
  item,
  canReturn,
  onReturn,
}: {
  item: PresentedOpportunity;
  canReturn: boolean;
  onReturn: () => void;
}) {
  const openExternal = useOpenExternal();
  const { opportunity, source, providerPageUrl } = item;
  const detail = useMemo(
    () => buildOpportunityDetailModel(opportunity, source.label),
    [opportunity, source.label],
  );
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const status = opportunity.status.value;

  return (
    <section
      className="detail-view"
      aria-label="Grant opportunity details"
      data-llm={`Viewing grant opportunity: ${opportunity.title}; source: ${source.label}; source-scoped ID: ${opportunity.id}`}
    >
      <header className="detail-header">
        <div>
          <p className="eyebrow">{detail.agency}</p>
          <h1>{opportunity.title}</h1>
        </div>
        <span className={`status-badge ${status}`}>{status}</span>
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
            onClick={() => setDescriptionExpanded((expanded) => !expanded)}
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
                {detail.applicantTypes.map((applicantType, index) => (
                  <span className="chip" key={`${applicantType}:${index}`}>
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

      {detail.eligibilityNotes && (
        <section className="detail-section">
          <h2>Eligibility notes</h2>
          <p>{detail.eligibilityNotes}</p>
        </section>
      )}

      {(detail.dates.length > 0 || detail.contact.length > 0) && (
        <div className="detail-grid detail-section">
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

      {!detail.hasDecisionDetails && (
        <p className="sparse-note">
          The source did not provide additional funding, deadline, eligibility, or contact details.
          The complete information currently available is shown above.
        </p>
      )}

      {detail.showDeadlineNote && (
        <p className="source-note">
          Dates and requirements are provided by the grant source and may change. A displayed close
          date may be an administrative horizon for a rolling or continuous program.
        </p>
      )}

      {detail.additionalDetails.length > 0 && (
        <details className="detail-disclosure">
          <summary>Additional source details</summary>
          <DetailRows rows={detail.additionalDetails} />
        </details>
      )}

      <div className="detail-actions">
        {canReturn && (
          <button className="secondary-button" onClick={onReturn}>
            Back to results
          </button>
        )}
        {providerPageUrl && (
          <button className="primary-button" onClick={() => openExternal(providerPageUrl)}>
            View provider page
          </button>
        )}
      </div>
    </section>
  );
}

export default function GrantResults() {
  const { theme, maxHeight, safeArea } = useLayout();
  const tool = useToolInfo<{
    input: JsonObject<PresentOpportunityShortlistToolInput>;
    output: JsonObject<PresentOpportunityShortlistToolOutput>;
  }>();
  const toolResultKey = tool.isSuccess
    ? JSON.stringify({ input: tool.input ?? null, items: tool.output.items })
    : null;
  const hydratedResultKey = useRef(toolResultKey);
  const [selected, setSelected] = useState<PresentedOpportunity | null>(null);
  const [additionalVisible, setAdditionalVisible] = useState(0);
  const sources = useMemo<ShortlistSource[]>(() => {
    if (!tool.isSuccess) return [];
    const grouped = new Map<string, ShortlistSource>();
    for (const item of tool.output.items) {
      const source = grouped.get(item.source.name) ?? {
        source: item.source,
        opportunities: [],
        errors: [],
      };
      if (item.status === 'success' && item.opportunity) {
        source.opportunities.push({
          source: item.source,
          opportunity: item.opportunity,
          providerPageUrl: item.providerPageUrl,
        });
      } else {
        source.errors.push(item.error ?? `Unable to load opportunity ${item.id}.`);
      }
      grouped.set(item.source.name, source);
    }
    return [...grouped.values()];
  }, [tool]);

  useEffect(() => {
    if (!toolResultKey || hydratedResultKey.current === toolResultKey) return;
    hydratedResultKey.current = toolResultKey;
    setSelected(null);
    setAdditionalVisible(0);
  }, [toolResultKey]);

  const resultCount = useMemo(
    () => sources.reduce((sum, source) => sum + source.opportunities.length, 0),
    [sources],
  );
  const baseVisiblePerSource = sources.length > 1 ? (maxHeight && maxHeight < 650 ? 1 : 2) : 5;
  const visiblePerSource = baseVisiblePerSource + additionalVisible;
  const hiddenCount = useMemo(
    () =>
      sources.reduce(
        (sum, source) => sum + Math.max(0, source.opportunities.length - visiblePerSource),
        0,
      ),
    [sources, visiblePerSource],
  );
  const rootStyle = {
    paddingTop: safeArea.insets.top,
    paddingRight: safeArea.insets.right,
    paddingBottom: safeArea.insets.bottom,
    paddingLeft: safeArea.insets.left,
  };

  if (tool.isPending) {
    return (
      <main className={`grant-app ${theme === 'dark' ? 'dark' : ''}`} style={rootStyle}>
        <div className="loading-card">
          <span className="spinner" />
          Loading grant information…
        </div>
      </main>
    );
  }

  if (selected) {
    return (
      <main className={`grant-app ${theme === 'dark' ? 'dark' : ''}`} style={rootStyle}>
        <DetailView
          item={selected}
          canReturn={sources.length > 0}
          onReturn={() => setSelected(null)}
        />
      </main>
    );
  }

  if (tool.isSuccess && tool.output.items.length === 0) {
    return (
      <main className={`grant-app ${theme === 'dark' ? 'dark' : ''}`} style={rootStyle}>
        <div className="empty-card">
          <p className="eyebrow">Grant opportunities</p>
          <h1>No shortlist candidates</h1>
          <p>
            {tool.output.searchesRun
              ? `${tool.output.searchesRun} searches were performed, but no opportunities were selected for review.`
              : 'No opportunities were selected for review.'}
          </p>
        </div>
      </main>
    );
  }

  const searchesRun = tool.isSuccess ? tool.output.searchesRun : null;
  const queries = tool.isSuccess ? tool.output.queries : [];

  return (
    <main
      className={`grant-app ${theme === 'dark' ? 'dark' : ''}`}
      style={rootStyle}
      data-llm={`Viewing a final shortlist of ${resultCount} grant opportunities across ${sources.length} sources${searchesRun !== null ? ` assembled after ${searchesRun} searches` : ''}`}
    >
      <header className="app-header">
        <div>
          <p className="eyebrow">Grant opportunities</p>
          <h1>Opportunity shortlist</h1>
          <p>
            {resultCount} {resultCount === 1 ? 'opportunity' : 'opportunities'} from{' '}
            {sources.length} {sources.length === 1 ? 'source' : 'sources'}
            {searchesRun !== null
              ? ` · selected after ${searchesRun} ${searchesRun === 1 ? 'search' : 'searches'}`
              : ''}
          </p>
        </div>
        {queries.length > 0 && (
          <details className="search-disclosure">
            <summary>Searches used</summary>
            <ol>
              {queries.map((query, index) => (
                <li key={`${query}:${index}`}>{query}</li>
              ))}
            </ol>
          </details>
        )}
      </header>

      <div className="source-list">
        {sources.map((source, sourceIndex) => (
          <section className="source-section" key={`${source.source.name}-${sourceIndex}`}>
            <div className="source-heading">
              <div>
                <h2>{source.source.label}</h2>
                <p>
                  {source.opportunities.length}{' '}
                  {source.opportunities.length === 1 ? 'candidate' : 'candidates'}
                </p>
              </div>
              <span className={`source-state ${source.errors.length > 0 ? 'error' : 'success'}`}>
                {source.errors.length > 0 ? 'Partial' : 'Ready'}
              </span>
            </div>

            {source.errors.map((error, index) => (
              <p className="source-error" key={`${error}:${index}`}>
                {error}
              </p>
            ))}

            <div className="result-list">
              {source.opportunities
                .slice(0, visiblePerSource)
                .map((item: PresentedOpportunity, resultIndex) => {
                  const { opportunity } = item;
                  const key = `${source.source.name}:${opportunity.id}`;
                  return (
                    <button
                      className="result-row"
                      key={`${key}:${resultIndex}`}
                      onClick={() => setSelected(item)}
                      data-llm={`Grant result: ${opportunity.title}; source: ${source.source.label}; ID: ${opportunity.id}`}
                    >
                      <span className="result-main">
                        <span className="result-topline">
                          <span className={`status-dot ${opportunity.status.value}`} />
                          {opportunity.status.value}
                        </span>
                        <strong>{opportunity.title}</strong>
                        <span className="result-meta">
                          <span>
                            {money(opportunity.funding?.maxAwardAmount) ?? 'Award not provided'}
                          </span>
                          <span>
                            {eventLabel(opportunity.keyDates?.closeDate ?? null) ??
                              'Close date not provided'}
                          </span>
                        </span>
                      </span>
                      <span className="review-label">Review</span>
                    </button>
                  );
                })}
            </div>
          </section>
        ))}
      </div>

      {hiddenCount > 0 && (
        <div className="collection-action">
          <button
            className="secondary-button"
            onClick={() => setAdditionalVisible((current) => current + 2)}
          >
            Show more results
          </button>
        </div>
      )}
    </main>
  );
}
