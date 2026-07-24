import type { Client } from '@common-grants/sdk/client';
import type { Plugin } from '@common-grants/sdk/extensions';

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
 * As of @common-grants/sdk@0.6: 'open' | 'forecasted' | 'closed' | 'custom'.
 */
export type OpportunityStatus = NonNullable<SearchArgs['statuses']>[number];

/** How to authenticate to a source. Most CommonGrants sources need no auth. */
export type AuthConfig =
  | { type: 'none' }
  | { type: 'apiKey'; key?: string; header?: string }
  | { type: 'bearer'; token?: string };

/**
 * The plugin behavior needed by a configured source.
 *
 * A concrete plugin's inferred schemas are intentionally more specific than
 * the SDK's default `Plugin` generic, so storing it as `Plugin` would reject
 * valid plugins. Erasing only the client result preserves the configuration
 * contract while allowing any `definePlugin()` result.
 */
export interface SourcePlugin {
  getClient(config?: Parameters<Plugin['getClient']>[0]): {
    opportunities: unknown;
  };
}

/** A single CommonGrants-compliant API the server can query. */
export interface SourceConfig {
  /** Short, stable id used in tool arguments, e.g. "federal". */
  name: string;
  /** Human-readable label shown in results, e.g. "Federal (Simpler.Grants.gov)". */
  label: string;
  /** Base URL of the CommonGrants API. The SDK appends /common-grants/... paths. */
  baseUrl: string;
  /** Optional stable provider-page prefix; the opportunity ID is appended to it. */
  opportunityPageBaseUrl?: string;
  /** Optional auth. Omit for public sources (PA, CA). */
  auth?: AuthConfig;
  /** Plugin that extends parsing and search behavior for this source. */
  plugin?: SourcePlugin;
  /**
   * Reserved for possible default-source behavior. Current tools do not read
   * this value: search without a source fans out, and retrieval requires one.
   */
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
 * MCP network operations depend on this interface rather than the SDK client
 * directly. Client construction and calls stay in one implementation, while
 * tool contracts may import SDK schemas and extensions.
 */
export interface ICommonGrantsClient {
  readonly name: string;
  readonly label: string;
  readonly opportunityPageBaseUrl?: string;
  searchOpportunities(params: SearchParams): Promise<SearchResult>;
  getOpportunity(id: string): Promise<Opportunity>;
}
