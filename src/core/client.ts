import { Auth, Client } from '@common-grants/sdk/client';
import type {
  AuthConfig,
  ICommonGrantsClient,
  Opportunity,
  SearchParams,
  SearchResult,
  SourceConfig,
} from './types.js';

type SdkSearchArgs = NonNullable<Parameters<Client['opportunities']['search']>[0]>;

function buildAuth(auth: AuthConfig | undefined) {
  switch (auth?.type) {
    case 'apiKey':
      // Auth.apiKey sends the key as the `X-API-Key` header by default; pass a
      // custom header name via `auth.header` if a source expects a different one.
      return auth.key ? Auth.apiKey(auth.key, auth.header) : undefined;
    case 'bearer':
      return auth.token ? Auth.bearer(auth.token) : undefined;
    default:
      return undefined;
  }
}

/**
 * The default {@link ICommonGrantsClient}, backed by @common-grants/sdk.
 * All SDK coupling lives here.
 */
export class SdkCommonGrantsClient implements ICommonGrantsClient {
  readonly name: string;
  readonly label: string;
  private readonly opportunities: {
    search(args: SdkSearchArgs): Promise<SearchResult>;
    get(id: string): Promise<Opportunity>;
  };

  constructor(source: SourceConfig) {
    this.name = source.name;
    this.label = source.label;
    const config = { baseUrl: source.baseUrl, auth: buildAuth(source.auth) };
    const client = source.plugin ? source.plugin.getClient(config) : new Client(config);
    this.opportunities = client.opportunities as typeof this.opportunities;
  }

  searchOpportunities(params: SearchParams): Promise<SearchResult> {
    const { query, statuses, page = 1, pageSize } = params;
    // Pass page/pageSize explicitly: search() auto-paginates up to maxItems
    // (default 1000) when they're omitted, which would fetch every result.
    return this.opportunities.search({
      query,
      // Values are validated to the SDK's status enum at the tool boundary.
      statuses: statuses as unknown as SdkSearchArgs['statuses'],
      page,
      pageSize,
      // Preserve the SDK 0.5 fail-fast contract. SDK 0.6 otherwise collects
      // malformed rows in result.errors, which this generic MCP client does
      // not yet expose.
      onParseError: 'throw',
    });
  }

  getOpportunity(id: string): Promise<Opportunity> {
    return this.opportunities.get(id);
  }
}

/** Builds one client per configured source, preserving order. */
export function createClients(sources: SourceConfig[]): ICommonGrantsClient[] {
  return sources.map((source) => new SdkCommonGrantsClient(source));
}
