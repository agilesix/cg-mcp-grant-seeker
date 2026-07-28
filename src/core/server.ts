import { McpServer } from 'skybridge/server';
import { createClients } from './client.js';
import { registerTools } from './tools.js';
import type { ICommonGrantsClient, SourceConfig } from './types.js';

export const SERVER_INFO = {
  name: 'commongrants-grant-seeker',
  version: '0.1.0',
} as const;

/**
 * Controls host-specific additions without changing the core tool contracts.
 */
export interface ServerBuildOptions {
  grantResultsView?: boolean;
}

/**
 * Builds a fully-wired Skybridge McpServer from a list of sources. The stdio
 * entrypoint disables the view; the HTTP app enables it.
 */
export function createServer(
  sources: SourceConfig[],
  { grantResultsView = true }: ServerBuildOptions = {},
): McpServer {
  const clients: ICommonGrantsClient[] = createClients(sources);
  const server = new McpServer(SERVER_INFO, {});
  registerTools(server, clients, { grantResultsView });
  return server;
}
