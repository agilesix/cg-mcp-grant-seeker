import './grant-results.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useCallTool, useLayout, useOpenExternal, useToolInfo } from 'skybridge/web';
import type {
  GetOpportunityToolInput,
  GetOpportunityToolOutput,
  OpportunityDetail,
  OpportunitySummary,
  SearchOutcome,
  SearchToolInput,
  SearchToolOutput,
} from '../core/tools.js';

type JsonObject<T> = T & Record<string, unknown>;
type DetailResponse = { structuredContent: JsonObject<GetOpportunityToolOutput> };
type SearchResponse = { structuredContent: JsonObject<SearchToolOutput> };

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

function mergePage(current: SearchOutcome[], incoming: SearchOutcome): SearchOutcome[] {
  return current.map((source) => {
    if (source.source.name !== incoming.source.name) return source;
    const seen = new Set(source.opportunities.map(({ id }) => id));
    return {
      ...incoming,
      opportunities: [
        ...source.opportunities,
        ...incoming.opportunities.filter(({ id }) => !seen.has(id)),
      ],
      omittedInvalidRows: source.omittedInvalidRows + incoming.omittedInvalidRows,
    };
  });
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
    input: JsonObject<SearchToolInput>;
    output: JsonObject<SearchToolOutput>;
  }>();
  const detailCall = useCallTool<JsonObject<GetOpportunityToolInput>, DetailResponse>(
    'get_opportunity',
  );
  const pageCall = useCallTool<JsonObject<SearchToolInput>, SearchResponse>('search_opportunities');
  const toolSources = tool.isSuccess ? tool.output.sources : null;
  const hydrated = useRef(toolSources !== null);
  const [sources, setSources] = useState<SearchOutcome[]>(toolSources ?? []);
  const [selected, setSelected] = useState<OpportunityDetail | null>(null);
  const [visiblePerSource, setVisiblePerSource] = useState(() =>
    toolSources && toolSources.length > 1 ? (maxHeight && maxHeight < 650 ? 1 : 2) : 5,
  );
  const [detailError, setDetailError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadingSource, setLoadingSource] = useState<string | null>(null);

  useEffect(() => {
    if (!toolSources || hydrated.current) return;
    hydrated.current = true;
    setSources(toolSources);
    setVisiblePerSource(toolSources.length > 1 ? (maxHeight && maxHeight < 650 ? 1 : 2) : 5);
  }, [maxHeight, toolSources]);

  const resultCount = useMemo(
    () => sources.reduce((sum, source) => sum + source.opportunities.length, 0),
    [sources],
  );
  const hiddenCount = useMemo(
    () =>
      sources.reduce(
        (sum, source) => sum + Math.max(0, source.opportunities.length - visiblePerSource),
        0,
      ),
    [sources, visiblePerSource],
  );
  const targetedSearch = sources.length === 1;
  const sourceWithNextPage =
    targetedSearch && hiddenCount === 0 && sources[0]?.hasNextPage && sources[0]?.nextPage
      ? sources[0]
      : null;
  const rootStyle = {
    paddingTop: safeArea.insets.top,
    paddingRight: safeArea.insets.right,
    paddingBottom: safeArea.insets.bottom,
    paddingLeft: safeArea.insets.left,
  };

  async function showDetail(opportunity: OpportunitySummary) {
    setLoadingId(`${opportunity.source.name}:${opportunity.id}`);
    setDetailError(null);
    try {
      const response = await detailCall.callToolAsync({
        id: opportunity.id,
        source: opportunity.source.name,
      });
      const result = response.structuredContent;
      if (result.status === 'success' && result.opportunity) {
        setSelected(result.opportunity);
      } else {
        setDetailError(result.error ?? 'Unable to retrieve this opportunity.');
      }
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : 'Unable to retrieve this opportunity.',
      );
    } finally {
      setLoadingId(null);
    }
  }

  async function continueSource(source: SearchOutcome) {
    if (!source.nextPage) return;
    setLoadingSource(source.source.name);
    try {
      const response = await pageCall.callToolAsync({
        query: tool.input?.query,
        statuses: tool.input?.statuses,
        source: source.source.name,
        page: source.nextPage,
        limit: tool.input?.limit ?? 5,
      });
      const incoming = response.structuredContent.sources[0];
      if (incoming) {
        setSources((current) => mergePage(current, incoming));
        setVisiblePerSource((current) => current + incoming.opportunities.length);
      }
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Unable to load more results.');
    } finally {
      setLoadingSource(null);
    }
  }

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

  if (sources.length === 0) {
    return (
      <main className={`grant-app ${theme === 'dark' ? 'dark' : ''}`} style={rootStyle}>
        <div className="empty-card" role={detailError ? 'alert' : undefined}>
          <h1>Opportunity unavailable</h1>
          <p>{detailError ?? 'No opportunity data was returned.'}</p>
        </div>
      </main>
    );
  }

  const query = tool.input?.query;

  return (
    <main
      className={`grant-app ${theme === 'dark' ? 'dark' : ''}`}
      style={rootStyle}
      data-llm={`Viewing ${resultCount} grant opportunity summaries across ${sources.length} sources${query ? ` for query: ${query}` : ''}`}
    >
      <header className="app-header">
        <div>
          <p className="eyebrow">Grant opportunities</p>
          <h1>{query ? `Results for “${query}”` : 'Search results'}</h1>
          <p>
            {resultCount} {resultCount === 1 ? 'opportunity' : 'opportunities'} from{' '}
            {sources.length} {sources.length === 1 ? 'source' : 'sources'}
          </p>
        </div>
      </header>

      {detailError && (
        <div className="error-banner" role="alert">
          <span>{detailError}</span>
          <button onClick={() => setDetailError(null)}>Dismiss</button>
        </div>
      )}

      <div className="source-list">
        {sources.map((source, sourceIndex) => (
          <section
            className="source-section"
            key={`${source.source.name}-${source.page}-${sourceIndex}`}
          >
            <div className="source-heading">
              <div>
                <h2>{source.source.label}</h2>
                <p>
                  {source.total ?? source.opportunities.length}{' '}
                  {(source.total ?? source.opportunities.length) === 1 ? 'result' : 'results'}
                </p>
              </div>
              <span className={`source-state ${source.status}`}>{source.status}</span>
            </div>

            {source.error && <p className="source-error">{source.error}</p>}
            {source.omittedInvalidRows > 0 && (
              <p className="source-warning">
                {source.omittedInvalidRows} malformed{' '}
                {source.omittedInvalidRows === 1 ? 'record was' : 'records were'} omitted.
              </p>
            )}
            {source.status === 'empty' && <p className="empty-state">No matching results.</p>}

            <div className="result-list">
              {source.opportunities
                .slice(0, visiblePerSource)
                .map((opportunity: OpportunitySummary, resultIndex) => {
                  const key = `${source.source.name}:${opportunity.id}`;
                  return (
                    <button
                      className="result-row"
                      key={`${key}:${resultIndex}`}
                      disabled={loadingId === key}
                      onClick={() => void showDetail(opportunity)}
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
                      <span className="review-label">
                        {loadingId === key ? 'Loading…' : 'Review'}
                      </span>
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
            onClick={() => setVisiblePerSource((current) => current + 2)}
          >
            Show more results
          </button>
        </div>
      )}

      {sourceWithNextPage && (
        <div className="collection-action">
          <button
            className="secondary-button"
            disabled={loadingSource === sourceWithNextPage.source.name}
            onClick={() => void continueSource(sourceWithNextPage)}
          >
            {loadingSource === sourceWithNextPage.source.name ? 'Loading…' : 'Load next page'}
          </button>
        </div>
      )}
    </main>
  );
}
