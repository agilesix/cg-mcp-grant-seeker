#!/usr/bin/env node
/**
 * Local (stdio) entrypoint. This is what runs when a user adds the server to
 * Claude Desktop or any stdio MCP client, and what `pnpm run dev` launches.
 *
 * It loads the source registry (a user config file if present, otherwise the
 * built-in federal/pa/ca defaults with FEDERAL_API_TOKEN from the env), builds
 * the transport-agnostic server, and connects it over stdio.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config/index.js';
import { createServer } from './core/index.js';

async function main(): Promise<void> {
  const config = await loadConfig();
  const server = createServer(config.sources, { grantResultsView: false });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  // stdout is reserved for the MCP protocol; log diagnostics to stderr.
  console.error('Failed to start CommonGrants MCP server:', err);
  process.exit(1);
});
