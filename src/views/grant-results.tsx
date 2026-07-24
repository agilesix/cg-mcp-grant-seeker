import './grant-results.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLayout, useOpenExternal, useToolInfo } from 'skybridge/web';
import type {
  OpportunityDetail,
  OpportunitySummary,
  PresentOpportunityShortlistToolInput,
  PresentOpportunityShortlistToolOutput,
  Source,
} from '../core/tools.js';

type JsonObject<T> = T & Record<string, unknown>;

interface ShortlistSource {
  source: Source;
  opportunities: OpportunityDetail[];
  errors: string[];
}

function money(value: OpportunitySummary['maxAward']): string | null {
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

function eventLabel(event: OpportunitySummary['closeDate']): string | null {
  if (!event) return null;
  if (event.eventType === 'singleDate') return event.date;
  if (event.eventType === 'dateRange') return `${event.startDate} – ${event.endDate}`;
  return event.details ?? event.description ?? event.name;
}

function DetailView({
  opportunity,
  canReturn,
  onReturn,
}: {
  opportunity: OpportunityDetail;
  canReturn: boolean;
  onReturn: () => void;
}) {
  const openExternal = useOpenExternal();
  const awardRange = [money(opportunity.minAward), money(opportunity.maxAward)]
    .filter(Boolean)
    .join(' – ');
  const agency = opportunity.agency?.name ?? opportunity.agency?.code ?? opportunity.source.label;
  const applicantTypes = opportunity.acceptedApplicantTypes ?? [];

  return (
    <section
      className="detail-view"
      aria-label="Grant opportunity details"
      data-llm={`Viewing grant opportunity: ${opportunity.title ?? 'Untitled opportunity'}; source: ${opportunity.source.label}; source-scoped ID: ${opportunity.id}`}
    >
      <header className="detail-header">
        <div>
          <p className="eyebrow">{agency}</p>
          <h1>{opportunity.title ?? 'Untitled opportunity'}</h1>
        </div>
        <span className={`status-badge ${opportunity.status ?? 'unknown'}`}>
          {opportunity.status ?? 'Status unknown'}
        </span>
      </header>

      <dl className="detail-facts">
        <div>
          <dt>Award range</dt>
          <dd>{awardRange || 'Not provided'}</dd>
        </div>
        <div>
          <dt>Close date</dt>
          <dd>{eventLabel(opportunity.closeDate) ?? 'Not provided'}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{opportunity.source.label}</dd>
        </div>
      </dl>

      {opportunity.description && (
        <section className="detail-section">
          <h2>About this opportunity</h2>
          <p className="description">{opportunity.description}</p>
        </section>
      )}

      {applicantTypes.length > 0 && (
        <section className="detail-section">
          <h2>Accepted applicants</h2>
          <div className="chips">
            {applicantTypes.map((type, index) => (
              <span
                className="chip"
                key={`${type.value}-${type.customValue ?? 'standard'}-${index}`}
              >
                {type.customValue ?? type.description ?? type.value}
              </span>
            ))}
          </div>
        </section>
      )}

      {opportunity.eligibilityCriteria?.details && (
        <section className="detail-section">
          <h2>Eligibility notes</h2>
          <p>{opportunity.eligibilityCriteria.details}</p>
        </section>
      )}

      {opportunity.contactInfo && (
        <section className="detail-section">
          <h2>Contact</h2>
          <p>
            {[
              opportunity.contactInfo.name,
              opportunity.contactInfo.email,
              opportunity.contactInfo.phone,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {opportunity.contactInfo.description && <p>{opportunity.contactInfo.description}</p>}
        </section>
      )}

      <p className="source-note">
        Verify requirements and deadlines with the grant provider. A displayed close date may be an
        administrative horizon for a rolling or continuous program.
      </p>

      <div className="detail-actions">
        {canReturn && (
          <button className="secondary-button" onClick={onReturn}>
            Back to results
          </button>
        )}
        {opportunity.originalSourceUrl && (
          <button
            className="primary-button"
            onClick={() => openExternal(opportunity.originalSourceUrl!)}
          >
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
  const [selected, setSelected] = useState<OpportunityDetail | null>(null);
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
        source.opportunities.push(item.opportunity);
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
          opportunity={selected}
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
                .map((opportunity: OpportunityDetail, resultIndex) => {
                  const key = `${source.source.name}:${opportunity.id}`;
                  return (
                    <button
                      className="result-row"
                      key={`${key}:${resultIndex}`}
                      onClick={() => setSelected(opportunity)}
                      data-llm={`Grant result: ${opportunity.title ?? 'Untitled opportunity'}; source: ${opportunity.source.label}; ID: ${opportunity.id}`}
                    >
                      <span className="result-main">
                        <span className="result-topline">
                          <span className={`status-dot ${opportunity.status ?? 'unknown'}`} />
                          {opportunity.status ?? 'Status unknown'}
                        </span>
                        <strong>{opportunity.title ?? 'Untitled opportunity'}</strong>
                        <span className="result-meta">
                          <span>{money(opportunity.maxAward) ?? 'Award not provided'}</span>
                          <span>
                            {eventLabel(opportunity.closeDate) ?? 'Close date not provided'}
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
