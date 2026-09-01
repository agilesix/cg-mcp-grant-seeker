import { McpServer as SkybridgeMcpServer } from 'skybridge/server';
import { createClients } from '../../../core/client.js';
import { SERVER_INFO } from '../../../core/server.js';
import { registerTools } from '../../../core/tools.js';
import type { CoreToolRegistrar } from '../../../core/tools.js';
import type { SourceConfig } from '../../../core/types.js';
import type { z } from 'zod3';
import { registerSkybridgeAppTools } from './register-app-tools.js';

export const APP_SERVER_INSTRUCTIONS = [
  'Use the grant discovery tools efficiently to research and evaluate opportunities.',
  'For a shortlist request, start with one targeted search_opportunities call using a limit large enough for the requested shortlist; omitting source already searches every configured source in parallel.',
  'A successful search result preserves every field returned by the provider and is normally sufficient to rank candidates.',
  'Do not repeat near-synonym searches, paginate, or broaden the query unless the first search returns too few relevant candidates or the user requests exhaustive research.',
  'Do not call get_opportunity merely to prepare a shortlist: present_opportunity_shortlist retrieves every selected opportunity in full.',
  'Use get_opportunity only when answering a detail question about one opportunity or when a search result lacks information required to decide whether it belongs in the shortlist.',
  'When completed research produces one or more recommended opportunities, automatically call present_opportunity_shortlist with the final ranked candidates.',
  'Do not wait for the user to request the shortlist or offer it as a separate optional step.',
  'The host may ask the user for permission to run the presentation tool; that approval flow is sufficient and should not prevent the call.',
  'Call the presentation tool once per completed shortlist revision and do not duplicate a successfully presented shortlist in full prose.',
  'If the presentation tool is denied or fails, provide a concise plain-text shortlist instead.',
].join(' ');

/**
 * Adapts Skybridge's definition-object signature to the minimal registration
 * capability required by the shared tools.
 */
function coreRegistrationAdapter(server: SkybridgeMcpServer): CoreToolRegistrar {
  const register = server.registerTool.bind(server) as unknown as (
    definition: Record<string, unknown>,
    handler: (input: unknown) => Promise<unknown>,
  ) => void;

  return <TInputSchema extends z.ZodRawShape>(
    name: string,
    definition: Record<string, unknown> & { inputSchema: TInputSchema },
    handler: (input: z.output<z.ZodObject<TInputSchema>>) => Promise<unknown>,
  ) => {
    // Skybridge uses the same schema-driven handler contract but places the
    // tool name inside its definition object. Keep that signature translation
    // and its unavoidable framework cast inside this adapter.
    register(
      { name, ...definition } as never,
      handler as unknown as (input: unknown) => Promise<unknown>,
    );
  };
}

/**
 * Builds the HTTP/MCP Apps host around the unchanged headless core tools.
 * App-only tools and views are registered here in later layers.
 */
export function createAppServer(sources: SourceConfig[]): SkybridgeMcpServer {
  const server = new SkybridgeMcpServer(SERVER_INFO, {
    instructions: APP_SERVER_INSTRUCTIONS,
  });
  const clients = createClients(sources);
  registerTools(coreRegistrationAdapter(server), clients);
  registerSkybridgeAppTools(server, clients);
  return server;
}
