import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createClients } from './client.js';
import { registerTools } from './tools.js';
import type { ICommonGrantsClient, SourceConfig } from './types.js';

export const SERVER_INFO = {
  name: 'commongrants-grant-seeker',
  version: '0.1.0',
} as const;

/**
 * Builds a fully-wired McpServer from a list of sources. Transport-agnostic:
 * the stdio entrypoint and the remote Worker both call this, then connect it
 * to their respective transport.
 */
export function createServer(sources: SourceConfig[]): McpServer {
  const clients: ICommonGrantsClient[] = createClients(sources);
  const server = new McpServer(SERVER_INFO);
  registerTools(server, clients);
  return server;
}
