// Public surface of the transport-agnostic core.
export { createServer, SERVER_INFO } from './server.js';
export { registerTools } from './tools.js';
export { createClients, SdkCommonGrantsClient } from './client.js';
export type {
  AuthConfig,
  ICommonGrantsClient,
  Opportunity,
  OpportunityStatus,
  SearchParams,
  SearchResult,
  SourceConfig,
} from './types.js';
