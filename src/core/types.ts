import type { Client } from '@common-grants/sdk/client';

/**
 * Types derived directly from the installed @common-grants/sdk so they track
 * the SDK exactly and never drift. `Opportunity` is the shape returned by
 * `get`; `SearchResult` is the full search envelope ({ items, paginationInfo,
 * errors, ... }).
 */
type SearchArgs = NonNullable<Parameters<Client['opportunities']['search']>[0]>;
export type Opportunity = Awaited<ReturnType<Client['opportunities']['get']>>;
export type SearchResult = Awaited<ReturnType<Client['opportunities']['search']>>;

/**
 * The base CommonGrants opportunity status values, derived from the SDK.
 * As of @common-grants/sdk@0.5: 'open' | 'forecasted' | 'closed' | 'custom'.
 */
export type OpportunityStatus = NonNullable<SearchArgs['statuses']>[number];

/** How to authenticate to a source. Most CommonGrants sources need no auth. */
export type AuthConfig =
  | { type: 'none' }
  | { type: 'apiKey'; key?: string; header?: string }
  | { type: 'bearer'; token?: string };

/** A single CommonGrants-compliant API the server can query. */
export interface SourceConfig {
  /** Short, stable id used in tool arguments, e.g. "federal". */
  name: string;
  /** Human-readable label shown in results, e.g. "Federal (Simpler.Grants.gov)". */
  label: string;
  /** Base URL of the CommonGrants API. The SDK appends /common-grants/... paths. */
  baseUrl: string;
  /** Optional auth. Omit for public sources (PA, CA). */
  auth?: AuthConfig;
  /** Marks the default source when a tool is called without an explicit source. */
  isDefault?: boolean;
}

/** Normalized search parameters accepted by {@link ICommonGrantsClient}. */
export interface SearchParams {
  query?: string;
  statuses?: string[];
  page?: number;
  pageSize?: number;
}

/**
 * The MCP server depends only on this interface, never on @common-grants/sdk
 * directly. This isolates SDK upgrades to one implementation file and leaves
 * room to add retries, caching, or pagination helpers later.
 */
export interface ICommonGrantsClient {
  readonly name: string;
  readonly label: string;
  searchOpportunities(params: SearchParams): Promise<SearchResult>;
  getOpportunity(id: string): Promise<Opportunity>;
}
