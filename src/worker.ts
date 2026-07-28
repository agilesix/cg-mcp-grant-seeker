/**
 * Remote (Cloudflare Workers) entrypoint — the hosted, Streamable-HTTP MCP
 * server that will be submitted to the Claude Connectors Directory and the
 * OpenAI Apps SDK.
 *
 * Transport: the MCP SDK's Web-standard Streamable HTTP transport
 * (`WebStandardStreamableHTTPServerTransport`), which runs natively on the
 * Workers `fetch(Request) -> Response` model. We run it **stateless**
 * (`sessionIdGenerator: undefined`) with JSON responses, which fits this
 * server exactly: every tool is read-only and public, so there is no session
 * state, no server-initiated streaming, and no per-user auth.
 *
 * Statelessness requires a fresh server + transport per request (the SDK
 * throws if a stateless transport is reused). Because the server Protocol does
 * not gate on prior initialization, each self-contained POST is handled
 * correctly.
 *
 * If we later add applications functionality (mutations, per-consumer state,
 * authN/Z), the contained upgrade is to Cloudflare's McpAgent (Durable
 * Objects): add the `agents` dep, move this into an McpAgent subclass whose
 * `init()` calls the same `createServer()` wiring, and add a DO binding +
 * migration to wrangler.jsonc. The tools in src/core stay unchanged.
 */
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createServer } from './core/index.js';
import { defaultSources } from './config/defaults.js';

interface WorkerEnv {
  /** Server-side Simpler.Grants.gov API key (a secret; set via `wrangler secret put`). */
  FEDERAL_API_TOKEN?: string;
}

const MCP_PATH = '/mcp';

// CORS for browser-based MCP clients (the MCP Inspector, OpenAI's web client).
// Server-side clients (Claude via mcp-remote) don't need it, but it's harmless.
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
  'Access-Control-Max-Age': '86400',
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
}

async function handleMcp(request: Request, env: WorkerEnv): Promise<Response> {
  // Fresh server + transport per request (required in stateless mode).
  const server = createServer(defaultSources(env.FEDERAL_API_TOKEN), {
    grantResultsView: false,
  });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response('CommonGrants MCP server is running. Connect an MCP client to /mcp.', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      });
    }

    if (url.pathname === MCP_PATH) {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }
      if (request.method !== 'POST') {
        // Stateless server: no sessions and no server-initiated messages, so
        // GET (standalone SSE stream) and DELETE (session teardown) have
        // nothing to do. Clients treat 405 as "no server push" and fall back.
        return withCors(
          new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32601, message: 'Method not allowed. POST JSON-RPC to /mcp.' },
              id: null,
            }),
            {
              status: 405,
              headers: { 'content-type': 'application/json', allow: 'POST, OPTIONS' },
            },
          ),
        );
      }
      return withCors(await handleMcp(request, env));
    }

    return new Response('Not found', { status: 404 });
  },
};
