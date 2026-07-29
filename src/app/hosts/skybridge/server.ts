import { McpServer as SkybridgeMcpServer } from 'skybridge/server';
import { createClients } from '../../../core/client.js';
import { SERVER_INFO } from '../../../core/server.js';
import { registerTools } from '../../../core/tools.js';
import type { CoreToolRegistrar } from '../../../core/tools.js';
import type { SourceConfig } from '../../../core/types.js';
import type { z } from 'zod3';

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
  const server = new SkybridgeMcpServer(SERVER_INFO, {});
  registerTools(coreRegistrationAdapter(server), createClients(sources));
  return server;
}
