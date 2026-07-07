/**
 * Remote (Cloudflare Workers) entrypoint — the hosted, Streamable-HTTP MCP
 * server submitted to the Claude Connectors Directory and OpenAI Apps SDK.
 *
 * ── PHASE 2 STUB ───────────────────────────────────────────────────────────
 * This is intentionally not wired up yet. The plan (docs/adr/002) is to serve
 * the same `createServer()` from src/core over Streamable HTTP using
 * Cloudflare's McpAgent (from the `agents` package, Durable Objects-backed)
 * rather than the MCP SDK's Node-only StreamableHTTPServerTransport.
 *
 * When implementing:
 *   1. `pnpm add agents`
 *   2. Uncomment the durable_objects + migrations blocks in wrangler.jsonc.
 *   3. Extend McpAgent, register tools via the shared core, and route
 *      /mcp (Streamable HTTP) and /sse (legacy) in fetch().
 *   4. Read source config from env/vars; set FEDERAL_API_TOKEN with
 *      `wrangler secret put`. No per-user OAuth is needed — grant search is
 *      public, read-only data, so a single server-side key suffices.
 *
 * Because grant search touches only public data, the marketplace listing needs
 * no user auth; users just connect the URL. Per-user keys / custom sources are
 * a self-hosted (stdio) feature.
 *
 * See the `agents-sdk` / `cloudflare` skills for the current McpAgent API.
 */

interface Env {
  FEDERAL_API_TOKEN?: string;
}

export default {
  async fetch(_request: Request, _env: Env): Promise<Response> {
    return new Response(
      'CommonGrants MCP remote server is not implemented yet (Phase 2). ' +
        'Use the stdio server (src/stdio.ts) for now.',
      { status: 501, headers: { 'content-type': 'text/plain' } },
    );
  },
};
