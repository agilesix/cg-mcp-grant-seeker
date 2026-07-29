import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createClients } from './client.js';
import { registerTools } from './tools.js';
import type { CoreToolRegistrar } from './tools.js';
import type { ICommonGrantsClient, SourceConfig } from './types.js';

export const SERVER_INFO = {
  name: 'commongrants-grant-seeker',
  version: '0.1.0',
} as const;

/**
 * Builds the standard, transport-agnostic McpServer used by the stdio
 * entrypoint. Hosted app runtimes reuse the same clients and tool-registration
 * capability through their localized host adapter.
 */
export function createServer(sources: SourceConfig[]): McpServer {
  const clients: ICommonGrantsClient[] = createClients(sources);
  const server = new McpServer(SERVER_INFO);
  const registerTool = server.registerTool.bind(server) as unknown as CoreToolRegistrar;
  registerTools(registerTool, clients);
  return server;
}
